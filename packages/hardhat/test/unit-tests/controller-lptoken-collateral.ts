import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers";
import { ethers } from "hardhat"
import { expect } from "chai";
import { BigNumber } from "ethers";
import { parseEther } from "ethers/lib/utils";
import { Controller, MockWSqueeth, MockVaultNFTManager, MockOracle, MockUniswapV3Pool, MockErc20, MockUniPositionManager, VaultLibTester, IWETH9 } from "../../typechain";
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
  let weth: IWETH9;
  let dai: MockErc20;
  let vaultLib: VaultLibTester
  let seller1: SignerWithAddress
  let random: SignerWithAddress
  let liquidator: SignerWithAddress

  let daiIsToken0InEthPool: boolean
  let wethIsToken0InSqueethPool: boolean

  const provider = ethers.provider

  this.beforeAll("Prepare accounts", async() => {
    const accounts = await ethers.getSigners();
    const [,_seller1, _random, _liquidator] = accounts;
    seller1 = _seller1
    random = _random
    liquidator = _liquidator
  })

  this.beforeAll("Setup environment", async () => {
    const MockSQUContract = await ethers.getContractFactory("MockWSqueeth");
    squeeth = (await MockSQUContract.deploy()) as MockWSqueeth;

    const NFTContract = await ethers.getContractFactory("MockVaultNFTManager");
    shortNFT = (await NFTContract.deploy()) as MockVaultNFTManager;

    const OracleContract = await ethers.getContractFactory("MockOracle");
    oracle = (await OracleContract.deploy()) as MockOracle;

    const MockErc20Contract = await ethers.getContractFactory("MockErc20");
    dai = (await MockErc20Contract.deploy("Dai", "Dai")) as MockErc20;

    const WETH9Contract = await ethers.getContractFactory("WETH9");
    weth = (await WETH9Contract.deploy()) as IWETH9;

    const MockUniswapV3PoolContract = await ethers.getContractFactory("MockUniswapV3Pool");
    squeethEthPool = (await MockUniswapV3PoolContract.deploy()) as MockUniswapV3Pool;
    ethDaiPool = (await MockUniswapV3PoolContract.deploy()) as MockUniswapV3Pool;

    const MockPositionManager = await ethers.getContractFactory("MockUniPositionManager");
    uniPositionManager = (await MockPositionManager.deploy()) as MockUniPositionManager;

    // mint weth and squeeth to position manager
    await weth.connect(random).deposit({value: parseEther('500')})
    await weth.connect(random).transfer(uniPositionManager.address, parseEther('500'))
    await squeeth.connect(random).mint(uniPositionManager.address, parseEther('500'))

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

  describe("Vault1 and Vault2: Basic Flow", function () {

    let vaultId: BigNumber;
    const uniNFTId = 1;
    const mintAmount = ethers.utils.parseUnits('0.01')
    const collateralAmount = ethers.utils.parseUnits('45')

    let token0: string
    let token1: string
    
      before("Open vault and mint perfect amount of squeeth", async () => {
        vaultId = await shortNFT.nextId()
        await controller.connect(seller1).mintPowerPerpAmount(0, mintAmount, 0, {value: collateralAmount})
        // mint uni nft for users
        await uniPositionManager.mint(seller1.address, uniNFTId)
        
        // mint 2nd nft for user to test reverting
        const nextUniNFTId = 2
        await controller.connect(seller1).mintPowerPerpAmount(0, mintAmount, 0, {value: collateralAmount})
        // mint uni nft for users
        await uniPositionManager.mint(seller1.address, nextUniNFTId)
      });

      before('Prepare shared variables', async() => {
        token0 = wethIsToken0InSqueethPool ? weth.address : squeeth.address
        token1 = wethIsToken0InSqueethPool ? squeeth.address : weth.address
      })

      it('should revert when trying to deposit a LP token from a different pool', async ()=> {
        // set token0 and token to dai and squeeth
        await uniPositionManager.connect(seller1).approve(controller.address, uniNFTId)
        await uniPositionManager.setMockedProperties(dai.address, squeeth.address, 0, 0, 0)

        await expect(controller.connect(seller1).depositUniPositionToken(vaultId, uniNFTId)).to.be.revertedWith('Invalid nft')
        // set the tokens back
        await uniPositionManager.setMockedProperties(token0, token1, 0, 0, 0)
      })

      it('should revert when trying to deposit a LP token with id 0', async ()=> {
        await uniPositionManager.mint(seller1.address, 0)
        await uniPositionManager.connect(seller1).approve(controller.address, 0)
        await expect(controller.connect(seller1).depositUniPositionToken(vaultId, 0)).to.be.revertedWith('invalid id')
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

        await controller.connect(seller1).depositUniPositionToken(vaultId, uniNFTId)
        
        const ownerAfter = await uniPositionManager.ownerOf(uniNFTId);  
        expect(ownerBefore === seller1.address).to.be.true
        expect(ownerAfter === controller.address).to.be.true      
      })

      it('should revert if a user tries to deposit a second nft.', async() => {
        
        const newUniNFTId = 2
        
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
        await uniPositionManager.connect(seller1).approve(controller.address, newUniNFTId)

        await expect(controller.connect(seller1).depositUniPositionToken(vaultId, newUniNFTId)).to.be.revertedWith("Vault already had nft")        
      })

      it('should revert if non owner withdraws the nft', async () => {
        await expect(controller.connect(random).withdrawUniPositionToken(vaultId)).to.be.revertedWith("not allowed")
      })

      it('should withdraw the nft successfully', async () => {
        const ownerBefore = await uniPositionManager.ownerOf(uniNFTId);

        await controller.connect(seller1).withdrawUniPositionToken(vaultId)

        const ownerAfter = await uniPositionManager.ownerOf(uniNFTId);        
        expect(ownerBefore === controller.address).to.be.true
        expect(ownerAfter === seller1.address).to.be.true
      })

      it('should revert when trying to withdraw from a empty vault', async () => {
        await expect(controller.connect(seller1).withdrawUniPositionToken(vaultId)).to.be.revertedWith('Vault has no NFT')
      })

      it('should deposit an NFT to an existing vault using _openDepositMint', async() => {

        // // deposit NFT
        await uniPositionManager.connect(seller1).approve(controller.address, uniNFTId)
        const ownerBefore = await uniPositionManager.ownerOf(uniNFTId);

        await controller.connect(seller1).mintPowerPerpAmount(0, mintAmount, uniNFTId)
        
        const ownerAfter = await uniPositionManager.ownerOf(uniNFTId);  
        expect(ownerBefore === seller1.address).to.be.true
        expect(ownerAfter === controller.address).to.be.true      
      })

  })

  describe('Vault3: Basic Collateralization checks', async() => {
    let vaultId: BigNumber;
    const uniNFTId = 3;
    const mintAmount = ethers.utils.parseUnits('0.01')
    const collateralAmount = ethers.utils.parseUnits('45')

    let token0: string
    let token1: string

    describe('Case: price is at the same', async () => {
      let currentTick: string;
      before("open vault and mint perfect amount of squeeth", async () => {
        vaultId = await shortNFT.nextId()
        await controller.connect(seller1).mintPowerPerpAmount(0, mintAmount,0, {value: collateralAmount})
        await uniPositionManager.mint(seller1.address, uniNFTId)
      });
  
      before('prepare shared variables', async() => {
        token0 = wethIsToken0InSqueethPool ? weth.address : squeeth.address
        token1 = wethIsToken0InSqueethPool ? squeeth.address : weth.address
      })
  
      before('deposit NFT into the vault', async() => {
        await uniPositionManager.connect(seller1).approve(controller.address, uniNFTId)
        await controller.connect(seller1).depositUniPositionToken(vaultId, uniNFTId)
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
        
        await controller.connect(seller1).mintPowerPerpAmount(vaultId, squeethToMint, 0)
        const vaultAfter = await controller.vaults(vaultId)
        
        // burn the minted amount 
        const wSqueethMinted = vaultAfter.shortAmount.sub(vaultBefore.shortAmount)
        await controller.connect(seller1).burnWPowerPerpAmount(vaultId, wSqueethMinted, 0)
      })
  
      it('should be able to remove all collateral after lp token deposit, because the lp token is worth 2x the debt amount.', async() => {
        await controller.connect(seller1).withdraw(vaultId, collateralAmount)
        const vaultAfter = await controller.vaults(vaultId)
        expect(vaultAfter.NftCollateralId === uniNFTId).to.be.true
        expect(vaultAfter.collateralAmount.isZero()).to.be.true
      })
  
      it('should revert if trying to remove LP token from the vault.', async() => {
        await expect(controller.connect(seller1).withdrawUniPositionToken(vaultId)).to.be.revertedWith('Invalid state')
      })

      // only got NFT left in the vault
    })
    describe('Case: price increase, vault should go underwater', async() => {
      let newTick: string;
      let newSqueethPrice: string
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
        newSqueethPrice = '4500'
        const { tick, sqrtPrice: newSqrtPrice } = getSqrtPriceAndTickBySqueethPrice(newSqueethPrice, wethIsToken0InSqueethPool)
        // update prices in pool and oracle.
        newTick = tick
        await squeethEthPool.setSlot0Data(newSqrtPrice, newTick)
        await oracle.setPrice(squeethEthPool.address, parseEther(newSqueethPrice))
        await oracle.setPrice(ethDaiPool.address, parseEther(newSqueethPrice))
        await oracle.setAverageTick(squeethEthPool.address, newTick)
      })
      it('should become underwater if squeeth price increase, and LP token has no enough eth to cover short position.', async () => {
        const result = await vaultLib.getUniPositionBalances(uniPositionManager.address, uniNFTId, newTick, wethIsToken0InSqueethPool)
        // LP token worth 0 squeeth
        expect(result.squeethAmount.isZero()).to.be.true
        // not enough eth value in LP token!
        const requiredCollateral = mintAmount.mul(newSqueethPrice).mul(3).div(2)
        expect(result.ethAmount.lt(requiredCollateral)).to.be.true
        
        await expect(controller.connect(seller1).withdraw(vaultId, 0)).to.be.revertedWith('Invalid state')
      })
      it('should be able to liquidate the NFT', async() => {
        const vaultBefore = await controller.vaults(vaultId)
        const { ethAmount, squeethAmount } = await vaultLib.getUniPositionBalances(uniPositionManager.address, uniNFTId, newTick, wethIsToken0InSqueethPool)
        
        // mint squeeth for liquidator
        const liquidationAmount = vaultBefore.shortAmount.sub(squeethAmount).div(2)
        const ethCollateral = liquidationAmount.mul(newSqueethPrice).mul(2) // with 2 collateral ratio
        await controller.connect(liquidator).mintPowerPerpAmount(0, liquidationAmount, 0, {value: ethCollateral})

        expect(vaultBefore.NftCollateralId === 0).to.be.false

        const token0ToSet = wethIsToken0InSqueethPool ? ethAmount : squeethAmount
        const token1ToSet = wethIsToken0InSqueethPool ? squeethAmount : ethAmount
        await uniPositionManager.setAmount0Amount1ToDecrease(token0ToSet, token1ToSet)

        const balanceBefore = await provider.getBalance(liquidator.address)

        // liquidate the vault
        await controller.connect(liquidator).liquidate(vaultId, liquidationAmount, {gasPrice: 0})
        const vaultAfter = await controller.vaults(vaultId)
        const balanceAfter = await provider.getBalance(liquidator.address)
        
        const reward = liquidationAmount.mul(newSqueethPrice).mul(11).div(10)
        
        expect(balanceAfter.sub(balanceBefore).eq(reward)).to.be.true
        expect(vaultAfter.NftCollateralId === 0).to.be.true // nft is liquidated
        expect(vaultAfter.shortAmount.eq(vaultBefore.shortAmount.sub(liquidationAmount))).to.be.true
        expect(vaultAfter.collateralAmount.eq(vaultBefore.collateralAmount.add(ethAmount).sub(reward))).to.be.true
      })
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

        const token0ToSet = wethIsToken0InSqueethPool ? result.ethAmount : result.squeethAmount
        const token1ToSet = wethIsToken0InSqueethPool ? result.squeethAmount : result.ethAmount
        await uniPositionManager.setAmount0Amount1ToDecrease(token0ToSet, token1ToSet)

        // LP token worth 0 eth
        expect(result.ethAmount.isZero()).to.be.true
        expect(result.squeethAmount.gt(mintAmount)).to.be.true
        
        const vaultBefore = await controller.vaults(vaultId)
        await controller.connect(seller1).mintPowerPerpAmount(vaultId, 10, 0)
        const vaultAfter = await controller.vaults(vaultId)
        expect(vaultAfter.shortAmount.gt(vaultBefore.shortAmount)).to.be.true
      })
      it('should revert when trying to liquidate the NFT', async() => {
        const liquidationAmount = ethers.utils.parseUnits('0.005')
        await expect(controller.connect(liquidator).liquidate(vaultId, liquidationAmount)).to.be.revertedWith(
          'Can not liquidate safe vault'
        )
      })
    })
  });

  describe('Vault4: Saving vault by burning NFT', async() => {
    // We use the exact setup as Vault2:
    // open vault => mint squeeth => add uni NFT => withdraw all collateral from the vault
    // so the price scenario should be identical, we're just testing saving vaults here.
    let vaultId: BigNumber;
    const uniNFTId = 4;
    const mintAmount = ethers.utils.parseUnits('0.01')
    const collateralAmount = ethers.utils.parseUnits('45')

    let token0: string
    let token1: string
    
    describe('Case: price is at the same', async () => {

      let currentTick: string;

      before('set price back to 3000', async() => {
        const { tick, sqrtPrice: newSqrtPrice } = getSqrtPriceAndTickBySqueethPrice(squeethETHPrice, wethIsToken0InSqueethPool)
        const newTick = tick 
        // update prices in pool and oracle.
        await squeethEthPool.setSlot0Data(newSqrtPrice, newTick)
        await oracle.setPrice(squeethEthPool.address , parseEther(squeethETHPrice))
        await oracle.setPrice(ethDaiPool.address , parseEther(squeethETHPrice))
        await oracle.setAverageTick(squeethEthPool.address, newTick)
      })
      
      before("open vault and mint perfect amount of squeeth", async () => {
        vaultId = await shortNFT.nextId()
        await controller.connect(seller1).mintPowerPerpAmount(0, mintAmount,0, {value: collateralAmount})
        await uniPositionManager.mint(seller1.address, uniNFTId)
      });
  
      before('prepare shared variables', async() => {
        token0 = wethIsToken0InSqueethPool ? weth.address : squeeth.address
        token1 = wethIsToken0InSqueethPool ? squeeth.address : weth.address
      })
  
      before('deposit NFT into the vault', async() => {
        await uniPositionManager.connect(seller1).approve(controller.address, uniNFTId)
        await controller.connect(seller1).depositUniPositionToken(vaultId, uniNFTId)
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

      it('should be able to remove all collateral after lp token deposit, because the lp token is worth 2x the debt amount.', async() => {
        await controller.connect(seller1).withdraw(vaultId, collateralAmount)
        const vaultAfter = await controller.vaults(vaultId)
        expect(vaultAfter.NftCollateralId === uniNFTId).to.be.true
        expect(vaultAfter.collateralAmount.isZero()).to.be.true
        // only got NFT left in the vault
      })
  
      it('should revert when calling from random address', async() => {
        await expect(controller.connect(random).reduceDebt(vaultId)).to.be.revertedWith('not allowed')
      })
    })
    describe('Case: price increase, vault should go underwater and people can save it', async() => {
      let newTick: string;
      let newSqueethPrice: string
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
      before('set price to 5000', async() => {
        newSqueethPrice = '5000'
        const { tick, sqrtPrice: newSqrtPrice } = getSqrtPriceAndTickBySqueethPrice(newSqueethPrice, wethIsToken0InSqueethPool)
        // update prices in pool and oracle.
        newTick = tick
        await squeethEthPool.setSlot0Data(newSqrtPrice, newTick)
        await oracle.setPrice(squeethEthPool.address, parseEther(newSqueethPrice))
        await oracle.setPrice(ethDaiPool.address, parseEther(newSqueethPrice))
        await oracle.setAverageTick(squeethEthPool.address, newTick)
      })
      it('should become underwater if squeeth price increase, and LP token has no enough eth', async () => {
        const result = await vaultLib.getUniPositionBalances(uniPositionManager.address, uniNFTId, newTick, wethIsToken0InSqueethPool)
        // LP token worth 0 squeeth
        expect(result.squeethAmount.isZero()).to.be.true
        // not enough eth value in LP token!
        const requiredCollateral = mintAmount.mul(newSqueethPrice).mul(3).div(2)
        expect(result.ethAmount.lt(requiredCollateral)).to.be.true
        
        await expect(controller.connect(seller1).withdraw(vaultId, 0)).to.be.revertedWith('Invalid state')
      })
      before('set NFT redemption amount', async () => {
        const { ethAmount, squeethAmount } = await vaultLib.getUniPositionBalances(uniPositionManager.address, uniNFTId, newTick, wethIsToken0InSqueethPool)
        const token0ToSet = wethIsToken0InSqueethPool ? ethAmount : squeethAmount
        const token1ToSet = wethIsToken0InSqueethPool ? squeethAmount : ethAmount
        await uniPositionManager.setAmount0Amount1ToDecrease(token0ToSet, token1ToSet)
      })
      it('should be able to reduce the debt by calling liquidate', async() => {
        const vaultBefore = await controller.vaults(vaultId)
        const { ethAmount, squeethAmount } = await vaultLib.getUniPositionBalances(uniPositionManager.address, uniNFTId, newTick, wethIsToken0InSqueethPool)
        // save the vault
        await controller.connect(seller1).liquidate(vaultId, 0, {gasPrice: 0})
        
        const vaultAfter = await controller.vaults(vaultId)
        expect(vaultAfter.NftCollateralId === 0).to.be.true // nft is redeemed
        expect(vaultAfter.shortAmount.eq(vaultBefore.shortAmount.sub(squeethAmount))).to.be.true
        expect(vaultAfter.collateralAmount.eq(vaultBefore.collateralAmount.add(ethAmount))).to.be.true
      })
    })
    
    describe('Case: the nft worth more wsqueeth than minted', async() => {
      /**
       * Scenario: the vault is safe when price is 4500
       * Deposit NFT: range order
       * 
       */
      const oldEthPrice = '5000'
      let newTick: string
      const newNFTId = 5

      before('set LP token properties: range order [10000 - 15000]', async() => {
        const vault = await controller.vaults(vaultId)

        // assume there's a NFT has wSqueethAmount value of 110% * shortAmount
        const wsqueethLiquidityAmount = vault.shortAmount.mul(11).div(10);

        const { sqrtPrice: sqrtPrice10000, tick: tick10000 } = getSqrtPriceAndTickBySqueethPrice('10000', wethIsToken0InSqueethPool)
        const { sqrtPrice: sqrtPrice1500, tick: tick15000 } = getSqrtPriceAndTickBySqueethPrice('15000', wethIsToken0InSqueethPool)

        // get approximate liquidity value, with fixed wsqueeth amount
        const liquidity = wethIsToken0InSqueethPool
          ? await vaultLib.getLiquidityForAmount1(sqrtPrice1500, sqrtPrice10000, wsqueethLiquidityAmount.toString())
          : await vaultLib.getLiquidityForAmount0(sqrtPrice1500, sqrtPrice10000, wsqueethLiquidityAmount.toString())
        
        const tickUpper = wethIsToken0InSqueethPool ? tick10000 : tick15000;
        const tickLower = wethIsToken0InSqueethPool ? tick15000 : tick10000;

        await uniPositionManager.setMockedProperties(token0, token1, tickLower, tickUpper, liquidity) // use the same liquidity
      })

      before('deposit NFT into the vault, withdraw some collateral', async() => {
        await uniPositionManager.mint(seller1.address, newNFTId)
        await uniPositionManager.connect(seller1).approve(controller.address, newNFTId)
        await controller.connect(seller1).depositUniPositionToken(vaultId, newNFTId)

        const vault = await controller.vaults(vaultId)
        const totalCollateralRequired = vault.shortAmount.mul(oldEthPrice).mul(3).div(2)
        
        // nft is equivalent as 110% short amount * index
        const nftEquivalentEthValue = vault.shortAmount.mul(11).div(10).mul(oldEthPrice)
        
        const minEthRequired = totalCollateralRequired.sub(nftEquivalentEthValue)
        const maxWithdrawableEth = vault.collateralAmount.sub(minEthRequired)

        await controller.connect(seller1).withdraw(vaultId, maxWithdrawableEth)
      })

      before('set price to 8000', async() => {
        const newSqueethPrice = '8000'
        const { tick, sqrtPrice: newSqrtPrice } = getSqrtPriceAndTickBySqueethPrice(newSqueethPrice, wethIsToken0InSqueethPool)
        // update prices in pool and oracle.
        newTick = tick
        await squeethEthPool.setSlot0Data(newSqrtPrice, newTick)
        await oracle.setPrice(squeethEthPool.address, parseEther(newSqueethPrice))
        await oracle.setPrice(ethDaiPool.address, parseEther(newSqueethPrice))
        await oracle.setAverageTick(squeethEthPool.address, newTick)
      })

      before('set NFT redemption amount', async () => {
        const { ethAmount, squeethAmount } = await vaultLib.getUniPositionBalances(uniPositionManager.address, uniNFTId, newTick, wethIsToken0InSqueethPool)
        const token0ToSet = wethIsToken0InSqueethPool ? ethAmount : squeethAmount
        const token1ToSet = wethIsToken0InSqueethPool ? squeethAmount : ethAmount
        await uniPositionManager.setAmount0Amount1ToDecrease(token0ToSet, token1ToSet)
      })

      it('anyone can safe the vault, the owner will receive extra wsqueeth withdrawn from Uniswap', async() => {
        // the vault should be underwater now
        await expect(controller.connect(seller1).mintPowerPerpAmount(vaultId, 1, 0)).to.be.revertedWith('Invalid state')
        const vaultBefore = await controller.vaults(vaultId)
        const { squeethAmount: nftSqueethAmount } = await vaultLib.getUniPositionBalances(uniPositionManager.address, newNFTId, newTick, wethIsToken0InSqueethPool)

        const ownerWSqueethBefore = await squeeth.balanceOf(seller1.address)

        await controller.connect(seller1).reduceDebt(vaultId)
        const vaultAfter = await controller.vaults(vaultId)

        const ownerWSqueethAfter = await squeeth.balanceOf(seller1.address)

        const wsqueethExcess = nftSqueethAmount.sub(vaultBefore.shortAmount)
        expect(ownerWSqueethAfter.sub(ownerWSqueethBefore).eq(wsqueethExcess)).to.be.true
        expect(vaultAfter.NftCollateralId === 0).to.be.true
        expect(vaultAfter.shortAmount.isZero()).to.be.true
      })
    })
  });
});
