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

describe("Crab flashswap integration test", function () {
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

  describe("Flash deposit", async () => {
    it("should revert flash depositing when ETH sent is not greater than ethToDeposit", async () => {
      const ethToDeposit = ethers.utils.parseUnits('1')
      const ethToBorrow = ethers.utils.parseUnits('1')
      const msgvalue = ethers.utils.parseUnits('1')

      await expect(
        crabStrategy.connect(depositor).flashDeposit(ethToDeposit, ethToBorrow, {value: msgvalue})
      ).to.be.revertedWith("Need some buffer");
    })

    it("should revert if depositing 0 ethToDeposit and 0 ethToBorrow due to slippage limit underflow", async () => {
      const ethToDeposit = ethers.utils.parseUnits('0')
      const ethToBorrow = ethers.utils.parseUnits('0')
      const msgvalue = ethers.utils.parseUnits('0.01')

      const squeethDelta = scaledStartingSqueethPrice1e18.mul(2);
      const debtToMint = wdiv(ethToDeposit.add(ethToBorrow), (squeethDelta));
      const depositorSqueethBalanceBefore = await wSqueeth.balanceOf(depositor.address)

      await expect(
        crabStrategy.connect(depositor).flashDeposit(ethToDeposit, ethToBorrow, {value: msgvalue})
      ).to.be.revertedWith("ds-math-sub-underflow");
    })

    it("should revert if slippage limit is breached", async () => {
      const ethToDeposit = ethers.utils.parseUnits('0.6')
      const ethToBorrow = ethers.utils.parseUnits('0.6')
      const msgvalue = ethers.utils.parseUnits('0.6000000001')
      const squeethDelta = scaledStartingSqueethPrice1e18.mul(2);
      const debtToMint = wdiv(ethToDeposit.add(ethToBorrow), (squeethDelta));
      const depositorSqueethBalanceBefore = await wSqueeth.balanceOf(depositor.address)

      await expect(
        crabStrategy.connect(depositor).flashDeposit(ethToDeposit, ethToBorrow, {value: msgvalue})
      ).to.be.revertedWith("function call failed to execute");
    })

    it("should deposit correct amount and mint correct shares amount", async () => {
      const ethToDeposit = ethers.utils.parseUnits('0.6')
      const ethToBorrow = ethers.utils.parseUnits('0.6')
      const msgvalue = ethers.utils.parseUnits('0.61')

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

    it("should deposit correct amount and mint correct shares amount on non-initial deposit", async () => {
      const ethToDeposit = ethers.utils.parseUnits('0.6')
      const ethToBorrow = ethers.utils.parseUnits('0.6')
      const msgvalue = ethers.utils.parseUnits('0.61')

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

      expect(totalSupply.eq(ethToDeposit.mul(2).add(ethToBorrow.mul(2)))).to.be.true
      expect(depositorCrab.eq(ethToDeposit.mul(2).add(ethToBorrow.mul(2)))).to.be.true
      expect(isSimilar(debtAmount.toString(), debtToMint.mul(2).toString())).to.be.true
      expect(depositorSqueethBalance.eq(depositorSqueethBalanceBefore)).to.be.true
      expect(strategyContractSqueeth.eq(BigNumber.from(0))).to.be.true
      expect(lastHedgeTime.eq(timeStamp)).to.be.false
    })
  })

  describe("Sell auction: time hedging before enough time has passed", async () => {
    before(async () => {
      const hedgeTimeThreshold = await crabStrategy.hedgeTimeThreshold()
            
      await provider.send("evm_increaseTime", [1])
      await provider.send("evm_mine", [])

    })

    describe("revert if not able to hedge due to time", async () => {
            
      it("should revert time hedging if the time threshold has not been reached", async () => {  
        const timeAtLastHedge = await crabStrategy.timeAtLastHedge()
        const hedgeTimeThreshold = await crabStrategy.hedgeTimeThreshold()
        const auctionTriggerTimer = timeAtLastHedge.add(hedgeTimeThreshold)
        
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
          crabStrategy.connect(depositor).timeHedge(isSellAuction, 0, {value: 1})
        ).to.be.revertedWith("Time hedging is not allowed");
      })  
    })

    it("should revert time hedging on uniswap if the time threshold has not been reached", async () => {  
      const timeAtLastHedge = await crabStrategy.timeAtLastHedge()
      const hedgeTimeThreshold = await crabStrategy.hedgeTimeThreshold()
      
      // set next block timestamp
      const currentBlockNumber = await provider.getBlockNumber()
      const currentBlock = await provider.getBlock(currentBlockNumber)
      const hedgeBlockTimestamp = currentBlock.timestamp + 1;
      await provider.send("evm_setNextBlockTimestamp", [hedgeBlockTimestamp])  
      expect((timeAtLastHedge.add(hedgeTimeThreshold)).gt(hedgeBlockTimestamp)).to.be.true
  
      await expect(
        crabStrategy.connect(depositor).timeHedgeOnUniswap()
      ).to.be.revertedWith("Time hedging is not allowed");
    })  
  })

  describe("Sell auction: price hedging with too small of a price deviation", async () => {
    before(async () => {
      const hedgeTimeThreshold = await crabStrategy.hedgeTimeThreshold()
      // ensure that we have a twap of 600s
      await provider.send("evm_increaseTime", [600])
      await provider.send("evm_mine", [])

    })

    describe("revert if not able to hedge due to price", async () => {
            
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
    })

    it("should revert price hedging on uniswap if the time threshold has not been reached", async () => {  
      const timeAtLastHedge = await crabStrategy.timeAtLastHedge()
      const hedgeTimeThreshold = await crabStrategy.hedgeTimeThreshold()
      
      // set next block timestamp
      const currentBlockNumber = await provider.getBlockNumber()
      const currentBlock = await provider.getBlock(currentBlockNumber)
      const hedgeBlockTimestamp = currentBlock.timestamp + 1;
      await provider.send("evm_setNextBlockTimestamp", [hedgeBlockTimestamp])  
      expect((timeAtLastHedge.add(hedgeTimeThreshold)).gt(hedgeBlockTimestamp)).to.be.true
  
      await expect(
        crabStrategy.connect(depositor).priceHedgeOnUniswap(hedgeBlockTimestamp)
      ).to.be.revertedWith("Price hedging not allowed");
    })  
  })

    describe("hedging delta neutral strategy", async () => {
      
      it("should revert hedging if strategy is delta neutral", async () => {  

        const hedgeTimeThreshold = await crabStrategy.hedgeTimeThreshold()
            
        await provider.send("evm_increaseTime", [hedgeTimeThreshold.toNumber()])
        await provider.send("evm_mine", [])

        const timeAtLastHedge = await crabStrategy.timeAtLastHedge()
        const auctionTriggerTimer = timeAtLastHedge.add(hedgeTimeThreshold)
        
        // set next block timestamp
        let currentBlockNumber = await provider.getBlockNumber()
        let currentBlock = await provider.getBlock(currentBlockNumber)
        const hedgeBlockTimestamp = currentBlock.timestamp + 1;
        await provider.send("evm_setNextBlockTimestamp", [hedgeBlockTimestamp])  
        
        const auctionTimeElapsed = BigNumber.from(hedgeBlockTimestamp).sub(auctionTriggerTimer)
    
        const ethDelta = await crabStrategy.getStrategyCollateral()
        const currentWSqueethPrice = await oracle.getTwapSafe(wSqueethPool.address, wSqueeth.address, weth.address, 600)
        const strategyDebt = await crabStrategy.getStrategyDebt()
        const initialWSqueethDelta = wmul(strategyDebt.mul(2), currentWSqueethPrice)
        const targetHedge = wdiv(initialWSqueethDelta.sub(ethDelta), currentWSqueethPrice)
        const isSellAuction = targetHedge.isNegative()
        const auctionExecution = (auctionTimeElapsed.gte(BigNumber.from(auctionTime))) ? one : wdiv(auctionTimeElapsed, BigNumber.from(auctionTime))
        const result = calcPriceMulAndAuctionPrice(isSellAuction, maxPriceMultiplier, minPriceMultiplier, auctionExecution, currentWSqueethPrice)
        const expectedAuctionWSqueethEthPrice = result[1]

        expect(targetHedge.abs().eq(BigNumber.from(0)) || isSimilar(initialWSqueethDelta.toString(), ethDelta.toString())).to.be.true
        await expect(
          crabStrategy.connect(depositor).timeHedge(isSellAuction, expectedAuctionWSqueethEthPrice, {value: 1})
        ).to.be.revertedWith("strategy is delta neutral");
      })  
      it("should revert hedgeOnUniswap if strategy is delta neutral", async () => {  

        const hedgeTimeThreshold = await crabStrategy.hedgeTimeThreshold()
    
        const timeAtLastHedge = await crabStrategy.timeAtLastHedge()
        const auctionTriggerTimer = timeAtLastHedge.add(hedgeTimeThreshold)
        
        // set next block timestamp
        let currentBlockNumber = await provider.getBlockNumber()
        let currentBlock = await provider.getBlock(currentBlockNumber)
        const hedgeBlockTimestamp = currentBlock.timestamp + 1;
        await provider.send("evm_setNextBlockTimestamp", [hedgeBlockTimestamp])      
    
        const auctionTimeElapsed = BigNumber.from(hedgeBlockTimestamp).sub(auctionTriggerTimer)

        const ethDelta = await crabStrategy.getStrategyCollateral()
        const currentWSqueethPrice = await oracle.getTwapSafe(wSqueethPool.address, wSqueeth.address, weth.address, 600)
        const strategyDebt = await crabStrategy.getStrategyDebt()
        const initialWSqueethDelta = wmul(strategyDebt.mul(2), currentWSqueethPrice)
        const targetHedge = wdiv(initialWSqueethDelta.sub(ethDelta), currentWSqueethPrice)
        const isSellAuction = targetHedge.isNegative()
        const auctionExecution = (auctionTimeElapsed.gte(BigNumber.from(auctionTime))) ? one : wdiv(auctionTimeElapsed, BigNumber.from(auctionTime))
        const result = calcPriceMulAndAuctionPrice(isSellAuction, maxPriceMultiplier, minPriceMultiplier, auctionExecution, currentWSqueethPrice)

        expect(targetHedge.abs().eq(BigNumber.from(0)) || isSimilar(initialWSqueethDelta.toString(), ethDelta.toString())).to.be.true
        await expect(
          crabStrategy.connect(depositor).timeHedgeOnUniswap()
        ).to.be.revertedWith("strategy is delta neutral");
      })  
    })

    describe("hedging non-delta neutral strategy: sell auction based on time threshold", async () => {
      before(async () => {
        const ethToDeposit = ethers.utils.parseUnits('1000')
        const wSqueethToMint = ethers.utils.parseUnits('1000')
      
        const currentBlockTimestamp = (await provider.getBlock(await provider.getBlockNumber())).timestamp

        await controller.connect(owner).mintWPowerPerpAmount("0", wSqueethToMint, "0", {value: ethToDeposit})
        await buyWeth(swapRouter, wSqueeth, weth, owner.address, (await wSqueeth.balanceOf(owner.address)), currentBlockTimestamp + 10)
      })

      it("should revert hedging if target hedge sign change (auction change from selling to buying)", async () => {
        const timeAtLastHedge = await crabStrategy.timeAtLastHedge()
        const hedgeTimeThreshold = await crabStrategy.hedgeTimeThreshold()
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

        const ethDelta = await crabStrategy.getStrategyCollateral()
        const currentWSqueethPrice = await oracle.getTwap(wSqueethPool.address, wSqueeth.address, weth.address, 600)
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
          crabStrategy.connect(depositor).timeHedge(isSellAuction, expectedAuctionWSqueethEthPrice, {value: expectedEthProceeds.add(1)})
        ).to.be.revertedWith("can not execute hedging trade");
      })    

      it("should revert hedging if sent ETH to sell for WSqueeth is not enough", async () => {      
        const timeAtLastHedge = await crabStrategy.timeAtLastHedge()
        const hedgeTimeThreshold = await crabStrategy.hedgeTimeThreshold()
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

        const ethDelta = await crabStrategy.getStrategyCollateral()
        const currentWSqueethPrice = await oracle.getTwapSafe(wSqueethPool.address, wSqueeth.address, weth.address, 600)
        const strategyDebt = await crabStrategy.getStrategyDebt()
        const initialWSqueethDelta = wmul(strategyDebt.mul(2), currentWSqueethPrice)
        const targetHedge = wdiv(initialWSqueethDelta.sub(ethDelta), currentWSqueethPrice)        
        const isSellAuction = targetHedge.isNegative()
        const auctionExecution = (auctionTimeElapsed.gte(BigNumber.from(auctionTime))) ? one : wdiv(auctionTimeElapsed, BigNumber.from(auctionTime))
        const result = calcPriceMulAndAuctionPrice(isSellAuction, maxPriceMultiplier, minPriceMultiplier, auctionExecution, currentWSqueethPrice)
        const expectedAuctionWSqueethEthPrice = result[1]
        const finalWSqueethDelta = wmul(strategyDebt.mul(2), expectedAuctionWSqueethEthPrice)
        const secondTargetHedge = wdiv(finalWSqueethDelta.sub(ethDelta), expectedAuctionWSqueethEthPrice)
        const expectedEthProceeds = wmul(secondTargetHedge.abs(), expectedAuctionWSqueethEthPrice)

        expect(isSellAuction).to.be.true

        await expect(
          crabStrategy.connect(depositor).timeHedge(isSellAuction, expectedAuctionWSqueethEthPrice, {value: expectedEthProceeds.sub(1)})
        ).to.be.revertedWith("Low ETH amount received");
      })

      it("should revert if hedger specifies wrong direction", async () => {
        const timeAtLastHedge = await crabStrategy.timeAtLastHedge()
        const hedgeTimeThreshold = await crabStrategy.hedgeTimeThreshold()
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
  
        const ethDelta = await crabStrategy.getStrategyCollateral()
        const currentWSqueethPrice = await oracle.getTwap(wSqueethPool.address, wSqueeth.address, weth.address, 600)
        const strategyDebt = await crabStrategy.getStrategyDebt()
        const initialWSqueethDelta = wmul(wmul(strategyDebt, BigNumber.from(2).mul(one)), currentWSqueethPrice)
        const targetHedge = wdiv(initialWSqueethDelta.sub(ethDelta), currentWSqueethPrice)        
        const isSellAuction = targetHedge.isNegative()
        
        const isStrategySellingWSqueeth = false
        expect(isSellAuction).to.be.true
        
        const auctionExecution = (auctionTimeElapsed.gte(BigNumber.from(auctionTime))) ? one : wdiv(auctionTimeElapsed, BigNumber.from(auctionTime))
        const result = calcPriceMulAndAuctionPrice(isSellAuction, maxPriceMultiplier, minPriceMultiplier, auctionExecution, currentWSqueethPrice)
        const expectedAuctionWSqueethEthPrice = result[1]
        const finalWSqueethDelta = wmul(wmul(strategyDebt, BigNumber.from(2).mul(one)), expectedAuctionWSqueethEthPrice)
        const secondTargetHedge = wdiv(finalWSqueethDelta.sub(ethDelta), expectedAuctionWSqueethEthPrice)
        const expectedEthProceeds = wmul(secondTargetHedge.abs(), expectedAuctionWSqueethEthPrice)

        await expect(
          crabStrategy.connect(depositor).timeHedge(isStrategySellingWSqueeth, expectedAuctionWSqueethEthPrice, {value: expectedEthProceeds.add(1)})
        ).to.be.revertedWith("wrong auction type");
      }) 

      it("should revert if hedger specifies a limit price that is low", async () => {
        const timeAtLastHedge = await crabStrategy.timeAtLastHedge()
        const hedgeTimeThreshold = await crabStrategy.hedgeTimeThreshold()
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
  
        const ethDelta = await crabStrategy.getStrategyCollateral()
        const currentWSqueethPrice = await oracle.getTwap(wSqueethPool.address, wSqueeth.address, weth.address, 600)
        const strategyDebt = await crabStrategy.getStrategyDebt()
        const initialWSqueethDelta = wmul(wmul(strategyDebt, BigNumber.from(2).mul(one)), currentWSqueethPrice)
        const targetHedge = wdiv(initialWSqueethDelta.sub(ethDelta), currentWSqueethPrice)        
        const isSellAuction = targetHedge.isNegative()
                
        expect(isSellAuction).to.be.true

        const auctionExecution = (auctionTimeElapsed.gte(BigNumber.from(auctionTime))) ? one : wdiv(auctionTimeElapsed, BigNumber.from(auctionTime))
        const result = calcPriceMulAndAuctionPrice(isSellAuction, maxPriceMultiplier, minPriceMultiplier, auctionExecution, currentWSqueethPrice)
        const expectedAuctionWSqueethEthPrice = result[1]
        const finalWSqueethDelta = wmul(wmul(strategyDebt, BigNumber.from(2).mul(one)), expectedAuctionWSqueethEthPrice)
        const secondTargetHedge = wdiv(finalWSqueethDelta.sub(ethDelta), expectedAuctionWSqueethEthPrice)
        const expectedEthProceeds = wmul(secondTargetHedge.abs(), expectedAuctionWSqueethEthPrice)

        await expect(
          crabStrategy.connect(depositor).timeHedge(isSellAuction, expectedAuctionWSqueethEthPrice.div(2), {value: expectedEthProceeds.add(1)})
        ).to.be.revertedWith("Auction price greater than max accepted price");
      }) 

      it("should hedge by selling WSqueeth for ETH and update timestamp and price at hedge", async () => {
        const timeAtLastHedge = await crabStrategy.timeAtLastHedge()
        const hedgeTimeThreshold = await crabStrategy.hedgeTimeThreshold()
        const auctionTriggerTimer = timeAtLastHedge.add(hedgeTimeThreshold)
        const priceAtLastHedge = await crabStrategy.priceAtLastHedge()
                
        // set next block timestamp
        const currentBlockNumber = await provider.getBlockNumber()
        const currentBlock = await provider.getBlock(currentBlockNumber)
        const hedgeBlockTimestamp = currentBlock.timestamp + 100;
        await provider.send("evm_setNextBlockTimestamp", [hedgeBlockTimestamp])

        const auctionTimeElapsed = BigNumber.from(hedgeBlockTimestamp).sub(auctionTriggerTimer)

        expect(await crabStrategy.checkPriceHedge(auctionTriggerTimer)).to.be.false;
        expect((await crabStrategy.checkTimeHedge())[0]).to.be.true;
  
        let currentWSqueethPrice = await oracle.getTwap(wSqueethPool.address, wSqueeth.address, weth.address, 600)
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
          
        await crabStrategy.connect(depositor).timeHedge(isSellAuction, expectedAuctionWSqueethEthPrice, {value: expectedEthProceeds.add(1)})
        
        const hedgeBlockNumber = await provider.getBlockNumber()
        const hedgeBlock = await provider.getBlock(hedgeBlockNumber)

        currentWSqueethPrice = await oracle.getTwap(wSqueethPool.address, wSqueeth.address, weth.address, 600)
        const senderWsqueethBalanceAfter = await wSqueeth.balanceOf(depositor.address)
        const strategyDebtAmountAfter = await crabStrategy.getStrategyDebt()
        const strategyCollateralAmountAfter = await crabStrategy.getStrategyCollateral()
        const timeAtLastHedgeAfter = await crabStrategy.timeAtLastHedge()
        const priceAtLastHedgeAfter = await crabStrategy.priceAtLastHedge()

        expect(senderWsqueethBalanceAfter.gt(senderWsqueethBalanceBefore)).to.be.true
        expect(isSimilar(senderWsqueethBalanceAfter.sub(senderWsqueethBalanceBefore).toString(), secondTargetHedge.abs().toString())).to.be.true
        expect(isSimilar(strategyDebtAmountAfter.sub(strategyDebt).toString(), secondTargetHedge.abs().toString())).to.be.true
        expect(isSimilar(strategyCollateralAmountAfter.sub(ethDelta).toString(), expectedEthProceeds.toString())).to.be.true
        expect(timeAtLastHedgeAfter.eq(hedgeBlock.timestamp)).to.be.true
        expect(priceAtLastHedgeAfter.eq(currentWSqueethPrice)).to.be.true 
      })

      
    })
  
  describe("hedging non-delta neutral strategy: sell auction based on price threshold", async () => {
    before(async () => {
      const ethToDeposit = ethers.utils.parseUnits('30000')
      const wSqueethToMint = ethers.utils.parseUnits('30000')
    
      const currentBlockTimestamp = (await provider.getBlock(await provider.getBlockNumber())).timestamp

      await controller.connect(owner).mintWPowerPerpAmount("0", wSqueethToMint, "0", {value: ethToDeposit})
      await buyWeth(swapRouter, wSqueeth, weth, owner.address, (await wSqueeth.balanceOf(owner.address)), currentBlockTimestamp + 10)

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

      //expect(isSellAuction).to.be.true

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
      const hedgeTimeThreshold = await crabStrategy.hedgeTimeThreshold()
      
      await provider.send("evm_increaseTime", [hedgeTimeThreshold.toNumber() + 1])
      await provider.send("evm_mine", [])
    })

    describe("hedging non-delta neutral strategy: buy auction", async () => {
      before(async () => {
        const currentBlockTimestamp = (await provider.getBlock(await provider.getBlockNumber())).timestamp
        let currentWSqueethPrice = await oracle.getTwap(wSqueethPool.address, wSqueeth.address, weth.address, 600)

        await buyWSqueeth(swapRouter, wSqueeth, weth, owner.address, ethers.utils.parseUnits('10000'), currentBlockTimestamp + 10)

        // set depositor balance to 0
        await wSqueeth.connect(depositor).transfer(random.address, await wSqueeth.balanceOf(depositor.address))
      })

      it("should revert when the limit price is too high", async () => {
        const timeAtLastHedge = await crabStrategy.timeAtLastHedge()
        const hedgeTimeThreshold = await crabStrategy.hedgeTimeThreshold()
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
  
        let currentWSqueethPrice = await oracle.getTwap(wSqueethPool.address, wSqueeth.address, weth.address, 600)
        const ethDelta = await crabStrategy.getStrategyCollateral()
        const strategyDebt = await crabStrategy.getStrategyDebt()
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
        ).to.be.revertedWith("Auction price greater than min accepted price");
      })

      it("should revert hedging when eth is attached to a buy hedge", async () => {
        const timeAtLastHedge = await crabStrategy.timeAtLastHedge()
        const hedgeTimeThreshold = await crabStrategy.hedgeTimeThreshold()
        const auctionTriggerTimer = timeAtLastHedge.add(hedgeTimeThreshold)
                
        const currentBlockNumber = await provider.getBlockNumber()
        const currentBlock = await provider.getBlock(currentBlockNumber)
        const hedgeBlockTimestamp = currentBlock.timestamp + 10;
        await provider.send("evm_setNextBlockTimestamp", [hedgeBlockTimestamp])

        const auctionTimeElapsed = BigNumber.from(hedgeBlockTimestamp).sub(auctionTriggerTimer)
          
        expect(await crabStrategy.checkPriceHedge(auctionTriggerTimer)).to.be.false;
        expect((await crabStrategy.checkTimeHedge())[0]).to.be.true;
  
        let currentWSqueethPrice = await oracle.getTwap(wSqueethPool.address, wSqueeth.address, weth.address, 600)
        const ethDelta = await crabStrategy.getStrategyCollateral()
        const strategyDebt = await crabStrategy.getStrategyDebt()
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
        const hedgeTimeThreshold = await crabStrategy.hedgeTimeThreshold()
        const auctionTriggerTimer = timeAtLastHedge.add(hedgeTimeThreshold)
                
        const currentBlockNumber = await provider.getBlockNumber()
        const currentBlock = await provider.getBlock(currentBlockNumber)
        const hedgeBlockTimestamp = currentBlock.timestamp + 10;
        await provider.send("evm_setNextBlockTimestamp", [hedgeBlockTimestamp])
        
        const auctionTimeElapsed = BigNumber.from(hedgeBlockTimestamp).sub(auctionTriggerTimer)
          
        expect(await crabStrategy.checkPriceHedge(auctionTriggerTimer)).to.be.false;
        expect((await crabStrategy.checkTimeHedge())[0]).to.be.true;
  
        let currentWSqueethPrice = await oracle.getTwap(wSqueethPool.address, wSqueeth.address, weth.address, 600)
        const ethDelta = await crabStrategy.getStrategyCollateral()
        const strategyDebt = await crabStrategy.getStrategyDebt()
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
        const hedgeTimeThreshold = await crabStrategy.hedgeTimeThreshold()
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
  
        let currentWSqueethPrice = await oracle.getTwap(wSqueethPool.address, wSqueeth.address, weth.address, 600)
        const ethDelta = await crabStrategy.getStrategyCollateral()
        const strategyDebt = await crabStrategy.getStrategyDebt()
        const initialWSqueethDelta = wmul(strategyDebt.mul(2), currentWSqueethPrice)
        const targetHedge = wdiv(initialWSqueethDelta.sub(ethDelta), currentWSqueethPrice)        
        const isSellAuction = targetHedge.isNegative()
        const auctionExecution = (auctionTimeElapsed.gte(BigNumber.from(auctionTime))) ? one : wdiv(auctionTimeElapsed, BigNumber.from(auctionTime))
        const result = calcPriceMulAndAuctionPrice(isSellAuction, maxPriceMultiplier, minPriceMultiplier, auctionExecution, currentWSqueethPrice)
        const expectedAuctionWSqueethEthPrice = result[1]
        const priceMultiplier = result[0]
        const finalWSqueethDelta = wmul(strategyDebt.mul(2), expectedAuctionWSqueethEthPrice)
        const secondTargetHedge = wdiv(finalWSqueethDelta.sub(ethDelta), expectedAuctionWSqueethEthPrice)
        const expectedEthProceeds = wmul(secondTargetHedge.abs(), expectedAuctionWSqueethEthPrice)
  
        expect(isSellAuction).to.be.false

        let collatToDeposit = wdiv(wmul(secondTargetHedge.abs(), ethDelta), strategyDebt) 
        if(collatToDeposit.lt(ethers.utils.parseUnits('0.5'))) {
          collatToDeposit = ethers.utils.parseUnits('1')
        }
        await controller.connect(depositor).mintWPowerPerpAmount("0", secondTargetHedge.abs(), "0", {value: collatToDeposit.add(collatToDeposit.mul(2).div(3))})
        let senderWsqueethBalanceBefore = await wSqueeth.balanceOf(depositor.address)

        await provider.send("evm_increaseTime", [50])

        await wSqueeth.connect(depositor).approve(crabStrategy.address, senderWsqueethBalanceBefore)
        await crabStrategy.connect(depositor).timeHedge(isSellAuction, expectedAuctionWSqueethEthPrice)

        currentWSqueethPrice = await oracle.getTwap(wSqueethPool.address, wSqueeth.address, weth.address, 600)
        const senderWsqueethBalanceAfter = await wSqueeth.balanceOf(depositor.address)
        const strategyDebtAmountAfter = await crabStrategy.getStrategyDebt()
        const strategyCollateralAmountAfter = await crabStrategy.getStrategyCollateral()
        
        expect(isSimilar(senderWsqueethBalanceBefore.sub(senderWsqueethBalanceAfter).toString(), secondTargetHedge.toString())).to.be.true
        expect(isSimilar(strategyDebt.sub(strategyDebtAmountAfter).toString(), secondTargetHedge.toString())).to.be.true
        expect(isSimilar(ethDelta.sub(strategyCollateralAmountAfter).toString(), expectedEthProceeds.abs().toString())).to.be.true
      })
    })   
  })

  describe("hedging non-delta neutral strategy: buy auction based on price threshold", async () => {
    before(async () => {

      const currentBlockTimestamp = (await provider.getBlock(await provider.getBlockNumber())).timestamp
      await buyWSqueeth(swapRouter, wSqueeth, weth, owner.address, ethers.utils.parseUnits('15000'), currentBlockTimestamp + 10)

    })

    //const buyTime = (await provider.getBlock(await provider.getBlockNumber())).timestamp

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

      await controller.connect(depositor).mintWPowerPerpAmount("0", one, "0", {value: collatToDeposit.mul(5)})
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

  describe("Sell auction: hedge on uniswap", async () => {
    before(async () => {
      const hedgeTimeTolerance = await crabStrategy.hedgeTimeThreshold()
      
      await provider.send("evm_increaseTime", [hedgeTimeTolerance.toNumber() + 1])
      await provider.send("evm_mine", [])

      let currentWSqueethPrice = await oracle.getTwap(wSqueethPool.address, wSqueeth.address, weth.address, 600)
    })

    it("hedge on uniswap based on time threshold", async () => {
      const timeAtLastHedge = await crabStrategy.timeAtLastHedge()
      const hedgeTimeTolerance = await crabStrategy.hedgeTimeThreshold()      
      const auctionTriggerTimer = timeAtLastHedge.add(hedgeTimeTolerance)
      
      // advanced more time to avoid traget hedge sign change
      await provider.send("evm_increaseTime", [auctionTime])
      await provider.send("evm_mine", [])        
      
      // set next block timestamp
      const currentBlockNumber = await provider.getBlockNumber()
      const currentBlock = await provider.getBlock(currentBlockNumber)
      const hedgeBlockTimestamp = currentBlock.timestamp + 100;
      await provider.send("evm_setNextBlockTimestamp", [hedgeBlockTimestamp])

      const auctionTimeElapsed = BigNumber.from(hedgeBlockTimestamp).sub(auctionTriggerTimer)
  
      expect((await crabStrategy.checkTimeHedge())[0]).to.be.true;
      expect(await crabStrategy.checkPriceHedge(auctionTriggerTimer)).to.be.false;
  
      let currentWSqueethPrice = await oracle.getTwap(wSqueethPool.address, wSqueeth.address, weth.address, 600)
      
      const ethDelta = await crabStrategy.getStrategyCollateral()
      const strategyDebt = await crabStrategy.getStrategyDebt()
      const initialWSqueethDelta = wmul(strategyDebt.mul(2), currentWSqueethPrice)
      const targetHedge = wdiv(initialWSqueethDelta.sub(ethDelta), currentWSqueethPrice)      
      const isSellAuction = targetHedge.isNegative()
      const auctionExecution = (auctionTimeElapsed.gte(BigNumber.from(auctionTime))) ? one : wdiv(auctionTimeElapsed, BigNumber.from(auctionTime))
      const result = calcPriceMulAndAuctionPrice(isSellAuction, maxPriceMultiplier, minPriceMultiplier, auctionExecution, currentWSqueethPrice)
      const expectedAuctionWSqueethEthPrice = result[1]
      const priceMultiplier = result[0]
      const finalWSqueethDelta = wmul(wmul(strategyDebt, BigNumber.from(2).mul(one)), expectedAuctionWSqueethEthPrice)
      const secondTargetHedge = wdiv(finalWSqueethDelta.sub(ethDelta), expectedAuctionWSqueethEthPrice)
      const expectedEthProceeds = wmul(secondTargetHedge.abs(), expectedAuctionWSqueethEthPrice)

      expect(isSellAuction).to.be.true

      const depositorWsqueethBalanceBefore = await wSqueeth.balanceOf(depositor.address)

      await crabStrategy.connect(depositor).timeHedgeOnUniswap();
      
      const strategyDebtAfter = await crabStrategy.getStrategyDebt()
      const depositorWsqueethBalanceAfter = await wSqueeth.balanceOf(depositor.address)
      const ethDeltaAfter = await crabStrategy.getStrategyCollateral()

      expect(isSimilar(strategyDebt.add(secondTargetHedge.mul(-1)).toString(),(strategyDebtAfter.toString())))
      expect(isSimilar((ethDelta.sub(expectedEthProceeds)).toString(),ethDeltaAfter.toString()))
      expect(depositorWsqueethBalanceAfter.gt(depositorWsqueethBalanceBefore)).to.be.true
    })

    it("hedge on uniswap based on price threshold", async () => {

      const ethToDeposit = ethers.utils.parseUnits('20000')
      const wSqueethToMint = ethers.utils.parseUnits('20000')
    
      const currentBlockTimestamp = (await provider.getBlock(await provider.getBlockNumber())).timestamp

      await controller.connect(owner).mintWPowerPerpAmount("0", wSqueethToMint, "0", {value: ethToDeposit})
      await buyWeth(swapRouter, wSqueeth, weth, owner.address, (await wSqueeth.balanceOf(owner.address)), currentBlockTimestamp + 10)

      const timeAtLastHedge = await crabStrategy.timeAtLastHedge()
      const hedgeTimeTolerance = await crabStrategy.hedgeTimeThreshold()      
      
      // advanced more time to get twap updated
      await provider.send("evm_increaseTime", [600])
      await provider.send("evm_mine", [])        
      
      // set next block timestamp
      const currentBlockNumber = await provider.getBlockNumber()
      const currentBlock = await provider.getBlock(currentBlockNumber)

      const auctionTriggerTimer = currentBlock.timestamp
      const hedgeBlockTimestamp = currentBlock.timestamp + auctionTime;
      await provider.send("evm_setNextBlockTimestamp", [hedgeBlockTimestamp])

      const auctionTimeElapsed = BigNumber.from(hedgeBlockTimestamp).sub(auctionTriggerTimer)
  
      expect((await crabStrategy.checkTimeHedge())[0]).to.be.false;
      expect(await crabStrategy.checkPriceHedge(auctionTriggerTimer)).to.be.true;
  
      let currentWSqueethPrice = await oracle.getTwap(wSqueethPool.address, wSqueeth.address, weth.address, 600)
      
      const ethDelta = await crabStrategy.getStrategyCollateral()
      const strategyDebt = await crabStrategy.getStrategyDebt()
      const initialWSqueethDelta = wmul(strategyDebt.mul(2), currentWSqueethPrice)
      const targetHedge = wdiv(initialWSqueethDelta.sub(ethDelta), currentWSqueethPrice)      
      const isSellAuction = targetHedge.isNegative()
      const auctionExecution = (auctionTimeElapsed.gte(BigNumber.from(auctionTime))) ? one : wdiv(auctionTimeElapsed, BigNumber.from(auctionTime))
      const result = calcPriceMulAndAuctionPrice(isSellAuction, maxPriceMultiplier, minPriceMultiplier, auctionExecution, currentWSqueethPrice)
      const expectedAuctionWSqueethEthPrice = result[1]
      const priceMultiplier = result[0]
      const finalWSqueethDelta = wmul(wmul(strategyDebt, BigNumber.from(2).mul(one)), expectedAuctionWSqueethEthPrice)
      const secondTargetHedge = wdiv(finalWSqueethDelta.sub(ethDelta), expectedAuctionWSqueethEthPrice)
      const expectedEthProceeds = wmul(secondTargetHedge.abs(), expectedAuctionWSqueethEthPrice)

      expect(isSellAuction).to.be.true

      const depositorWsqueethBalanceBefore = await wSqueeth.balanceOf(depositor.address)

      await crabStrategy.connect(depositor).priceHedgeOnUniswap(auctionTriggerTimer);
      
      const strategyDebtAfter = await crabStrategy.getStrategyDebt()
      const depositorWsqueethBalanceAfter = await wSqueeth.balanceOf(depositor.address)
      const ethDeltaAfter = await crabStrategy.getStrategyCollateral()

      expect(isSimilar(strategyDebt.add(secondTargetHedge.mul(-1)).toString(),(strategyDebtAfter.toString())))
      expect(isSimilar((ethDelta.sub(expectedEthProceeds)).toString(),ethDeltaAfter.toString()))
      expect(depositorWsqueethBalanceAfter.gt(depositorWsqueethBalanceBefore)).to.be.true
    })
  })

  describe("Buy auction: hedge on uniswap", async () => {
    before(async () => {
      const priceBefore = await oracle.getTwap(wSqueethPool.address, wSqueeth.address, weth.address, 600)
      const currentBlockTimestamp = (await provider.getBlock(await provider.getBlockNumber())).timestamp
      await buyWSqueeth(swapRouter, wSqueeth, weth, owner.address, ethers.utils.parseUnits('1000'), currentBlockTimestamp + 10)


      // set depositor balance to 0
      await wSqueeth.connect(depositor).transfer(random.address, await wSqueeth.balanceOf(depositor.address))

      const hedgeTimeTolerance = await crabStrategy.hedgeTimeThreshold()
      await provider.send("evm_increaseTime", [hedgeTimeTolerance.toNumber() + 1])
      await provider.send("evm_mine", [])
    })
  
    it("hedge based on time on uniswap", async () => {
      const timeAtLastHedge = await crabStrategy.timeAtLastHedge()
      const hedgeTimeTolerance = await crabStrategy.hedgeTimeThreshold()      
      const auctionTriggerTimer = timeAtLastHedge.add(hedgeTimeTolerance)
      
      // advanced more time to avoid traget hedge sign change
      await provider.send("evm_increaseTime", [auctionTime])
      await provider.send("evm_mine", [])        
      
      // set next block timestamp
      const currentBlockNumber = await provider.getBlockNumber()
      const currentBlock = await provider.getBlock(currentBlockNumber)
      const hedgeBlockTimestamp = currentBlock.timestamp + 100;
      await provider.send("evm_setNextBlockTimestamp", [hedgeBlockTimestamp])

      const auctionTimeElapsed = BigNumber.from(hedgeBlockTimestamp).sub(auctionTriggerTimer)
  
      expect((await crabStrategy.checkTimeHedge())[0]).to.be.true;
      // expect(await crabStrategy.checkPriceHedge(auctionTriggerTimer)).to.be.true;
  
      let currentWSqueethPrice = await oracle.getTwap(wSqueethPool.address, wSqueeth.address, weth.address, 600)
      const ethDelta = await crabStrategy.getStrategyCollateral()
      const strategyDebt = await crabStrategy.getStrategyDebt()
      const initialWSqueethDelta = wmul(strategyDebt.mul(2), currentWSqueethPrice)
      const targetHedge = wdiv(initialWSqueethDelta.sub(ethDelta), currentWSqueethPrice)      
      const isSellAuction = targetHedge.isNegative()
      const auctionExecution = (auctionTimeElapsed.gte(BigNumber.from(auctionTime))) ? one : wdiv(auctionTimeElapsed, BigNumber.from(auctionTime))
      const result = calcPriceMulAndAuctionPrice(isSellAuction, maxPriceMultiplier, minPriceMultiplier, auctionExecution, currentWSqueethPrice)
      const expectedAuctionWSqueethEthPrice = result[1]
      const priceMultiplier = result[0]
      const finalWSqueethDelta = wmul(wmul(strategyDebt, BigNumber.from(2).mul(one)), expectedAuctionWSqueethEthPrice)
      const secondTargetHedge = wdiv(finalWSqueethDelta.sub(ethDelta), expectedAuctionWSqueethEthPrice)
      const expectedEthProceeds = wmul(secondTargetHedge.abs(), expectedAuctionWSqueethEthPrice)

      expect(isSellAuction).to.be.false

      const depositorWsqueethBalanceBefore = await wSqueeth.balanceOf(depositor.address)
      const depositorEthBalanceBefore = await provider.getBalance(depositor.address)
      
      await crabStrategy.connect(depositor).timeHedgeOnUniswap();
      
      const depositorWsqueethBalanceAfter = await wSqueeth.balanceOf(depositor.address)
      const depositorEthBalanceAfter = await provider.getBalance(depositor.address)

      expect(depositorEthBalanceAfter.gte(depositorEthBalanceBefore)).to.be.true
      expect(depositorWsqueethBalanceAfter.eq(depositorWsqueethBalanceBefore)).to.be.true
    })

    it("hedge based on price on uniswap", async () => {
    
      const currentBlockTimestamp = (await provider.getBlock(await provider.getBlockNumber())).timestamp

      await buyWSqueeth(swapRouter, wSqueeth, weth, owner.address, ethers.utils.parseUnits('10000'), currentBlockTimestamp + 10)
      
      // advanced more time to get twap updated
      await provider.send("evm_increaseTime", [600])
      await provider.send("evm_mine", [])        
      
      // set next block timestamp
      const currentBlockNumber = await provider.getBlockNumber()
      const currentBlock = await provider.getBlock(currentBlockNumber)

      const auctionTriggerTimer = currentBlock.timestamp
      const hedgeBlockTimestamp = currentBlock.timestamp + auctionTime;
      await provider.send("evm_setNextBlockTimestamp", [hedgeBlockTimestamp])

      const auctionTimeElapsed = BigNumber.from(hedgeBlockTimestamp).sub(auctionTriggerTimer)
  
      expect((await crabStrategy.checkTimeHedge())[0]).to.be.false;
      expect(await crabStrategy.checkPriceHedge(auctionTriggerTimer)).to.be.true;
  
      let currentWSqueethPrice = await oracle.getTwap(wSqueethPool.address, wSqueeth.address, weth.address, 600)
      
      const ethDelta = await crabStrategy.getStrategyCollateral()
      const strategyDebt = await crabStrategy.getStrategyDebt()
      const initialWSqueethDelta = wmul(strategyDebt.mul(2), currentWSqueethPrice)
      const targetHedge = wdiv(initialWSqueethDelta.sub(ethDelta), currentWSqueethPrice)      
      const isSellAuction = targetHedge.isNegative()
      const auctionExecution = (auctionTimeElapsed.gte(BigNumber.from(auctionTime))) ? one : wdiv(auctionTimeElapsed, BigNumber.from(auctionTime))
      const result = calcPriceMulAndAuctionPrice(isSellAuction, maxPriceMultiplier, minPriceMultiplier, auctionExecution, currentWSqueethPrice)
      const expectedAuctionWSqueethEthPrice = result[1]
      const priceMultiplier = result[0]
      const finalWSqueethDelta = wmul(wmul(strategyDebt, BigNumber.from(2).mul(one)), expectedAuctionWSqueethEthPrice)
      const secondTargetHedge = wdiv(finalWSqueethDelta.sub(ethDelta), expectedAuctionWSqueethEthPrice)
      const expectedEthProceeds = wmul(secondTargetHedge.abs(), expectedAuctionWSqueethEthPrice)

      expect(isSellAuction).to.be.false

      const depositorWsqueethBalanceBefore = await wSqueeth.balanceOf(depositor.address)
      const depositorEthBalanceBefore = await provider.getBalance(depositor.address)


      await crabStrategy.connect(depositor).priceHedgeOnUniswap(auctionTriggerTimer);
      
      const strategyDebtAfter = await crabStrategy.getStrategyDebt()
      const depositorWsqueethBalanceAfter = await wSqueeth.balanceOf(depositor.address)
      const ethDeltaAfter = await crabStrategy.getStrategyCollateral()
      const depositorEthBalanceAfter = await provider.getBalance(depositor.address)

      expect(isSimilar(strategyDebt.add(secondTargetHedge.mul(-1)).toString(),(strategyDebtAfter.toString())))
      expect(isSimilar((ethDelta.sub(expectedEthProceeds)).toString(),ethDeltaAfter.toString()))
      expect(depositorWsqueethBalanceAfter.eq(depositorWsqueethBalanceBefore)).to.be.true
      expect(depositorEthBalanceAfter.gt(depositorEthBalanceBefore)).to.be.true
    })

  }) 

  describe("Flash withdraw", async () => {
    it("should revert if amount IN is greater than max ETH to pay", async () => {
      const userCrabBalanceBefore = await crabStrategy.balanceOf(depositor.address);
      const crabTotalSupply = await crabStrategy.totalSupply()
      const strategyCollateralAmount = await crabStrategy.getStrategyCollateral()
      const crabRatio = wdiv(userCrabBalanceBefore, crabTotalSupply);
      const ethToWithdraw = wmul(crabRatio, strategyCollateralAmount);
      const maxEthToPay = ethToWithdraw.div(BigNumber.from(3))

      await expect(
        crabStrategy.connect(depositor).flashWithdraw(userCrabBalanceBefore, maxEthToPay)
      ).to.be.revertedWith("amount in greater than max");
    })

    it("should revert if random address tries to flash withdrwa", async () => {
      const userCrabBalanceBefore = await crabStrategy.balanceOf(depositor.address);
      const crabTotalSupply = await crabStrategy.totalSupply()
      const strategyCollateralAmount = await crabStrategy.getStrategyCollateral()
      const crabRatio = wdiv(userCrabBalanceBefore, crabTotalSupply);
      const ethToWithdraw = wmul(crabRatio, strategyCollateralAmount);
      const maxEthToPay = ethToWithdraw

      await expect(
        crabStrategy.connect(random).flashWithdraw(userCrabBalanceBefore, maxEthToPay)
      ).to.be.revertedWith("ERC20: burn amount exceeds balance");
    })

    it("should withdraw correct amount of ETH collateral", async () => {
      const userCrabBalanceBefore = await crabStrategy.balanceOf(depositor.address);
      const crabTotalSupply = await crabStrategy.totalSupply()
      const strategyCollateralAmount = await crabStrategy.getStrategyCollateral()
      const userEthBalanceBefore = await provider.getBalance(depositor.address)
      const crabRatio = wdiv(userCrabBalanceBefore, crabTotalSupply);
      const ethToWithdraw = wmul(crabRatio, strategyCollateralAmount);
      const maxEthToPay = ethToWithdraw.sub(ethToWithdraw.div(BigNumber.from(3)))

      await crabStrategy.connect(depositor).flashWithdraw(userCrabBalanceBefore, maxEthToPay)

      const userEthBalanceAfter = await provider.getBalance(depositor.address)
      const userCrabBalanceAfter = await crabStrategy.balanceOf(depositor.address);

      expect(isSimilar(userEthBalanceAfter.sub(ethToWithdraw).toString(), userEthBalanceBefore.toString())).to.be.true
      expect(userCrabBalanceAfter.eq(BigNumber.from(0))).to.be.true
    })
  })
})