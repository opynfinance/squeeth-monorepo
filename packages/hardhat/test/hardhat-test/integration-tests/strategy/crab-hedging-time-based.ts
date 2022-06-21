import { ethers } from "hardhat"
import { expect } from "chai";
import BigNumberJs from 'bignumber.js'

import { Contract, BigNumber, providers } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { WETH9, MockErc20, Controller, Oracle, WPowerPerp, CrabStrategy } from "../../../../typechain";
import { deployUniswapV3, deploySqueethCoreContracts, deployWETHAndDai, addWethDaiLiquidity, addSqueethLiquidity, buyWSqueeth, buyWeth } from '../../setup'
import { isSimilar, wmul, wdiv, one, oracleScaleFactor } from "../../utils"

BigNumberJs.set({EXPONENTIAL_AT: 30})

const calcPriceMulAndAuctionPrice = (isNegativeTargetHedge: boolean, maxPriceMultiplier: BigNumber, minPriceMultiplier: BigNumber, auctionExecution: BigNumber, currentWSqueethPrice: BigNumber) : [BigNumber, BigNumber] => {
  let priceMultiplier: BigNumber
  let auctionWSqueethEthPrice: BigNumber

  if(isNegativeTargetHedge) {
    priceMultiplier = maxPriceMultiplier.sub(wmul(auctionExecution, maxPriceMultiplier.sub(minPriceMultiplier)))
    auctionWSqueethEthPrice = wmul(currentWSqueethPrice, priceMultiplier);
  } 
  else {
    priceMultiplier = minPriceMultiplier.add(wmul(auctionExecution, maxPriceMultiplier.sub(minPriceMultiplier)))
    auctionWSqueethEthPrice = wmul(currentWSqueethPrice, priceMultiplier);
  }

  return [priceMultiplier, auctionWSqueethEthPrice]
}

