import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers";
import { ethers } from "hardhat"
import { expect } from "chai";
import { BigNumber } from "ethers";
import { parseEther } from "ethers/lib/utils";
import { Controller, MockWSqueeth, MockVaultNFTManager, MockOracle, MockUniswapV3Pool, MockErc20, MockUniPositionManager, VaultLibTester } from "../../typechain";
import { getSqrtPriceAndTickBySqueethPrice } from "../calculator";

// use the same price at first, so there's no funding.
const squeethETHPrice = '3000'
const squeethEthPrice1e18 = ethers.utils.parseUnits(squeethETHPrice)
const ethDaiPrice = '3000'
const ethDaiPrice1e18 = ethers.utils.parseUnits(ethDaiPrice)


describe("Controller: Uni LP tokens collateralization", function () {
  let squeeth: MockWSqueeth;
  let shortNFT: MockVaultNFTManager;
  let controller: Controller;
  let squeethEthPool: MockUniswapV3Pool;
  let ethDaiPool: MockUniswapV3Pool;
  let uniPositionManager: MockUniPositionManager
  let oracle: MockOracle;
  let weth: MockErc20;
  let dai: MockErc20;
  let vaultLib: VaultLibTester
  let seller1: SignerWithAddress
  let random: SignerWithAddress

  let daiIsToken0InEthPool: boolean
  let wethIsToken0InSqueethPool: boolean

  this.beforeAll("Prepare accounts", async() => {
    const accounts = await ethers.getSigners();
    const [,_seller1, _random] = accounts;
    seller1 = _seller1
    random = _random
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
    dai = (await MockErc20Contract.deploy("Dai", "Dai")) as MockErc20;

    const MockUniswapV3PoolContract = await ethers.getContractFactory("MockUniswapV3Pool");
    squeethEthPool = (await MockUniswapV3PoolContract.deploy()) as MockUniswapV3Pool;
    ethDaiPool = (await MockUniswapV3PoolContract.deploy()) as MockUniswapV3Pool;

    const MockPositionManager = await ethers.getContractFactory("MockUniPositionManager");
    uniPositionManager = (await MockPositionManager.deploy()) as MockUniPositionManager;

    const VaultTester = await ethers.getContractFactory("VaultLibTester");
    vaultLib = (await VaultTester.deploy()) as VaultLibTester;


    // set token0 and token1 for squeeth/eth pool
    wethIsToken0InSqueethPool = parseInt(weth.address, 16) < parseInt(squeeth.address, 16)
    if (wethIsToken0InSqueethPool) {
      await squeethEthPool.setPoolTokens(weth.address, squeeth.address);
    } else {
      await squeethEthPool.setPoolTokens(squeeth.address, weth.address);
    }

    daiIsToken0InEthPool = parseInt(dai.address, 16) < parseInt(weth.address, 16)
    if (daiIsToken0InEthPool)  {
      await ethDaiPool.setPoolTokens(dai.address, weth.address);
    } else {
      await ethDaiPool.setPoolTokens(weth.address, dai.address);
    }

    await oracle.connect(random).setPrice(squeethEthPool.address, squeethEthPrice1e18)
    await oracle.connect(random).setPrice(ethDaiPool.address, ethDaiPrice1e18)

    const { tick } = getSqrtPriceAndTickBySqueethPrice(squeethETHPrice, wethIsToken0InSqueethPool)
    await oracle.setAverageTick(squeethEthPool.address, tick)
  });

  this.beforeAll("Deploy Controller", async () => {
    const ControllerContract = await ethers.getContractFactory("Controller");
    controller = (await ControllerContract.deploy()) as Controller;
    await controller.init(oracle.address, shortNFT.address, squeeth.address, weth.address, dai.address, ethDaiPool.address, squeethEthPool.address, uniPositionManager.address);
  })

  describe("Vault1: Basic Flow", function () {

    let vaultId: BigNumber;
    const uniNFTId = 1;
    const mintAmount = ethers.utils.parseUnits('0.01')
    const collateralAmount = ethers.utils.parseUnits('45')

    let token0: string
    let token1: string
    
      before("Open vault and mint perfect amount of squeeth", async () => {
        vaultId = await shortNFT.nextId()
        await controller.connect(seller1).mint(0, mintAmount, 0, {value: collateralAmount})
        // mint uni nft for users
        await uniPositionManager.mint(seller1.address, uniNFTId)
      });

      before('Prepare shared variables', async() => {
        token0 = wethIsToken0InSqueethPool ? weth.address : squeeth.address
        token1 = wethIsToken0InSqueethPool ? squeeth.address : weth.address
      })

      it('should revert when trying to deposit a LP token from a different pool', async ()=> {
        // set token0 and token to dai and squeeth
        await uniPositionManager.connect(seller1).approve(controller.address, uniNFTId)
        await uniPositionManager.setMockedProperties(dai.address, squeeth.address, 0, 0, 0)

        await expect(controller.connect(seller1).depositUniNFT(vaultId, uniNFTId)).to.be.revertedWith('Invalid nft')
        // set the tokens back
        await uniPositionManager.setMockedProperties(token0, token1, 0, 0, 0)
      })

      it('should revert when trying to deposit a LP token with id 0', async ()=> {
        await uniPositionManager.mint(seller1.address, 0)
        await uniPositionManager.connect(seller1).approve(controller.address, 0)
        await expect(controller.connect(seller1).depositUniNFT(vaultId, 0)).to.be.revertedWith('invalid id')
      })

      it('should deposit and NFT to an existing vault.', async() => {
        // infinite price range
        const nftTickUpper = 887220
        const nftTickLower = -887220
        const { sqrtPrice: sqrtX96Price, tick: currentTick } = getSqrtPriceAndTickBySqueethPrice(squeethETHPrice, wethIsToken0InSqueethPool)

        // how much to stimulate as LP deposit
        const ethLiquidityAmount = ethers.utils.parseUnits('30')
        const squeethLiquidityAmount = ethers.utils.parseUnits('0.01')

        // nft ticks
        const liquidity = await vaultLib.getLiquidity(
          sqrtX96Price,
          nftTickLower,
          nftTickUpper,
          wethIsToken0InSqueethPool ? ethLiquidityAmount : squeethLiquidityAmount,
          wethIsToken0InSqueethPool ? squeethLiquidityAmount: ethLiquidityAmount,
        )
        
        await squeethEthPool.setSlot0Data(sqrtX96Price, currentTick)
        await uniPositionManager.setMockedProperties(token0, token1, nftTickLower, nftTickUpper, liquidity)

        // // deposit NFT
        await uniPositionManager.connect(seller1).approve(controller.address, uniNFTId)
        const ownerBefore = await uniPositionManager.ownerOf(uniNFTId);

        await controller.connect(seller1).depositUniNFT(vaultId, uniNFTId)
        
        const ownerAfter = await uniPositionManager.ownerOf(uniNFTId);  
        expect(ownerBefore === seller1.address).to.be.true
        expect(ownerAfter === controller.address).to.be.true      
      })

      it('should withdraw the nft successfully', async () => {
        const ownerBefore = await uniPositionManager.ownerOf(uniNFTId);

        await controller.connect(seller1).withdrawUniNFT(vaultId)

        const ownerAfter = await uniPositionManager.ownerOf(uniNFTId);        
        expect(ownerBefore === controller.address).to.be.true
        expect(ownerAfter === seller1.address).to.be.true
      })

      it('should revert when trying to withdraw from a empty vault', async () => {
        await expect(controller.connect(seller1).withdrawUniNFT(vaultId)).to.be.revertedWith('Vault has no NFT')
      })
  })

  describe('Vault2: Basic Collateralization checks', async() => {
    let vaultId: BigNumber;
    const uniNFTId = 2;
    const mintAmount = ethers.utils.parseUnits('0.01')
    const collateralAmount = ethers.utils.parseUnits('45')

    let token0: string
    let token1: string

    describe('Case: price is at the same', async () => {
      let currentTick: string;
      before("open vault and mint perfect amount of squeeth", async () => {
        vaultId = await shortNFT.nextId()
        await controller.connect(seller1).mint(0, mintAmount,0, {value: collateralAmount})
        await uniPositionManager.mint(seller1.address, uniNFTId)

        // await expect(controller.connect(seller1).mint(vaultId, 1, 0)).to.be.revertedWith('Invalid state')
      });
  
      before('prepare shared variables', async() => {
        token0 = wethIsToken0InSqueethPool ? weth.address : squeeth.address
        token1 = wethIsToken0InSqueethPool ? squeeth.address : weth.address
      })
  
      before('deposit NFT into the vault', async() => {
        await uniPositionManager.connect(seller1).approve(controller.address, uniNFTId)
        await controller.connect(seller1).depositUniNFT(vaultId, uniNFTId)
      })

      before('set LP token properties', async() => {
        
        const { sqrtPrice: sqrtX96Price, tick } = getSqrtPriceAndTickBySqueethPrice(squeethETHPrice, wethIsToken0InSqueethPool)
        currentTick = tick

        // how much to stimulate as LP deposit
        const ethLiquidityAmount = ethers.utils.parseUnits('30')
        const squeethLiquidityAmount = ethers.utils.parseUnits('0.01')

        // infinite price range
        const nftTickUpper = 887220
        const nftTickLower = -887220

        // nft ticks
        const liquidity = await vaultLib.getLiquidity(
          sqrtX96Price,
          nftTickLower,
          nftTickUpper,
          wethIsToken0InSqueethPool ? ethLiquidityAmount : squeethLiquidityAmount,
          wethIsToken0InSqueethPool ? squeethLiquidityAmount: ethLiquidityAmount,
        )
        
        await squeethEthPool.setSlot0Data(sqrtX96Price, currentTick)
        await uniPositionManager.setMockedProperties(token0, token1, nftTickLower, nftTickUpper, liquidity)
      })

      it('should be able to mint more squeeth after lp deposit', async() => {

        const { ethAmount, squeethAmount } = await vaultLib.getUniPositionBalances(uniPositionManager.address, uniNFTId, currentTick, wethIsToken0InSqueethPool)
        const equivalentCollateral = ethAmount.add(squeethAmount.mul(ethDaiPrice))
        const vaultBefore = await controller.vaults(vaultId)
        
        const squeethToMint = equivalentCollateral.div(ethDaiPrice).mul(2).div(3)
        
        await controller.connect(seller1).mint(vaultId, squeethToMint, 0)
        const vaultAfter = await controller.vaults(vaultId)
        
        // burn the minted amount 
        const wSqueethMinted = vaultAfter.shortAmount.sub(vaultBefore.shortAmount)
        await controller.connect(seller1).burn(vaultId, wSqueethMinted, 0)
      })
  
      it('should be able to remove all collateral after lp token deposit, because the lp token is worth 2x the debt amount.', async() => {
        await controller.connect(seller1).withdraw(vaultId, collateralAmount)
        const vaultAfter = await controller.vaults(vaultId)
        expect(vaultAfter.NftCollateralId.eq(uniNFTId)).to.be.true
        expect(vaultAfter.collateralAmount.isZero()).to.be.true
      })
  
      it('should revert if trying to remove LP token from the vault.', async() => {
        await expect(controller.connect(seller1).withdrawUniNFT(vaultId)).to.be.revertedWith('Invalid state')
      })

      // only got NFT left in the vault
    })
    describe('Case: price increase, vault should go underwater', async() => {
      let newTick: string;
      before("assume we start LPing when price was 3000. with range 2000 - 4000", async () => {
        // the let's assume price range is only 2000 -> 4000, so if squeeth price > 4000
        // we will only have eth left in LP token.
        // old price was 3000
        const { sqrtPrice: oldSqrtPrice } = getSqrtPriceAndTickBySqueethPrice(squeethETHPrice, wethIsToken0InSqueethPool)
        
        // fix deposit eth amount at 30
        const ethLiquidityAmount = ethers.utils.parseUnits('30')

        const { tick: tick4000 } = getSqrtPriceAndTickBySqueethPrice('4000', wethIsToken0InSqueethPool)
        const { sqrtPrice: sqrtPrice2000, tick: tick2000 } = getSqrtPriceAndTickBySqueethPrice('2000', wethIsToken0InSqueethPool)

        // get approximate liquidity value, with 30 eth deposit
        const liquidity = wethIsToken0InSqueethPool
          ? await vaultLib.getLiquidityForAmount0(oldSqrtPrice, sqrtPrice2000, ethLiquidityAmount.toString())
          : await vaultLib.getLiquidityForAmount1(oldSqrtPrice, sqrtPrice2000, ethLiquidityAmount.toString())
        
        const tickUpper = wethIsToken0InSqueethPool ? tick2000 : tick4000;
        const tickLower = wethIsToken0InSqueethPool ? tick4000 : tick2000;

        await uniPositionManager.setMockedProperties(token0, token1, tickLower, tickUpper, liquidity) // use the same liquidity
      })
      before('set price to 4500', async() => {
        const newSqueethPrice = '4500'
        const { tick, sqrtPrice: newSqrtPrice } = getSqrtPriceAndTickBySqueethPrice(newSqueethPrice, wethIsToken0InSqueethPool)
        // update prices in pool and oracle.
        newTick = tick
        await squeethEthPool.setSlot0Data(newSqrtPrice, newTick)
        await oracle.setPrice(squeethEthPool.address, parseEther(newSqueethPrice))
        await oracle.setPrice(ethDaiPool.address, parseEther(newSqueethPrice))
        await oracle.setAverageTick(squeethEthPool.address, newTick)
      })
      it('should become underwater if squeeth price increase, and LP token has no enough eth to cover short position.', async () => {
        const newSqueethPrice = '4500'
        const result = await vaultLib.getUniPositionBalances(uniPositionManager.address, uniNFTId, newTick, wethIsToken0InSqueethPool)
        // LP token worth 0 squeeth
        expect(result.squeethAmount.isZero()).to.be.true
        // not enough eth value in LP token!
        const requiredCollateral = mintAmount.mul(newSqueethPrice).mul(3).div(2)
        expect(result.ethAmount.lt(requiredCollateral)).to.be.true
        
        await expect(controller.connect(seller1).withdraw(vaultId, 0)).to.be.revertedWith('Invalid state')
      })
      it('should be able to liquidate the NFT', async() => {})
    })
    describe('Case: price decrease, vault should above water', async() => {
      let newTick:string
      before('set price to 1500', async() => {
        const newSqueethPrice = '1500'
        const { tick, sqrtPrice: newSqrtPrice } = getSqrtPriceAndTickBySqueethPrice(newSqueethPrice, wethIsToken0InSqueethPool)
        newTick = tick 
        // update prices in pool and oracle.
        await squeethEthPool.setSlot0Data(newSqrtPrice, newTick)
        await oracle.setPrice(squeethEthPool.address , parseEther(newSqueethPrice))
        await oracle.setPrice(ethDaiPool.address , parseEther(newSqueethPrice))
        await oracle.setAverageTick(squeethEthPool.address, newTick)
      })
      it('should be able to collateralize the vault', async () => {

        const result = await vaultLib.getUniPositionBalances(uniPositionManager.address, uniNFTId, newTick, wethIsToken0InSqueethPool)
        // LP token worth 0 eth
        expect(result.ethAmount.isZero()).to.be.true
        expect(result.squeethAmount.gt(mintAmount)).to.be.true
        
        const vaultBefore = await controller.vaults(vaultId)
        await controller.connect(seller1).mint(vaultId, 10, 0,)
        const vaultAfter = await controller.vaults(vaultId)
        expect(vaultAfter.shortAmount.gt(vaultBefore.shortAmount)).to.be.true
      })
      it('should revert when trying to liquidate the NFT', async() => {})
    })
  });
});
