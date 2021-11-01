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
    it("should revert time hedging if the time threshold has not been reached", async () => {  
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

    it("should revert hedging if strategy is delta neutral", async () => {  
      const hedgeTimeThreshold = await crabStrategy.hedgeTimeThreshold()
          
      await provider.send("evm_increaseTime", [hedgeTimeThreshold.toNumber()])
      await provider.send("evm_mine", [])

      // set next block timestamp
      let currentBlockNumber = await provider.getBlockNumber()
      let currentBlock = await provider.getBlock(currentBlockNumber)
      const hedgeBlockTimestamp = currentBlock.timestamp + 1;
      await provider.send("evm_setNextBlockTimestamp", [hedgeBlockTimestamp])  
        
      const ethDelta = await crabStrategy.getStrategyCollateral()
      const currentWSqueethPrice = await oracle.getTwapSafe(wSqueethPool.address, wSqueeth.address, weth.address, 600)
      const strategyDebt = await crabStrategy.getStrategyDebt()
      const initialWSqueethDelta = wmul(strategyDebt.mul(2), currentWSqueethPrice)
      const targetHedge = wdiv(initialWSqueethDelta.sub(ethDelta), currentWSqueethPrice)

      expect(targetHedge.abs().eq(BigNumber.from(0)) || isSimilar(initialWSqueethDelta.toString(), ethDelta.toString())).to.be.true
      await expect(
        crabStrategy.connect(depositor).timeHedgeOnUniswap()
      ).to.be.revertedWith("strategy is delta neutral");
    })

    it("should revert hedging if target hedge sign change (auction change from selling to buying)", async () => {
      // change pool price for auction to be sell auction
      const ethToDeposit = ethers.utils.parseUnits('1000')
      const wSqueethToMint = ethers.utils.parseUnits('1000')
      const currentBlockTimestamp = (await provider.getBlock(await provider.getBlockNumber())).timestamp
      await controller.connect(owner).mintWPowerPerpAmount("0", wSqueethToMint, "0", {value: ethToDeposit})
      await buyWeth(swapRouter, wSqueeth, weth, owner.address, (await wSqueeth.balanceOf(owner.address)), currentBlockTimestamp + 10)

      await provider.send("evm_increaseTime", [600])
      await provider.send("evm_mine", [])              

      // set next block timestamp
      const currentBlockNumber = await provider.getBlockNumber()
      const currentBlock = await provider.getBlock(currentBlockNumber)
      const hedgeBlockTimestamp = currentBlock.timestamp + 1;
      await provider.send("evm_setNextBlockTimestamp", [hedgeBlockTimestamp])      

      const ethDelta = await crabStrategy.getStrategyCollateral()
      const currentWSqueethPrice = await oracle.getTwapSafe(wSqueethPool.address, wSqueeth.address, weth.address, 600)
      const strategyDebt = await crabStrategy.getStrategyDebt()
      const initialWSqueethDelta = wmul(wmul(strategyDebt, BigNumber.from(2).mul(one)), currentWSqueethPrice)
      const targetHedge = wdiv(initialWSqueethDelta.sub(ethDelta), currentWSqueethPrice)        
      const isSellAuction = targetHedge.isNegative()

      expect(isSellAuction).to.be.true

      await expect(
        crabStrategy.connect(depositor).timeHedgeOnUniswap()
      ).to.be.revertedWith("can not execute hedging trade as auction type changed");
    })

    it("should revert if not positive PnL", async () => {
      const timeAtLastHedge = await crabStrategy.timeAtLastHedge()
      const hedgeTimeTolerance = await crabStrategy.hedgeTimeThreshold()      
      const auctionTriggerTimer = timeAtLastHedge.add(hedgeTimeTolerance)
      
      // advanced more time to avoid traget hedge sign change
      await provider.send("evm_increaseTime", [auctionTime/3])
      await provider.send("evm_mine", [])        
      
      // set next block timestamp
      const currentBlockNumber = await provider.getBlockNumber()
      const currentBlock = await provider.getBlock(currentBlockNumber)
      const hedgeBlockTimestamp = currentBlock.timestamp + 100;
      await provider.send("evm_setNextBlockTimestamp", [hedgeBlockTimestamp])

      const auctionTimeElapsed = BigNumber.from(hedgeBlockTimestamp).sub(auctionTriggerTimer)
  
      expect((await crabStrategy.checkTimeHedge())[0]).to.be.true;
      expect(await crabStrategy.checkPriceHedge(auctionTriggerTimer)).to.be.false;
  
      let currentWSqueethPrice = await oracle.getTwapSafe(wSqueethPool.address, wSqueeth.address, weth.address, 600)
      
      const ethDelta = await crabStrategy.getStrategyCollateral()
      const strategyDebt = await crabStrategy.getStrategyDebt()
      const initialWSqueethDelta = wmul(strategyDebt.mul(2), currentWSqueethPrice)
      const targetHedge = wdiv(initialWSqueethDelta.sub(ethDelta), currentWSqueethPrice)      
      const isSellAuction = targetHedge.isNegative()
      const auctionExecution = (auctionTimeElapsed.gte(BigNumber.from(auctionTime))) ? one : wdiv(auctionTimeElapsed, BigNumber.from(auctionTime))
      const result = calcPriceMulAndAuctionPrice(isSellAuction, maxPriceMultiplier, minPriceMultiplier, auctionExecution, currentWSqueethPrice)
      const expectedAuctionWSqueethEthPrice = result[1]

      expect(isSellAuction).to.be.true
      expect(expectedAuctionWSqueethEthPrice.lt(currentWSqueethPrice)).to.be.true

      await expect(
        crabStrategy.connect(depositor).timeHedgeOnUniswap()
      ).to.be.revertedWith("ERC20: transfer amount exceeds balance");
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
  
      let currentWSqueethPrice = await oracle.getTwapSafe(wSqueethPool.address, wSqueeth.address, weth.address, 600)
      
      const ethDelta = await crabStrategy.getStrategyCollateral()
      const strategyDebt = await crabStrategy.getStrategyDebt()
      const initialWSqueethDelta = wmul(strategyDebt.mul(2), currentWSqueethPrice)
      const targetHedge = wdiv(initialWSqueethDelta.sub(ethDelta), currentWSqueethPrice)      
      const isSellAuction = targetHedge.isNegative()
      const auctionExecution = (auctionTimeElapsed.gte(BigNumber.from(auctionTime))) ? one : wdiv(auctionTimeElapsed, BigNumber.from(auctionTime))
      const result = calcPriceMulAndAuctionPrice(isSellAuction, maxPriceMultiplier, minPriceMultiplier, auctionExecution, currentWSqueethPrice)
      const expectedAuctionWSqueethEthPrice = result[1]
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
  })

  describe("Buy auction", async () => {
    before(async () => {
      // change pool price for auction to be sell auction
      const ethToDeposit = ethers.utils.parseUnits('1000')
      const wSqueethToMint = ethers.utils.parseUnits('1000')
      const currentBlockTimestamp = (await provider.getBlock(await provider.getBlockNumber())).timestamp
      await controller.connect(owner).mintWPowerPerpAmount("0", wSqueethToMint, "0", {value: ethToDeposit})
      await buyWeth(swapRouter, wSqueeth, weth, owner.address, (await wSqueeth.balanceOf(owner.address)), currentBlockTimestamp + 10)
    })
    it("should revert time hedging if the time threshold has not been reached", async () => {  
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

    it("should revert hedging if target hedge sign change (auction change from buying to selling)", async () => {
      const hedgeTimeThreshold = await crabStrategy.hedgeTimeThreshold()
      
      await provider.send("evm_increaseTime", [hedgeTimeThreshold.toNumber() + 1])
      await provider.send("evm_mine", [])

      await provider.send("evm_increaseTime", [10])
      await provider.send("evm_mine", [])              

      // set next block timestamp
      const currentBlockNumber = await provider.getBlockNumber()
      const currentBlock = await provider.getBlock(currentBlockNumber)
      const hedgeBlockTimestamp = currentBlock.timestamp + 1;
      await provider.send("evm_setNextBlockTimestamp", [hedgeBlockTimestamp])      

      const ethDelta = await crabStrategy.getStrategyCollateral()
      const currentWSqueethPrice = await oracle.getTwapSafe(wSqueethPool.address, wSqueeth.address, weth.address, 600)
      const strategyDebt = await crabStrategy.getStrategyDebt()
      const initialWSqueethDelta = wmul(wmul(strategyDebt, BigNumber.from(2).mul(one)), currentWSqueethPrice)
      const targetHedge = wdiv(initialWSqueethDelta.sub(ethDelta), currentWSqueethPrice)        
      const isSellAuction = targetHedge.isNegative()

      expect(isSellAuction).to.be.false

      await expect(
        crabStrategy.connect(depositor).timeHedgeOnUniswap()
      ).to.be.revertedWith("can not execute hedging trade as auction type changed");
    })

    it("should revert if not positive PnL", async () => {
      const timeAtLastHedge = await crabStrategy.timeAtLastHedge()
      const hedgeTimeTolerance = await crabStrategy.hedgeTimeThreshold()      
      const auctionTriggerTimer = timeAtLastHedge.add(hedgeTimeTolerance)
      
      // advanced more time to avoid traget hedge sign change
      await provider.send("evm_increaseTime", [auctionTime/3])
      await provider.send("evm_mine", [])        
      
      // set next block timestamp
      const currentBlockNumber = await provider.getBlockNumber()
      const currentBlock = await provider.getBlock(currentBlockNumber)
      const hedgeBlockTimestamp = currentBlock.timestamp + 100;
      await provider.send("evm_setNextBlockTimestamp", [hedgeBlockTimestamp])

      const auctionTimeElapsed = BigNumber.from(hedgeBlockTimestamp).sub(auctionTriggerTimer)
  
      expect((await crabStrategy.checkTimeHedge())[0]).to.be.true;
      expect(await crabStrategy.checkPriceHedge(auctionTriggerTimer)).to.be.false;
  
      let currentWSqueethPrice = await oracle.getTwapSafe(wSqueethPool.address, wSqueeth.address, weth.address, 600)
      
      const ethDelta = await crabStrategy.getStrategyCollateral()
      const strategyDebt = await crabStrategy.getStrategyDebt()
      const initialWSqueethDelta = wmul(strategyDebt.mul(2), currentWSqueethPrice)
      const targetHedge = wdiv(initialWSqueethDelta.sub(ethDelta), currentWSqueethPrice)      
      const isSellAuction = targetHedge.isNegative()
      const auctionExecution = (auctionTimeElapsed.gte(BigNumber.from(auctionTime))) ? one : wdiv(auctionTimeElapsed, BigNumber.from(auctionTime))
      const result = calcPriceMulAndAuctionPrice(isSellAuction, maxPriceMultiplier, minPriceMultiplier, auctionExecution, currentWSqueethPrice)
      const expectedAuctionWSqueethEthPrice = result[1]

      expect(isSellAuction).to.be.false
      expect(expectedAuctionWSqueethEthPrice.lt(currentWSqueethPrice)).to.be.true

      await expect(
        crabStrategy.connect(depositor).timeHedgeOnUniswap()
      ).to.be.revertedWith("function call failed to execute");
    })

    it("hedge based on time on uniswap", async () => {      
      // advanced more time to avoid traget hedge sign change
      await provider.send("evm_increaseTime", [auctionTime])
      await provider.send("evm_mine", [])        
      
      // set next block timestamp
      const currentBlockNumber = await provider.getBlockNumber()
      const currentBlock = await provider.getBlock(currentBlockNumber)
      const hedgeBlockTimestamp = currentBlock.timestamp + 100;
      await provider.send("evm_setNextBlockTimestamp", [hedgeBlockTimestamp])
    
      expect((await crabStrategy.checkTimeHedge())[0]).to.be.true;
  
      let currentWSqueethPrice = await oracle.getTwap(wSqueethPool.address, wSqueeth.address, weth.address, 600)
      const ethDelta = await crabStrategy.getStrategyCollateral()
      const strategyDebt = await crabStrategy.getStrategyDebt()
      const initialWSqueethDelta = wmul(strategyDebt.mul(2), currentWSqueethPrice)
      const targetHedge = wdiv(initialWSqueethDelta.sub(ethDelta), currentWSqueethPrice)      
      const isSellAuction = targetHedge.isNegative()
  
      expect(isSellAuction).to.be.false
  
      const depositorWsqueethBalanceBefore = await wSqueeth.balanceOf(depositor.address)
      const depositorEthBalanceBefore = await provider.getBalance(depositor.address)
      
      await crabStrategy.connect(depositor).timeHedgeOnUniswap();
      
      const depositorWsqueethBalanceAfter = await wSqueeth.balanceOf(depositor.address)
      const depositorEthBalanceAfter = await provider.getBalance(depositor.address)
  
      expect(depositorEthBalanceAfter.gte(depositorEthBalanceBefore)).to.be.true
      expect(depositorWsqueethBalanceAfter.eq(depositorWsqueethBalanceBefore)).to.be.true
    })
  })
})