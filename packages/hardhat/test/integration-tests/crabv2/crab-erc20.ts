import { ethers } from "hardhat"
import { expect } from "chai";
import { Contract, BigNumber, providers } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import BigNumberJs from 'bignumber.js'
import { WETH9, MockErc20, Controller, Oracle, WPowerPerp, CrabStrategyV2, ISwapRouter, MockTimelock } from "../../../typechain";
import { deployUniswapV3, deploySqueethCoreContracts, deployWETHAndDai, addWethDaiLiquidity, addSqueethLiquidity } from '../../setup'
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

  let provider: providers.JsonRpcProvider;
  let owner: SignerWithAddress;
  let depositor: SignerWithAddress;
  let depositor2: SignerWithAddress;
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
  let wSqueeth: WPowerPerp
  let crabStrategy: CrabStrategyV2
  let ethDaiPool: Contract
  let timelock: MockTimelock;

  this.beforeAll("Deploy uniswap protocol & setup uniswap pool", async () => {
    const accounts = await ethers.getSigners();
    const [_owner, _depositor, _depositor2, _liquidator, _feeRecipient] = accounts;
    owner = _owner;
    depositor = _depositor;
    depositor2 = _depositor2;
    liquidator = _liquidator;
    feeRecipient = _feeRecipient;
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

    await controller.connect(owner).setFeeRecipient(feeRecipient.address);
    await controller.connect(owner).setFeeRate(100)

    const TimelockContract = await ethers.getContractFactory("MockTimelock");
    timelock = (await TimelockContract.deploy(owner.address, 3 * 24 * 60 * 60)) as MockTimelock;

    const CrabStrategyContract = await ethers.getContractFactory("CrabStrategyV2");
    crabStrategy = (await CrabStrategyContract.deploy(controller.address, oracle.address, weth.address, uniswapFactory.address, wSqueethPool.address, timelock.address, swapRouter.address, hedgeTimeThreshold, hedgePriceThreshold, auctionTime, minPriceMultiplier, maxPriceMultiplier)) as CrabStrategyV2;

    const strategyCap = ethers.utils.parseUnits("1000")
    await crabStrategy.connect(owner).setStrategyCap(strategyCap)
    const strategyCapInContract = await crabStrategy.strategyCap()
    expect(strategyCapInContract.eq(strategyCap)).to.be.true
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
  })

  this.beforeAll("Deposit into strategy", async () => {
    const ethToDeposit = ethers.utils.parseUnits('20')
    const msgvalue = ethers.utils.parseUnits('10.2')
    const depositorSqueethBalanceBefore = await wSqueeth.balanceOf(depositor.address)

    await crabStrategy.connect(depositor).flashDeposit(ethToDeposit, { value: msgvalue })

    const currentScaledSquethPrice = (await oracle.getTwap(wSqueethPool.address, wSqueeth.address, weth.address, 300, false))
    const feeRate = await controller.feeRate()
    const ethFeePerWSqueeth = currentScaledSquethPrice.mul(feeRate).div(10000)
    const squeethDelta = scaledStartingSqueethPrice1e18.mul(2);
    const debtToMint = wdiv(ethToDeposit, (squeethDelta.add(ethFeePerWSqueeth)));
    const expectedEthDeposit = ethToDeposit.sub(debtToMint.mul(ethFeePerWSqueeth).div(one))

    const totalSupply = (await crabStrategy.totalSupply())
    const depositorCrab = (await crabStrategy.balanceOf(depositor.address))
    const strategyVault = await controller.vaults(await crabStrategy.vaultId());
    const debtAmount = strategyVault.shortAmount
    const depositorSqueethBalance = await wSqueeth.balanceOf(depositor.address)
    const strategyContractSqueeth = await wSqueeth.balanceOf(crabStrategy.address)
    const lastHedgeTime = await crabStrategy.timeAtLastHedge()
    const currentBlockNumber = await provider.getBlockNumber()
    const currentBlock = await provider.getBlock(currentBlockNumber)
    const timeStamp = currentBlock.timestamp
    const collateralAmount = await strategyVault.collateralAmount

    expect(isSimilar(totalSupply.toString(), (expectedEthDeposit).toString())).to.be.true
    expect(isSimilar(depositorCrab.toString(), expectedEthDeposit.toString())).to.be.true
    expect(isSimilar(debtAmount.toString(), debtToMint.toString())).to.be.true
    expect(depositorSqueethBalance.eq(depositorSqueethBalanceBefore)).to.be.true
    expect(strategyContractSqueeth.eq(BigNumber.from(0))).to.be.true
    expect(lastHedgeTime.eq(timeStamp)).to.be.true
  })

  describe("Deposit USDC into strategy", async () => {
    const usdcAmount = startingEthPrice1e18
    const ethToDeposit = ethers.utils.parseUnits('1.5')

    beforeEach(async () => {
      await dai.mint(depositor2.address, usdcAmount.toString())
      await dai.connect(depositor2).approve(crabStrategy.address, usdcAmount.toString())
    })

    it("Should fail if it minimum ETH is not swapped in ERC20 transfer", async () => {
      await expect(crabStrategy.connect(depositor2).flashDepositERC20(ethToDeposit, usdcAmount, ethers.utils.parseEther('1'), 3000, dai.address)).to.be.revertedWith("Too little received")
    })

    it("Should deposit USDC into strategy", async () => {
      const usdcBalanceBefore = await dai.balanceOf(depositor2.address)

      await expect(crabStrategy.connect(depositor2).flashDepositERC20(ethToDeposit, usdcAmount, 0, 3000, dai.address)).to.emit(crabStrategy, "FlashDepositERC20")
      const usdcBalanceAfter = await dai.balanceOf(depositor2.address)
      expect(usdcBalanceBefore.sub(usdcAmount)).to.be.equal(usdcBalanceAfter)
    })
  })
})
