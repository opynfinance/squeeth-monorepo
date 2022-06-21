import { ethers } from "hardhat"
import BigNumberJs from 'bignumber.js'
import { Contract, BigNumber, constants, utils } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { Controller, INonfungiblePositionManager, MockErc20, VaultLibTester, ShortPowerPerp, WETH9, WPowerPerp, IUniswapV3Factory } from "../../../typechain";
import { deployUniswapV3, deploySqueethCoreContracts, deployWETHAndDai, addSqueethLiquidity, addWethDaiLiquidity, createUniPool } from '../setup'
import { isSimilar, getNow, one, oracleScaleFactor } from "../utils";
import { getSqrtPriceAndTickBySqueethPrice } from "../calculator";

const TICK_SPACE = 60

// make sure .toString won't return string like 3.73e+22
BigNumberJs.set({EXPONENTIAL_AT: 30})

describe("Uniswap Position token integration test", function () {
  let dai: MockErc20
  let weth: WETH9
  let squeeth: WPowerPerp
  let shortSqueeth: ShortPowerPerp
  let positionManager: INonfungiblePositionManager
  let uniFactory: IUniswapV3Factory
  let controller: Controller
  
  let squeethPool: Contract
  
  let vaultLib: VaultLibTester

  const startingEthPrice = 3000
  let isWethToken0: boolean
  
  const scaledStartingSqueethPrice = startingEthPrice / oracleScaleFactor.toNumber() // 0.3
  
  let liquidityProvider: SignerWithAddress
  let seller: SignerWithAddress

  const humanReadableMintAmount = '100'
  const depositAmount = ethers.utils.parseUnits('45.1')
  const mintAmount = ethers.utils.parseUnits(humanReadableMintAmount)

  // vault0: uni position token has both eth and squeeth
  let vault0Id: BigNumber
  let vault0LPTokenId: number

  // vault1: uni position token has only squeeth
  let vault1Id: BigNumber
  let vault1LPTokenId: number
  let vault1LpWSqueethAmount: BigNumber
  

  // vault2: uni position token has only eth
  let vault2Id: BigNumber
  let vault2LPTokenId: number
  const vault2LpEthAmount = utils.parseEther('10')

  // vault3: uni position token has only eth
  let vault3LPTokenId: number
  const vault3LpEthAmount = utils.parseEther('10')

  this.beforeAll("Prepare accounts", async() => {
    const accounts = await ethers.getSigners()
    liquidityProvider = accounts[0]
    seller = accounts[1]
  })

  this.beforeAll("Deploy uniswap protocol & setup uniswap pool", async() => {
  
    const { dai: daiToken, weth: wethToken } = await deployWETHAndDai()

    dai = daiToken
    weth = wethToken

    const uniDeployments = await deployUniswapV3(weth)
    const coreDeployments = await deploySqueethCoreContracts(
      weth,
      dai, 
      uniDeployments.positionManager, 
      uniDeployments.uniswapFactory,
      scaledStartingSqueethPrice,
      startingEthPrice
    )

    positionManager = (uniDeployments.positionManager) as INonfungiblePositionManager
    uniFactory = uniDeployments.uniswapFactory as IUniswapV3Factory

    squeeth = coreDeployments.wsqueeth
    shortSqueeth = coreDeployments.shortSqueeth
    controller = coreDeployments.controller
    squeethPool = coreDeployments.wsqueethEthPool

    const SqrtPriceExternal = await ethers.getContractFactory("SqrtPriceMathPartial")
    const SqrtPriceExternalLibrary = (await SqrtPriceExternal.deploy());

    const TickMathExternal = await ethers.getContractFactory("TickMathExternal")
    const TickMathLibrary = (await TickMathExternal.deploy());

    const VaultTester = await ethers.getContractFactory("VaultLibTester", {libraries: {TickMathExternal: TickMathLibrary.address, SqrtPriceMathPartial: SqrtPriceExternalLibrary.address}});
    vaultLib = (await VaultTester.deploy()) as VaultLibTester;
  })

  this.beforeAll('Add liquidity to both pools', async() => {
    await addSqueethLiquidity(
      scaledStartingSqueethPrice, 
      '5',
      '30', 
      liquidityProvider.address, 
      squeeth, 
      weth, 
      positionManager, 
      controller
    )

    await addWethDaiLiquidity(
      startingEthPrice,
      ethers.utils.parseUnits('10'), // eth amount
      liquidityProvider.address,
      dai,
      weth,
      positionManager
    )
  })

  this.beforeAll('Prepare vault0 (normal)', async() => {
    vault0Id = await shortSqueeth.nextId()

    await controller.connect(seller).mintPowerPerpAmount(0, mintAmount, 0, {value: depositAmount})

    vault0LPTokenId = await addSqueethLiquidity(
      scaledStartingSqueethPrice,
      humanReadableMintAmount,
      '45.1',
      liquidityProvider.address,
      squeeth,
      weth,
      positionManager,
      controller
    )
    await (positionManager as INonfungiblePositionManager).connect(liquidityProvider).transferFrom(liquidityProvider.address, seller.address, vault0LPTokenId)
    await (positionManager as INonfungiblePositionManager).connect(seller).approve(controller.address, vault0LPTokenId)

    await controller.connect(seller).depositUniPositionToken(vault0Id, vault0LPTokenId)
    const vault = await controller.vaults(vault0Id)
    expect(vault.NftCollateralId === vault0LPTokenId).to.be.true
  })

  this.beforeAll('Prepare vault1 (all squeeth)', async() => {
    vault1Id = await shortSqueeth.nextId()

    isWethToken0 = parseInt(weth.address, 16) < parseInt(squeeth.address, 16) 

    // create a uni position that's [4000, 5000], so it's now all squeeth
    const scaledPrice5000 = BigNumber.from('5000').mul(one).div(oracleScaleFactor)
    const scaledPrice4000 = BigNumber.from('4000').mul(one).div(oracleScaleFactor)
    const { tick: tick4000 } = getSqrtPriceAndTickBySqueethPrice(scaledPrice4000, isWethToken0)
    const { tick: tick5000 } = getSqrtPriceAndTickBySqueethPrice(scaledPrice5000, isWethToken0)
    const tickUpper = isWethToken0 ? tick4000 : tick5000;
    const tickLower = isWethToken0 ? tick5000 : tick4000;
    const tickUpperToUse = Math.ceil(parseInt(tickUpper, 10) / TICK_SPACE) * TICK_SPACE
    const tickLowerToUse = Math.ceil(parseInt(tickLower, 10) / TICK_SPACE) * TICK_SPACE
    const token0 = isWethToken0 ? weth.address : squeeth.address
    const token1 = isWethToken0 ? squeeth.address : weth.address

    // put all wsqueeth balance into this LP token
    vault1LpWSqueethAmount = await squeeth.balanceOf(seller.address)

    // uni position is all wsqueeth
    const mintParam = {
      token0,
      token1,
      fee: 3000,
      tickLower: tickLowerToUse,
      tickUpper: tickUpperToUse,
      amount0Desired: isWethToken0 ? 0 : vault1LpWSqueethAmount,
      amount1Desired: isWethToken0 ? vault1LpWSqueethAmount : 0,
      amount0Min: 0,
      amount1Min: 0,
      recipient: seller.address,
      deadline: Math.floor(await getNow(ethers.provider) + 8640000),// uint256
    }

    await squeeth.connect(seller).approve(positionManager.address, constants.MaxUint256)
    const tx = await positionManager.connect(seller).mint(mintParam)

    const receipt = await tx.wait();
    vault1LPTokenId = (receipt.events?.find(event => event.event === 'IncreaseLiquidity'))?.args?.tokenId.toNumber();

    await positionManager.connect(seller).approve(controller.address, vault1LPTokenId)

    await controller.connect(seller).mintPowerPerpAmount(0, mintAmount, vault1LPTokenId, {value: depositAmount})
    const vault = await controller.vaults(vault1Id)
    expect(vault.NftCollateralId === vault1LPTokenId).to.be.true
  })

  this.beforeAll('Prepare vault2 (all eth)', async() => {
    vault2Id = await shortSqueeth.nextId()

    // create a uni position that's [1000, 2000], so it's now all eth
    const scaledPrice2000 = BigNumber.from('2000').mul(one).div(oracleScaleFactor)
    const scaledPrice1000 = BigNumber.from('1000').mul(one).div(oracleScaleFactor)
    const { tick: tick1000 } = getSqrtPriceAndTickBySqueethPrice(scaledPrice1000, isWethToken0)
    const { tick: tick2000 } = getSqrtPriceAndTickBySqueethPrice(scaledPrice2000, isWethToken0)
    const tickUpper = isWethToken0 ? tick1000 : tick2000;
    const tickLower = isWethToken0 ? tick2000 : tick1000;
    const tickUpperToUse = Math.ceil(parseInt(tickUpper, 10) / TICK_SPACE) * TICK_SPACE
    const tickLowerToUse = Math.ceil(parseInt(tickLower, 10) / TICK_SPACE) * TICK_SPACE
    const token0 = isWethToken0 ? weth.address : squeeth.address
    const token1 = isWethToken0 ? squeeth.address : weth.address

    // uni position is all ETH
    const mintParam = {
      token0,
      token1,
      fee: 3000,
      tickLower: tickLowerToUse,
      tickUpper: tickUpperToUse,
      amount0Desired: isWethToken0 ? vault2LpEthAmount : 0,
      amount1Desired: isWethToken0 ? 0 : vault2LpEthAmount,
      amount0Min: 0,
      amount1Min: 0,
      recipient: seller.address,
      deadline: Math.floor(await getNow(ethers.provider) + 8640000),// uint256
    }

    await weth.connect(seller).deposit({value: vault2LpEthAmount})
    await weth.connect(seller).approve(positionManager.address, constants.MaxUint256)
    const tx = await positionManager.connect(seller).mint(mintParam)

    const receipt = await tx.wait();
    vault2LPTokenId = (receipt.events?.find(event => event.event === 'IncreaseLiquidity'))?.args?.tokenId.toNumber();

    await positionManager.connect(seller).approve(controller.address, vault2LPTokenId)

    await controller.connect(seller).mintPowerPerpAmount(0, mintAmount, vault2LPTokenId, {value: depositAmount})
    const vault = await controller.vaults(vault2Id)
    expect(vault.NftCollateralId === vault2LPTokenId).to.be.true
  })

  describe('Can not deposit a 0 liquidity uni nft in to vault', async( )=> {
    
    it("should revert if a user tries to deposit a uni nft with 0 liquidity", async () => {
      // create a uni position that's [1000, 2000], so it's now all eth
      const scaledPrice2000 = BigNumber.from('2000').mul(one).div(oracleScaleFactor)
      const scaledPrice1000 = BigNumber.from('1000').mul(one).div(oracleScaleFactor)
      const { tick: tick1000 } = getSqrtPriceAndTickBySqueethPrice(scaledPrice1000, isWethToken0)
      const { tick: tick2000 } = getSqrtPriceAndTickBySqueethPrice(scaledPrice2000, isWethToken0)
      const tickUpper = isWethToken0 ? tick1000 : tick2000;
      const tickLower = isWethToken0 ? tick2000 : tick1000;
      const tickUpperToUse = Math.ceil(parseInt(tickUpper, 10) / TICK_SPACE) * TICK_SPACE
      const tickLowerToUse = Math.ceil(parseInt(tickLower, 10) / TICK_SPACE) * TICK_SPACE
      const token0 = isWethToken0 ? weth.address : squeeth.address
      const token1 = isWethToken0 ? squeeth.address : weth.address
  
      // uni position is all ETH
      const mintParam = {
        token0,
        token1,
        fee: 3000,
        tickLower: tickLowerToUse,
        tickUpper: tickUpperToUse,
        amount0Desired: isWethToken0 ? vault3LpEthAmount : 0,
        amount1Desired: isWethToken0 ? 0 : vault3LpEthAmount,
        amount0Min: 0,
        amount1Min: 0,
        recipient: seller.address,
        deadline: Math.floor(await getNow(ethers.provider) + 8640000),// uint256
      }
      
      await weth.connect(seller).deposit({value: vault3LpEthAmount})
      await weth.connect(seller).approve(positionManager.address, constants.MaxUint256)
  
      const tx = await positionManager.connect(seller).mint(mintParam)
  
      const receipt = await tx.wait();
      vault3LPTokenId = (receipt.events?.find(event => event.event === 'IncreaseLiquidity'))?.args?.tokenId.toNumber();
  
      const {liquidity: nftLiquidity} = await positionManager.positions(vault3LPTokenId)

      const decreaseLiquidityParams = {
        tokenId: vault3LPTokenId,
        liquidity: nftLiquidity,
        amount0Min: 0,
        amount1Min: 0,
        deadline: Math.floor(await getNow(ethers.provider) + 8640000),// uint256
      }
        
      await positionManager.connect(seller).decreaseLiquidity(decreaseLiquidityParams)

      await positionManager.connect(seller).approve(controller.address, vault3LPTokenId)
  
      await expect(controller.connect(seller).mintPowerPerpAmount(0, 0, vault3LPTokenId)).to.be.revertedWith("C25")
    })
  })
  describe('Save vault with uni position token', async( )=> {
    
    it("seller can redeem an Uni Position token for weth and wSqueeth to reduce debt in vault0", async () => {

      // get net worth of uni position token
      const poolContract = await ethers.getContractAt("IUniswapV3Pool", squeethPool.address)
      
      const {tick} = await poolContract.slot0()

      const vaultBefore = await controller.vaults(vault0Id)

      // the result we get from here is not accurate
      const {ethAmount, wPowerPerpAmount} = await vaultLib.getUniPositionBalances(positionManager.address, vault0LPTokenId, tick, isWethToken0)

      const wsqueethBefore = await squeeth.balanceOf(seller.address)

      await controller.connect(seller).reduceDebt(vault0Id)

      const wsqueethAfter = await squeeth.balanceOf(seller.address)

      const vaultAfter = await controller.vaults(vault0Id)

      const wsqueethBurned = vaultBefore.shortAmount.sub(vaultAfter.shortAmount)
      const wsqueethReceived = wsqueethAfter.sub(wsqueethBefore)
      
      expect(vaultAfter.NftCollateralId === 0).to.be.true
      expect(isSimilar(vaultBefore.collateralAmount.add(ethAmount).toString(), vaultAfter.collateralAmount.toString())).to.be.true
      expect(isSimilar(wsqueethBurned.add(wsqueethReceived).toString(), wPowerPerpAmount.toString())).to.be.true
    })
    it("seller can redeem an Uni Position token for wSqueeth to reduce debt in vault1", async () => {
      const vaultBefore = await controller.vaults(vault1Id)

      const wsqueethBefore = await squeeth.balanceOf(seller.address)
      
      await controller.connect(seller).reduceDebt(vault1Id)
      
      const wsqueethAfter = await squeeth.balanceOf(seller.address)

      const vaultAfter = await controller.vaults(vault1Id)
      expect(vaultAfter.NftCollateralId === 0).to.be.true

      const expectedAmountInVault = vault1LpWSqueethAmount.gt(vaultBefore.shortAmount) 
        ? BigNumber.from(0)
        : vaultBefore.shortAmount.sub(vault1LpWSqueethAmount)
      
      const expectedWSqueethReceived = vault1LpWSqueethAmount.gt(vaultBefore.shortAmount) 
        ? vault1LpWSqueethAmount.sub(vaultBefore.shortAmount)
        : BigNumber.from(0)

      // collateral is the same
      expect(vaultBefore.collateralAmount.eq(vaultAfter.collateralAmount)).to.be.true
      expect(isSimilar(expectedAmountInVault.toString(), vaultAfter.shortAmount.toString())).to.be.true
      expect(isSimilar(wsqueethAfter.sub(wsqueethBefore).toString(), expectedWSqueethReceived.toString(), 4)).to.be.true

    })
    it("seller can redeem an Uni Position token for eth to reduce debt in vault2", async () => {
      const vaultBefore = await controller.vaults(vault2Id)

      await controller.connect(seller).reduceDebt(vault2Id)
      
      const vaultAfter = await controller.vaults(vault2Id)
      // short amount is the same
      expect(isSimilar(vaultBefore.collateralAmount.add(vault2LpEthAmount).toString() ,vaultAfter.collateralAmount.toString())).to.be.true
      expect(vaultBefore.shortAmount.eq(vaultAfter.shortAmount)).to.be.true
      expect(vaultAfter.NftCollateralId === 0).to.be.true
    })
  })

  describe('deposit LP token with diff fee tier', async() => {
    let newPoolLPTokenId: number
    // use fee tier of 0.05% instead of 1% because 0.05% has smaller tick space (10)
    // which works with our existing script
    const newFeeTier = 500
    before('create new pool with fee tier = 0.05%', async() => {
      await createUniPool(scaledStartingSqueethPrice, squeeth, weth, positionManager, uniFactory, newFeeTier)
    })
    before('add liquidity to the new pool', async() => {
      newPoolLPTokenId = await addSqueethLiquidity(
        scaledStartingSqueethPrice,
        humanReadableMintAmount,
        '45.1',
        liquidityProvider.address,
        squeeth,
        weth,
        positionManager,
        controller,
        newFeeTier
      )
    })
    it('should revert depositing lp token into the vault with the wrong fee tier', async() => {
      await (positionManager as INonfungiblePositionManager).connect(liquidityProvider).transferFrom(liquidityProvider.address, seller.address, newPoolLPTokenId)
      await (positionManager as INonfungiblePositionManager).connect(seller).approve(controller.address, newPoolLPTokenId)
      await expect(controller.connect(seller).mintWPowerPerpAmount(0, 0, newPoolLPTokenId)).to.be.revertedWith("C26")    
    })
  })
})
