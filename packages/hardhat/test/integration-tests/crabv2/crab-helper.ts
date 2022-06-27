import { ethers, network } from "hardhat"
import { expect } from "chai";
import { Contract, BigNumber, providers } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import BigNumberJs from 'bignumber.js'
import { WETH9, MockErc20, Controller, Oracle, WPowerPerp, CrabStrategyV2, ISwapRouter, Timelock, CrabHelper, IWETH9 } from "../../../typechain";
import { deployUniswapV3, deploySqueethCoreContracts, deployWETHAndDai, addWethDaiLiquidity, addSqueethLiquidity, buyWeth, buyWSqueeth } from '../../setup'
import { isSimilar, wmul, wdiv, one, signTypedData, oracleScaleFactor } from "../../utils"

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

    await controller.connect(owner).setFeeRecipient(feeRecipient.address);
    await controller.connect(owner).setFeeRate(100)

    const TimelockContract = await ethers.getContractFactory("Timelock");
    timelock = (await TimelockContract.deploy(owner.address, 3 * 24 * 60 * 60)) as Timelock;

    const CrabStrategyContract = await ethers.getContractFactory("CrabStrategyV2");
    crabStrategy = (await CrabStrategyContract.deploy(controller.address, oracle.address, weth.address, uniswapFactory.address, wSqueethPool.address, timelock.address, crabMigration.address, hedgeTimeThreshold, hedgePriceThreshold)) as CrabStrategyV2;

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

    await crabStrategy.connect(crabMigration).initialize(debtToMint, expectedEthDeposit, 1, 1, { value: ethToDeposit });
});

  describe("Deposit USDC into strategy", async () => {
    const usdcAmount = startingEthPrice1e18
    const ethToDeposit = ethers.utils.parseUnits('1.5')

    beforeEach(async () => {
      await dai.mint(depositor2.address, usdcAmount.toString())
      await dai.connect(depositor2).approve(crabHelper.address, usdcAmount.toString())
    })

    it("Should fail if it minimum ETH is not swapped in ERC20 transfer", async () => {
      await expect(crabHelper.connect(depositor2).flashDepositERC20(ethToDeposit, usdcAmount, ethers.utils.parseEther('1'), 3000, dai.address)).to.be.revertedWith("Too little received")
    })

    it("Should deposit USDC into strategy", async () => {
      const usdcBalanceBefore = await dai.balanceOf(depositor2.address)
      const crabBalanceBefore = await crabStrategy.balanceOf(depositor2.address)

      await expect(crabHelper.connect(depositor2).flashDepositERC20(ethToDeposit, usdcAmount, 0, 3000, dai.address)).to.emit(crabHelper, "FlashDepositERC20")

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
      await crabHelper.connect(depositor2).flashDepositERC20(ethToDeposit, usdcAmount, 0, 3000, dai.address)
      crabBalance = await crabStrategy.balanceOf(depositor2.address)
    })

    afterEach("Clean up deposit", async () => {
      const _crb = await crabStrategy.balanceOf(depositor2.address)
      if (_crb.gt(0)) {
        await crabStrategy.connect(depositor2).flashWithdraw(_crb, ethToDeposit)
      }
    })

    it("Should fail if it minimum USDC out is not swapped in ERC20 transfer", async () => {
      await crabStrategy.connect(depositor2).approve(crabHelper.address, crabBalance)
      await expect(crabHelper.connect(depositor2).flashWithdrawERC20(crabBalance, ethToDeposit, dai.address, usdcAmount.mul(2), 3000)).to.be.revertedWith("Too little received")
    })

    it("Should withdraw USDC from strategy", async () => {
      const usdcBalanceBefore = await dai.balanceOf(depositor2.address)

      const minUsdToGet = usdcAmount.div(2)
      await expect(crabHelper.connect(depositor2).flashWithdrawERC20(crabBalance, ethToDeposit.mul(2), dai.address, minUsdToGet, 3000)).to.emit(crabHelper, "FlashWithdrawERC20")

      const usdcBalanceAfter = await dai.balanceOf(depositor2.address)
      const crabBalanceAfter = await crabStrategy.balanceOf(depositor2.address)

      expect(usdcBalanceAfter.gte(usdcBalanceBefore.add(minUsdToGet))).to.be.true
      expect(crabBalanceAfter).to.be.equal("0")
    })
  })


  describe("View functions to validate orders and hedge size", async () => {
    const usdcAmount = startingEthPrice1e18
    const ethToDeposit = ethers.utils.parseUnits('1.5')
    let crabBalance = BigNumber.from(0)

    const getTypeAndDomainData = () => {
      const typeData = {
          Order: [
              { type: "uint256", name: "bidId" },
              { type: "address", name: "trader" },
              { type: "uint256", name: "quantity" },
              { type: "uint256", name: "price" },
              { type: "bool", name: "isBuying" },
              { type: "uint256", name: "expiry" },
              { type: "uint256", name: "nonce" },
          ],
      };
      const domainData = {
          name: "CrabOTC",
          version: "2",
          chainId: network.config.chainId,
          verifyingContract: crabHelper.address,
      };
      return { typeData, domainData };
  };


  const getOSQTHPrice = () => oracle.getTwap(wSqueethPool.address, wSqueeth.address, weth.address, 600, false);
  const mintAndSell = async (toMint = "1000") => {
    const ethToDeposit = ethers.utils.parseUnits("1000");
    const wSqueethToMint = ethers.utils.parseUnits(toMint);
    const currentBlockTimestamp = (await provider.getBlock(await provider.getBlockNumber())).timestamp;
    await controller.connect(owner).mintWPowerPerpAmount("0", wSqueethToMint, "0", { value: ethToDeposit });
    await buyWeth(
        swapRouter,
        wSqueeth,
        weth,
        owner.address,
        await wSqueeth.balanceOf(owner.address),
        currentBlockTimestamp + 10
    );

    await provider.send("evm_increaseTime", [86400]);
    await provider.send("evm_mine", []);
};

const buyBackSqueeth = async (ethToSell= "100") => {
  const wethAmount = ethers.utils.parseUnits(ethToSell);
  await weth.connect(owner).deposit({ value: wethAmount})
  const currentBlockTimestamp = (await provider.getBlock(await provider.getBlockNumber())).timestamp;
  await buyWSqueeth(
    swapRouter,
    wSqueeth,
    weth,
    owner.address,
    wethAmount,
    currentBlockTimestamp + 10
);
await provider.send("evm_increaseTime", [86400]);
await provider.send("evm_mine", []);

};


  const delta = async (vault: any) => {
      // oSQTH price before
      const oSQTHPriceBefore = await getOSQTHPrice();
      const oSQTHdelta = wmul(vault.shortAmount.mul(2), oSQTHPriceBefore);
      const delta:BigNumber = vault.collateralAmount.sub(oSQTHdelta);
      return delta;
  };


    beforeEach("Deposit into strategy", async () => {
      await dai.mint(depositor2.address, usdcAmount.toString())
      await dai.connect(depositor2).approve(crabHelper.address, usdcAmount.toString())
      await crabHelper.connect(depositor2).flashDepositERC20(ethToDeposit, usdcAmount, 0, 3000, dai.address)
      crabBalance = await crabStrategy.balanceOf(depositor2.address)
    })

    afterEach("Clean up deposit", async () => {
      const _crb = await crabStrategy.balanceOf(depositor2.address)
      if (_crb.gt(0)) {
        await crabStrategy.connect(depositor2).flashWithdraw(_crb, ethToDeposit)
      }
    })


    it("Should revert order if wrong signer", async () => {

      // prepare the trade
      const orderHash = {
                bidId: 0,
                trader: depositor.address,
                quantity: ethers.utils.parseUnits("10"),
                price: ethers.utils.parseUnits("0.1"),
                isBuying: true,
                expiry: (await provider.getBlock(await provider.getBlockNumber())).timestamp + 600,
                nonce: await crabStrategy.nonces(depositor2.address)
            };
      const { typeData, domainData } = getTypeAndDomainData();
      const signedOrder = await signTypedData(depositor2, domainData, typeData, orderHash);
      await expect( crabHelper.verifyOrder(signedOrder)).to.be.revertedWith("Invalid offer signature")

    })

    it("Should revert order if expired", async () => {

      // prepare the trade
      const orderHash = {
                bidId: 0,
                trader: depositor2.address,
                quantity: ethers.utils.parseUnits("10"),
                price: ethers.utils.parseUnits("0.1"),
                isBuying: true,
                expiry: (await provider.getBlock(await provider.getBlockNumber())).timestamp - 10,
                nonce: await crabStrategy.nonces(depositor2.address)
            };
      const { typeData, domainData } = getTypeAndDomainData();
      const signedOrder = await signTypedData(depositor2, domainData, typeData, orderHash);
      await expect( crabHelper.verifyOrder(signedOrder)).to.be.revertedWith("Order has expired")

    })


    it("Should revert order if not enough weth balance", async () => {

      // prepare the trade
      const orderHash = {
                bidId: 0,
                trader: depositor2.address,
                quantity: ethers.utils.parseUnits("10"),
                price: ethers.utils.parseUnits("0.1"),
                isBuying: true,
                expiry: (await provider.getBlock(await provider.getBlockNumber())).timestamp + 600,
                nonce: await crabStrategy.nonces(depositor2.address)
            };

      const { typeData, domainData } = getTypeAndDomainData();
      const signedOrder = await signTypedData(depositor2, domainData, typeData, orderHash);
      await expect( crabHelper.verifyOrder(signedOrder)).to.be.revertedWith("Not enough weth balance for trade")

    })

    it("Should revert order if not enough weth allowance", async () => {
      await weth.connect(depositor2).deposit({ value: ethers.utils.parseUnits("1") });
      
      // prepare the trade
      const orderHash = {
                bidId: 0,
                trader: depositor2.address,
                quantity: ethers.utils.parseUnits("10"),
                price: ethers.utils.parseUnits("0.1"),
                isBuying: true,
                expiry: (await provider.getBlock(await provider.getBlockNumber())).timestamp + 600,
                nonce: await crabStrategy.nonces(depositor2.address)
            };

      const { typeData, domainData } = getTypeAndDomainData();
      const signedOrder = await signTypedData(depositor2, domainData, typeData, orderHash);
      await expect( crabHelper.verifyOrder(signedOrder)).to.be.revertedWith("Not enough weth allowance for trade")

    })

    it("Should revert order if not enough wPowerPerp balance", async () => {

      // prepare the trade
      const orderHash = {
                bidId: 0,
                trader: depositor2.address,
                quantity: ethers.utils.parseUnits("10"),
                price: ethers.utils.parseUnits("0.1"),
                isBuying: false,
                expiry: (await provider.getBlock(await provider.getBlockNumber())).timestamp + 600,
                nonce: await crabStrategy.nonces(depositor2.address)
            };

      const { typeData, domainData } = getTypeAndDomainData();
      const signedOrder = await signTypedData(depositor2, domainData, typeData, orderHash);
      await expect( crabHelper.verifyOrder(signedOrder)).to.be.revertedWith("Not enough wPowerPerp balance for trade")

    })

    it("Should revert order if not enough wPowerPerp allowance", async () => {
      await weth.connect(depositor2).approve(crabHelper.address, ethers.utils.parseUnits("10"))
      await controller.connect(depositor2).mintWPowerPerpAmount("0", ethers.utils.parseUnits("10"), "0", { value: ethers.utils.parseUnits("10") });
      // prepare the trade
      const orderHash = {
                bidId: 0,
                trader: depositor2.address,
                quantity: ethers.utils.parseUnits("10"),
                price: ethers.utils.parseUnits("0.1"),
                isBuying: false,
                expiry: (await provider.getBlock(await provider.getBlockNumber())).timestamp + 600,
                nonce: await crabStrategy.nonces(depositor2.address)
            };

      const { typeData, domainData } = getTypeAndDomainData();
      const signedOrder = await signTypedData(depositor2, domainData, typeData, orderHash);
      await expect( crabHelper.verifyOrder(signedOrder)).to.be.revertedWith("Not enough wPowerPerp allowance for trade")

    })

    it("Should verify valid sell order", async () => {
      await wSqueeth.connect(depositor2).approve(crabHelper.address, ethers.utils.parseUnits("10"))
      const orderHash = {
                bidId: 0,
                trader: depositor2.address,
                quantity: ethers.utils.parseUnits("10"),
                price: ethers.utils.parseUnits("0.1"),
                isBuying: false,
                expiry: (await provider.getBlock(await provider.getBlockNumber())).timestamp + 600,
                nonce: await crabStrategy.nonces(depositor2.address)
            };

      const { typeData, domainData } = getTypeAndDomainData();
      const signedOrder = await signTypedData(depositor2, domainData, typeData, orderHash);
    const validOrder = await crabHelper.verifyOrder(signedOrder)
    expect(validOrder).to.be.true

    })


    it("Should verify valid buy order", async () => {
      await weth.connect(depositor2).deposit({ value: ethers.utils.parseUnits("1") });
      await weth.connect(depositor2).approve(crabHelper.address, ethers.utils.parseUnits("1") ); 
      const orderHash = {
                bidId: 0,
                trader: depositor2.address,
                quantity: ethers.utils.parseUnits("10"),
                price: ethers.utils.parseUnits("0.1"),
                isBuying: true,
                expiry: (await provider.getBlock(await provider.getBlockNumber())).timestamp + 600,
                nonce: await crabStrategy.nonces(depositor2.address)
            };

      const { typeData, domainData } = getTypeAndDomainData();
      const signedOrder = await signTypedData(depositor2, domainData, typeData, orderHash);
    const validOrder = await crabHelper.verifyOrder(signedOrder)
    expect(validOrder).to.be.true

    })


    it("Should return correct hedge size for sell squeeth case", async () => {
      // current vault state
      const strategyVaultBefore = await controller.vaults(await crabStrategy.vaultId());
      // hedge size and direction from view function
      const [hedgeSize, isSellingSqueeth] = await crabHelper.connect(depositor2).getHedgeSize()
      const oSQTHPriceBefore = await getOSQTHPrice();
      const oSQTHDelta = wmul(strategyVaultBefore.shortAmount.mul(2), oSQTHPriceBefore);
      // compare hedge from view function with calculation directly from vault state and price
      expect(isSellingSqueeth).to.be.true
      if (isSellingSqueeth){ 
        const netDelta = strategyVaultBefore.collateralAmount.sub(oSQTHDelta)
        expect(hedgeSize.sub((netDelta).mul(one).div(oSQTHPriceBefore)).lte(1)).to.be.true
      } else {
        const netDelta = oSQTHDelta.sub(strategyVaultBefore.collateralAmount)
        expect(hedgeSize.sub(netDelta.mul(one).div(oSQTHPriceBefore)).lte(1)).to.be.true
      }

    })


    it("Should return correct hedge size for buy squeeth case", async () => {
      await buyBackSqueeth("1000")
      // current vault state
      const strategyVaultBefore = await controller.vaults(await crabStrategy.vaultId());
      // hedge size and direction from view function
      const [hedgeSize, isSellingSqueeth] = await crabHelper.connect(depositor2).getHedgeSize()
      const oSQTHPriceBefore = await getOSQTHPrice();
      const oSQTHDelta = wmul(strategyVaultBefore.shortAmount.mul(2), oSQTHPriceBefore);
      // compare hedge from view function with calculation directly from vault state and price
      expect(isSellingSqueeth).to.be.false
      if (isSellingSqueeth){ 
        const netDelta = strategyVaultBefore.collateralAmount.sub(oSQTHDelta)
        expect(hedgeSize.sub((netDelta).mul(one).div(oSQTHPriceBefore)).lte(1)).to.be.true
      } else {
        const netDelta = oSQTHDelta.sub(strategyVaultBefore.collateralAmount)
        expect(hedgeSize.sub(netDelta.mul(one).div(oSQTHPriceBefore)).lte(1)).to.be.true
      }

    })

  })

})