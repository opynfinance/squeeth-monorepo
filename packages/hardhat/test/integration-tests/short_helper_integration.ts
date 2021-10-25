import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers";

import { ethers, getNamedAccounts, deployments } from "hardhat"
import { expect } from "chai";
import { Contract, providers } from "ethers";
import { Controller, ShortPowerPerp, WPowerPerp, ShortHelper, WETH9 } from "../../typechain";

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
  let provider: providers.JsonRpcProvider;

  let seller1VaultId = 0;
  let seller2VaultId = 0; 

  const squeethAmount = ethers.utils.parseEther('10')
  const collateralAmount = ethers.utils.parseEther('20')

  this.beforeAll("Prepare accounts", async() => {
    const accounts = await ethers.getSigners();
    const [,_seller1, _seller2] = accounts;
    seller1 = _seller1
    seller2 = _seller2
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
    it('should deploy ShortHelper', async () => {
      const { deployer } = await getNamedAccounts();
      const { deploy } = deployments;
      await deploy("ShortHelper", {
        from: deployer,
        args: [controller.address, swapRouter.address, weth.address]
      });
  
      // deploy short helper
      shortHelper = await ethers.getContract("ShortHelper", deployer);
  
      expect(await shortHelper.shortPowerPerp()).to.be.eq(shortPowerPerp.address, "shortPowerPerp address mismatch")
      expect(await shortHelper.controller()).to.be.eq(controller.address, "controller address mismatch")
      expect(await shortHelper.router()).to.be.eq(swapRouter.address, "swapRouter address mismatch")
      expect(await shortHelper.weth()).to.be.eq(weth.address, "weth address mismatch")
    })
  })

  describe('Create short position', async() => {
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
      // there is no access control here now, we need to fix!
      
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
      

      expect

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
          value: collateralAmount, 
          gasPrice: 0 // won't cost gas so we can calculate eth recieved
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
      expect(poolWethBefore.sub(poolWethAfter).toString()).to.be.eq(
        sellerEthAfter.add(collateralAmount).sub(sellerEthBefore), "weth mismatch"
      )
    })

  })

  describe('Checking eth payable reverts', async() => {
    it ('should revert if ETH is sent from a contract other than weth or the controller', async () => {
      await expect(seller1.sendTransaction({to: shortHelper.address, value:1})).to.be.revertedWith("can't receive eth")
    })
  })

  describe('Close short position', async() => {

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
  
      // add short helper as operator
      await controller.connect(seller1).updateOperator(seller1VaultId,shortHelper.address, {gasPrice: 0})

      const nftBalanceBefore = await shortPowerPerp.balanceOf(seller1.address)
      const poolSqueethBefore = await squeeth.balanceOf(poolAddress)
      const sellerEthBefore = await provider.getBalance(seller1.address)
      const poolWethBefore = await weth.balanceOf(poolAddress)

      // buy and close
      await shortHelper.connect(seller1).closeShort(seller1VaultId, buyBackSqueethAmount, withdrawCollateralAmount, exactOutputParam, {
          value: amountInMaximum, // max amount used to buy back eth
          gasPrice: 0 // won't cost gas so we can calculate eth received
        }
      )
  
      const nftBalanceAfter = await shortPowerPerp.balanceOf(seller1.address)
      const poolSqueethAfter = await squeeth.balanceOf(poolAddress)
      const sellerEthAfter = await provider.getBalance(seller1.address)
      const poolWethAfter = await weth.balanceOf(poolAddress)
  
      expect(nftBalanceAfter.eq(nftBalanceBefore)).to.be.true
      expect(poolSqueethAfter.toString()).to.be.eq(poolSqueethBefore.sub(buyBackSqueethAmount), "squeeth mismatch")
      expect(poolWethAfter.sub(poolWethBefore).toString()).to.be.eq(
        sellerEthBefore.add(withdrawCollateralAmount).sub(sellerEthAfter), "weth mismatch"
      )
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
          value: amountInMaximum, // max amount used to buy back eth
          gasPrice: 0 // won't cost gas so we can calculate eth received
        }
      )
  
      const nftBalanceAfter = await shortPowerPerp.balanceOf(seller2.address)
      const poolSqueethAfter = await squeeth.balanceOf(poolAddress)
      const sellerEthAfter = await provider.getBalance(seller2.address)
      const poolWethAfter = await weth.balanceOf(poolAddress)
  
      expect(nftBalanceAfter.eq(nftBalanceBefore)).to.be.true // nft amount stay the same
      expect(poolSqueethAfter.toString()).to.be.eq(poolSqueethBefore.sub(buyBackSqueethAmount), "squeeth mismatch")
      expect(poolWethAfter.sub(poolWethBefore).toString()).to.be.eq(
        sellerEthBefore.add(withdrawCollateralAmount).sub(sellerEthAfter), "weth mismatch"
      )
    })

  })
});
