import { ethers } from "hardhat"
import { expect } from "chai";
import { Contract, BigNumber, providers } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import BigNumberJs from 'bignumber.js'
import { WETH9, MockErc20, Controller, Oracle, WPowerPerp, CrabStrategyV2, ISwapRouter, Timelock, CrabHelper } from "../../../typechain";
import { deployUniswapV3, deploySqueethCoreContracts, deployWETHAndDai, addWethDaiLiquidity, addSqueethLiquidity, createUniPool } from '../../setup'
import { isSimilar, wmul, wdiv, one, oracleScaleFactor } from "../../utils"

BigNumberJs.set({ EXPONENTIAL_AT: 30 })

describe("Crab V2 integration test: ERC20 deposit and withdrawals", function () {
  const startingEthPrice = 3000
  const startingEthPrice1e18 = BigNumber.from(startingEthPrice).mul(one) // 3000 * 1e18
  const scaledStartingSqueethPrice1e18 = startingEthPrice1e18.mul(11).div(10).div(oracleScaleFactor) // 0.3 * 1e18
  const scaledStartingSqueethPrice = startingEthPrice * 1.1 / oracleScaleFactor.toNumber() // 0.3


  const hedgeTimeThreshold = 86400  // 24h
  const hedgePriceThreshold = ethers.utils.parseUnits('0.01')
  const auctionTime = 3600
  const minPriceMultiplier = ethers.utils.parseUnits('0.95')
  const maxPriceMultiplier = ethers.utils.parseUnits('1.05')
  let poolFee: BigNumber;
  let poolFeePool2: BigNumber

  let provider: providers.JsonRpcProvider;
  let owner: SignerWithAddress;
  let depositor: SignerWithAddress;
  let depositor2: SignerWithAddress;
  let crabMigration: SignerWithAddress;
  let liquidator: SignerWithAddress;
  let feeRecipient: SignerWithAddress;
  let dai: MockErc20
  let weth: WETH9
  let positionManager: Contract
  let uniswapFactory: Contract
  let swapRouter: Contract
  let oracle: Oracle
  let controller: Controller
  let wSqueethPool: Contract
  let wSqueethPool2: Contract
  let wSqueeth: WPowerPerp
  let crabStrategy: CrabStrategyV2
  let ethDaiPool: Contract
  let timelock: Timelock;
  let crabHelper: CrabHelper;

  this.beforeAll("Deploy uniswap protocol & setup uniswap pool", async () => {
    const accounts = await ethers.getSigners();
    const [_owner, _depositor, _depositor2, _liquidator, _feeRecipient, _crabMigration] = accounts;
    owner = _owner;
    depositor = _depositor;
    depositor2 = _depositor2;
    liquidator = _liquidator;
    feeRecipient = _feeRecipient;
    crabMigration = _crabMigration;
    provider = ethers.provider

    const { dai: daiToken, weth: wethToken } = await deployWETHAndDai()

    dai = daiToken
    weth = wethToken

    const uniDeployments = await deployUniswapV3(weth)
    positionManager = uniDeployments.positionManager
    uniswapFactory = uniDeployments.uniswapFactory
    swapRouter = uniDeployments.swapRouter

    // this will not deploy a new pool, only reuse old onces
    const squeethDeployments = await deploySqueethCoreContracts(
      weth,
      dai,
      positionManager,
      uniswapFactory,
      scaledStartingSqueethPrice,
      startingEthPrice
    )
    controller = squeethDeployments.controller
    wSqueeth = squeethDeployments.wsqueeth
    oracle = squeethDeployments.oracle
    // shortSqueeth = squeethDeployments.shortSqueeth
    wSqueethPool = squeethDeployments.wsqueethEthPool
    ethDaiPool = squeethDeployments.ethDaiPool

    wSqueethPool2 = await createUniPool(scaledStartingSqueethPrice, weth, wSqueeth, positionManager, uniswapFactory, 10000) as Contract
    await wSqueethPool2.increaseObservationCardinalityNext(500) 
  
    poolFee = await wSqueethPool.fee()
    poolFeePool2 = await wSqueethPool2.fee()


    await controller.connect(owner).setFeeRecipient(feeRecipient.address);
    await controller.connect(owner).setFeeRate(100)

    const TimelockContract = await ethers.getContractFactory("Timelock");
    timelock = (await TimelockContract.deploy(owner.address, 3 * 24 * 60 * 60)) as Timelock;

    const CrabStrategyContract = await ethers.getContractFactory("CrabStrategyV2");
    crabStrategy = (await CrabStrategyContract.deploy(controller.address, oracle.address, weth.address, uniswapFactory.address, wSqueethPool.address, timelock.address, crabMigration.address, hedgeTimeThreshold, hedgePriceThreshold)) as CrabStrategyV2;
  })

  this.beforeAll("Seed pool liquidity", async () => {
    await provider.send("evm_increaseTime", [300])
    await provider.send("evm_mine", [])

    // add liquidity
    await addWethDaiLiquidity(
      startingEthPrice,
      ethers.utils.parseUnits('100'), // eth amount
      owner.address,
      dai,
      weth,
      positionManager
    )

    await provider.send("evm_increaseTime", [600])
    await provider.send("evm_mine", [])

    await addSqueethLiquidity(
      scaledStartingSqueethPrice,
      '1000000',
      '2000000',
      owner.address,
      wSqueeth,
      weth,
      positionManager,
      controller
    )

    await provider.send("evm_increaseTime", [600])
    await provider.send("evm_mine", [])

    await addSqueethLiquidity(
      scaledStartingSqueethPrice,
      '1000000',
      '2000000',
      owner.address,
      wSqueeth,
      weth,
      positionManager,
      controller,
      10000
    )

    await provider.send("evm_increaseTime", [600])
    await provider.send("evm_mine", [])

  })

  this.beforeAll("Deploy Crab Helper", async () => {
    const CrabHelperContract = await ethers.getContractFactory("CrabHelper");
    crabHelper = (await CrabHelperContract.deploy(crabStrategy.address, swapRouter.address)) as CrabHelper;
  })

  this.beforeAll("Initialize strategy", async () => {
    const ethToDeposit = ethers.utils.parseUnits("20");

    const normFactor = await controller.normalizationFactor();
    const currentScaledSquethPrice = await oracle.getTwap(
        wSqueethPool.address,
        wSqueeth.address,
        weth.address,
        300,
        false
    );
    const feeRate = await controller.feeRate();
    const ethFeePerWSqueeth = currentScaledSquethPrice.mul(feeRate).div(10000);
    const squeethDelta = scaledStartingSqueethPrice1e18.mul(2); // .66*10^18
    const debtToMint = wdiv(ethToDeposit, squeethDelta.add(ethFeePerWSqueeth));
    const expectedEthDeposit = ethToDeposit.sub(debtToMint.mul(ethFeePerWSqueeth).div(one));

    const strategyCap = ethers.utils.parseUnits("1000")

    await crabStrategy.connect(crabMigration).initialize(debtToMint, expectedEthDeposit, 1, 1, strategyCap, { value: ethToDeposit });
    const strategyCapInContract = await crabStrategy.strategyCap()
    expect(strategyCapInContract.eq(strategyCap)).to.be.true

});

  describe("Deposit USDC into strategy", async () => {
    const usdcAmount = startingEthPrice1e18
    const ethToDeposit = ethers.utils.parseUnits('1.5')

    beforeEach(async () => {
      await dai.mint(depositor2.address, usdcAmount.toString())
      await dai.connect(depositor2).approve(crabHelper.address, usdcAmount.toString())
    })

    it("Should fail if it minimum ETH is not swapped in ERC20 transfer", async () => {
      await expect(crabHelper.connect(depositor2).flashDepositERC20(ethToDeposit, usdcAmount, ethers.utils.parseEther('1'), 3000, poolFee, dai.address)).to.be.revertedWith("Too little received")
    })

    it("Should deposit USDC into strategy", async () => {
      const usdcBalanceBefore = await dai.balanceOf(depositor2.address)
      const crabBalanceBefore = await crabStrategy.balanceOf(depositor2.address)

      await expect(crabHelper.connect(depositor2).flashDepositERC20(ethToDeposit, usdcAmount, 0, 3000, poolFee, dai.address)).to.emit(crabHelper, "FlashDepositERC20")

      const usdcBalanceAfter = await dai.balanceOf(depositor2.address)
      const crabBalanceAfter = await crabStrategy.balanceOf(depositor2.address)

      expect(usdcBalanceBefore.sub(usdcAmount)).to.be.equal(usdcBalanceAfter)
      expect(crabBalanceAfter.gt(crabBalanceBefore)).to.be.true
    })
  })

  describe("Withdraw USDC from strategy", async () => {
    const usdcAmount = startingEthPrice1e18
    const ethToDeposit = ethers.utils.parseUnits('1.5')
    let crabBalance = BigNumber.from(0)

    beforeEach("Deposit into strategy", async () => {
      await dai.mint(depositor2.address, usdcAmount.toString())
      await dai.connect(depositor2).approve(crabHelper.address, usdcAmount.toString())
      await crabHelper.connect(depositor2).flashDepositERC20(ethToDeposit, usdcAmount, 0, 3000, poolFee, dai.address)
      crabBalance = await crabStrategy.balanceOf(depositor2.address)
    })

    afterEach("Clean up deposit", async () => {
      const _crb = await crabStrategy.balanceOf(depositor2.address)
      if (_crb.gt(0)) {
        await crabStrategy.connect(depositor2).flashWithdraw(_crb, ethToDeposit, poolFee)
      }
    })

    it("Should fail if it minimum USDC out is not swapped in ERC20 transfer", async () => {
      await crabStrategy.connect(depositor2).approve(crabHelper.address, crabBalance)
      await expect(crabHelper.connect(depositor2).flashWithdrawERC20(crabBalance, ethToDeposit, dai.address, usdcAmount.mul(2), 3000, poolFee)).to.be.revertedWith("Too little received")
    })

    it("Should withdraw USDC from strategy", async () => {
      const usdcBalanceBefore = await dai.balanceOf(depositor2.address)

      const minUsdToGet = usdcAmount.div(2)
      await expect(crabHelper.connect(depositor2).flashWithdrawERC20(crabBalance, ethToDeposit.mul(2), dai.address, minUsdToGet, 3000, poolFee)).to.emit(crabHelper, "FlashWithdrawERC20")

      const usdcBalanceAfter = await dai.balanceOf(depositor2.address)
      const crabBalanceAfter = await crabStrategy.balanceOf(depositor2.address)

      expect(usdcBalanceAfter.gte(usdcBalanceBefore.add(minUsdToGet))).to.be.true
      expect(crabBalanceAfter).to.be.equal("0")
    })
  })

  describe("Deposit USDC into strategy in 1% pool", async () => {
    const usdcAmount = startingEthPrice1e18
    const ethToDeposit = ethers.utils.parseUnits('1.5')

    beforeEach(async () => {
      await dai.mint(depositor2.address, usdcAmount.toString())
      await dai.connect(depositor2).approve(crabHelper.address, usdcAmount.toString())
    })

    it("Should fail if it minimum ETH is not swapped in ERC20 transfer", async () => {
      await expect(crabHelper.connect(depositor2).flashDepositERC20(ethToDeposit, usdcAmount, ethers.utils.parseEther('1'), 3000, poolFeePool2, dai.address)).to.be.revertedWith("Too little received")
    })

    it("Should deposit USDC into strategy", async () => {
      const usdcBalanceBefore = await dai.balanceOf(depositor2.address)
      const crabBalanceBefore = await crabStrategy.balanceOf(depositor2.address)

      await expect(crabHelper.connect(depositor2).flashDepositERC20(ethToDeposit, usdcAmount, 0, 3000, poolFeePool2, dai.address)).to.emit(crabHelper, "FlashDepositERC20")

      const usdcBalanceAfter = await dai.balanceOf(depositor2.address)
      const crabBalanceAfter = await crabStrategy.balanceOf(depositor2.address)

      expect(usdcBalanceBefore.sub(usdcAmount)).to.be.equal(usdcBalanceAfter)
      expect(crabBalanceAfter.gt(crabBalanceBefore)).to.be.true
    })
  })

  describe("Withdraw USDC from strategy in 1%", async () => {
    const usdcAmount = startingEthPrice1e18
    const ethToDeposit = ethers.utils.parseUnits('1.5')
    let crabBalance = BigNumber.from(0)

    beforeEach("Deposit into strategy", async () => {
      await dai.mint(depositor2.address, usdcAmount.toString())
      await dai.connect(depositor2).approve(crabHelper.address, usdcAmount.toString())
      await crabHelper.connect(depositor2).flashDepositERC20(ethToDeposit, usdcAmount, 0, 3000, poolFeePool2, dai.address)
      crabBalance = await crabStrategy.balanceOf(depositor2.address)
    })

    afterEach("Clean up deposit", async () => {
      const _crb = await crabStrategy.balanceOf(depositor2.address)
      if (_crb.gt(0)) {
        await crabStrategy.connect(depositor2).flashWithdraw(_crb, ethToDeposit.mul(102).div(100), poolFeePool2)
      }
    })

    it("Should fail if it minimum USDC out is not swapped in ERC20 transfer", async () => {
      await crabStrategy.connect(depositor2).approve(crabHelper.address, crabBalance)
      await expect(crabHelper.connect(depositor2).flashWithdrawERC20(crabBalance, ethToDeposit.mul(102).div(100), dai.address, usdcAmount.mul(2), 3000, poolFeePool2)).to.be.revertedWith("Too little received")
    })

    it("Should withdraw USDC from strategy", async () => {
      const usdcBalanceBefore = await dai.balanceOf(depositor2.address)

      const minUsdToGet = usdcAmount.div(2)
      await expect(crabHelper.connect(depositor2).flashWithdrawERC20(crabBalance, ethToDeposit.mul(2), dai.address, minUsdToGet, 3000, poolFeePool2)).to.emit(crabHelper, "FlashWithdrawERC20")

      const usdcBalanceAfter = await dai.balanceOf(depositor2.address)
      const crabBalanceAfter = await crabStrategy.balanceOf(depositor2.address)

      expect(usdcBalanceAfter.gte(usdcBalanceBefore.add(minUsdToGet))).to.be.true
      expect(crabBalanceAfter).to.be.equal("0")
    })
  })
})