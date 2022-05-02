import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";

import { ethers, getNamedAccounts } from "hardhat"
import { expect } from "chai";
import { Contract, providers, constants } from "ethers";
import { Controller, ShortPowerPerp, WPowerPerp, ShortHelper, WETH9, IUniswapV3Pool } from "../../../typechain";

import { deployUniswapV3, deploySqueethCoreContracts, addSqueethLiquidity, deployWETHAndDai } from '../setup'
import { getNow, one, oracleScaleFactor } from "../utils";

describe("ShortHelper Integration Test", function () {
  const startingEthPrice = 3000
  const startingScaledSqueethPrice = startingEthPrice / oracleScaleFactor.toNumber()

  let shortHelper: ShortHelper
  // peer contracts
  let squeeth: WPowerPerp
  let shortPowerPerp: ShortPowerPerp
  let controller: Controller
  let swapRouter: Contract
  let weth: WETH9

  let poolAddress: string

  // accounts
  let seller1: SignerWithAddress
  let seller2: SignerWithAddress
  let random: SignerWithAddress
  let provider: providers.JsonRpcProvider;

  let seller1VaultId = 0;
  let seller2VaultId = 0; 

  const squeethAmount = ethers.utils.parseEther('10')
  const collateralAmount = ethers.utils.parseEther('20')

  this.beforeAll("Prepare accounts", async() => {
    const accounts = await ethers.getSigners();
    const [,_seller1, _seller2, _random] = accounts;
    seller1 = _seller1
    seller2 = _seller2
    random = _random
    provider = ethers.provider
  })

  this.beforeAll("Deploy uniswap protocol & setup uniswap pool", async() => {

    const { dai, weth: wethToken } = await deployWETHAndDai()

    weth = wethToken

    const uniDeployments = await deployUniswapV3(weth);

    const coreDeployments = await deploySqueethCoreContracts(weth, dai, uniDeployments.positionManager, uniDeployments.uniswapFactory)

    const { deployer } = await getNamedAccounts();
    
    // init uniswap pool: price = 3000, seed with 0.005 squeeth (30 eth as collateral)
    await addSqueethLiquidity(
      startingScaledSqueethPrice, 
      '50',
      '30', 
      deployer, 
      coreDeployments.wsqueeth, 
      weth, 
      uniDeployments.positionManager, 
      coreDeployments.controller, 
    )

    swapRouter = uniDeployments.swapRouter
    // positionManager = uniDeployments.positionManager
    squeeth = coreDeployments.wsqueeth
    shortPowerPerp = coreDeployments.shortSqueeth
    controller = coreDeployments.controller
    poolAddress = coreDeployments.wsqueethEthPool.address 
    
  })

  describe('Basic settings', async() => {
    describe('deployment', async() => {
      it('should revert if argument address is invalid', async() => {
        const ShortHelperFactory = await ethers.getContractFactory("ShortHelper");
        await expect(ShortHelperFactory.deploy(
          constants.AddressZero, swapRouter.address, weth.address
        )).to.be.revertedWith('Invalid controller address');

        await expect(ShortHelperFactory.deploy(
          controller.address, constants.AddressZero, weth.address
        )).to.be.revertedWith('Invalid swap router address');

        await expect(ShortHelperFactory.deploy(
          controller.address, swapRouter.address, constants.AddressZero
        )).to.be.revertedWith('Invalid weth address');
      })
      it('should deploy ShortHelper', async () => {
        const ShortHelperFactory = await ethers.getContractFactory("ShortHelper");

        // deploy short helper
        shortHelper = (await ShortHelperFactory.deploy(controller.address, swapRouter.address, weth.address)) as ShortHelper
    
        expect(await shortHelper.shortPowerPerp()).to.be.eq(shortPowerPerp.address, "shortPosition address mismatch")
        expect(await shortHelper.controller()).to.be.eq(controller.address, "controller address mismatch")
        expect(await shortHelper.router()).to.be.eq(swapRouter.address, "swapRouter address mismatch")
        expect(await shortHelper.weth()).to.be.eq(weth.address, "weth address mismatch")
      })
    })
    
  })

  describe('Create short position', async() => {
    
    it ('should revert if trying to open a vault with non-weth address and squeeth for swap', async () => {

      const exactInputParam = {
        tokenIn: squeeth.address,
        tokenOut: random.address,
        fee: 3000,
        recipient: seller1.address,
        deadline: await getNow(provider) + 86400,
        amountIn: squeethAmount,
        amountOutMinimum: 0, // no slippage control now
        sqrtPriceLimitX96: 0,
      }
  
      await expect(shortHelper.connect(seller1).openShort(0, squeethAmount, 0, exactInputParam, {value: collateralAmount} )).to.be.revertedWith("Wrong swap tokens")
    })
    
    it ('should revert if trying to open a vault with weth address and non-squeeth for swap', async () => {

      const exactInputParam = {
        tokenIn: random.address,
        tokenOut: weth.address,
        fee: 3000,
        recipient: seller1.address,
        deadline: await getNow(provider) + 86400,
        amountIn: squeethAmount,
        amountOutMinimum: 0, // no slippage control now
        sqrtPriceLimitX96: 0,
      }
  
      await expect(shortHelper.connect(seller1).openShort(0, squeethAmount, 0, exactInputParam, {value: collateralAmount} )).to.be.revertedWith("Wrong swap tokens")
    })

    it('should revert is slippage is too high', async() => {
      const expectedOutIfNoSlippage = squeethAmount.mul(startingEthPrice).div(oracleScaleFactor)

      const exactInputParam = {
        tokenIn: squeeth.address,
        tokenOut: weth.address,
        fee: 3000,
        recipient: shortHelper.address, // specify shortHelper as recipient to unwrap weth.
        deadline: await getNow(provider) + 86400,
        amountIn: 0,
        amountOutMinimum: expectedOutIfNoSlippage,
        sqrtPriceLimitX96: 0,
      }
      await expect(shortHelper.connect(seller2).openShort(seller2VaultId, squeethAmount, 0, exactInputParam, {
        value: collateralAmount
      })).to.be.revertedWith('Too little received')
    })

    it('should revert if end price is lower than limit', async() => {
      
      // set the min price to be same as current price
      const pool = await ethers.getContractAt('IUniswapV3Pool', poolAddress) as IUniswapV3Pool
      const { sqrtPriceX96 } = await pool.slot0()
      
      const exactInputParam = {
        tokenIn: squeeth.address,
        tokenOut: weth.address,
        fee: 3000,
        recipient: shortHelper.address, // specify shortHelper as recipient to unwrap weth.
        deadline: await getNow(provider) + 86400,
        amountIn: 0,
        amountOutMinimum: 0,
        sqrtPriceLimitX96: sqrtPriceX96,
      }

      const largeSqueethAMount = ethers.utils.parseEther('10')

      await expect(shortHelper.connect(seller1).openShort(0, largeSqueethAMount, 0, exactInputParam, {
        value: collateralAmount
      })).to.be.revertedWith('SPL')
      
    })

    it ('should open new vault and sell squeeth, receive weth in return', async () => {

      const exactInputParam = {
        tokenIn: squeeth.address,
        tokenOut: weth.address,
        fee: 3000,
        recipient: seller1.address,
        deadline: await getNow(provider) + 86400,
        amountIn: squeethAmount,
        amountOutMinimum: 0, // no slippage control now
        sqrtPriceLimitX96: 0,
      }
  
      const nftBalanceBefore = await shortPowerPerp.balanceOf(seller1.address)
      const poolSqueethBefore = await squeeth.balanceOf(poolAddress)
      const sellerWethBefore = await weth.balanceOf(seller1.address)
      const poolWethBefore = await weth.balanceOf(poolAddress)
      seller1VaultId = (await shortPowerPerp.nextId()).toNumber()
      // mint and trade
      await shortHelper.connect(seller1).openShort(0, squeethAmount, 0, exactInputParam, {value: collateralAmount} )
  
      const normalizationFactor = await controller.normalizationFactor()
      const wSqueethAmount = squeethAmount.mul(one).div(normalizationFactor)

      const nftBalanceAfter = await shortPowerPerp.balanceOf(seller1.address)
      const poolSqueethAfter = await squeeth.balanceOf(poolAddress)
      const sellerWethAfter = await weth.balanceOf(seller1.address)
      const poolWethAfter = await weth.balanceOf(poolAddress)
  
      expect(nftBalanceAfter.eq(nftBalanceBefore.add(1))).to.be.true
      expect(poolSqueethAfter.toString()).to.be.eq(poolSqueethBefore.add(wSqueethAmount), "squeeth mismatch")
      expect(poolWethBefore.sub(poolWethAfter).toString()).to.be.eq(sellerWethAfter.sub(sellerWethBefore), "weth mismatch")
    })

    it('should add ShortHelper as an operator', async() =>{
      // it needs to set the ShortHelper as an operator to allow interactions past minting a new vault
      
      await controller.connect(seller1).updateOperator(seller1VaultId,shortHelper.address)
      const vault = await controller.vaults(seller1VaultId)
      expect(vault.operator).to.be.eq(shortHelper.address, "Operator not set correctly")
    })

    it('should reset operator when vault transferred', async() =>{
      
      const nftOwnerBefore = await shortPowerPerp.ownerOf(seller1VaultId)
      const vaultBefore = await controller.vaults(seller1VaultId)
      await shortPowerPerp.connect(seller1).functions["safeTransferFrom(address,address,uint256)"](seller1.address, seller2.address, seller1VaultId)
      
      const nftOwnerAfter = await shortPowerPerp.ownerOf(seller1VaultId)

      const vaultAfter = await controller.vaults(seller1VaultId)
      expect(vaultBefore.operator).to.be.eq(shortHelper.address, "Operator was not set correctly to short helper")
      expect(vaultAfter.operator).to.be.eq(ethers.constants.AddressZero, "Operator didn't get reset on transfer")
      expect(nftOwnerBefore).to.be.eq(seller1.address, "Nft was not owned by seller1 before transfer")
      expect(nftOwnerAfter).to.be.eq(seller2.address, "Nft is not owned by seller2 after transfer")

      await shortPowerPerp.connect(seller2).functions["safeTransferFrom(address,address,uint256)"](seller2.address, seller1.address, seller1VaultId)
      const nftOwnerFinal = await shortPowerPerp.ownerOf(seller1VaultId)

      expect(nftOwnerFinal).to.be.eq(seller1.address, "Nft is not owned by seller1 after final transfer")

      await controller.connect(seller1).updateOperator(seller1VaultId,shortHelper.address)
      const vault = await controller.vaults(seller1VaultId)
      expect(vault.operator).to.be.eq(shortHelper.address, "Operator not set correctly")

    })

    it ('should add collateral to an existing vault and sell squeeth, receive weth in return', async () => {
      
      const exactInputParam = {
        tokenIn: squeeth.address,
        tokenOut: weth.address,
        fee: 3000,
        recipient: seller1.address,
        deadline: await getNow(provider) + 86400,
        amountIn: squeethAmount,
        amountOutMinimum: 0, // no slippage control now
        sqrtPriceLimitX96: 0,
      }
  
      const nftBalanceBefore = await shortPowerPerp.balanceOf(seller1.address)
      const poolSqueethBefore = await squeeth.balanceOf(poolAddress)
      const sellerWethBefore = await weth.balanceOf(seller1.address)
      const poolWethBefore = await weth.balanceOf(poolAddress)

      // mint and trade
      await shortHelper.connect(seller1).openShort(seller1VaultId, squeethAmount, 0, exactInputParam, {value: collateralAmount} )
  
      const normalizationFactor = await controller.normalizationFactor()
      const wSqueethAmount = squeethAmount.mul(ethers.utils.parseUnits('1')).div(normalizationFactor)

      const nftBalanceAfter = await shortPowerPerp.balanceOf(seller1.address)
      const poolSqueethAfter = await squeeth.balanceOf(poolAddress)
      const sellerWethAfter = await weth.balanceOf(seller1.address)
      const poolWethAfter = await weth.balanceOf(poolAddress)
  
      expect(nftBalanceAfter.eq(nftBalanceBefore)).to.be.true
      expect(poolSqueethAfter.toString()).to.be.eq(poolSqueethBefore.add(wSqueethAmount), "squeeth mismatch")
      expect(poolWethBefore.sub(poolWethAfter).toString()).to.be.eq(sellerWethAfter.sub(sellerWethBefore), "weth mismatch")
    })

    it ('should revert if a random address tries to mint and sell squeeth on someone elses vault', async () => {
      const attackAmount = squeethAmount.div(10)
      const exactInputParam = {
        tokenIn: squeeth.address,
        tokenOut: weth.address,
        fee: 3000,
        recipient: seller2.address,
        deadline: await getNow(provider) + 86400,
        amountIn: attackAmount,
        amountOutMinimum: 0, // no slippage control now
        sqrtPriceLimitX96: 0,
      }
  
      await expect(shortHelper.connect(seller2).openShort(seller1VaultId, attackAmount, 0, exactInputParam, {value: 0} )).to.be.revertedWith("Not allowed")
    })

    it ('should revert if collateral amount put down is dust', async () => {
      const smallSqueethAmount = ethers.utils.parseEther('0.1')
      const smallCollateralAmount = ethers.utils.parseEther('0.2')
      
      const exactInputParam = {
        tokenIn: squeeth.address,
        tokenOut: weth.address,
        fee: 3000,
        recipient: shortHelper.address, // specify shortHelper as recipient to unwrap weth.
        deadline: await getNow(provider) + 86400,
        amountIn: 0, // should be replaced by real wsqueeth minted
        amountOutMinimum: 0,
        sqrtPriceLimitX96: 0,
      }
  
      await expect(shortHelper.connect(seller2).openShort(0, smallSqueethAmount, 0, exactInputParam, {
          value: smallCollateralAmount, 
        }
      )).to.be.revertedWith('C22')

    })

    it ('should revert if user does not put enough collateral', async () => {
      const exactInputParam = {
        tokenIn: squeeth.address,
        tokenOut: weth.address,
        fee: 3000,
        recipient: shortHelper.address,
        deadline: await getNow(provider) + 86400,
        amountIn: 0, // should be replaced by real wsqueeth minted
        amountOutMinimum: 0,
        sqrtPriceLimitX96: 0,
      }
  
      await expect(shortHelper.connect(seller2).openShort(0, squeethAmount, 0, exactInputParam, {
          value: collateralAmount.div(5),  // not enough collateral
        }
      )).to.be.revertedWith('C24')

    })

    it ('should open new vault and sell squeeth, receive eth at the end', async () => {
      
      const exactInputParam = {
        tokenIn: squeeth.address,
        tokenOut: weth.address,
        fee: 3000,
        recipient: shortHelper.address, // specify shortHelper as recipient to unwrap weth.
        deadline: await getNow(provider) + 86400,
        amountIn: squeethAmount,
        amountOutMinimum: 0,
        sqrtPriceLimitX96: 0,
      }
  
      const nftBalanceBefore = await shortPowerPerp.balanceOf(seller2.address)
      const poolSqueethBefore = await squeeth.balanceOf(poolAddress)
      const sellerEthBefore = await provider.getBalance(seller2.address)
      const poolWethBefore = await weth.balanceOf(poolAddress)
  
      seller2VaultId = (await shortPowerPerp.nextId()).toNumber()

      // mint and trade
      await shortHelper.connect(seller2).openShort(0, squeethAmount, 0, exactInputParam, {
          value: collateralAmount
        }
      )

      const normalizationFactor = await controller.normalizationFactor()
      const wSqueethAmount = squeethAmount.mul(one).div(normalizationFactor)

      const nftBalanceAfter = await shortPowerPerp.balanceOf(seller2.address)
      const poolSqueethAfter = await squeeth.balanceOf(poolAddress)
      const sellerEthAfter = await provider.getBalance(seller2.address)
      const poolWethAfter = await weth.balanceOf(poolAddress)
  
      expect(nftBalanceAfter.eq(nftBalanceBefore.add(1))).to.be.true
      expect(poolSqueethAfter.toString()).to.be.eq(poolSqueethBefore.add(wSqueethAmount), "squeeth mismatch")
      // expect(poolWethBefore.sub(poolWethAfter).toString()).to.be.eq(
      //   sellerEthAfter.add(collateralAmount).sub(sellerEthBefore), "weth mismatch"
      // )
    })

    it ('should revert if trying to short more from the current vault', async () => {
      
      await controller.connect(seller2).updateOperator(seller2VaultId, shortHelper.address)
      
      const exactInputParam = {
        tokenIn: squeeth.address,
        tokenOut: weth.address,
        fee: 3000,
        recipient: shortHelper.address,
        deadline: await getNow(provider) + 86400,
        amountIn: 0, // should be replaced by real wsqueeth minted
        amountOutMinimum: 0,
        sqrtPriceLimitX96: 0,
      }
  
      await expect(shortHelper.connect(seller2).openShort(seller2VaultId, squeethAmount.mul(5), 0, exactInputParam)).to.be.revertedWith('C24')
    })

  })

  describe('Checking eth payable reverts', async() => {
    it ('should revert if ETH is sent from a contract other than weth or the controller', async () => {
      await expect(seller1.sendTransaction({to: shortHelper.address, value:1})).to.be.revertedWith("can't receive eth")
    })
  })

  describe('Close short position', async() => {
    
    it ('should revert if a random user to withdraw ETH from someone elses vault', async () => {
      const buyBackSqueethAmount = ethers.utils.parseEther('0.0000001')
      const withdrawCollateralAmount = ethers.utils.parseEther('2.5')

      // max amount to buy back 0.1 squeeth
      const amountInMaximum = ethers.utils.parseEther('5')
  
      const exactOutputParam = {
        tokenIn: weth.address,
        tokenOut: squeeth.address,
        fee: 3000,
        recipient: shortHelper.address,
        deadline: await getNow(provider) + 86400,
        amountOut: buyBackSqueethAmount,
        amountInMaximum,
        sqrtPriceLimitX96: 0,
      }
  
      // short helper already added as operator for seller1
      // buy and close
      await expect(shortHelper.connect(seller2).closeShort(seller1VaultId, buyBackSqueethAmount, withdrawCollateralAmount, exactOutputParam, {
          value: amountInMaximum // max amount used to buy back eth
        }
      )).to.be.revertedWith("Not allowed")
    })

    it ('should revert if trying to partially close a position using squeeth and not weth', async () => {
      const buyBackSqueethAmount = ethers.utils.parseEther('0.0005')
      const withdrawCollateralAmount = ethers.utils.parseEther('10')

      // max amount to buy back 0.1 squeeth
      const amountInMaximum = ethers.utils.parseEther('5')
  
      const exactOutputParam = {
        tokenIn: random.address,
        tokenOut: squeeth.address,
        fee: 3000,
        recipient: shortHelper.address,
        deadline: await getNow(provider) + 86400,
        amountOut: buyBackSqueethAmount,
        amountInMaximum,
        sqrtPriceLimitX96: 0,
      }
  
      // buy and close
      await expect(shortHelper.connect(seller1).closeShort(seller1VaultId, buyBackSqueethAmount, withdrawCollateralAmount, exactOutputParam, {
          value: amountInMaximum // max amount used to buy back eth
        }
      )).to.be.revertedWith('Wrong swap tokens')
    })

    it ('should revert if trying to partially close a position using weth and non-squeeth', async () => {
      const buyBackSqueethAmount = ethers.utils.parseEther('0.0005')
      const withdrawCollateralAmount = ethers.utils.parseEther('10')

      // max amount to buy back 0.1 squeeth
      const amountInMaximum = ethers.utils.parseEther('5')
  
      const exactOutputParam = {
        tokenIn: weth.address,
        tokenOut: random.address,
        fee: 3000,
        recipient: shortHelper.address,
        deadline: await getNow(provider) + 86400,
        amountOut: buyBackSqueethAmount,
        amountInMaximum,
        sqrtPriceLimitX96: 0,
      }
  
      // buy and close
      await expect(shortHelper.connect(seller1).closeShort(seller1VaultId, buyBackSqueethAmount, withdrawCollateralAmount, exactOutputParam, {
          value: amountInMaximum // max amount used to buy back eth
        }
      )).to.be.revertedWith('Wrong swap tokens')
    })

    it('should revert if slippage is too high', async() => {      
      const vaultToClose = await controller.vaults(seller1VaultId)
      const buyBackSqueethAmount = vaultToClose.shortAmount
      const withdrawCollateralAmount = vaultToClose.collateralAmount
      const maxWethToPay = squeethAmount.mul(startingEthPrice).div(oracleScaleFactor)

      const exactOutputParam = {
        tokenIn: weth.address,
        tokenOut: squeeth.address,
        fee: 3000,
        recipient: shortHelper.address,
        deadline: await getNow(provider) + 86400,
        amountOut: buyBackSqueethAmount,
        amountInMaximum: maxWethToPay,
        sqrtPriceLimitX96: 0,
      }    
      
      // revert with STF cuz the short helper won't have enough weth to pay for it
      await expect(shortHelper.connect(seller1).closeShort(seller1VaultId, buyBackSqueethAmount, withdrawCollateralAmount, exactOutputParam, {
          value: maxWethToPay, 
        }
      )).to.be.revertedWith('STF')
    })

    it('should revert if end price is too high', async() => {  
      const pool = await ethers.getContractAt('IUniswapV3Pool', poolAddress) as IUniswapV3Pool
      const { sqrtPriceX96 } = await pool.slot0()
      
      const vaultToClose = await controller.vaults(seller2VaultId)
      const buyBackSqueethAmount = vaultToClose.shortAmount
      const withdrawCollateralAmount = vaultToClose.collateralAmount

      // max amount to buy back squeeth
      const amountInMaximum = ethers.utils.parseEther('10')
  
      const exactOutputParam = {
        tokenIn: weth.address,
        tokenOut: squeeth.address,
        fee: 3000,
        recipient: shortHelper.address,
        deadline: await getNow(provider) + 86400,
        amountOut: buyBackSqueethAmount,
        amountInMaximum,
        sqrtPriceLimitX96: sqrtPriceX96, // set the limit as current price
      }    
      
      await controller.connect(seller2).updateOperator(seller2VaultId, shortHelper.address)
      await expect(shortHelper.connect(seller2).closeShort(seller2VaultId, buyBackSqueethAmount, withdrawCollateralAmount, exactOutputParam, {
          value: amountInMaximum
        }
      )).to.be.revertedWith('SPL')
      
    })

    it ('should revert when leaving vault with dust collateral and debt', async () => {
      const vault = await controller.vaults(seller1VaultId)
      
      const buyBackWsqueethAmount = vault.shortAmount.sub(10) // leaving 10 wei wsqueeth
      
      // leaving the vault with 1 wei less than 0.5
      const withdrawCollateralAmount = vault.collateralAmount.sub(ethers.utils.parseEther('0.5')).add(1)
      
      const amountInMaximum = ethers.utils.parseEther('20')
  
      const exactOutputParam = {
        tokenIn: weth.address,
        tokenOut: squeeth.address,
        fee: 3000,
        recipient: shortHelper.address,
        deadline: await getNow(provider) + 86400,
        amountOut: buyBackWsqueethAmount,
        amountInMaximum,
        sqrtPriceLimitX96: 0,
      }
  
      await expect(shortHelper.connect(seller1)
        .closeShort(seller1VaultId, buyBackWsqueethAmount, withdrawCollateralAmount, exactOutputParam, {value: amountInMaximum}
      )).to.be.revertedWith('C22')  
    })

    it ('should revert if remove too much collateral vs debt bought back', async () => {
      const vault = await controller.vaults(seller1VaultId)
      
      const buyBackWsqueethAmount = 10
      
      const withdrawCollateralAmount = vault.collateralAmount.sub(ethers.utils.parseEther('0.5'))
      
      const amountInMaximum = ethers.utils.parseEther('0.02')
  
      const exactOutputParam = {
        tokenIn: weth.address,
        tokenOut: squeeth.address,
        fee: 3000,
        recipient: shortHelper.address,
        deadline: await getNow(provider) + 86400,
        amountOut: buyBackWsqueethAmount,
        amountInMaximum,
        sqrtPriceLimitX96: 0,
      }
  
      await expect(shortHelper.connect(seller1)
        .closeShort(seller1VaultId, buyBackWsqueethAmount, withdrawCollateralAmount, exactOutputParam, {value: amountInMaximum}
      )).to.be.revertedWith('C24')  
    })
    
    it ('should partially close a short position and get back eth', async () => {
      const buyBackSqueethAmount = ethers.utils.parseEther('0.0005')
      const withdrawCollateralAmount = ethers.utils.parseEther('10')

      // max amount to buy back 0.1 squeeth
      const amountInMaximum = ethers.utils.parseEther('5')
  
      const exactOutputParam = {
        tokenIn: weth.address,
        tokenOut: squeeth.address,
        fee: 3000,
        recipient: shortHelper.address,
        deadline: await getNow(provider) + 86400,
        amountOut: buyBackSqueethAmount,
        amountInMaximum,
        sqrtPriceLimitX96: 0,
      }
  
      // short helper already added as operator for seller1

      const nftBalanceBefore = await shortPowerPerp.balanceOf(seller1.address)
      const poolSqueethBefore = await squeeth.balanceOf(poolAddress)
      const sellerEthBefore = await provider.getBalance(seller1.address)
      const poolWethBefore = await weth.balanceOf(poolAddress)

      // buy and close
      await shortHelper.connect(seller1).closeShort(seller1VaultId, buyBackSqueethAmount, withdrawCollateralAmount, exactOutputParam, {
          value: amountInMaximum // max amount used to buy back eth
        }
      )
  
      const nftBalanceAfter = await shortPowerPerp.balanceOf(seller1.address)
      const poolSqueethAfter = await squeeth.balanceOf(poolAddress)
      const sellerEthAfter = await provider.getBalance(seller1.address)
      const poolWethAfter = await weth.balanceOf(poolAddress)
  
      expect(nftBalanceAfter.eq(nftBalanceBefore)).to.be.true
      expect(poolSqueethAfter.toString()).to.be.eq(poolSqueethBefore.sub(buyBackSqueethAmount), "squeeth mismatch")
      // expect(poolWethAfter.sub(poolWethBefore).toString()).to.be.eq(
      //   sellerEthBefore.add(withdrawCollateralAmount).sub(sellerEthAfter), "weth mismatch"
      // )
    })

    it ('should fully close a short position and get back eth', async () => {
      const vaultToClose = await controller.vaults(seller2VaultId)
      const buyBackSqueethAmount = vaultToClose.shortAmount
      const withdrawCollateralAmount = vaultToClose.collateralAmount

      // max amount to buy back 0.1 squeeth
      const amountInMaximum = ethers.utils.parseEther('10')
  
      const exactOutputParam = {
        tokenIn: weth.address,
        tokenOut: squeeth.address,
        fee: 3000,
        recipient: shortHelper.address,
        deadline: await getNow(provider) + 86400,
        amountOut: buyBackSqueethAmount,
        amountInMaximum,
        sqrtPriceLimitX96: 0,
      }    
      // add short helper as operator
      await controller.connect(seller2).updateOperator(seller2VaultId, shortHelper.address)

      const nftBalanceBefore = await shortPowerPerp.balanceOf(seller2.address)
      const poolSqueethBefore = await squeeth.balanceOf(poolAddress)
      const sellerEthBefore = await provider.getBalance(seller2.address)
      const poolWethBefore = await weth.balanceOf(poolAddress)

      // buy and close
      await shortHelper.connect(seller2).closeShort(seller2VaultId, buyBackSqueethAmount, withdrawCollateralAmount, exactOutputParam, {
          value: amountInMaximum // max amount used to buy back eth
        }
      )
  
      const nftBalanceAfter = await shortPowerPerp.balanceOf(seller2.address)
      const poolSqueethAfter = await squeeth.balanceOf(poolAddress)
      const sellerEthAfter = await provider.getBalance(seller2.address)
      const poolWethAfter = await weth.balanceOf(poolAddress)
  
      expect(nftBalanceAfter.eq(nftBalanceBefore)).to.be.true // nft amount stay the same
      expect(poolSqueethAfter.toString()).to.be.eq(poolSqueethBefore.sub(buyBackSqueethAmount), "squeeth mismatch")
      // expect(poolWethAfter.sub(poolWethBefore).toString()).to.be.eq(
      //   sellerEthBefore.add(withdrawCollateralAmount).sub(sellerEthAfter), "weth mismatch"
      // )
    })

  })
});
