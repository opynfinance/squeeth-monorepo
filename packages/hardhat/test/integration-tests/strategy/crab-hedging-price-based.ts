import { ethers } from "hardhat"
import { expect } from "chai";
import { Contract, BigNumber, providers } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers";
import { WETH9, MockErc20, Controller, Oracle, WPowerPerp, CrabStrategy } from "../../../typechain";
import { deployUniswapV3, deploySqueethCoreContracts, deployWETHAndDai, addWethDaiLiquidity, addSqueethLiquidity, buyWSqueeth, buyWeth } from '../../setup'
import { isSimilar, wmul, wdiv, one, oracleScaleFactor } from "../../utils"
import BigNumberJs from 'bignumber.js'

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
  const scaledStartingSqueethPrice1e18 = startingEthPrice1e18.div(oracleScaleFactor) // 0.3 * 1e18
  const scaledStartingSqueethPrice = startingEthPrice / oracleScaleFactor.toNumber() // 0.3


  const hedgeTimeThreshold = 86400  // 24h
  const hedgePriceThreshold = ethers.utils.parseUnits('0.01')
  const auctionTime = 3600
  const minPriceMultiplier = ethers.utils.parseUnits('0.95')
  const maxPriceMultiplier = ethers.utils.parseUnits('1.05')

  let provider: providers.JsonRpcProvider;
  let owner: SignerWithAddress;
  let depositor: SignerWithAddress;
  let random: SignerWithAddress;
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

  this.beforeAll("Deploy uniswap protocol & setup uniswap pool", async() => {
    const accounts = await ethers.getSigners();
    const [_owner, _depositor, _random ] = accounts;
    owner = _owner;
    depositor = _depositor;
    random = _random;
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
    // ethDaiPool = squeethDeployments.ethDaiPool

    const CrabStrategyContract = await ethers.getContractFactory("CrabStrategy");
    crabStrategy = (await CrabStrategyContract.deploy(controller.address, oracle.address, weth.address, uniswapFactory.address, wSqueethPool.address, hedgeTimeThreshold, hedgePriceThreshold, auctionTime, minPriceMultiplier, maxPriceMultiplier)) as CrabStrategy;
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
  })

  this.beforeAll("Deposit into strategy", async () => {
    const ethToDeposit = ethers.utils.parseUnits('10')
    const ethToBorrow = ethers.utils.parseUnits('10')
    const msgvalue = ethers.utils.parseUnits('10.1')

    const squeethDelta = scaledStartingSqueethPrice1e18.mul(2);
    const debtToMint = wdiv(ethToDeposit.add(ethToBorrow), (squeethDelta));
    const depositorSqueethBalanceBefore = await wSqueeth.balanceOf(depositor.address)

    await crabStrategy.connect(depositor).flashDeposit(ethToDeposit, ethToBorrow, {value: msgvalue})
    
    const totalSupply = (await crabStrategy.totalSupply())
    const depositorCrab = (await crabStrategy.balanceOf(depositor.address))
    const debtAmount = (await crabStrategy.getStrategyDebt())
    const depositorSqueethBalance = await wSqueeth.balanceOf(depositor.address)
    const strategyContractSqueeth = await wSqueeth.balanceOf(crabStrategy.address)
    const lastHedgeTime = await crabStrategy.timeAtLastHedge()
    let currentBlockNumber = await provider.getBlockNumber()
    let currentBlock = await provider.getBlock(currentBlockNumber)
    let timeStamp = currentBlock.timestamp

    expect(totalSupply.eq(ethToDeposit.add(ethToBorrow))).to.be.true
    expect(depositorCrab.eq(ethToDeposit.add(ethToBorrow))).to.be.true
    expect(isSimilar(debtAmount.toString(), debtToMint.toString())).to.be.true
    expect(depositorSqueethBalance.eq(depositorSqueethBalanceBefore)).to.be.true
    expect(strategyContractSqueeth.eq(BigNumber.from(0))).to.be.true
    expect(lastHedgeTime.eq(timeStamp)).to.be.true
  })

  describe("Sell auction", async () => {
    before(async () => {
      const hedgeTimeThreshold = await crabStrategy.hedgeTimeThreshold()
      // ensure that we have a twap of 600s
      await provider.send("evm_increaseTime", [600])
      await provider.send("evm_mine", [])
    })

    it("should revert price hedging if the time threshold has not been reached", async () => {  
      const timeAtLastHedge = await crabStrategy.timeAtLastHedge()
      const hedgeTimeThreshold = await crabStrategy.hedgeTimeThreshold()
      
      // set next block timestamp
      const currentBlockNumber = await provider.getBlockNumber()
      const currentBlock = await provider.getBlock(currentBlockNumber)
      const hedgeBlockTimestamp = currentBlock.timestamp + 1;
      await provider.send("evm_setNextBlockTimestamp", [hedgeBlockTimestamp])  
      expect((timeAtLastHedge.add(hedgeTimeThreshold)).gt(hedgeBlockTimestamp)).to.be.true
  
      const ethDelta = await crabStrategy.getStrategyCollateral()
      const currentWSqueethPrice = await oracle.getTwapSafe(wSqueethPool.address, wSqueeth.address, weth.address, 600)
      const strategyDebt = await crabStrategy.getStrategyDebt()
      const initialWSqueethDelta = wmul(strategyDebt.mul(2), currentWSqueethPrice)
      const targetHedge = wdiv(initialWSqueethDelta.sub(ethDelta), currentWSqueethPrice)
      const isSellAuction = targetHedge.isNegative()
      await expect(
        crabStrategy.connect(depositor).priceHedge(hedgeBlockTimestamp, isSellAuction, 0, {value: 1})
      ).to.be.revertedWith("Price hedging not allowed");
    })
    
    it("price hedging should not immediately be eligible for a hedge", async () => {
      // change pool price
      const ethToDeposit = ethers.utils.parseUnits('10000')
      const wSqueethToMint = ethers.utils.parseUnits('10000')
      const currentBlockTimestamp = (await provider.getBlock(await provider.getBlockNumber())).timestamp
      await controller.connect(owner).mintWPowerPerpAmount("0", wSqueethToMint, "0", {value: ethToDeposit})
      await buyWeth(swapRouter, wSqueeth, weth, owner.address, (await wSqueeth.balanceOf(owner.address)), currentBlockTimestamp + 10)

      const priceAtLastHedge = await crabStrategy.priceAtLastHedge()
      const hedgePriceThreshold = await crabStrategy.hedgePriceThreshold()
      const currentWSqueethPrice = await oracle.getTwap(wSqueethPool.address, wSqueeth.address, weth.address, 600)
      const priceChange = one.mul(currentWSqueethPrice).div(priceAtLastHedge)
      const priceDeviation = priceChange.gt(one) ? priceChange.sub(one): one.sub(priceChange)
      
      expect(priceDeviation.lt(hedgePriceThreshold))

      // set next block timestamp
      const currentBlockNumber = await provider.getBlockNumber()
      const currentBlock = await provider.getBlock(currentBlockNumber)
      const auctionTriggerTimer = currentBlock.timestamp
      const hedgeBlockTimestamp = currentBlock.timestamp + 1;
      await provider.send("evm_setNextBlockTimestamp", [hedgeBlockTimestamp])   
      
      const auctionTimeElapsed = BigNumber.from(hedgeBlockTimestamp).sub(auctionTriggerTimer)

      expect(await crabStrategy.checkPriceHedge(auctionTriggerTimer)).to.be.false;
      expect((await crabStrategy.checkTimeHedge())[0]).to.be.false;

      const ethDelta = await crabStrategy.getStrategyCollateral()
      const strategyDebt = await crabStrategy.getStrategyDebt()
      const initialWSqueethDelta = wmul(wmul(strategyDebt, BigNumber.from(2).mul(one)), currentWSqueethPrice)
      const targetHedge = wdiv(initialWSqueethDelta.sub(ethDelta), currentWSqueethPrice)      
      const isSellAuction = targetHedge.isNegative()
      const auctionExecution = (auctionTimeElapsed.gte(BigNumber.from(auctionTime))) ? one : wdiv(auctionTimeElapsed, BigNumber.from(auctionTime))
      const result = calcPriceMulAndAuctionPrice(isSellAuction, maxPriceMultiplier, minPriceMultiplier, auctionExecution, currentWSqueethPrice)
      const expectedAuctionWSqueethEthPrice = result[1]
      const finalWSqueethDelta = wmul(wmul(strategyDebt, BigNumber.from(2).mul(one)), expectedAuctionWSqueethEthPrice)
      const secondTargetHedge = wdiv(finalWSqueethDelta.sub(ethDelta), expectedAuctionWSqueethEthPrice)
      const expectedEthProceeds = wmul(secondTargetHedge.abs(), expectedAuctionWSqueethEthPrice)

      await expect(
        crabStrategy.connect(depositor).priceHedge(auctionTriggerTimer, isSellAuction, expectedAuctionWSqueethEthPrice, {value: expectedEthProceeds})
      ).to.be.revertedWith("Price hedging not allowed");
    })
    
    it("it should be eligible for a hedge after time has passed for twap to update but will revert due to hedge sign change", async () => {
      // advance time for twap to update
      await provider.send("evm_increaseTime", [600])
      await provider.send("evm_mine", [])  

      const currentBlockNumber = await provider.getBlockNumber()
      const currentBlock = await provider.getBlock(currentBlockNumber)
      const auctionTriggerTimer = currentBlock.timestamp
      
      const priceAtLastHedge = await crabStrategy.priceAtLastHedge()
      const hedgePriceThreshold = await crabStrategy.hedgePriceThreshold()
      const currentWSqueethPrice = await oracle.getTwap(wSqueethPool.address, wSqueeth.address, weth.address, 600)
      const priceChange = one.mul(currentWSqueethPrice).div(priceAtLastHedge)
      const priceDeviation = priceChange.gt(one) ? priceChange.sub(one): one.sub(priceChange)
      const canPriceHedge = await crabStrategy.checkPriceHedge(auctionTriggerTimer)

      expect(priceDeviation.gt(hedgePriceThreshold))
      expect(canPriceHedge).to.be.true

      // set next block timestamp     
      const hedgeBlockTimestamp = currentBlock.timestamp + 1;
      await provider.send("evm_setNextBlockTimestamp", [hedgeBlockTimestamp])

      const auctionTimeElapsed = BigNumber.from(hedgeBlockTimestamp).sub(auctionTriggerTimer)

      expect(await crabStrategy.checkPriceHedge(auctionTriggerTimer)).to.be.true;
      expect((await crabStrategy.checkTimeHedge())[0]).to.be.false;

      const ethDelta = await crabStrategy.getStrategyCollateral()
      const strategyDebt = await crabStrategy.getStrategyDebt()
      const initialWSqueethDelta = wmul(wmul(strategyDebt, BigNumber.from(2).mul(one)), currentWSqueethPrice)
      const targetHedge = wdiv(initialWSqueethDelta.sub(ethDelta), currentWSqueethPrice)      
      const isSellAuction = targetHedge.isNegative()
      const auctionExecution = (auctionTimeElapsed.gte(BigNumber.from(auctionTime))) ? one : wdiv(auctionTimeElapsed, BigNumber.from(auctionTime))
      const result = calcPriceMulAndAuctionPrice(isSellAuction, maxPriceMultiplier, minPriceMultiplier, auctionExecution, currentWSqueethPrice)
      const expectedAuctionWSqueethEthPrice = result[1]
      const finalWSqueethDelta = wmul(wmul(strategyDebt, BigNumber.from(2).mul(one)), expectedAuctionWSqueethEthPrice)
      const secondTargetHedge = wdiv(finalWSqueethDelta.sub(ethDelta), expectedAuctionWSqueethEthPrice)
      const expectedEthProceeds = wmul(secondTargetHedge.abs(), expectedAuctionWSqueethEthPrice)

      expect(isSellAuction).to.be.true

      await expect(
        crabStrategy.connect(depositor).priceHedge(auctionTriggerTimer, isSellAuction, expectedAuctionWSqueethEthPrice, {value: expectedEthProceeds.add(1)})
      ).to.be.revertedWith("can not execute hedging trade as auction type changed");
    })    

    it("it should revert if hedger specifies the wrong direction", async () => {
      // advance time so hedge sign doesn't switch
      const currentBlockNumber = await provider.getBlockNumber()
      const currentBlock = await provider.getBlock(currentBlockNumber)
      const auctionTriggerTimer = currentBlock.timestamp

      await provider.send("evm_increaseTime", [auctionTime/2])
      await provider.send("evm_mine", [])  
            
      const priceAtLastHedge = await crabStrategy.priceAtLastHedge()
      const hedgePriceThreshold = await crabStrategy.hedgePriceThreshold()
      const currentWSqueethPrice = await oracle.getTwap(wSqueethPool.address, wSqueeth.address, weth.address, 600)
      const priceChange = one.mul(currentWSqueethPrice).div(priceAtLastHedge)
      const priceDeviation = priceChange.gt(one) ? priceChange.sub(one): one.sub(priceChange)
      const canPriceHedge = await crabStrategy.checkPriceHedge(auctionTriggerTimer)

      // set next block timestamp     
      const hedgeBlockNumber = await provider.getBlockNumber()
      const hedgeBlock = await provider.getBlock(hedgeBlockNumber)
      const hedgeBlockTimestamp = hedgeBlock.timestamp + 1;
      await provider.send("evm_setNextBlockTimestamp", [hedgeBlockTimestamp])

      const auctionTimeElapsed = BigNumber.from(hedgeBlockTimestamp).sub(auctionTriggerTimer)

      const ethDelta = await crabStrategy.getStrategyCollateral()
      const strategyDebt = await crabStrategy.getStrategyDebt()
      const initialWSqueethDelta = wmul(wmul(strategyDebt, BigNumber.from(2).mul(one)), currentWSqueethPrice)
      const targetHedge = wdiv(initialWSqueethDelta.sub(ethDelta), currentWSqueethPrice)      
      const isSellAuction = targetHedge.isNegative()
      const auctionExecution = (auctionTimeElapsed.gte(BigNumber.from(auctionTime))) ? one : wdiv(auctionTimeElapsed, BigNumber.from(auctionTime))
      const result = calcPriceMulAndAuctionPrice(isSellAuction, maxPriceMultiplier, minPriceMultiplier, auctionExecution, currentWSqueethPrice)
      const expectedAuctionWSqueethEthPrice = result[1]
      const finalWSqueethDelta = wmul(wmul(strategyDebt, BigNumber.from(2).mul(one)), expectedAuctionWSqueethEthPrice)
      const secondTargetHedge = wdiv(finalWSqueethDelta.sub(ethDelta), expectedAuctionWSqueethEthPrice)
      const expectedEthProceeds = wmul(secondTargetHedge.abs(), expectedAuctionWSqueethEthPrice)

      expect(isSellAuction).to.be.true

      await expect(
        crabStrategy.connect(depositor).priceHedge(auctionTriggerTimer, !isSellAuction, expectedAuctionWSqueethEthPrice, {value: expectedEthProceeds.add(1)})
      ).to.be.revertedWith("wrong auction type");
    })    

    it("it should allow a hedge based on price", async () => {
      // advance time so hedge sign doesn't switch
      const currentBlockNumber = await provider.getBlockNumber()
      const currentBlock = await provider.getBlock(currentBlockNumber)
      const auctionTriggerTimer = currentBlock.timestamp

      await provider.send("evm_increaseTime", [auctionTime/2])
      await provider.send("evm_mine", [])  
            
      const priceAtLastHedge = await crabStrategy.priceAtLastHedge()
      const hedgePriceThreshold = await crabStrategy.hedgePriceThreshold()
      const currentWSqueethPrice = await oracle.getTwap(wSqueethPool.address, wSqueeth.address, weth.address, 600)
      const priceChange = one.mul(currentWSqueethPrice).div(priceAtLastHedge)
      const priceDeviation = priceChange.gt(one) ? priceChange.sub(one): one.sub(priceChange)
      const canPriceHedge = await crabStrategy.checkPriceHedge(auctionTriggerTimer)

      expect(priceDeviation.gt(hedgePriceThreshold))
      expect(canPriceHedge).to.be.true

      // set next block timestamp     
      const hedgeBlockNumber = await provider.getBlockNumber()
      const hedgeBlock = await provider.getBlock(hedgeBlockNumber)
      const hedgeBlockTimestamp = hedgeBlock.timestamp + 1;
      await provider.send("evm_setNextBlockTimestamp", [hedgeBlockTimestamp])
   
      const auctionTimeElapsed = BigNumber.from(hedgeBlockTimestamp).sub(auctionTriggerTimer)

      const ethDelta = await crabStrategy.getStrategyCollateral()
      const strategyDebt = await crabStrategy.getStrategyDebt()
      const initialWSqueethDelta = wmul(wmul(strategyDebt, BigNumber.from(2).mul(one)), currentWSqueethPrice)
      const targetHedge = wdiv(initialWSqueethDelta.sub(ethDelta), currentWSqueethPrice)      
      const isSellAuction = targetHedge.isNegative()
      const auctionExecution = (auctionTimeElapsed.gte(BigNumber.from(auctionTime))) ? one : wdiv(auctionTimeElapsed, BigNumber.from(auctionTime))
      const result = calcPriceMulAndAuctionPrice(isSellAuction, maxPriceMultiplier, minPriceMultiplier, auctionExecution, currentWSqueethPrice)
      const expectedAuctionWSqueethEthPrice = result[1]
      const finalWSqueethDelta = wmul(wmul(strategyDebt, BigNumber.from(2).mul(one)), expectedAuctionWSqueethEthPrice)
      const secondTargetHedge = wdiv(finalWSqueethDelta.sub(ethDelta), expectedAuctionWSqueethEthPrice)
      const expectedEthProceeds = wmul(secondTargetHedge.abs(), expectedAuctionWSqueethEthPrice)

      expect(isSellAuction).to.be.true

      const senderWsqueethBalanceBefore = await wSqueeth.balanceOf(depositor.address)

      await crabStrategy.connect(depositor).priceHedge(auctionTriggerTimer, isSellAuction, expectedAuctionWSqueethEthPrice, {value: expectedEthProceeds})
              
      const currentWSqueethPriceAfter = await oracle.getTwap(wSqueethPool.address, wSqueeth.address, weth.address, 600)
      const senderWsqueethBalanceAfter = await wSqueeth.balanceOf(depositor.address)
      const strategyDebtAmountAfter = await crabStrategy.getStrategyDebt()
      const strategyCollateralAmountAfter = await crabStrategy.getStrategyCollateral()
      const timeAtLastHedgeAfter = await crabStrategy.timeAtLastHedge()
      const priceAtLastHedgeAfter = await crabStrategy.priceAtLastHedge()

      expect(isSimilar(senderWsqueethBalanceAfter.sub(senderWsqueethBalanceBefore).toString(), secondTargetHedge.mul(-1).toString())).to.be.true
      expect(isSimilar(strategyDebtAmountAfter.sub(strategyDebt).toString(), secondTargetHedge.mul(-1).toString())).to.be.true
      expect(isSimilar(strategyCollateralAmountAfter.sub(ethDelta).toString(), expectedEthProceeds.toString())).to.be.true
      expect(timeAtLastHedgeAfter.eq(hedgeBlockTimestamp)).to.be.true
      expect(priceAtLastHedgeAfter.eq(currentWSqueethPriceAfter)).to.be.true 
    })    
  })

  describe("Buy auction", async () => {
    before(async () => {
      const currentBlockTimestamp = (await provider.getBlock(await provider.getBlockNumber())).timestamp
      await buyWSqueeth(swapRouter, wSqueeth, weth, owner.address, ethers.utils.parseUnits('7500'), currentBlockTimestamp + 10)
      const priceBefore = await oracle.getTwap(wSqueethPool.address, wSqueeth.address, weth.address, 600)
    })

    it("should not immediately be eligible for a hedge", async () => {
      const priceAtLastHedge = await crabStrategy.priceAtLastHedge()
      const hedgePriceThreshold = await crabStrategy.hedgePriceThreshold()
      const currentWSqueethPrice = await oracle.getTwap(wSqueethPool.address, wSqueeth.address, weth.address, 600)
      const priceChange = one.mul(currentWSqueethPrice).div(priceAtLastHedge)
      const priceDeviation = priceChange.gt(one) ? priceChange.sub(one): one.sub(priceChange)
      
      expect(priceDeviation.lt(hedgePriceThreshold))

      // set next block timestamp
      const currentBlockNumber = await provider.getBlockNumber()
      const currentBlock = await provider.getBlock(currentBlockNumber)
      const auctionTriggerTimer = currentBlock.timestamp
      const hedgeBlockTimestamp = currentBlock.timestamp + 1;
      await provider.send("evm_setNextBlockTimestamp", [hedgeBlockTimestamp])  
      
      const auctionTimeElapsed = BigNumber.from(hedgeBlockTimestamp).sub(auctionTriggerTimer)

      expect(await crabStrategy.checkPriceHedge(auctionTriggerTimer)).to.be.false;
      expect((await crabStrategy.checkTimeHedge())[0]).to.be.false;

      const ethDelta = await crabStrategy.getStrategyCollateral()
      const strategyDebt = await crabStrategy.getStrategyDebt()
      const initialWSqueethDelta = wmul(wmul(strategyDebt, BigNumber.from(2).mul(one)), currentWSqueethPrice)
      const targetHedge = wdiv(initialWSqueethDelta.sub(ethDelta), currentWSqueethPrice)      
      const isSellAuction = targetHedge.isNegative()
      const auctionExecution = (auctionTimeElapsed.gte(BigNumber.from(auctionTime))) ? one : wdiv(auctionTimeElapsed, BigNumber.from(auctionTime))
      const result = calcPriceMulAndAuctionPrice(isSellAuction, maxPriceMultiplier, minPriceMultiplier, auctionExecution, currentWSqueethPrice)
      const expectedAuctionWSqueethEthPrice = result[1]
      const finalWSqueethDelta = wmul(wmul(strategyDebt, BigNumber.from(2).mul(one)), expectedAuctionWSqueethEthPrice)
      const secondTargetHedge = wdiv(finalWSqueethDelta.sub(ethDelta), expectedAuctionWSqueethEthPrice)
      const expectedEthProceeds = wmul(secondTargetHedge.abs(), expectedAuctionWSqueethEthPrice)

      const senderWsqueethBalanceBefore = await wSqueeth.balanceOf(depositor.address)
      await wSqueeth.connect(depositor).approve(crabStrategy.address, senderWsqueethBalanceBefore)

      await expect(
        crabStrategy.connect(depositor).priceHedge(auctionTriggerTimer, isSellAuction, expectedAuctionWSqueethEthPrice)
      ).to.be.revertedWith("Price hedging not allowed");
    })    

    it("it should be eligible for a hedge after time has passed for twap to update but will revert due to hedge sign change", async () => {
      // advance time for twap to update
      await provider.send("evm_increaseTime", [600])
      await provider.send("evm_mine", []) 
      
      const priceAfter = await oracle.getTwap(wSqueethPool.address, wSqueeth.address, weth.address, 600)
      
      const currentBlockNumber = await provider.getBlockNumber()
      const currentBlock = await provider.getBlock(currentBlockNumber)
      const auctionTriggerTimer = currentBlock.timestamp
      
      const priceAtLastHedge = await crabStrategy.priceAtLastHedge()
      const hedgePriceThreshold = await crabStrategy.hedgePriceThreshold()
      const currentWSqueethPrice = await oracle.getTwap(wSqueethPool.address, wSqueeth.address, weth.address, 600)
      const priceChange = one.mul(currentWSqueethPrice).div(priceAtLastHedge)
      const priceDeviation = priceChange.gt(one) ? priceChange.sub(one): one.sub(priceChange)
      const canPriceHedge = await crabStrategy.checkPriceHedge(auctionTriggerTimer)

      expect(priceDeviation.gt(hedgePriceThreshold))
      expect(canPriceHedge).to.be.true

      // set next block timestamp     
      const hedgeBlockTimestamp = currentBlock.timestamp + 1;
      await provider.send("evm_setNextBlockTimestamp", [hedgeBlockTimestamp])

      const auctionTimeElapsed = BigNumber.from(hedgeBlockTimestamp).sub(auctionTriggerTimer)

      expect(await crabStrategy.checkPriceHedge(auctionTriggerTimer)).to.be.true;
      expect((await crabStrategy.checkTimeHedge())[0]).to.be.false;

      const ethDelta = await crabStrategy.getStrategyCollateral()
      const strategyDebt = await crabStrategy.getStrategyDebt()
      const initialWSqueethDelta = wmul(wmul(strategyDebt, BigNumber.from(2).mul(one)), currentWSqueethPrice)
      const targetHedge = wdiv(initialWSqueethDelta.sub(ethDelta), currentWSqueethPrice)      
      const isSellAuction = targetHedge.isNegative()
      const auctionExecution = (auctionTimeElapsed.gte(BigNumber.from(auctionTime))) ? one : wdiv(auctionTimeElapsed, BigNumber.from(auctionTime))
      const result = calcPriceMulAndAuctionPrice(isSellAuction, maxPriceMultiplier, minPriceMultiplier, auctionExecution, currentWSqueethPrice)
      const expectedAuctionWSqueethEthPrice = result[1]
      const finalWSqueethDelta = wmul(wmul(strategyDebt, BigNumber.from(2).mul(one)), expectedAuctionWSqueethEthPrice)
      const secondTargetHedge = wdiv(finalWSqueethDelta.sub(ethDelta), expectedAuctionWSqueethEthPrice)
      const expectedEthProceeds = wmul(secondTargetHedge.abs(), expectedAuctionWSqueethEthPrice)

      expect(isSellAuction).to.be.false

      await expect(
        crabStrategy.connect(depositor).priceHedge(auctionTriggerTimer, isSellAuction, expectedAuctionWSqueethEthPrice)
      ).to.be.revertedWith("can not execute hedging trade as auction type changed");
    })    

    it("it should revert if hedger specifies the wrong direction", async () => {
      // advance time so hedge sign doesn't switch
      const currentBlockNumber = await provider.getBlockNumber()
      const currentBlock = await provider.getBlock(currentBlockNumber)
      const auctionTriggerTimer = currentBlock.timestamp

      await provider.send("evm_increaseTime", [auctionTime/2])
      await provider.send("evm_mine", [])  
            
      const priceAtLastHedge = await crabStrategy.priceAtLastHedge()
      const hedgePriceThreshold = await crabStrategy.hedgePriceThreshold()
      const currentWSqueethPrice = await oracle.getTwap(wSqueethPool.address, wSqueeth.address, weth.address, 600)
      const priceChange = one.mul(currentWSqueethPrice).div(priceAtLastHedge)
      const priceDeviation = priceChange.gt(one) ? priceChange.sub(one): one.sub(priceChange)
      const canPriceHedge = await crabStrategy.checkPriceHedge(auctionTriggerTimer)

      expect(priceDeviation.gt(hedgePriceThreshold))
      expect(canPriceHedge).to.be.true

      // set next block timestamp     
      const hedgeBlockNumber = await provider.getBlockNumber()
      const hedgeBlock = await provider.getBlock(hedgeBlockNumber)
      const hedgeBlockTimestamp = hedgeBlock.timestamp + 1;
      await provider.send("evm_setNextBlockTimestamp", [hedgeBlockTimestamp])

      const auctionTimeElapsed = BigNumber.from(hedgeBlockTimestamp).sub(auctionTriggerTimer)

      const ethDelta = await crabStrategy.getStrategyCollateral()
      const strategyDebt = await crabStrategy.getStrategyDebt()
      const initialWSqueethDelta = wmul(wmul(strategyDebt, BigNumber.from(2).mul(one)), currentWSqueethPrice)
      const targetHedge = wdiv(initialWSqueethDelta.sub(ethDelta), currentWSqueethPrice)      
      const isSellAuction = targetHedge.isNegative()
      const auctionExecution = (auctionTimeElapsed.gte(BigNumber.from(auctionTime))) ? one : wdiv(auctionTimeElapsed, BigNumber.from(auctionTime))
      const result = calcPriceMulAndAuctionPrice(isSellAuction, maxPriceMultiplier, minPriceMultiplier, auctionExecution, currentWSqueethPrice)
      const expectedAuctionWSqueethEthPrice = result[1]
      const finalWSqueethDelta = wmul(wmul(strategyDebt, BigNumber.from(2).mul(one)), expectedAuctionWSqueethEthPrice)
      const secondTargetHedge = wdiv(finalWSqueethDelta.sub(ethDelta), expectedAuctionWSqueethEthPrice)
      const expectedEthProceeds = wmul(secondTargetHedge.abs(), expectedAuctionWSqueethEthPrice)

      expect(isSellAuction).to.be.false

      await expect(
        crabStrategy.connect(depositor).priceHedge(auctionTriggerTimer, !isSellAuction,expectedAuctionWSqueethEthPrice)
      ).to.be.revertedWith("wrong auction type");
    })
    
    it("it should revert if eth is attached to a buy auction", async () => {      
      const currentBlockNumber = await provider.getBlockNumber()
      const currentBlock = await provider.getBlock(currentBlockNumber)
      const auctionTriggerTimer = currentBlock.timestamp
      
      await provider.send("evm_increaseTime", [auctionTime/2])
      await provider.send("evm_mine", [])  

      const priceAtLastHedge = await crabStrategy.priceAtLastHedge()
      const hedgePriceThreshold = await crabStrategy.hedgePriceThreshold()
      const currentWSqueethPrice = await oracle.getTwap(wSqueethPool.address, wSqueeth.address, weth.address, 600)
      const priceChange = one.mul(currentWSqueethPrice).div(priceAtLastHedge)
      const priceDeviation = priceChange.gt(one) ? priceChange.sub(one): one.sub(priceChange)
      const canPriceHedge = await crabStrategy.checkPriceHedge(auctionTriggerTimer)

      expect(priceDeviation.gt(hedgePriceThreshold))
      expect(canPriceHedge).to.be.true

      // set next block timestamp     
      const hedgeBlockNumber = await provider.getBlockNumber()
      const hedgeBlock = await provider.getBlock(hedgeBlockNumber)
      const hedgeBlockTimestamp = hedgeBlock.timestamp + 1;
      await provider.send("evm_setNextBlockTimestamp", [hedgeBlockTimestamp])

      const auctionTimeElapsed = BigNumber.from(hedgeBlockTimestamp).sub(auctionTriggerTimer)

      expect(await crabStrategy.checkPriceHedge(auctionTriggerTimer)).to.be.true;
      expect((await crabStrategy.checkTimeHedge())[0]).to.be.false;

      const ethDelta = await crabStrategy.getStrategyCollateral()
      const strategyDebt = await crabStrategy.getStrategyDebt()
      const initialWSqueethDelta = wmul(wmul(strategyDebt, BigNumber.from(2).mul(one)), currentWSqueethPrice)
      const targetHedge = wdiv(initialWSqueethDelta.sub(ethDelta), currentWSqueethPrice)      
      const isSellAuction = targetHedge.isNegative()
      const auctionExecution = (auctionTimeElapsed.gte(BigNumber.from(auctionTime))) ? one : wdiv(auctionTimeElapsed, BigNumber.from(auctionTime))
      const result = calcPriceMulAndAuctionPrice(isSellAuction, maxPriceMultiplier, minPriceMultiplier, auctionExecution, currentWSqueethPrice)
      const expectedAuctionWSqueethEthPrice = result[1]
      const finalWSqueethDelta = wmul(wmul(strategyDebt, BigNumber.from(2).mul(one)), expectedAuctionWSqueethEthPrice)
      const secondTargetHedge = wdiv(finalWSqueethDelta.sub(ethDelta), expectedAuctionWSqueethEthPrice)
      const expectedEthProceeds = wmul(secondTargetHedge.abs(), expectedAuctionWSqueethEthPrice)

      expect(isSellAuction).to.be.false

      await expect(
        crabStrategy.connect(depositor).priceHedge(auctionTriggerTimer, isSellAuction, expectedAuctionWSqueethEthPrice, {value: 1})
      ).to.be.revertedWith("ETH attached for buy auction");
    })   

    it("it should revert if the limit price is breached", async () => {      
      const currentBlockNumber = await provider.getBlockNumber()
      const currentBlock = await provider.getBlock(currentBlockNumber)
      const auctionTriggerTimer = currentBlock.timestamp
      
      await provider.send("evm_increaseTime", [auctionTime/2])
      await provider.send("evm_mine", [])  
      
      const priceAtLastHedge = await crabStrategy.priceAtLastHedge()
      const hedgePriceThreshold = await crabStrategy.hedgePriceThreshold()
      const currentWSqueethPrice = await oracle.getTwap(wSqueethPool.address, wSqueeth.address, weth.address, 600)
      const priceChange = one.mul(currentWSqueethPrice).div(priceAtLastHedge)
      const priceDeviation = priceChange.gt(one) ? priceChange.sub(one): one.sub(priceChange)
      const canPriceHedge = await crabStrategy.checkPriceHedge(auctionTriggerTimer)

      expect(priceDeviation.gt(hedgePriceThreshold))
      expect(canPriceHedge).to.be.true

      // set next block timestamp     
      const hedgeBlockNumber = await provider.getBlockNumber()
      const hedgeBlock = await provider.getBlock(hedgeBlockNumber)
      const hedgeBlockTimestamp = hedgeBlock.timestamp + 1;
      await provider.send("evm_setNextBlockTimestamp", [hedgeBlockTimestamp])

      const auctionTimeElapsed = BigNumber.from(hedgeBlockTimestamp).sub(auctionTriggerTimer)

      expect(await crabStrategy.checkPriceHedge(auctionTriggerTimer)).to.be.true;
      expect((await crabStrategy.checkTimeHedge())[0]).to.be.false;

      const ethDelta = await crabStrategy.getStrategyCollateral()
      const strategyDebt = await crabStrategy.getStrategyDebt()
      const initialWSqueethDelta = wmul(wmul(strategyDebt, BigNumber.from(2).mul(one)), currentWSqueethPrice)
      const targetHedge = wdiv(initialWSqueethDelta.sub(ethDelta), currentWSqueethPrice)      
      const isSellAuction = targetHedge.isNegative()
      const auctionExecution = (auctionTimeElapsed.gte(BigNumber.from(auctionTime))) ? one : wdiv(auctionTimeElapsed, BigNumber.from(auctionTime))
      const result = calcPriceMulAndAuctionPrice(isSellAuction, maxPriceMultiplier, minPriceMultiplier, auctionExecution, currentWSqueethPrice)
      const expectedAuctionWSqueethEthPrice = result[1]
      const finalWSqueethDelta = wmul(wmul(strategyDebt, BigNumber.from(2).mul(one)), expectedAuctionWSqueethEthPrice)
      const secondTargetHedge = wdiv(finalWSqueethDelta.sub(ethDelta), expectedAuctionWSqueethEthPrice)
      const expectedEthProceeds = wmul(secondTargetHedge.abs(), expectedAuctionWSqueethEthPrice)
      
      expect(isSellAuction).to.be.false

      await expect(
        crabStrategy.connect(depositor).priceHedge(auctionTriggerTimer, isSellAuction, expectedAuctionWSqueethEthPrice.mul(2))
      ).to.be.revertedWith("Auction price greater than min accepted price");
    })  

    it("it should allow a hedge based on price", async () => {
      // advance time so hedge sign doesn't switch
      const currentBlockNumber = await provider.getBlockNumber()
      const currentBlock = await provider.getBlock(currentBlockNumber)
      const auctionTriggerTimer = currentBlock.timestamp

      await provider.send("evm_increaseTime", [auctionTime/2])
      await provider.send("evm_mine", [])  
            
      const priceAtLastHedge = await crabStrategy.priceAtLastHedge()
      const hedgePriceThreshold = await crabStrategy.hedgePriceThreshold()
      const currentWSqueethPrice = await oracle.getTwap(wSqueethPool.address, wSqueeth.address, weth.address, 600)
      const priceChange = one.mul(currentWSqueethPrice).div(priceAtLastHedge)
      const priceDeviation = priceChange.gt(one) ? priceChange.sub(one): one.sub(priceChange)
      const canPriceHedge = await crabStrategy.checkPriceHedge(auctionTriggerTimer)

      expect(priceDeviation.gt(hedgePriceThreshold))
      expect(canPriceHedge).to.be.true

      const collat = await crabStrategy.getStrategyCollateral()
      const debt = await crabStrategy.getStrategyDebt()
      const normFactor = await controller.getExpectedNormalizationFactor()

      const collatValueInUsd = collat
      const debtValueInUsd = debt.mul(normFactor).mul(startingEthPrice).div(10000)
      const collateralizatonRatio = one.mul(collatValueInUsd).mul(one).div(debtValueInUsd)

      const collatToDeposit = one.mul(normFactor).mul(2).mul(startingEthPrice).div(oracleScaleFactor).div(one)

      await controller.connect(depositor).mintWPowerPerpAmount("0", ethers.utils.parseUnits("3"), "0", {value: collatToDeposit.mul(10)})
      let senderWsqueethBalanceBefore = await wSqueeth.balanceOf(depositor.address)
      await wSqueeth.connect(depositor).approve(crabStrategy.address, senderWsqueethBalanceBefore)

      // set next block timestamp     
      const hedgeBlockNumber = await provider.getBlockNumber()
      const hedgeBlock = await provider.getBlock(hedgeBlockNumber)
      const hedgeBlockTimestamp = hedgeBlock.timestamp + 1;
      await provider.send("evm_setNextBlockTimestamp", [hedgeBlockTimestamp])

      const auctionTimeElapsed = BigNumber.from(hedgeBlockTimestamp).sub(auctionTriggerTimer)

      const ethDelta = await crabStrategy.getStrategyCollateral()
      const strategyDebt = await crabStrategy.getStrategyDebt()
      const initialWSqueethDelta = wmul(wmul(strategyDebt, BigNumber.from(2).mul(one)), currentWSqueethPrice)
      const targetHedge = wdiv(initialWSqueethDelta.sub(ethDelta), currentWSqueethPrice)      
      const isSellAuction = targetHedge.isNegative()
      const auctionExecution = (auctionTimeElapsed.gte(BigNumber.from(auctionTime))) ? one : wdiv(auctionTimeElapsed, BigNumber.from(auctionTime))
      const result = calcPriceMulAndAuctionPrice(isSellAuction, maxPriceMultiplier, minPriceMultiplier, auctionExecution, currentWSqueethPrice)
      const expectedAuctionWSqueethEthPrice = result[1]
      const finalWSqueethDelta = wmul(wmul(strategyDebt, BigNumber.from(2).mul(one)), expectedAuctionWSqueethEthPrice)
      const secondTargetHedge = wdiv(finalWSqueethDelta.sub(ethDelta), expectedAuctionWSqueethEthPrice)
      const expectedEthProceeds = wmul(secondTargetHedge.abs(), expectedAuctionWSqueethEthPrice)

      expect(isSellAuction).to.be.false

      await crabStrategy.connect(depositor).priceHedge(auctionTriggerTimer, isSellAuction, expectedAuctionWSqueethEthPrice)
              
      const currentWSqueethPriceAfter = await oracle.getTwap(wSqueethPool.address, wSqueeth.address, weth.address, 600)
      const senderWsqueethBalanceAfter = await wSqueeth.balanceOf(depositor.address)
      const strategyDebtAmountAfter = await crabStrategy.getStrategyDebt()
      const strategyCollateralAmountAfter = await crabStrategy.getStrategyCollateral()
      const timeAtLastHedgeAfter = await crabStrategy.timeAtLastHedge()
      const priceAtLastHedgeAfter = await crabStrategy.priceAtLastHedge()

      expect(isSimilar(senderWsqueethBalanceAfter.sub(senderWsqueethBalanceBefore).toString(), secondTargetHedge.mul(-1).toString())).to.be.true
      expect(isSimilar(strategyDebtAmountAfter.sub(strategyDebt).toString(), secondTargetHedge.mul(-1).toString())).to.be.true
      expect(isSimilar(strategyCollateralAmountAfter.sub(ethDelta).toString(), (expectedEthProceeds.mul(-1)).toString())).to.be.true
      expect(timeAtLastHedgeAfter.eq(hedgeBlockTimestamp)).to.be.true
      expect(priceAtLastHedgeAfter.eq(currentWSqueethPriceAfter)).to.be.true 
    })    
  })
})