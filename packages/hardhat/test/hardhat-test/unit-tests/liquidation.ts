import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { ethers } from "hardhat"
import { expect } from "chai";
import { BigNumber, providers } from "ethers";
import { Controller, MockWPowerPerp, MockShortPowerPerp, MockOracle, MockUniswapV3Pool, MockErc20, MockUniPositionManager, LiquidationHelper, ABDKMath64x64 } from "../../../typechain";
import { isSimilar, one, oracleScaleFactor } from '../utils'

const squeethETHPrice = ethers.utils.parseUnits('3030').mul(one).div(oracleScaleFactor)
const ethUSDPrice = ethers.utils.parseUnits('3000')



describe("Controller: liquidation unit test", function () {
  let squeeth: MockWPowerPerp;
  let shortSqueeth: MockShortPowerPerp;
  let controller: Controller;
  let squeethEthPool: MockUniswapV3Pool;
  let uniPositionManager: MockUniPositionManager
  let ethUSDPool: MockUniswapV3Pool;
  let oracle: MockOracle;
  let weth: MockErc20;
  let usdc: MockErc20;
  let liquidationHelper: LiquidationHelper

  let provider: providers.JsonRpcProvider;
  let seller1: SignerWithAddress
  let liquidator: SignerWithAddress
  let random: SignerWithAddress

  this.beforeAll("Prepare accounts", async() => {
    const accounts = await ethers.getSigners();
    const [_seller1, _liquidator, _random] = accounts;
    seller1 = _seller1
    liquidator = _liquidator
    random = _random
    provider = ethers.provider
  })

  this.beforeAll("Setup environment", async () => {
    const MockSQUContract = await ethers.getContractFactory("MockWPowerPerp");
    squeeth = (await MockSQUContract.deploy()) as MockWPowerPerp;

    const NFTContract = await ethers.getContractFactory("MockShortPowerPerp");
    shortSqueeth = (await NFTContract.deploy()) as MockShortPowerPerp;

    const OracleContract = await ethers.getContractFactory("MockOracle");
    oracle = (await OracleContract.deploy()) as MockOracle;

    const MockErc20Contract = await ethers.getContractFactory("MockErc20");
    weth = (await MockErc20Contract.deploy("WETH", "WETH", 18)) as MockErc20;
    usdc = (await MockErc20Contract.deploy("USDC", "USDC", 6)) as MockErc20;

    const MockUniswapV3PoolContract = await ethers.getContractFactory("MockUniswapV3Pool");
    squeethEthPool = (await MockUniswapV3PoolContract.deploy()) as MockUniswapV3Pool;
    ethUSDPool = (await MockUniswapV3PoolContract.deploy()) as MockUniswapV3Pool;

    const MockPositionManager = await ethers.getContractFactory("MockUniPositionManager");
    uniPositionManager = (await MockPositionManager.deploy()) as MockUniPositionManager;

    await squeethEthPool.setPoolTokens(weth.address, squeeth.address);
    await ethUSDPool.setPoolTokens(weth.address, usdc.address);

    await oracle.connect(random).setPrice(squeethEthPool.address , squeethETHPrice) // eth per 1 squeeth
    await oracle.connect(random).setPrice(ethUSDPool.address , ethUSDPrice)  // usdc per 1 eth
  });

  describe("Deployment", async () => {
    it("Deployment", async function () {
      const ABDK = await ethers.getContractFactory("ABDKMath64x64")
      const ABDKLibrary = (await ABDK.deploy()) as ABDKMath64x64;
    
      const TickMathExternal = await ethers.getContractFactory("TickMathExternal")
      const TickMathLibrary = (await TickMathExternal.deploy());
    
      const SqrtPriceExternal = await ethers.getContractFactory("SqrtPriceMathPartial")
      const SqrtPriceExternalLibrary = (await SqrtPriceExternal.deploy());
  
      const ControllerContract = await ethers.getContractFactory("Controller", {libraries: {ABDKMath64x64: ABDKLibrary.address, TickMathExternal: TickMathLibrary.address, SqrtPriceMathPartial: SqrtPriceExternalLibrary.address}});
      controller = (await ControllerContract.deploy(oracle.address, shortSqueeth.address, squeeth.address, weth.address, usdc.address, ethUSDPool.address, squeethEthPool.address, uniPositionManager.address, 3000)) as Controller;
      const squeethAddr = await controller.wPowerPerp();
      const nftAddr = await controller.shortPowerPerp();
      expect(squeethAddr).to.be.eq(
        squeeth.address,
        "squeeth address mismatch"
      );
      expect(nftAddr).to.be.eq(shortSqueeth.address, "nft address mismatch");
    });
    after('deploy liquidation helper', async() => {
      const TickMathExternal = await ethers.getContractFactory("TickMathExternal")
      const TickMathLibrary = (await TickMathExternal.deploy());
    
      const SqrtPriceExternal = await ethers.getContractFactory("SqrtPriceMathPartial")
      const SqrtPriceExternalLibrary = (await SqrtPriceExternal.deploy());

      const LiqHelperFactory = await ethers.getContractFactory("LiquidationHelper", {libraries: {TickMathExternal: TickMathLibrary.address, SqrtPriceMathPartial: SqrtPriceExternalLibrary.address}});
      liquidationHelper = await LiqHelperFactory.deploy(
          controller.address,
          oracle.address,
          squeeth.address,
          weth.address,
          usdc.address,
          ethUSDPool.address,
          squeethEthPool.address,
          uniPositionManager.address
        ) as LiquidationHelper;  
    })
  });

  describe("Liquidation", async () => {
    let vault1Id: BigNumber;

    // small vault that will become a dust vault after liquidation
    let vault2Id: BigNumber

    // the new eth price that put vault underwater
    let newEthUsdPrice: BigNumber
    // the new squeeth price that determines the liquidator bounty
    let newSqueethEthPrice: BigNumber

    before("open vault 1", async () => {
      vault1Id = await shortSqueeth.nextId()

      const depositAmount = ethers.utils.parseUnits('45')
      const mintAmount = ethers.utils.parseUnits('100')
        
      const vaultBefore = await controller.vaults(vault1Id)
      const squeethBalanceBefore = await squeeth.balanceOf(seller1.address)
      
      await controller.connect(seller1).mintPowerPerpAmount(0, mintAmount, 0, {value: depositAmount})

      const squeethBalanceAfter = await squeeth.balanceOf(seller1.address)
      const vaultAfter = await controller.vaults(vault1Id)
      const normFactor = await controller.normalizationFactor()

      expect(vaultBefore.shortAmount.add(mintAmount.mul(one).div(normFactor)).eq(vaultAfter.shortAmount)).to.be.true
      expect(squeethBalanceBefore.add(mintAmount.mul(one).div(normFactor)).eq(squeethBalanceAfter)).to.be.true
    });

    before("open vault 2", async () => {
      vault2Id = await shortSqueeth.nextId()

      const depositAmount = ethers.utils.parseUnits('0.9')
      const mintAmount = ethers.utils.parseUnits('2')
        
      const vaultBefore = await controller.vaults(vault2Id)
      const squeethBalanceBefore = await squeeth.balanceOf(seller1.address)
      
      await controller.connect(seller1).mintPowerPerpAmount(0, mintAmount, 0, {value: depositAmount})

      const squeethBalanceAfter = await squeeth.balanceOf(seller1.address)
      const vaultAfter = await controller.vaults(vault2Id)
      const normFactor = await controller.normalizationFactor()
      expect(await controller.isVaultSafe(vault2Id)).to.be.true
      expect(vaultBefore.shortAmount.add(mintAmount.mul(one).div(normFactor)).eq(vaultAfter.shortAmount)).to.be.true
      expect(squeethBalanceBefore.add(mintAmount.mul(one).div(normFactor)).eq(squeethBalanceAfter)).to.be.true

      // give all wsqueeth to liquidator
      await squeeth.connect(seller1).transfer(liquidator.address, squeethBalanceAfter)
    });

    it("Should revert liquidating a a vault with id 0", async () => {
      const result = await liquidationHelper.checkLiquidation(0);
      const [isUnsafe, isLiquidatableAfterReducingDebt, maxWPowerPerpAmount, collateralToReceive] = result;

      expect(isUnsafe).to.be.false
      expect(isLiquidatableAfterReducingDebt).to.be.false
      expect(maxWPowerPerpAmount.eq(BigNumber.from(0))).to.be.true
      expect(collateralToReceive.eq(BigNumber.from(0))).to.be.true

      await expect(controller.connect(liquidator).liquidate(0, 1)).to.be.revertedWith(
        'C12'
      )
    })

    it("Should revert liquidating a a vault with id greater than max vaults", async () => {
      const vaultId = await shortSqueeth.nextId()
      const result = await liquidationHelper.checkLiquidation(vaultId);
      const [isUnsafe, isLiquidatableAfterReducingDebt, maxWPowerPerpAmount, collateralToReceive] = result;

      expect(isUnsafe).to.be.false
      expect(isLiquidatableAfterReducingDebt).to.be.false
      expect(maxWPowerPerpAmount.eq(BigNumber.from(0))).to.be.true
      expect(collateralToReceive.eq(BigNumber.from(0))).to.be.true

      await expect(controller.connect(liquidator).liquidate(vaultId, 1)).to.be.revertedWith(
        'C12'
      )
    })

    it("Should revert liquidating a safe vault", async () => {
      const vaultBefore = await controller.vaults(vault1Id)

      // liquidator mint wSqueeth
      await squeeth.connect(liquidator).mint(liquidator.address, vaultBefore.shortAmount)

      const result = await liquidationHelper.checkLiquidation(vault1Id);
      const [isUnsafe, isLiquidatableAfterReducingDebt, maxWPowerPerpAmount, collateralToReceive] = result;

      expect(isUnsafe).to.be.false
      expect(isLiquidatableAfterReducingDebt).to.be.false
      expect(maxWPowerPerpAmount.eq(BigNumber.from(0))).to.be.true
      expect(collateralToReceive.eq(BigNumber.from(0))).to.be.true

      await expect(controller.connect(liquidator).liquidate(vault1Id, vaultBefore.shortAmount)).to.be.revertedWith(
        'C12'
      )
    })

    it('set eth price to make the vault underwater', async() => {
      newEthUsdPrice = BigNumber.from(4000).mul(one)
      newSqueethEthPrice = BigNumber.from(4040).mul(one).div(oracleScaleFactor)
      await oracle.connect(random).setPrice(ethUSDPool.address, newEthUsdPrice)
      await oracle.connect(random).setPrice(squeethEthPool.address, newSqueethEthPrice)

    })
    it("should revert if the vault become a dust vault after liquidation", async () => {
      const vaultBefore = await controller.vaults(vault2Id)
      const debtToRepay = vaultBefore.shortAmount.sub(1) // not burning all the the short

      const debtShouldRepay = vaultBefore.shortAmount
      let collateralToSell : BigNumber = newSqueethEthPrice.mul(debtShouldRepay).div(one)
      collateralToSell = collateralToSell.add(collateralToSell.div(10))

      const result = await liquidationHelper.checkLiquidation(vault2Id);
      const [isUnsafe, isLiquidatableAfterReducingDebt, maxWPowerPerpAmount, collateralToReceive] = result;

      expect(isUnsafe).to.be.true
      expect(isLiquidatableAfterReducingDebt).to.be.true
      expect(maxWPowerPerpAmount.eq(debtShouldRepay)).to.be.true
      expect(isSimilar(collateralToReceive.toString(), collateralToSell.toString())).to.be.true

      await expect(controller.connect(liquidator).liquidate(vault2Id, debtToRepay)).to.be.revertedWith('C22');
    })
    it("should allow liquidating a whole vault if only liquidating half of it is gonna make it a dust vault", async () => {
      const vaultBefore = await controller.vaults(vault2Id)
      const debtToRepay = vaultBefore.shortAmount
            
      let collateralToSell : BigNumber = newSqueethEthPrice.mul(debtToRepay).div(one)
      collateralToSell = collateralToSell.add(collateralToSell.div(10))

      const result = await liquidationHelper.checkLiquidation(vault2Id);
      const [isUnsafe, isLiquidatableAfterReducingDebt, maxWPowerPerpAmount, collateralToReceive] = result;

      expect(isUnsafe).to.be.true
      expect(isLiquidatableAfterReducingDebt).to.be.true
      expect(maxWPowerPerpAmount.eq(vaultBefore.shortAmount)).to.be.true
      expect(isSimilar(collateralToReceive.toString(), collateralToSell.toString())).to.be.true

      await controller.connect(liquidator).liquidate(vault2Id, debtToRepay)

      const vaultAfter = await controller.vaults(vault2Id)
      expect(vaultAfter.shortAmount.isZero()).to.be.true

    })

    it("Liquidate unsafe vault (vault 1)", async () => {
      const vaultBefore = await controller.vaults(vault1Id)
      const liquidatorBalanceBefore = await provider.getBalance(liquidator.address)
      const squeethLiquidatorBalanceBefore = await squeeth.balanceOf(liquidator.address)

      const isVaultSafeBefore = await controller.isVaultSafe(vault1Id)
      expect(isVaultSafeBefore).to.be.false

      const debtToRepay = vaultBefore.shortAmount.div(2)

      const result = await liquidationHelper.checkLiquidation(vault1Id);
      const [isUnsafe, isLiquidatableAfterReducingDebt, maxWPowerPerpAmount, collateralToReceive] = result;

      // specifying a higher maxDebtToRepay number, which won't be used
      const maxDebtToRepay = debtToRepay.add(10)
      const tx = await controller.connect(liquidator).liquidate(vault1Id, maxDebtToRepay);
      const receipt = await tx.wait();
      
      let collateralToSell : BigNumber = newSqueethEthPrice.mul(debtToRepay).div(one)
      collateralToSell = collateralToSell.add(collateralToSell.div(10))

      const vaultAfter = await controller.vaults(vault1Id)
      const liquidatorBalanceAfter = await provider.getBalance(liquidator.address)
      const liquidateEventCollateralToSell : BigNumber = (receipt.events?.find(event => event.event === 'Liquidate'))?.args?.collateralPaid;
      const squeethLiquidatorBalanceAfter = await squeeth.balanceOf(liquidator.address)

      expect(isUnsafe).to.be.true
      expect(isLiquidatableAfterReducingDebt).to.be.true
      expect(maxWPowerPerpAmount.eq(debtToRepay)).to.be.true
      expect(isSimilar(collateralToReceive.toString(), collateralToSell.toString())).to.be.true

      expect(isSimilar(liquidatorBalanceAfter.sub(liquidatorBalanceBefore).toString(), collateralToSell.toString())).to.be.true
      expect(liquidateEventCollateralToSell.eq(collateralToSell)).to.be.true
      expect(vaultBefore.shortAmount.sub(vaultAfter.shortAmount).eq(debtToRepay)).to.be.true
      expect(vaultBefore.collateralAmount.sub(vaultAfter.collateralAmount).eq(collateralToSell)).to.be.true
      expect(squeethLiquidatorBalanceBefore.sub(squeethLiquidatorBalanceAfter).eq(debtToRepay)).to.be.true
    })
  })

  describe("Liquidation: un-profitable scenario", async () => {
    let vaultId: BigNumber;
    const newSqueethETHPrice = ethers.utils.parseUnits('9090').mul(one).div(oracleScaleFactor)
    const newEthUSDPrice = ethers.utils.parseUnits('9000')
    
    before("open vault", async () => {
      const oldEthPrice = BigNumber.from('3000').mul(one)
      await oracle.connect(random).setPrice(ethUSDPool.address, oldEthPrice)
      vaultId = await shortSqueeth.nextId()
      const depositAmount = ethers.utils.parseUnits('45')
      const mintAmount = ethers.utils.parseUnits('100')
      await controller.connect(seller1).mintPowerPerpAmount(0, mintAmount, 0, {value: depositAmount})
    });
    
    before("set price to a number where vault will become insolvent", async () => {
      // change oracle price to make vault liquidatable
      await oracle.connect(random).setPrice(ethUSDPool.address, newEthUSDPrice)
      await oracle.connect(random).setPrice(squeethEthPool.address, newSqueethETHPrice)
      
    })

    it("should revert if the vault is paying out all collateral, but there are still debt", async () => {
      const vault = await controller.vaults(vaultId)
      // liquidator specify amount that would take all collateral, but not clearing all the debt
      const debtToRepay = vault.shortAmount.sub(1)

      let collateralToSell : BigNumber = newSqueethETHPrice.mul(debtToRepay).div(one)
      collateralToSell = collateralToSell.add(collateralToSell.div(10))

      const result = await liquidationHelper.checkLiquidation(vaultId);
      const [isUnsafe, isLiquidatableAfterReducingDebt, maxWPowerPerpAmount, collateralToReceive] = result;

      expect(collateralToSell.gt(vault.collateralAmount)).to.be.true
      expect(isUnsafe).to.be.true
      expect(isLiquidatableAfterReducingDebt).to.be.true
      expect(maxWPowerPerpAmount.eq(vault.shortAmount)).to.be.true
      expect(isSimilar(collateralToReceive.toString(), vault.collateralAmount.toString())).to.be.true

      await expect(controller.connect(liquidator).liquidate(vaultId, debtToRepay)).to.be.revertedWith('C21');
    })

    it("can fully liquidate a underwater vault, even it's not profitable", async () => {
      const vaultBefore = await controller.vaults(vaultId)
      const liquidatorBalanceBefore = await provider.getBalance(liquidator.address)
      const squeethLiquidatorBalanceBefore = await squeeth.balanceOf(liquidator.address)

      const result = await liquidationHelper.checkLiquidation(vaultId);
      const [isUnsafe, isLiquidatableAfterReducingDebt, maxWPowerPerpAmount, collateralToReceive] = result;

      // fully liquidate a vault
      const debtToRepay = vaultBefore.shortAmount
      const tx = await controller.connect(liquidator).liquidate(vaultId, debtToRepay);
      const receipt = await tx.wait();
      
      let collateralToSell : BigNumber = newSqueethETHPrice.mul(debtToRepay).div(one)
      collateralToSell = collateralToSell.add(collateralToSell.div(10))

      // paying this amount will reduce total eth 
      expect(collateralToSell.gt(vaultBefore.collateralAmount)).to.be.true

      expect(collateralToSell.gt(vaultBefore.collateralAmount)).to.be.true
      expect(isUnsafe).to.be.true
      expect(isLiquidatableAfterReducingDebt).to.be.true
      expect(maxWPowerPerpAmount.eq(vaultBefore.shortAmount)).to.be.true
      expect(isSimilar(collateralToReceive.toString(), vaultBefore.collateralAmount.toString())).to.be.true

      const vaultAfter = await controller.vaults(vaultId)
      const liquidatorBalanceAfter = await provider.getBalance(liquidator.address)
      const actualAmountPaidForLiquidator : BigNumber = (receipt.events?.find(event => event.event === 'Liquidate'))?.args?.collateralPaid;
      const squeethLiquidatorBalanceAfter = await squeeth.balanceOf(liquidator.address)

      expect(vaultAfter.collateralAmount.isZero()).to.be.true
      expect(isSimilar(liquidatorBalanceAfter.sub(liquidatorBalanceBefore).toString(), actualAmountPaidForLiquidator.toString())).to.be.true
      expect(vaultBefore.shortAmount.sub(vaultAfter.shortAmount).eq(debtToRepay)).to.be.true
      expect(vaultBefore.collateralAmount.eq(actualAmountPaidForLiquidator)).to.be.true
      expect(squeethLiquidatorBalanceBefore.sub(squeethLiquidatorBalanceAfter).eq(debtToRepay)).to.be.true
    })
  })
});