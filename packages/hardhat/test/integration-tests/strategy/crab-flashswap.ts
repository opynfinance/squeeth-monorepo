import { ethers } from "hardhat"
import { expect } from "chai";
import { Contract, BigNumber, providers } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers";
import { WETH9, MockErc20, Controller, Oracle, WPowerPerp, CrabStrategy } from "../../../typechain";
import { deployUniswapV3, deploySqueethCoreContracts, deployWETHAndDai, addWethDaiLiquidity, addSqueethLiquidity, buyWSqueeth, buyWeth } from '../../setup'
import { isSimilar, wmul, wdiv } from "../../utils"
// import { BigNumber as BigNumberJs} from "bignumber.js"

const calcSlippageAndAuctionPrice = (isNegativeTargetHedge: boolean, maxAuctionSlippage: BigNumber, minAuctionSlippage: BigNumber, auctionExecution: BigNumber, currentWSqueethPrice: BigNumber) : [BigNumber, BigNumber] => {
  let slippage: BigNumber
  let auctionWSqueethEthPrice: BigNumber

  if(isNegativeTargetHedge) {
    slippage = maxAuctionSlippage.sub(wmul(auctionExecution, maxAuctionSlippage.sub(minAuctionSlippage)))
    auctionWSqueethEthPrice = wmul(currentWSqueethPrice, slippage);
  } 
  else {
    slippage = minAuctionSlippage.add(wmul(auctionExecution, maxAuctionSlippage.sub(minAuctionSlippage)))
    auctionWSqueethEthPrice = wmul(currentWSqueethPrice, slippage);
  }

  return [slippage, auctionWSqueethEthPrice]
}

