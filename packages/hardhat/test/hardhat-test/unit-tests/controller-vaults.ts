import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { ethers } from "hardhat"
import { expect } from "chai";
import { BigNumber, providers } from "ethers";
import { one, oracleScaleFactor } from "../utils";
import { Controller, MockWPowerPerp, MockShortPowerPerp, MockOracle, MockUniswapV3Pool, MockErc20, MockUniPositionManager, VaultLibTester, ABDKMath64x64 } from "../../../typechain";
import { getSqrtPriceAndTickBySqueethPrice } from "../calculator";

// use the same price to make sure we're not paying funding (at first)
const initSquEthPrice = BigNumber.from('3000').mul(one).div(oracleScaleFactor)
const initEthUSDPrice = BigNumber.from('3000').mul(one)

const mintAmount = BigNumber.from('100').mul(one)
const collateralAmount = BigNumber.from('45').mul(one)

describe("Simple Vault state tests", function () {
  let squeeth: MockWPowerPerp;
  let shortSqueeth: MockShortPowerPerp;
  let controller: Controller;
  let vaultLib: VaultLibTester
  let squeethEthPool: MockUniswapV3Pool;
  let ethUSDPool: MockUniswapV3Pool;
  let uniPositionManager: MockUniPositionManager
  let oracle: MockOracle;
  let weth: MockErc20;
  let usdc: MockErc20;
  let provider: providers.JsonRpcProvider;
  let seller1: SignerWithAddress
  let random: SignerWithAddress

  this.beforeAll("Prepare accounts", async() => {
    const accounts = await ethers.getSigners();
    const [_seller1, _random] = accounts;
    seller1 = _seller1
    random = _random
    provider = ethers.provider

    await provider.send("evm_setAutomine", [true]);
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

    const SqrtPriceExternal = await ethers.getContractFactory("SqrtPriceMathPartial")
    const SqrtPriceExternalLibrary = (await SqrtPriceExternal.deploy());

    const TickMathExternal = await ethers.getContractFactory("TickMathExternal")
    const TickMathLibrary = (await TickMathExternal.deploy());

    const VaultLibFactory = await ethers.getContractFactory("VaultLibTester", {libraries: {TickMathExternal: TickMathLibrary.address, SqrtPriceMathPartial: SqrtPriceExternalLibrary.address}});
    vaultLib = (await VaultLibFactory.deploy()) as VaultLibTester;


    await squeethEthPool.setPoolTokens(weth.address, squeeth.address);
    await ethUSDPool.setPoolTokens(weth.address, usdc.address);

    await oracle.connect(random).setPrice(squeethEthPool.address , initSquEthPrice) // eth per 1 squeeth
    await oracle.connect(random).setPrice(ethUSDPool.address , initEthUSDPrice)  // usdc per 1 eth
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
    });
  });

  describe('isVaultSafe tests on vaults with no nft', async() => {
    let vaultId: BigNumber
    it('should return true if vault does not exist', async() => {
      expect((await controller.isVaultSafe(1))).to.be.true
    })
    it('should return true if vault has no short', async() => {
      vaultId = await shortSqueeth.nextId()
      await controller.connect(seller1).mintPowerPerpAmount(0, 0, 0, {value: collateralAmount})
      expect((await controller.isVaultSafe(vaultId))).to.be.true
    })
    it('should be able to mint perfect amount of wsqueeth', async() => {
      await controller.connect(seller1).mintPowerPerpAmount(vaultId, mintAmount, 0)
      expect((await controller.isVaultSafe(vaultId))).to.be.true
    })
    it('moving the price up should make the vault insolvent', async() => {
      const newEthPrice = BigNumber.from('3001').mul(one)
      await oracle.setPrice(ethUSDPool.address , newEthPrice)
      expect((await controller.isVaultSafe(vaultId))).to.be.false
    })
    it('funding should make the vault back to safe as time goes by', async() => {
      const markPrice = BigNumber.from('3030').mul(one).div(oracleScaleFactor)
      await oracle.setPrice(squeethEthPool.address , markPrice)
      await provider.send("evm_increaseTime", [1.04*86400]) // increase time by 1.04 days
      await provider.send("evm_mine", [])
      expect((await controller.isVaultSafe(vaultId))).to.be.true
    })
  })

  describe('isVaultSafe tests on vaults with nft', async() => {
      let wethIsToken0: boolean
      let vaultId: BigNumber
      const uniNFTId = 1

      let token0: string
      let token1: string

      
      before('prepare global variables', async() => {
        wethIsToken0 = parseInt(weth.address, 16) < parseInt(squeeth.address, 16)
        token0 = wethIsToken0 ? weth.address : squeeth.address
        token1 = wethIsToken0 ? squeeth.address : weth.address
      })
      
      before("set lp token properties", async () => {
        // the let's assume price range is only 2000 -> 4000, so if squeeth price > 4000
        // we will only have eth left in LP token.
        const { sqrtPrice: oldSqrtPrice } = getSqrtPriceAndTickBySqueethPrice(initSquEthPrice, wethIsToken0)

        // fix deposit eth amount at 30
        const ethLiquidityAmount = ethers.utils.parseUnits('30')

        const scaledPrice4000 = BigNumber.from('4000').mul(one).div(oracleScaleFactor)
        const scaledPrice2000 = BigNumber.from('2000').mul(one).div(oracleScaleFactor)

        const { tick: tick4000 } = getSqrtPriceAndTickBySqueethPrice(scaledPrice4000, wethIsToken0)
        const { sqrtPrice: sqrtPrice2000, tick: tick2000 } = getSqrtPriceAndTickBySqueethPrice(scaledPrice2000, wethIsToken0)

        // get approximate liquidity value, with 30 eth deposit
        const liquidity = wethIsToken0
          ? await vaultLib.getLiquidityForAmount0(oldSqrtPrice, sqrtPrice2000, ethLiquidityAmount.toString())
          : await vaultLib.getLiquidityForAmount1(oldSqrtPrice, sqrtPrice2000, ethLiquidityAmount.toString())
        
        const tickUpper = wethIsToken0 ? tick2000 : tick4000;
        const tickLower = wethIsToken0 ? tick4000 : tick2000;

        await uniPositionManager.setMockedProperties(token0, token1, tickLower, tickUpper, liquidity) // use the same liquidity
      })
      
      before('create vault with nft', async() => {
        

        await uniPositionManager.mint(seller1.address, uniNFTId)
        await uniPositionManager.connect(seller1).approve(controller.address, uniNFTId)

        vaultId = await shortSqueeth.nextId()
        const { tick } = getSqrtPriceAndTickBySqueethPrice(initSquEthPrice, wethIsToken0)
        await oracle.connect(random).setPrice(squeethEthPool.address , initSquEthPrice)
        await oracle.connect(random).setPrice(ethUSDPool.address , initEthUSDPrice)
        await oracle.setAverageTick(squeethEthPool.address, tick)


        const { wPowerPerpAmount, ethAmount } = await vaultLib.getUniPositionBalances(uniPositionManager.address, uniNFTId, tick, wethIsToken0)
        
        const equivalentCollateral = wPowerPerpAmount.mul(initEthUSDPrice).div(one).div(oracleScaleFactor).add(ethAmount)
        
        const totalMintAmount = equivalentCollateral.mul(one).mul(2).div(3).div(initEthUSDPrice).mul(oracleScaleFactor)
        await controller.mintPowerPerpAmount(0, totalMintAmount, uniNFTId, {value: 0})
      })
      it('should become underwater if squeeth price increase, and LP is all eth', async()=>{
        // set oracle to 4500
        const newEthPrice = BigNumber.from('4500').mul(one)
        const newSqueethPrice = newEthPrice.div(oracleScaleFactor)
        
        const { tick } = getSqrtPriceAndTickBySqueethPrice(newSqueethPrice, wethIsToken0)

        await oracle.connect(random).setPrice(ethUSDPool.address , newEthPrice)
        await oracle.connect(random).setPrice(squeethEthPool.address , newSqueethPrice)
        await oracle.setAverageTick(squeethEthPool.address, tick)

        
        const result = await vaultLib.getUniPositionBalances(uniPositionManager.address, uniNFTId, tick, wethIsToken0)

        expect(result.wPowerPerpAmount.isZero()).to.be.true
        expect(await controller.isVaultSafe(vaultId)).to.be.false
      })
      it('should become underwater if squeeth price decrease, and LP is all squeeth', async()=>{
        // set oracle to 1500
        const newEthPrice = BigNumber.from('1500').mul(one)
        const newSqueethPrice = newEthPrice.div(oracleScaleFactor)
        
        const { tick } = getSqrtPriceAndTickBySqueethPrice(newSqueethPrice, wethIsToken0)

        await oracle.connect(random).setPrice(ethUSDPool.address , newEthPrice)
        await oracle.connect(random).setPrice(squeethEthPool.address , newSqueethPrice)
        await oracle.setAverageTick(squeethEthPool.address, tick)

        const result = await vaultLib.getUniPositionBalances(uniPositionManager.address, uniNFTId, tick, wethIsToken0)
        
        expect(result.ethAmount.isZero()).to.be.true
        expect(await controller.isVaultSafe(vaultId)).to.be.true
      })
  })
});