describe("Crab flashswap integration test: time based hedging", function () {
  const startingEthPrice = 3000
  const startingEthPrice1e18 = BigNumber.from(startingEthPrice).mul(one) // 3000 * 1e18
  const scaledStartingSqueethPrice1e18 = startingEthPrice1e18.mul(11).div(10).div(oracleScaleFactor) // 0.303 * 1e18
  const scaledStartingSqueethPrice = startingEthPrice*1.1 / oracleScaleFactor.toNumber() // 0.303


  const hedgeTimeThreshold = 86400  // 24h
  const hedgePriceThreshold = ethers.utils.parseUnits('0.01')
  const auctionTime = 3600
  const minPriceMultiplier = ethers.utils.parseUnits('0.95')
  const maxPriceMultiplier = ethers.utils.parseUnits('1.05')

  let provider: providers.JsonRpcProvider;
  let owner: SignerWithAddress;
  let depositor: SignerWithAddress;
  let random: SignerWithAddress;
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
  let crabStrategy: CrabStrategy
  let ethDaiPool: Contract

  this.beforeAll("Deploy uniswap protocol & setup uniswap pool", async() => {
    const accounts = await ethers.getSigners();
    const [_owner, _depositor, _random, _feeRecipient ] = accounts;
    owner = _owner;
    depositor = _depositor;
    random = _random;
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

    const CrabStrategyContract = await ethers.getContractFactory("CrabStrategy");
    crabStrategy = (await CrabStrategyContract.deploy(controller.address, oracle.address, weth.address, uniswapFactory.address, wSqueethPool.address, hedgeTimeThreshold, hedgePriceThreshold, auctionTime, minPriceMultiplier, maxPriceMultiplier)) as CrabStrategy;
    
    const strategyCap = ethers.utils.parseUnits("1000")
    await crabStrategy.connect(owner).setStrategyCap(strategyCap)
    const strategyCapInContract = await crabStrategy.strategyCap()
    expect(strategyCapInContract.eq(strategyCap)).to.be.true
  })

  this.beforeAll("Seed pool liquidity", async() => {
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
    const msgvalue = ethers.utils.parseUnits('10.1')
    const depositorSqueethBalanceBefore = await wSqueeth.balanceOf(depositor.address)

    await crabStrategy.connect(depositor).flashDeposit(ethToDeposit, {value: msgvalue})
    
    const normFactor = await controller.normalizationFactor()
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

    expect(isSimilar(totalSupply.toString(),(expectedEthDeposit).toString())).to.be.true
    expect(isSimilar(depositorCrab.toString(),(expectedEthDeposit).toString())).to.be.true
    expect(isSimilar(debtAmount.toString(), debtToMint.toString())).to.be.true
    expect(depositorSqueethBalance.eq(depositorSqueethBalanceBefore)).to.be.true
    expect(strategyContractSqueeth.eq(BigNumber.from(0))).to.be.true
    expect(lastHedgeTime.eq(timeStamp)).to.be.true
  })

  describe("Sell auction", async () => {
    it("should revert time hedging if the time threshold has not been reached", async () => {  
      const timeAtLastHedge = await crabStrategy.timeAtLastHedge()
      
      // set next block timestamp
      const currentBlockNumber = await provider.getBlockNumber()
      const currentBlock = await provider.getBlock(currentBlockNumber)
      const hedgeBlockTimestamp = currentBlock.timestamp + 1;
      await provider.send("evm_setNextBlockTimestamp", [hedgeBlockTimestamp])  
      expect((timeAtLastHedge.add(hedgeTimeThreshold)).gt(hedgeBlockTimestamp)).to.be.true
  
      const strategyVault = await controller.vaults(await crabStrategy.vaultId());
      const ethDelta = strategyVault.collateralAmount
      const currentWSqueethPrice = await oracle.getTwap(wSqueethPool.address, wSqueeth.address, weth.address, 600, true)
      const strategyDebt = await strategyVault.shortAmount
      const initialWSqueethDelta = wmul(strategyDebt.mul(2), currentWSqueethPrice)
      const targetHedge = wdiv(initialWSqueethDelta.sub(ethDelta), currentWSqueethPrice)
      const isSellAuction = targetHedge.isNegative()
      await expect(
        crabStrategy.connect(depositor).timeHedge(isSellAuction, 0, {value: 1})
      ).to.be.revertedWith("Time hedging is not allowed");
    })  

    it("should revert hedging if strategy is delta neutral", async () => {  
      
          
      await provider.send("evm_increaseTime", [hedgeTimeThreshold])
      await provider.send("evm_mine", [])

      const timeAtLastHedge = await crabStrategy.timeAtLastHedge()
      const auctionTriggerTimer = timeAtLastHedge.add(hedgeTimeThreshold)
      
      // set next block timestamp
      const currentBlockNumber = await provider.getBlockNumber()
      const currentBlock = await provider.getBlock(currentBlockNumber)
      const hedgeBlockTimestamp = currentBlock.timestamp + 1;
      await provider.send("evm_setNextBlockTimestamp", [hedgeBlockTimestamp])  
      
      const auctionTimeElapsed = BigNumber.from(hedgeBlockTimestamp).sub(auctionTriggerTimer)
      
      const currentWSqueethPrice = await oracle.getTwap(wSqueethPool.address, wSqueeth.address, weth.address, 600, false)
      const strategyVault = await controller.vaults(await crabStrategy.vaultId());
      const ethDelta = strategyVault.collateralAmount
      const normFactor = await controller.normalizationFactor()
      const currentScaledEthPrice = (await oracle.getTwap(ethDaiPool.address, weth.address, dai.address, 300, false)).div(oracleScaleFactor)
      const feeRate = await controller.feeRate()
      const ethFeePerWSqueeth = currentScaledEthPrice.mul(normFactor).mul(feeRate).div(10000).div(one)  

      const strategyDebt = strategyVault.shortAmount
      const initialWSqueethDelta = wmul(strategyDebt.mul(2), currentWSqueethPrice)
      const targetHedge = wdiv(initialWSqueethDelta.sub(ethDelta), currentWSqueethPrice.add(ethFeePerWSqueeth))        
      const isSellAuction = targetHedge.isNegative()
      const auctionExecution = (auctionTimeElapsed.gte(BigNumber.from(auctionTime))) ? one : wdiv(auctionTimeElapsed, BigNumber.from(auctionTime))
      const result = calcPriceMulAndAuctionPrice(isSellAuction, maxPriceMultiplier, minPriceMultiplier, auctionExecution, currentWSqueethPrice)
      const expectedAuctionWSqueethEthPrice = result[1]
      const finalWSqueethDelta = wmul(strategyDebt.mul(2), expectedAuctionWSqueethEthPrice)
      const secondTargetHedge = wdiv(finalWSqueethDelta.sub(ethDelta), expectedAuctionWSqueethEthPrice.add(ethFeePerWSqueeth))
      const expectedEthProceeds = wmul(secondTargetHedge.abs(), expectedAuctionWSqueethEthPrice)
      const expectedEthDeposited = expectedEthProceeds.sub(wmul(ethFeePerWSqueeth, secondTargetHedge.abs()))

      expect(targetHedge.abs().eq(BigNumber.from(0)) || isSimilar(initialWSqueethDelta.toString(), ethDelta.toString())).to.be.true
      await expect(
        crabStrategy.connect(depositor).timeHedge(isSellAuction, expectedAuctionWSqueethEthPrice, {value: 1})
      ).to.be.revertedWith("strategy is delta neutral");
    })
    
    it("should revert hedging if target hedge sign change (auction change from selling to buying)", async () => {
      // change pool price for auction to be sell auction
      const ethToDeposit = ethers.utils.parseUnits('1000')
      const wSqueethToMint = ethers.utils.parseUnits('1000')
      const currentBlockTimestamp = (await provider.getBlock(await provider.getBlockNumber())).timestamp
      await controller.connect(owner).mintWPowerPerpAmount("0", wSqueethToMint, "0", {value: ethToDeposit})
      await buyWeth(swapRouter, wSqueeth, weth, owner.address, (await wSqueeth.balanceOf(owner.address)), currentBlockTimestamp + 10)

      const timeAtLastHedge = await crabStrategy.timeAtLastHedge()
      
      const auctionTriggerTimer = timeAtLastHedge.add(hedgeTimeThreshold)

      // advanced more time to avoid traget hedge sign change
      await provider.send("evm_increaseTime", [600])
      await provider.send("evm_mine", [])              

      // set next block timestamp
      const currentBlockNumber = await provider.getBlockNumber()
      const currentBlock = await provider.getBlock(currentBlockNumber)
      const hedgeBlockTimestamp = currentBlock.timestamp + 1;
      await provider.send("evm_setNextBlockTimestamp", [hedgeBlockTimestamp])      

      const auctionTimeElapsed = BigNumber.from(hedgeBlockTimestamp).sub(auctionTriggerTimer)

      const currentWSqueethPrice = await oracle.getTwap(wSqueethPool.address, wSqueeth.address, weth.address, 600, false)
      const strategyVault = await controller.vaults(await crabStrategy.vaultId());
      const ethDelta = strategyVault.collateralAmount
      const normFactor = await controller.normalizationFactor()
      const currentScaledEthPrice = (await oracle.getTwap(ethDaiPool.address, weth.address, dai.address, 300, false)).div(oracleScaleFactor)
      const feeRate = await controller.feeRate()
      const ethFeePerWSqueeth = currentScaledEthPrice.mul(normFactor).mul(feeRate).div(10000).div(one)  

      const strategyDebt = strategyVault.shortAmount
      const initialWSqueethDelta = wmul(strategyDebt.mul(2), currentWSqueethPrice)
      const targetHedge = wdiv(initialWSqueethDelta.sub(ethDelta), currentWSqueethPrice.add(ethFeePerWSqueeth))        
      const isSellAuction = targetHedge.isNegative()
      const auctionExecution = (auctionTimeElapsed.gte(BigNumber.from(auctionTime))) ? one : wdiv(auctionTimeElapsed, BigNumber.from(auctionTime))
      const result = calcPriceMulAndAuctionPrice(isSellAuction, maxPriceMultiplier, minPriceMultiplier, auctionExecution, currentWSqueethPrice)
      const expectedAuctionWSqueethEthPrice = result[1]
      const finalWSqueethDelta = wmul(strategyDebt.mul(2), expectedAuctionWSqueethEthPrice)
      const secondTargetHedge = wdiv(finalWSqueethDelta.sub(ethDelta), expectedAuctionWSqueethEthPrice.add(ethFeePerWSqueeth))
      const expectedEthProceeds = wmul(secondTargetHedge.abs(), expectedAuctionWSqueethEthPrice)
      const expectedEthDeposited = expectedEthProceeds.sub(wmul(ethFeePerWSqueeth, secondTargetHedge.abs()))

      expect(isSellAuction).to.be.true

      await expect(
        crabStrategy.connect(depositor).timeHedge(isSellAuction, expectedAuctionWSqueethEthPrice, {value: expectedEthProceeds.add(1)})
      ).to.be.revertedWith("auction direction changed");
    })
    
    it("should revert hedging if sent ETH to sell for WSqueeth is not enough", async () => {      
      const timeAtLastHedge = await crabStrategy.timeAtLastHedge()
      
      const auctionTriggerTimer = timeAtLastHedge.add(hedgeTimeThreshold)

      // advanced more time to avoid traget hedge sign change
      await provider.send("evm_increaseTime", [auctionTime/2])
      await provider.send("evm_mine", [])      

      // set next block timestamp
      const currentBlockNumber = await provider.getBlockNumber()
      const currentBlock = await provider.getBlock(currentBlockNumber)
      const hedgeBlockTimestamp = currentBlock.timestamp + 100;
      await provider.send("evm_setNextBlockTimestamp", [hedgeBlockTimestamp])      

      const auctionTimeElapsed = BigNumber.from(hedgeBlockTimestamp).sub(auctionTriggerTimer)

      const currentWSqueethPrice = await oracle.getTwap(wSqueethPool.address, wSqueeth.address, weth.address, 600, false)
      const strategyVault = await controller.vaults(await crabStrategy.vaultId());
      const ethDelta = strategyVault.collateralAmount
      const normFactor = await controller.normalizationFactor()
      const currentScaledEthPrice = (await oracle.getTwap(ethDaiPool.address, weth.address, dai.address, 300, false)).div(oracleScaleFactor)
      const feeRate = await controller.feeRate()
      const ethFeePerWSqueeth = currentScaledEthPrice.mul(normFactor).mul(feeRate).div(10000).div(one)  

      const strategyDebt = strategyVault.shortAmount
      const initialWSqueethDelta = wmul(strategyDebt.mul(2), currentWSqueethPrice)
      const targetHedge = wdiv(initialWSqueethDelta.sub(ethDelta), currentWSqueethPrice.add(ethFeePerWSqueeth))        
      const isSellAuction = targetHedge.isNegative()
      const auctionExecution = (auctionTimeElapsed.gte(BigNumber.from(auctionTime))) ? one : wdiv(auctionTimeElapsed, BigNumber.from(auctionTime))
      const result = calcPriceMulAndAuctionPrice(isSellAuction, maxPriceMultiplier, minPriceMultiplier, auctionExecution, currentWSqueethPrice)
      const expectedAuctionWSqueethEthPrice = result[1]
      const finalWSqueethDelta = wmul(strategyDebt.mul(2), expectedAuctionWSqueethEthPrice)
      const secondTargetHedge = wdiv(finalWSqueethDelta.sub(ethDelta), expectedAuctionWSqueethEthPrice.add(ethFeePerWSqueeth))
      const expectedEthProceeds = wmul(secondTargetHedge.abs(), expectedAuctionWSqueethEthPrice)
      const expectedEthDeposited = expectedEthProceeds.sub(wmul(ethFeePerWSqueeth, secondTargetHedge.abs()))

      expect(isSellAuction).to.be.true

      await expect(
        crabStrategy.connect(depositor).timeHedge(isSellAuction, expectedAuctionWSqueethEthPrice, {value: expectedEthProceeds.sub(1)})
      ).to.be.revertedWith("Low ETH amount received");
    })

    it("should revert if hedger specifies wrong direction", async () => {
      const timeAtLastHedge = await crabStrategy.timeAtLastHedge()
      
      const auctionTriggerTimer = timeAtLastHedge.add(hedgeTimeThreshold)

      // advanced more time to avoid traget hedge sign change
      await provider.send("evm_increaseTime", [10])
      await provider.send("evm_mine", [])              

      // set next block timestamp
      const currentBlockNumber = await provider.getBlockNumber()
      const currentBlock = await provider.getBlock(currentBlockNumber)
      const hedgeBlockTimestamp = currentBlock.timestamp + 1;
      await provider.send("evm_setNextBlockTimestamp", [hedgeBlockTimestamp])  
      
      const auctionTimeElapsed = BigNumber.from(hedgeBlockTimestamp).sub(auctionTriggerTimer)

      const currentWSqueethPrice = await oracle.getTwap(wSqueethPool.address, wSqueeth.address, weth.address, 600, false)
      const strategyVault = await controller.vaults(await crabStrategy.vaultId());
      const ethDelta = strategyVault.collateralAmount
      const normFactor = await controller.normalizationFactor()
      const currentScaledEthPrice = (await oracle.getTwap(ethDaiPool.address, weth.address, dai.address, 300, false)).div(oracleScaleFactor)
      const feeRate = await controller.feeRate()
      const ethFeePerWSqueeth = currentScaledEthPrice.mul(normFactor).mul(feeRate).div(10000).div(one)  

      const strategyDebt = strategyVault.shortAmount
      const initialWSqueethDelta = wmul(strategyDebt.mul(2), currentWSqueethPrice)
      const targetHedge = wdiv(initialWSqueethDelta.sub(ethDelta), currentWSqueethPrice.add(ethFeePerWSqueeth))        
      const isSellAuction = targetHedge.isNegative()
      const auctionExecution = (auctionTimeElapsed.gte(BigNumber.from(auctionTime))) ? one : wdiv(auctionTimeElapsed, BigNumber.from(auctionTime))
      const result = calcPriceMulAndAuctionPrice(isSellAuction, maxPriceMultiplier, minPriceMultiplier, auctionExecution, currentWSqueethPrice)
      const expectedAuctionWSqueethEthPrice = result[1]
      const finalWSqueethDelta = wmul(strategyDebt.mul(2), expectedAuctionWSqueethEthPrice)
      const secondTargetHedge = wdiv(finalWSqueethDelta.sub(ethDelta), expectedAuctionWSqueethEthPrice.add(ethFeePerWSqueeth))
      const expectedEthProceeds = wmul(secondTargetHedge.abs(), expectedAuctionWSqueethEthPrice)
      const expectedEthDeposited = expectedEthProceeds.sub(wmul(ethFeePerWSqueeth, secondTargetHedge.abs()))
      
      const isStrategySellingWSqueeth = false
      expect(isSellAuction).to.be.true

      await expect(
        crabStrategy.connect(depositor).timeHedge(isStrategySellingWSqueeth, expectedAuctionWSqueethEthPrice, {value: expectedEthProceeds.add(1)})
      ).to.be.revertedWith("wrong auction type");
    }) 

    it("should revert if hedger specifies a limit price that is low", async () => {
      const timeAtLastHedge = await crabStrategy.timeAtLastHedge()
      
      const auctionTriggerTimer = timeAtLastHedge.add(hedgeTimeThreshold)

      // advanced more time to avoid traget hedge sign change
      await provider.send("evm_increaseTime", [10])
      await provider.send("evm_mine", [])              

      // set next block timestamp
      const currentBlockNumber = await provider.getBlockNumber()
      const currentBlock = await provider.getBlock(currentBlockNumber)
      const hedgeBlockTimestamp = currentBlock.timestamp + 1;
      await provider.send("evm_setNextBlockTimestamp", [hedgeBlockTimestamp]) 
      
      const auctionTimeElapsed = BigNumber.from(hedgeBlockTimestamp).sub(auctionTriggerTimer)

      const currentWSqueethPrice = await oracle.getTwap(wSqueethPool.address, wSqueeth.address, weth.address, 600, false)
      const strategyVault = await controller.vaults(await crabStrategy.vaultId());
      const ethDelta = strategyVault.collateralAmount
      const normFactor = await controller.normalizationFactor()
      const currentScaledEthPrice = (await oracle.getTwap(ethDaiPool.address, weth.address, dai.address, 300, false)).div(oracleScaleFactor)
      const feeRate = await controller.feeRate()
      const ethFeePerWSqueeth = currentScaledEthPrice.mul(normFactor).mul(feeRate).div(10000).div(one)  

      const strategyDebt = strategyVault.shortAmount
      const initialWSqueethDelta = wmul(strategyDebt.mul(2), currentWSqueethPrice)
      const targetHedge = wdiv(initialWSqueethDelta.sub(ethDelta), currentWSqueethPrice.add(ethFeePerWSqueeth))        
      const isSellAuction = targetHedge.isNegative()
      const auctionExecution = (auctionTimeElapsed.gte(BigNumber.from(auctionTime))) ? one : wdiv(auctionTimeElapsed, BigNumber.from(auctionTime))
      const result = calcPriceMulAndAuctionPrice(isSellAuction, maxPriceMultiplier, minPriceMultiplier, auctionExecution, currentWSqueethPrice)
      const expectedAuctionWSqueethEthPrice = result[1]
      const finalWSqueethDelta = wmul(strategyDebt.mul(2), expectedAuctionWSqueethEthPrice)
      const secondTargetHedge = wdiv(finalWSqueethDelta.sub(ethDelta), expectedAuctionWSqueethEthPrice.add(ethFeePerWSqueeth))
      const expectedEthProceeds = wmul(secondTargetHedge.abs(), expectedAuctionWSqueethEthPrice)
      const expectedEthDeposited = expectedEthProceeds.sub(wmul(ethFeePerWSqueeth, secondTargetHedge.abs()))

      expect(isSellAuction).to.be.true

      await expect(
        crabStrategy.connect(depositor).timeHedge(isSellAuction, expectedAuctionWSqueethEthPrice.div(2), {value: expectedEthProceeds.add(1)})
      ).to.be.revertedWith("Auction price > max price");
    }) 

    it("should hedge by selling WSqueeth for ETH and update timestamp and price at hedge", async () => {
      const timeAtLastHedge = await crabStrategy.timeAtLastHedge()
      
      const auctionTriggerTimer = timeAtLastHedge.add(hedgeTimeThreshold)
              
      // set next block timestamp
      const currentBlockNumber = await provider.getBlockNumber()
      const currentBlock = await provider.getBlock(currentBlockNumber)
      const hedgeBlockTimestamp = currentBlock.timestamp + 100;
      await provider.send("evm_setNextBlockTimestamp", [hedgeBlockTimestamp])

      const auctionTimeElapsed = BigNumber.from(hedgeBlockTimestamp).sub(auctionTriggerTimer)

      expect(await crabStrategy.checkPriceHedge(auctionTriggerTimer)).to.be.false;
      expect((await crabStrategy.checkTimeHedge())[0]).to.be.true;

      let currentWSqueethPrice = await oracle.getTwap(wSqueethPool.address, wSqueeth.address, weth.address, 600, false)
      const strategyVault = await controller.vaults(await crabStrategy.vaultId());
      const ethDelta = strategyVault.collateralAmount
      const normFactor = await controller.normalizationFactor()
      const currentScaledSquethPrice = (await oracle.getTwap(wSqueethPool.address, wSqueeth.address, weth.address, 300, false))
      const feeRate = await controller.feeRate()
      const ethFeePerWSqueeth = currentScaledSquethPrice.mul(feeRate).div(10000)

      const strategyDebt = strategyVault.shortAmount
      const initialWSqueethDelta = wmul(strategyDebt.mul(2), currentWSqueethPrice)
      const targetHedge = wdiv(initialWSqueethDelta.sub(ethDelta), currentWSqueethPrice.add(ethFeePerWSqueeth))        
      const isSellAuction = targetHedge.isNegative()
      const auctionExecution = (auctionTimeElapsed.gte(BigNumber.from(auctionTime))) ? one : wdiv(auctionTimeElapsed, BigNumber.from(auctionTime))
      const result = calcPriceMulAndAuctionPrice(isSellAuction, maxPriceMultiplier, minPriceMultiplier, auctionExecution, currentWSqueethPrice)
      const expectedAuctionWSqueethEthPrice = result[1]
      const finalWSqueethDelta = wmul(strategyDebt.mul(2), expectedAuctionWSqueethEthPrice)
      const secondTargetHedge = wdiv(finalWSqueethDelta.sub(ethDelta), expectedAuctionWSqueethEthPrice.add(ethFeePerWSqueeth))
      const expectedEthProceeds = wmul(secondTargetHedge.abs(), expectedAuctionWSqueethEthPrice)
      const expectedEthDeposited = expectedEthProceeds.sub(wmul(ethFeePerWSqueeth, secondTargetHedge.abs()))

      expect(isSellAuction).to.be.true

      expect(isSellAuction).to.be.true

      const senderWsqueethBalanceBefore = await wSqueeth.balanceOf(depositor.address)
        
      await crabStrategy.connect(depositor).timeHedge(isSellAuction, expectedAuctionWSqueethEthPrice, {value: expectedEthProceeds.add(1)})
      
      const hedgeBlockNumber = await provider.getBlockNumber()
      const hedgeBlock = await provider.getBlock(hedgeBlockNumber)

      currentWSqueethPrice = await oracle.getTwap(wSqueethPool.address, wSqueeth.address, weth.address, 600, false)
      const senderWsqueethBalanceAfter = await wSqueeth.balanceOf(depositor.address)
      const strategyVaultAfter = await controller.vaults(await crabStrategy.vaultId());
      const strategyCollateralAmountAfter = strategyVaultAfter.collateralAmount
      const strategyDebtAmountAfter = strategyVaultAfter.shortAmount
      const timeAtLastHedgeAfter = await crabStrategy.timeAtLastHedge()
      const priceAtLastHedgeAfter = await crabStrategy.priceAtLastHedge()

      expect(senderWsqueethBalanceAfter.gt(senderWsqueethBalanceBefore)).to.be.true
      expect(isSimilar(senderWsqueethBalanceAfter.sub(senderWsqueethBalanceBefore).toString(), secondTargetHedge.abs().toString())).to.be.true
      expect(isSimilar(strategyDebtAmountAfter.sub(strategyDebt).toString(), secondTargetHedge.abs().toString())).to.be.true
      expect(isSimilar(strategyCollateralAmountAfter.sub(ethDelta).toString(), expectedEthDeposited.toString())).to.be.true
      expect(timeAtLastHedgeAfter.eq(hedgeBlock.timestamp)).to.be.true
      expect(priceAtLastHedgeAfter.eq(currentWSqueethPrice)).to.be.true 
    })
  })

  describe("Buy auction", async () => {
    before(async () => {
      
      
      await provider.send("evm_increaseTime", [hedgeTimeThreshold + 1])
      await provider.send("evm_mine", [])

      // change pool price
      const currentBlockTimestamp = (await provider.getBlock(await provider.getBlockNumber())).timestamp
      await buyWSqueeth(swapRouter, wSqueeth, weth, owner.address, ethers.utils.parseUnits('10000'), currentBlockTimestamp + 10)
      // set depositor balance to 0
      await wSqueeth.connect(depositor).transfer(random.address, await wSqueeth.balanceOf(depositor.address))
    })

    it("should revert when the limit price is too high", async () => {
      const timeAtLastHedge = await crabStrategy.timeAtLastHedge()
      
      const auctionTriggerTimer = timeAtLastHedge.add(hedgeTimeThreshold)
      
      // advanced more time to avoid traget hedge sign change
      await provider.send("evm_increaseTime", [auctionTime/2])
      await provider.send("evm_mine", [])     
      
      const currentBlockNumber = await provider.getBlockNumber()
      const currentBlock = await provider.getBlock(currentBlockNumber)
      const hedgeBlockTimestamp = currentBlock.timestamp + 10;
      await provider.send("evm_setNextBlockTimestamp", [hedgeBlockTimestamp])
        
      const auctionTimeElapsed = BigNumber.from(hedgeBlockTimestamp).sub(auctionTriggerTimer)

      expect(await crabStrategy.checkPriceHedge(auctionTriggerTimer)).to.be.false;
      expect((await crabStrategy.checkTimeHedge())[0]).to.be.true;

      const currentWSqueethPrice = await oracle.getTwap(wSqueethPool.address, wSqueeth.address, weth.address, 600, false)
      const strategyVault = await controller.vaults(await crabStrategy.vaultId());
      const ethDelta = strategyVault.collateralAmount
      const strategyDebt = strategyVault.shortAmount
      const initialWSqueethDelta = wmul(strategyDebt.mul(2), currentWSqueethPrice)
      const targetHedge = wdiv(initialWSqueethDelta.sub(ethDelta), currentWSqueethPrice)
      const isSellAuction = targetHedge.isNegative()
      const auctionExecution = (auctionTimeElapsed.gte(BigNumber.from(auctionTime))) ? one : wdiv(auctionTimeElapsed, BigNumber.from(auctionTime))
      const result = calcPriceMulAndAuctionPrice(isSellAuction, maxPriceMultiplier, minPriceMultiplier, auctionExecution, currentWSqueethPrice)
      const expectedAuctionWSqueethEthPrice = result[1]

      expect(isSellAuction).to.be.false

      const senderWsqueethBalanceBefore = await wSqueeth.balanceOf(depositor.address)

      await wSqueeth.connect(depositor).approve(crabStrategy.address, senderWsqueethBalanceBefore)

      await expect(
        crabStrategy.connect(depositor).timeHedge(isSellAuction, expectedAuctionWSqueethEthPrice.mul(2))
      ).to.be.revertedWith("Auction price < min price");
    })

    it("should revert hedging when eth is attached to a buy hedge", async () => {
      const timeAtLastHedge = await crabStrategy.timeAtLastHedge()
      
      const auctionTriggerTimer = timeAtLastHedge.add(hedgeTimeThreshold)
              
      const currentBlockNumber = await provider.getBlockNumber()
      const currentBlock = await provider.getBlock(currentBlockNumber)
      const hedgeBlockTimestamp = currentBlock.timestamp + 10;
      await provider.send("evm_setNextBlockTimestamp", [hedgeBlockTimestamp])

      const auctionTimeElapsed = BigNumber.from(hedgeBlockTimestamp).sub(auctionTriggerTimer)
        
      expect(await crabStrategy.checkPriceHedge(auctionTriggerTimer)).to.be.false;
      expect((await crabStrategy.checkTimeHedge())[0]).to.be.true;

      const currentWSqueethPrice = await oracle.getTwap(wSqueethPool.address, wSqueeth.address, weth.address, 600, false)
      const strategyVault = await controller.vaults(await crabStrategy.vaultId());
      const ethDelta = strategyVault.collateralAmount
      const strategyDebt = strategyVault.shortAmount
      const initialWSqueethDelta = wmul(strategyDebt.mul(2), currentWSqueethPrice)
      const targetHedge = wdiv(initialWSqueethDelta.sub(ethDelta), currentWSqueethPrice)
      const isSellAuction = targetHedge.isNegative()
      const auctionExecution = (auctionTimeElapsed.gte(BigNumber.from(auctionTime))) ? one : wdiv(auctionTimeElapsed, BigNumber.from(auctionTime))
      const result = calcPriceMulAndAuctionPrice(isSellAuction, maxPriceMultiplier, minPriceMultiplier, auctionExecution, currentWSqueethPrice)
      const expectedAuctionWSqueethEthPrice = result[1]

      expect(isSellAuction).to.be.false

      const senderWsqueethBalanceBefore = await wSqueeth.balanceOf(depositor.address)

      await wSqueeth.connect(depositor).approve(crabStrategy.address, senderWsqueethBalanceBefore)

      await expect(
        crabStrategy.connect(depositor).timeHedge(isSellAuction, expectedAuctionWSqueethEthPrice, {value: 1})
      ).to.be.revertedWith("ETH attached for buy auction");
    })


    it("should revert hedging when WSqueeth seller have less amount that target hedge", async () => {
      const timeAtLastHedge = await crabStrategy.timeAtLastHedge()
      
      const auctionTriggerTimer = timeAtLastHedge.add(hedgeTimeThreshold)
              
      const currentBlockNumber = await provider.getBlockNumber()
      const currentBlock = await provider.getBlock(currentBlockNumber)
      const hedgeBlockTimestamp = currentBlock.timestamp + 10;
      await provider.send("evm_setNextBlockTimestamp", [hedgeBlockTimestamp])
      
      const auctionTimeElapsed = BigNumber.from(hedgeBlockTimestamp).sub(auctionTriggerTimer)
        
      expect(await crabStrategy.checkPriceHedge(auctionTriggerTimer)).to.be.false;
      expect((await crabStrategy.checkTimeHedge())[0]).to.be.true;

      const currentWSqueethPrice = await oracle.getTwap(wSqueethPool.address, wSqueeth.address, weth.address, 600, false)
      const strategyVault = await controller.vaults(await crabStrategy.vaultId());
      const ethDelta = strategyVault.collateralAmount
      const strategyDebt = strategyVault.shortAmount
      const initialWSqueethDelta = wmul(strategyDebt.mul(2), currentWSqueethPrice)
      const targetHedge = wdiv(initialWSqueethDelta.sub(ethDelta), currentWSqueethPrice)
      const isSellAuction = targetHedge.isNegative()
      const auctionExecution = (auctionTimeElapsed.gte(BigNumber.from(auctionTime))) ? one : wdiv(auctionTimeElapsed, BigNumber.from(auctionTime))
      const result = calcPriceMulAndAuctionPrice(isSellAuction, maxPriceMultiplier, minPriceMultiplier, auctionExecution, currentWSqueethPrice)
      const expectedAuctionWSqueethEthPrice = result[1]

      expect(isSellAuction).to.be.false

      const senderWsqueethBalanceBefore = await wSqueeth.balanceOf(depositor.address)

      await wSqueeth.connect(depositor).approve(crabStrategy.address, senderWsqueethBalanceBefore)

      await expect(
        crabStrategy.connect(depositor).timeHedge(isSellAuction, expectedAuctionWSqueethEthPrice)
      ).to.be.revertedWith("ERC20: transfer amount exceeds balance");
    })

    it("should hedge by buying WSqueeth for ETH ", async () => {
      const timeAtLastHedge = await crabStrategy.timeAtLastHedge()
      
      const auctionTriggerTimer = timeAtLastHedge.add(hedgeTimeThreshold)

      // advanced more time to avoid traget hedge sign change
      await provider.send("evm_increaseTime", [auctionTime/2])
      await provider.send("evm_mine", [])                
              
      // set next block timestamp
      const currentBlockNumber = await provider.getBlockNumber()
      const currentBlock = await provider.getBlock(currentBlockNumber)
      const hedgeBlockTimestamp = currentBlock.timestamp + 100;
      await provider.send("evm_setNextBlockTimestamp", [hedgeBlockTimestamp])

      const auctionTimeElapsed = BigNumber.from(hedgeBlockTimestamp).sub(auctionTriggerTimer)

      expect(await crabStrategy.checkPriceHedge(auctionTriggerTimer)).to.be.false;
      expect((await crabStrategy.checkTimeHedge())[0]).to.be.true;

      let currentWSqueethPrice = await oracle.getTwap(wSqueethPool.address, wSqueeth.address, weth.address, 600, false)
      const strategyVault = await controller.vaults(await crabStrategy.vaultId());
      const ethDelta = strategyVault.collateralAmount
      const strategyDebt = strategyVault.shortAmount
      const initialWSqueethDelta = wmul(strategyDebt.mul(2), currentWSqueethPrice)
      const targetHedge = wdiv(initialWSqueethDelta.sub(ethDelta), currentWSqueethPrice)        
      const isSellAuction = targetHedge.isNegative()
      const auctionExecution = (auctionTimeElapsed.gte(BigNumber.from(auctionTime))) ? one : wdiv(auctionTimeElapsed, BigNumber.from(auctionTime))
      const result = calcPriceMulAndAuctionPrice(isSellAuction, maxPriceMultiplier, minPriceMultiplier, auctionExecution, currentWSqueethPrice)
      const expectedAuctionWSqueethEthPrice = result[1]
      const finalWSqueethDelta = wmul(strategyDebt.mul(2), expectedAuctionWSqueethEthPrice)
      const secondTargetHedge = wdiv(finalWSqueethDelta.sub(ethDelta), expectedAuctionWSqueethEthPrice)
      const expectedEthProceeds = wmul(secondTargetHedge.abs(), expectedAuctionWSqueethEthPrice)

      expect(isSellAuction).to.be.false

      let collatToDeposit = wdiv(wmul(secondTargetHedge.abs(), ethDelta), strategyDebt) 
      if(collatToDeposit.lt(ethers.utils.parseUnits('0.5'))) {
        collatToDeposit = ethers.utils.parseUnits('1')
      }
      await controller.connect(depositor).mintWPowerPerpAmount("0", secondTargetHedge.abs(), "0", {value: collatToDeposit.add(collatToDeposit.mul(2).div(3))})
      const senderWsqueethBalanceBefore = await wSqueeth.balanceOf(depositor.address)

      await provider.send("evm_increaseTime", [50])

      await wSqueeth.connect(depositor).approve(crabStrategy.address, senderWsqueethBalanceBefore)
      await crabStrategy.connect(depositor).timeHedge(isSellAuction, expectedAuctionWSqueethEthPrice)

      currentWSqueethPrice = await oracle.getTwap(wSqueethPool.address, wSqueeth.address, weth.address, 600, false)
      const senderWsqueethBalanceAfter = await wSqueeth.balanceOf(depositor.address)
      const strategyVaultAfter = await controller.vaults(await crabStrategy.vaultId());
      const strategyCollateralAmountAfter = strategyVaultAfter.collateralAmount
      const strategyDebtAmountAfter = strategyVaultAfter.shortAmount
      
      expect(isSimilar(senderWsqueethBalanceBefore.sub(senderWsqueethBalanceAfter).toString(), secondTargetHedge.toString())).to.be.true
      expect(isSimilar(strategyDebt.sub(strategyDebtAmountAfter).toString(), secondTargetHedge.toString())).to.be.true
      expect(isSimilar(ethDelta.sub(strategyCollateralAmountAfter).toString(), expectedEthProceeds.abs().toString())).to.be.true
    })
  })
})