describe("Crab flashswap integration test", function () {
  const startingPrice = 1
  const hedgeTimeThreshold = 86400  // 24h
  const hedgePriceThreshold = ethers.utils.parseUnits('0.15')
  const auctionTime = 3600
  const minAuctionSlippage = ethers.utils.parseUnits('0.95')
  const maxAuctionSlippage = ethers.utils.parseUnits('1.05')

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
  // let ethDaiPool: Contract
  let wSqueeth: WPowerPerp
  // let shortSqueeth: ShortPowerPerp
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
      startingPrice,
      startingPrice
    )
    controller = squeethDeployments.controller
    wSqueeth = squeethDeployments.wsqueeth
    oracle = squeethDeployments.oracle
    // shortSqueeth = squeethDeployments.shortSqueeth
    wSqueethPool = squeethDeployments.wsqueethEthPool
    // ethDaiPool = squeethDeployments.ethDaiPool

    const CrabStrategyContract = await ethers.getContractFactory("CrabStrategy");
    crabStrategy = (await CrabStrategyContract.deploy(controller.address, oracle.address, weth.address, uniswapFactory.address, wSqueethPool.address, hedgeTimeThreshold, hedgePriceThreshold, auctionTime, minAuctionSlippage, maxAuctionSlippage)) as CrabStrategy;
  })

  this.beforeAll("Seed pool liquidity", async() => {
    // add liquidity
    await addWethDaiLiquidity(
      startingPrice,
      ethers.utils.parseUnits('100'), // eth amount
      owner.address,
      dai,
      weth,
      positionManager
    )

    await addSqueethLiquidity(
      startingPrice, 
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

    it("should deposit correct amount and mint correct shares amount", async () => {
      const ethToDeposit = ethers.utils.parseUnits('0.6')
      const ethToBorrow = ethers.utils.parseUnits('0.6')
      const msgvalue = ethers.utils.parseUnits('0.61')

      const squeethDelta = BigNumber.from(startingPrice).mul(BigNumber.from(10).pow(18)).mul(2);
      const debtToMint = wdiv(ethToDeposit.add(ethToBorrow), (squeethDelta));
      const depositorSqueethBalanceBefore = await wSqueeth.balanceOf(depositor.address)

      await crabStrategy.connect(depositor).flashDeposit(ethToDeposit, ethToBorrow, {value: msgvalue})
      
      const totalSupply = (await crabStrategy.totalSupply())
      const depositorCrab = (await crabStrategy.balanceOf(depositor.address))
      const debtAmount = (await crabStrategy.getStrategyDebt())
      const depositorSqueethBalance = await wSqueeth.balanceOf(depositor.address)
      const strategyContractSqueeth = await wSqueeth.balanceOf(crabStrategy.address)

      expect(totalSupply.eq(ethToDeposit.add(ethToBorrow))).to.be.true
      expect(depositorCrab.eq(ethToDeposit.add(ethToBorrow))).to.be.true
      expect(debtAmount.eq(debtToMint)).to.be.true
      expect(depositorSqueethBalance.eq(depositorSqueethBalanceBefore)).to.be.true
      expect(strategyContractSqueeth.eq(BigNumber.from(0))).to.be.true
    })
  })

  describe("Sell auction: time hedging", async () => {
    before(async () => {
      const hedgeTimeThreshold = await crabStrategy.hedgeTimeThreshold()
      
      await provider.send("evm_increaseTime", [hedgeTimeThreshold.toNumber() + 1])
      await provider.send("evm_mine", [])
    })

    describe("hedging delta neutral strategy", async () => {
      it("should revert hedging if strategy is delta neutral", async () => {        
        // advanced more time to avoid traget hedge sign change
        await provider.send("evm_increaseTime", [auctionTime/3])
        await provider.send("evm_mine", [])     
        
        // set next block timestamp
        let currentBlockNumber = await provider.getBlockNumber()
        let currentBlock = await provider.getBlock(currentBlockNumber)
        const hedgeBlockTimestamp = currentBlock.timestamp + 100;
        await provider.send("evm_setNextBlockTimestamp", [hedgeBlockTimestamp])      
    
        const ethDelta = await crabStrategy.getStrategyCollateral()
        const currentWSqueethPrice = await oracle.getTwapSafe(wSqueethPool.address, wSqueeth.address, weth.address, 600)
        const strategyDebt = await crabStrategy.getStrategyDebt()
        const wSqueethDelta = wmul(strategyDebt.mul(2), currentWSqueethPrice)
        const targetHedge = wdiv(wSqueethDelta.sub(ethDelta), currentWSqueethPrice)
      
        expect(targetHedge.abs().eq(BigNumber.from(0)) || isSimilar(wSqueethDelta.toString(), ethDelta.toString())).to.be.true
        await expect(
          crabStrategy.connect(depositor).timeHedge({value: 1})
        ).to.be.revertedWith("strategy is delta neutral");
      })  
    })

    describe("hedging non-delta neutral strategy: sell auction", async () => {
      before(async () => {
        const ethToDeposit = ethers.utils.parseUnits('100000')
    
        await crabStrategy.connect(owner).deposit({value: ethToDeposit})
  
        const currentBlockTimestamp = (await provider.getBlock(await provider.getBlockNumber())).timestamp
        const beforeTradePrice = await oracle.getTwap(wSqueethPool.address, wSqueeth.address, weth.address, 600)

        await buyWeth(swapRouter, wSqueeth, weth, owner.address, (await wSqueeth.balanceOf(owner.address)), currentBlockTimestamp + 10)

        const afterTradePrice = await oracle.getTwap(wSqueethPool.address, wSqueeth.address, weth.address, 600)
      })

      it("should revert hedging if target hedge sign change (auction change from selling to buying)", async () => {
        const timeAtLastHedge = await crabStrategy.timeAtLastHedge()
        const hedgeTimeThreshold = await crabStrategy.hedgeTimeThreshold()
        const auctionTriggerTimer = timeAtLastHedge.add(hedgeTimeThreshold)
  
        // set next block timestamp
        const currentBlockNumber = await provider.getBlockNumber()
        const currentBlock = await provider.getBlock(currentBlockNumber)
        const hedgeBlockTimestamp = currentBlock.timestamp + 1;
        await provider.send("evm_setNextBlockTimestamp", [hedgeBlockTimestamp])      
  
        const ethDelta = await crabStrategy.getStrategyCollateral()
        const currentWSqueethPrice = await oracle.getTwap(wSqueethPool.address, wSqueeth.address, weth.address, 600)
        const strategyDebt = await crabStrategy.getStrategyDebt()
        let wSqueethDelta = wmul(wmul(strategyDebt, BigNumber.from(2).mul(BigNumber.from(10).pow(18))), currentWSqueethPrice)
        const targetHedge = wdiv(wSqueethDelta.sub(ethDelta), currentWSqueethPrice)
        const isSellAuction = targetHedge.isNegative()
        const auctionExecution = (BigNumber.from(hedgeBlockTimestamp).sub(auctionTriggerTimer).gte(BigNumber.from(auctionTime))) ? BigNumber.from(1).mul(BigNumber.from(10).pow(18)) : wdiv(BigNumber.from(hedgeBlockTimestamp).sub(auctionTriggerTimer), BigNumber.from(auctionTime))
        const result = calcSlippageAndAuctionPrice(isSellAuction, maxAuctionSlippage, minAuctionSlippage, auctionExecution, currentWSqueethPrice)
        const expectedAuctionWSqueethEthPrice = result[1]
        wSqueethDelta = wmul(wmul(strategyDebt, BigNumber.from(2).mul(BigNumber.from(10).pow(18))), expectedAuctionWSqueethEthPrice)
        const secondTargetHedge = wdiv(wSqueethDelta.sub(ethDelta), expectedAuctionWSqueethEthPrice)
        const expectedEthProceeds = wmul(secondTargetHedge.abs(), expectedAuctionWSqueethEthPrice)

        await expect(
          crabStrategy.connect(depositor).timeHedge({value: expectedEthProceeds.add(1)})
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

        const ethDelta = await crabStrategy.getStrategyCollateral()
        const currentWSqueethPrice = await oracle.getTwapSafe(wSqueethPool.address, wSqueeth.address, weth.address, 600)
        const strategyDebt = await crabStrategy.getStrategyDebt()
        let wSqueethDelta = wmul(strategyDebt.mul(2), currentWSqueethPrice)
        const targetHedge = wdiv(wSqueethDelta.sub(ethDelta), currentWSqueethPrice)
        const isSellAuction = targetHedge.isNegative()
        const auctionExecution = (BigNumber.from(hedgeBlockTimestamp).sub(auctionTriggerTimer).gte(BigNumber.from(auctionTime))) ? BigNumber.from(1).mul(BigNumber.from(10).pow(18)) : wdiv(BigNumber.from(hedgeBlockTimestamp).sub(auctionTriggerTimer), BigNumber.from(auctionTime))
        const result = calcSlippageAndAuctionPrice(isSellAuction, maxAuctionSlippage, minAuctionSlippage, auctionExecution, currentWSqueethPrice)
        const expectedAuctionWSqueethEthPrice = result[1]
        wSqueethDelta = wmul(strategyDebt.mul(2), expectedAuctionWSqueethEthPrice)
        const secondTargetHedge = wdiv(wSqueethDelta.sub(ethDelta), expectedAuctionWSqueethEthPrice)
        const expectedEthProceeds = wmul(secondTargetHedge.abs(), expectedAuctionWSqueethEthPrice)

        await expect(
          crabStrategy.connect(depositor).timeHedge({value: expectedEthProceeds.sub(1)})
        ).to.be.revertedWith("Low ETH amount received");
      })

      it("should hedge by selling WSqueeth for ETH", async () => {
        const timeAtLastHedge = await crabStrategy.timeAtLastHedge()
        const hedgeTimeThreshold = await crabStrategy.hedgeTimeThreshold()
        const auctionTriggerTimer = timeAtLastHedge.add(hedgeTimeThreshold)
                
        // set next block timestamp
        const currentBlockNumber = await provider.getBlockNumber()
        const currentBlock = await provider.getBlock(currentBlockNumber)
        const hedgeBlockTimestamp = currentBlock.timestamp + 100;
        await provider.send("evm_setNextBlockTimestamp", [hedgeBlockTimestamp])
  
        expect(await crabStrategy.checkPriceHedge(auctionTriggerTimer)).to.be.false;
        expect((await crabStrategy.checkTimeHedge())[0]).to.be.true;
  
        let currentWSqueethPrice = await oracle.getTwap(wSqueethPool.address, wSqueeth.address, weth.address, 600)
        const ethDelta = await crabStrategy.getStrategyCollateral()
        const strategyDebt = await crabStrategy.getStrategyDebt()
        let wSqueethDelta = wmul(wmul(strategyDebt, BigNumber.from(2).mul(BigNumber.from(10).pow(18))), currentWSqueethPrice)
        const targetHedge = wdiv(wSqueethDelta.sub(ethDelta), currentWSqueethPrice)
        const isSellAuction = targetHedge.isNegative()
        const auctionExecution = (BigNumber.from(hedgeBlockTimestamp).sub(auctionTriggerTimer).gte(BigNumber.from(auctionTime))) ? BigNumber.from(1).mul(BigNumber.from(10).pow(18)) : wdiv(BigNumber.from(hedgeBlockTimestamp).sub(auctionTriggerTimer), BigNumber.from(auctionTime))
        const result = calcSlippageAndAuctionPrice(isSellAuction, maxAuctionSlippage, minAuctionSlippage, auctionExecution, currentWSqueethPrice)
        const expectedAuctionWSqueethEthPrice = result[1]
        wSqueethDelta = wmul(wmul(strategyDebt, BigNumber.from(2).mul(BigNumber.from(10).pow(18))), expectedAuctionWSqueethEthPrice)
        const expectedSecondTargetHedge = wdiv(wSqueethDelta.sub(ethDelta), expectedAuctionWSqueethEthPrice)
        const expectedEthProceeds = wmul(expectedSecondTargetHedge.abs(), expectedAuctionWSqueethEthPrice)
  
        expect(isSellAuction).to.be.true

        const senderWsqueethBalanceBefore = await wSqueeth.balanceOf(depositor.address)
          
        await crabStrategy.connect(depositor).timeHedge({value: expectedEthProceeds.add(1)})
        
        currentWSqueethPrice = await oracle.getTwap(wSqueethPool.address, wSqueeth.address, weth.address, 600)
        const senderWsqueethBalanceAfter = await wSqueeth.balanceOf(depositor.address)
        const strategyDebtAmountAfter = await crabStrategy.getStrategyDebt()
        const strategyCollateralAmountAfter = await crabStrategy.getStrategyCollateral()
        wSqueethDelta = wmul(wmul(strategyDebtAmountAfter, BigNumber.from(2).mul(BigNumber.from(10).pow(18))), currentWSqueethPrice)

        expect(isSimilar(senderWsqueethBalanceAfter.sub(senderWsqueethBalanceBefore).toString(), expectedSecondTargetHedge.abs().toString())).to.be.true
        expect(isSimilar(strategyDebtAmountAfter.sub(strategyDebt).toString(), expectedSecondTargetHedge.abs().toString())).to.be.true
        expect(isSimilar(strategyCollateralAmountAfter.sub(ethDelta).toString(), expectedEthProceeds.toString())).to.be.true
      })
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


        await buyWSqueeth(swapRouter, wSqueeth, weth, owner.address, ethers.utils.parseUnits('4000'), currentBlockTimestamp + 10)
        // set depositor balance to 0
        await wSqueeth.connect(depositor).transfer(random.address, await wSqueeth.balanceOf(depositor.address))
      })

      it("should revert hedging when WSqueeth seller have less amount that target hedge", async () => {
        const timeAtLastHedge = await crabStrategy.timeAtLastHedge()
        const hedgeTimeThreshold = await crabStrategy.hedgeTimeThreshold()
        const auctionTriggerTimer = timeAtLastHedge.add(hedgeTimeThreshold)
        
        // advanced more time to avoid traget hedge sign change
        await provider.send("evm_increaseTime", [auctionTime/2])
        await provider.send("evm_mine", [])        
          
        expect(await crabStrategy.checkPriceHedge(auctionTriggerTimer)).to.be.false;
        expect((await crabStrategy.checkTimeHedge())[0]).to.be.true;
  
        let currentWSqueethPrice = await oracle.getTwap(wSqueethPool.address, wSqueeth.address, weth.address, 600)
        const ethDelta = await crabStrategy.getStrategyCollateral()
        const strategyDebt = await crabStrategy.getStrategyDebt()
        const wSqueethDelta = wmul(strategyDebt.mul(2), currentWSqueethPrice)
        const targetHedge = wdiv(wSqueethDelta.sub(ethDelta), currentWSqueethPrice)
        const isSellAuction = targetHedge.isNegative()
  
        expect(isSellAuction).to.be.false

        const senderWsqueethBalanceBefore = await wSqueeth.balanceOf(depositor.address)

        await wSqueeth.connect(depositor).approve(crabStrategy.address, senderWsqueethBalanceBefore)

        await expect(
          crabStrategy.connect(depositor).timeHedge()
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
  
        expect(await crabStrategy.checkPriceHedge(auctionTriggerTimer)).to.be.false;
        expect((await crabStrategy.checkTimeHedge())[0]).to.be.true;
  
        let currentWSqueethPrice = await oracle.getTwap(wSqueethPool.address, wSqueeth.address, weth.address, 600)
        const ethDelta = await crabStrategy.getStrategyCollateral()
        const strategyDebt = await crabStrategy.getStrategyDebt()
        let wSqueethDelta = wmul(strategyDebt.mul(2), currentWSqueethPrice)
        const targetHedge = wdiv(wSqueethDelta.sub(ethDelta), currentWSqueethPrice)
        const isSellAuction = targetHedge.isNegative()
        const auctionExecution = (BigNumber.from(hedgeBlockTimestamp).sub(auctionTriggerTimer).gte(BigNumber.from(auctionTime))) ? BigNumber.from(1).mul(BigNumber.from(10).pow(18)) : wdiv(BigNumber.from(hedgeBlockTimestamp).sub(auctionTriggerTimer), BigNumber.from(auctionTime))
        const result = calcSlippageAndAuctionPrice(isSellAuction, maxAuctionSlippage, minAuctionSlippage, auctionExecution, currentWSqueethPrice)
        const expectedAuctionWSqueethEthPrice = result[1]
        const slippage = result[0]
        wSqueethDelta = wmul(strategyDebt.mul(2), expectedAuctionWSqueethEthPrice)
        const secondTargetHedge = wdiv(wSqueethDelta.sub(ethDelta), expectedAuctionWSqueethEthPrice)
        const expectedEthProceeds = wmul(secondTargetHedge.abs(), expectedAuctionWSqueethEthPrice)
  
        expect(isSellAuction).to.be.false

        const collatToDeposit = wdiv(wmul(secondTargetHedge.abs(), ethDelta), strategyDebt) 
        await controller.connect(depositor).mintWPowerPerpAmount("0", secondTargetHedge.abs(), "0", {value: collatToDeposit.add(collatToDeposit.mul(2).div(3))})
        let senderWsqueethBalanceBefore = await wSqueeth.balanceOf(depositor.address)

        await wSqueeth.connect(depositor).approve(crabStrategy.address, senderWsqueethBalanceBefore)
        await crabStrategy.connect(depositor).timeHedge()

        currentWSqueethPrice = await oracle.getTwap(wSqueethPool.address, wSqueeth.address, weth.address, 600)
        const senderWsqueethBalanceAfter = await wSqueeth.balanceOf(depositor.address)
        const strategyDebtAmountAfter = await crabStrategy.getStrategyDebt()
        const strategyCollateralAmountAfter = await crabStrategy.getStrategyCollateral()
        wSqueethDelta = wmul(wmul(strategyDebtAmountAfter, BigNumber.from(2).mul(BigNumber.from(10).pow(18))), currentWSqueethPrice)
        
        expect(isSimilar(senderWsqueethBalanceBefore.sub(senderWsqueethBalanceAfter).toString(), secondTargetHedge.toString())).to.be.true
        expect(isSimilar(strategyDebt.sub(strategyDebtAmountAfter).toString(), secondTargetHedge.toString())).to.be.true
        expect(isSimilar(ethDelta.sub(strategyCollateralAmountAfter).toString(), expectedEthProceeds.abs().toString())).to.be.true
      })
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