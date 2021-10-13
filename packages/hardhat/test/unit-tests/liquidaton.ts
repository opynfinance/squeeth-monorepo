import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers";
import { ethers } from "hardhat"
import { expect } from "chai";
import { BigNumber, providers } from "ethers";
import { Controller, MockWSqueeth, MockVaultNFTManager, MockOracle, MockUniswapV3Pool, MockErc20, MockUniPositionManager } from "../../typechain";
import { isSimilar } from '../utils'

const squeethETHPrice = ethers.utils.parseUnits('3010')
const ethUSDPrice = ethers.utils.parseUnits('3000')


describe("Controller: liquidation unit test", function () {
  let squeeth: MockWSqueeth;
  let shortNFT: MockVaultNFTManager;
  let controller: Controller;
  let squeethEthPool: MockUniswapV3Pool;
  let uniPositionManager: MockUniPositionManager
  let ethUSDPool: MockUniswapV3Pool;
  let oracle: MockOracle;
  let weth: MockErc20;
  let usdc: MockErc20;
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
    const MockSQUContract = await ethers.getContractFactory("MockWSqueeth");
    squeeth = (await MockSQUContract.deploy()) as MockWSqueeth;

    const NFTContract = await ethers.getContractFactory("MockVaultNFTManager");
    shortNFT = (await NFTContract.deploy()) as MockVaultNFTManager;

    const OracleContract = await ethers.getContractFactory("MockOracle");
    oracle = (await OracleContract.deploy()) as MockOracle;

    const MockErc20Contract = await ethers.getContractFactory("MockErc20");
    weth = (await MockErc20Contract.deploy("WETH", "WETH")) as MockErc20;
    usdc = (await MockErc20Contract.deploy("USDC", "USDC")) as MockErc20;

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
      const ControllerContract = await ethers.getContractFactory("Controller");
      controller = (await ControllerContract.deploy()) as Controller;
      await controller.init(oracle.address, shortNFT.address, squeeth.address, weth.address, usdc.address, ethUSDPool.address, squeethEthPool.address, uniPositionManager.address);
      const squeethAddr = await controller.wPowerPerp();
      const nftAddr = await controller.vaultNFT();
      expect(squeethAddr).to.be.eq(
        squeeth.address,
        "squeeth address mismatch"
      );
      expect(nftAddr).to.be.eq(shortNFT.address, "nft address mismatch");
    });
  });

  describe("Liquidation", async () => {
    let vault1Id: BigNumber;

    // small vault that will become a dust vault after liquidation
    let vault2Id: BigNumber

    before("open vault 1", async () => {
      vault1Id = await shortNFT.nextId()

      const depositAmount = ethers.utils.parseUnits('45')
      const mintAmount = ethers.utils.parseUnits('0.01')
        
      const vaultBefore = await controller.vaults(vault1Id)
      const squeethBalanceBefore = await squeeth.balanceOf(seller1.address)
      
      await controller.connect(seller1).mintPowerPerpAmount(0, mintAmount, 0, {value: depositAmount})

      const squeethBalanceAfter = await squeeth.balanceOf(seller1.address)
      const vaultAfter = await controller.vaults(vault1Id)
      const normFactor = await controller.normalizationFactor()

      expect(vaultBefore.shortAmount.add(mintAmount.mul(ethers.utils.parseUnits('1')).div(normFactor)).eq(vaultAfter.shortAmount)).to.be.true
      expect(squeethBalanceBefore.add(mintAmount.mul(ethers.utils.parseUnits('1')).div(normFactor)).eq(squeethBalanceAfter)).to.be.true
    });

    before("open vault 2", async () => {
      vault2Id = await shortNFT.nextId()

      const depositAmount = ethers.utils.parseUnits('0.9')
      const mintAmount = ethers.utils.parseUnits('0.0002')
        
      const vaultBefore = await controller.vaults(vault2Id)
      const squeethBalanceBefore = await squeeth.balanceOf(seller1.address)
      
      await controller.connect(seller1).mintPowerPerpAmount(0, mintAmount, 0, {value: depositAmount})

      const squeethBalanceAfter = await squeeth.balanceOf(seller1.address)
      const vaultAfter = await controller.vaults(vault2Id)
      const normFactor = await controller.normalizationFactor()
      expect(await controller.isVaultSafe(vault2Id)).to.be.true
      expect(vaultBefore.shortAmount.add(mintAmount.mul(ethers.utils.parseUnits('1')).div(normFactor)).eq(vaultAfter.shortAmount)).to.be.true
      expect(squeethBalanceBefore.add(mintAmount.mul(ethers.utils.parseUnits('1')).div(normFactor)).eq(squeethBalanceAfter)).to.be.true

      // give all wsqueeth to liquidator
      await squeeth.connect(seller1).transfer(liquidator.address, squeethBalanceAfter)
    });

    it("Should revert liquidating a safe vault", async () => {
      const vaultBefore = await controller.vaults(vault1Id)

      // liquidator mint wSqueeth
      await squeeth.connect(liquidator).mint(liquidator.address, vaultBefore.shortAmount)

      await expect(controller.connect(liquidator).liquidate(vault1Id, vaultBefore.shortAmount)).to.be.revertedWith(
        'Can not liquidate safe vault'
      )
    })

    it('set eth price to make the vault underwater', async() => {
      const newEthUsdPrice = ethers.utils.parseUnits('4000')
      await oracle.connect(random).setPrice(ethUSDPool.address, newEthUsdPrice)
    })
    it("should revert if the vault become a dust vault after liquidation", async () => {
      const vaultBefore = await controller.vaults(vault2Id)
      const debtToRepay = vaultBefore.shortAmount.sub(1) // not burning all the the short
      await expect(controller.connect(liquidator).liquidate(vault2Id, debtToRepay)).to.be.revertedWith('dust vault left');
    })
    it("should allow liquidating a whole vault if only liquidating half of it is gonna make it a dust vault", async () => {
      const vaultBefore = await controller.vaults(vault2Id)
      const debtToRepay = vaultBefore.shortAmount
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
      const tx = await controller.connect(liquidator).liquidate(vault1Id, debtToRepay);
      const receipt = await tx.wait();
      
      const normFactor = await controller.normalizationFactor()
      let collateralToSell : BigNumber = BigNumber.from(4000).mul(BigNumber.from(10).pow(18)).mul(normFactor).mul(debtToRepay).div(BigNumber.from(10).pow(36))
      collateralToSell = collateralToSell.add(collateralToSell.div(10))

      const vaultAfter = await controller.vaults(vault1Id)
      const liquidatorBalanceAfter = await provider.getBalance(liquidator.address)
      const liquidateEventCollateralToSell : BigNumber = (receipt.events?.find(event => event.event === 'Liquidate'))?.args?.collateralPaid;
      const squeethLiquidatorBalanceAfter = await squeeth.balanceOf(liquidator.address)

      expect(isSimilar(liquidatorBalanceAfter.sub(liquidatorBalanceBefore).toString(), collateralToSell.toString())).to.be.true
      expect(liquidateEventCollateralToSell.eq(collateralToSell)).to.be.true
      expect(vaultBefore.shortAmount.sub(vaultAfter.shortAmount).eq(debtToRepay)).to.be.true
      expect(vaultBefore.collateralAmount.sub(vaultAfter.collateralAmount).eq(collateralToSell)).to.be.true
      expect(squeethLiquidatorBalanceBefore.sub(squeethLiquidatorBalanceAfter).eq(debtToRepay)).to.be.true
    })
  })

  describe("Liquidation: un-profitable scenario", async () => {
    let vaultId: BigNumber;
    const newEthPrice = '9000'

    before("open vault", async () => {
      const oldEthPrice = ethers.utils.parseUnits('3000')
      await oracle.connect(random).setPrice(ethUSDPool.address, oldEthPrice)
      vaultId = await shortNFT.nextId()
      const depositAmount = ethers.utils.parseUnits('45')
      const mintAmount = ethers.utils.parseUnits('0.01')
      await controller.connect(seller1).mintPowerPerpAmount(0, mintAmount, 0, {value: depositAmount})
    });
    
    before("set price to a number where vault will become insolvent", async () => {
      // change oracle price to make vault liquidatable
      const newEthUsdPrice = ethers.utils.parseUnits(newEthPrice)
      await oracle.connect(random).setPrice(ethUSDPool.address, newEthUsdPrice)
    })

    it("should revert if the vault is paying out all collateral, but there are still debt", async () => {
      const vault = await controller.vaults(vaultId)
      // liquidator specify amount that would take all collateral, but not clearing all the debt
      const debtToRepay = vault.shortAmount.sub(1)
      await expect(controller.connect(liquidator).liquidate(vaultId, debtToRepay)).to.be.revertedWith('need full liquidation');
    })

    it("can fully liquidate a underwater vault, even it's not profitable", async () => {
      const vaultBefore = await controller.vaults(vaultId)
      const liquidatorBalanceBefore = await provider.getBalance(liquidator.address)
      const squeethLiquidatorBalanceBefore = await squeeth.balanceOf(liquidator.address)

      // fully liquidate a vault
      const debtToRepay = vaultBefore.shortAmount
      const tx = await controller.connect(liquidator).liquidate(vaultId, debtToRepay);
      const receipt = await tx.wait();
      
      const normFactor = await controller.normalizationFactor()
      let collateralToSell = BigNumber.from(newEthPrice).mul(BigNumber.from(10).pow(18)).mul(normFactor).mul(debtToRepay).div(BigNumber.from(10).pow(36))
      collateralToSell = collateralToSell.add(collateralToSell.div(10))

      // paying this amount will reduce total eth 
      expect(collateralToSell.gt(vaultBefore.collateralAmount)).to.be.true

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