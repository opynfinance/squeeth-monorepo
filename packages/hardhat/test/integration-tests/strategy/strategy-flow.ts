import { ethers } from "hardhat"
import { expect } from "chai";
import { Contract, BigNumber, providers } from "ethers";
import BigNumberJs from 'bignumber.js'

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers";
import { WETH9, MockErc20, Controller, Oracle, WPowerPerp, CrabStrategy } from "../../../typechain";
import { deployUniswapV3, deploySqueethCoreContracts, deployWETHAndDai, addWethDaiLiquidity, addSqueethLiquidity } from '../../setup'
import { isSimilar, wmul, wdiv, one, oracleScaleFactor } from "../../utils"

BigNumberJs.set({EXPONENTIAL_AT: 30})

describe("Crab integration test: flash deposit - deposit - withdraw", function () {
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
  let dai: MockErc20
  let weth: WETH9
  let positionManager: Contract
  let uniswapFactory: Contract
  let oracle: Oracle
  let controller: Controller
  let wSqueethPool: Contract
  let wSqueeth: WPowerPerp
  let crabStrategy: CrabStrategy

  this.beforeAll("Deploy uniswap protocol & setup uniswap pool", async() => {
    const accounts = await ethers.getSigners();
    const [_owner, _depositor ] = accounts;
    owner = _owner;
    depositor = _depositor;
    provider = ethers.provider

    const { dai: daiToken, weth: wethToken } = await deployWETHAndDai()

    dai = daiToken
    weth = wethToken

    const uniDeployments = await deployUniswapV3(weth)
    positionManager = uniDeployments.positionManager
    uniswapFactory = uniDeployments.uniswapFactory

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

  describe("flash deposit - deposit - withdraw - flash withdraw", async () => {
    it("should revert flash depositing if not enough ETH", async () => {
      const ethToDeposit = ethers.utils.parseUnits('10')
      const ethToBorrow = ethers.utils.parseUnits('10')
      const msgvalue = ethers.utils.parseUnits('10')

      await expect(
        crabStrategy.connect(depositor).flashDeposit(ethToDeposit, ethToBorrow, {value: msgvalue})
      ).to.be.revertedWith("Need some buffer");
    })

    it("should flash deposit correct amount and mint correct shares amount", async () => {
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
      const currentBlockNumber = await provider.getBlockNumber()
      const currentBlock = await provider.getBlock(currentBlockNumber)
      const timeStamp = currentBlock.timestamp

      expect(totalSupply.eq(ethToDeposit.add(ethToBorrow))).to.be.true
      expect(depositorCrab.eq(ethToDeposit.add(ethToBorrow))).to.be.true
      expect(isSimilar(debtAmount.toString(), debtToMint.toString())).to.be.true
      expect(depositorSqueethBalance.eq(depositorSqueethBalanceBefore)).to.be.true
      expect(strategyContractSqueeth.eq(BigNumber.from(0))).to.be.true
      expect(lastHedgeTime.eq(timeStamp)).to.be.true
    })

    it("should deposit and mint correct LP and return the correct amount of wSqueeth debt per crab strategy token", async () => {
      const strategyCollateralBefore = await crabStrategy.getStrategyCollateral()
      const strategyDebtBefore = await crabStrategy.getStrategyDebt()
      const totalCrabBefore = await crabStrategy.totalSupply()
      const depositorCrabBefore = (await crabStrategy.balanceOf(depositor.address))
      const depositorSqueethBalanceBefore = await wSqueeth.balanceOf(depositor.address)

      const ethToDeposit = BigNumber.from(20).mul(one)
      const depositorShare = wdiv(ethToDeposit, (strategyCollateralBefore.add(ethToDeposit)))
      const expectedDepositorCrab = wdiv(wmul(totalCrabBefore, depositorShare), (one.sub(depositorShare)))
      
      const debtToMint = ethToDeposit.mul(strategyDebtBefore).div(strategyCollateralBefore);

      await crabStrategy.connect(depositor).deposit({value: ethToDeposit});

      const normFactor = await controller.normalizationFactor()
      const expectedMintedWsqueeth = wmul(debtToMint,normFactor)
      const totalCrabAfter = (await crabStrategy.totalSupply())
      const depositorCrab = (await crabStrategy.balanceOf(depositor.address))
      const debtAmount = (await crabStrategy.getStrategyDebt())
      const depositorSqueethBalance = await wSqueeth.balanceOf(depositor.address)
      const strategyContractSqueeth = await wSqueeth.balanceOf(crabStrategy.address)
      const depositorWSqueethDebt = await crabStrategy.getWsqueethFromCrabAmount(depositorCrab)

      expect(totalCrabAfter.eq(totalCrabBefore.add(expectedDepositorCrab))).to.be.true
      expect(depositorCrab.sub(depositorCrabBefore).eq(expectedDepositorCrab)).to.be.true
      expect(debtAmount.eq(strategyDebtBefore.add(debtToMint))).to.be.true
      expect(isSimilar(depositorSqueethBalance.sub(depositorSqueethBalanceBefore).toString(), expectedMintedWsqueeth.toString())).to.be.true
      expect(strategyContractSqueeth.eq(BigNumber.from(0))).to.be.true
      expect(depositorWSqueethDebt.eq(depositorSqueethBalance))    
    })

    it("should withdraw correct amount of ETH", async () => {
      const crabToBurn = ethers.utils.parseUnits('20')
      const wSqueethToBurn = await crabStrategy.getWsqueethFromCrabAmount(crabToBurn)
      const strategyCollateralBefore = await crabStrategy.getStrategyCollateral()
      const strategyDebtBefore = await crabStrategy.getStrategyDebt()
      const totalCrabBefore = await crabStrategy.totalSupply()
      const depositorCrabBefore = (await crabStrategy.balanceOf(depositor.address))
      const depositorEthBalanceBefore = await provider.getBalance(depositor.address)

      const expectedCrabPercentage = wdiv(crabToBurn, totalCrabBefore)
      const expectedEthToWithdraw = wmul(strategyCollateralBefore, expectedCrabPercentage)

      await wSqueeth.connect(depositor).approve(crabStrategy.address, wSqueethToBurn)
      await crabStrategy.connect(depositor).withdraw(crabToBurn, wSqueethToBurn);  

      const strategyCollateralAfter = await crabStrategy.getStrategyCollateral()
      const strategyDebtAfter = await crabStrategy.getStrategyDebt()
      const totalCrabAfter = await crabStrategy.totalSupply()
      const depositorCrabAfter = (await crabStrategy.balanceOf(depositor.address))
      const depositorSqueethBalanceAfter = await wSqueeth.balanceOf(depositor.address)
      const depositorEthBalanceAfter = await provider.getBalance(depositor.address)

      expect(depositorSqueethBalanceAfter.eq(BigNumber.from(0))).to.be.true
      expect(depositorCrabAfter.eq(depositorCrabBefore.sub(crabToBurn))).to.be.true
      expect(totalCrabAfter.eq(totalCrabBefore.sub(crabToBurn))).to.be.true
      expect(strategyCollateralAfter.eq(strategyCollateralBefore.sub(expectedEthToWithdraw))).to.be.true
      expect(strategyDebtAfter.eq(strategyDebtBefore.sub(wSqueethToBurn))).to.be.true
      expect(isSimilar(depositorEthBalanceAfter.sub(depositorEthBalanceBefore).toString(), expectedEthToWithdraw.toString(), 3)).to.be.true // 0.002605896 diff
    })

    it("should revert if slippage is too high", async () => {
      const wSqueethPrice = await oracle.getTwap(wSqueethPool.address, wSqueeth.address, weth.address, 1, false)

      const userCrabBalanceBefore = await crabStrategy.balanceOf(depositor.address);
      const crabTotalSupply = await crabStrategy.totalSupply()
      const strategyDebtAmountBefore = await crabStrategy.getStrategyDebt()
      const strategyCollateralAmountBefore = await crabStrategy.getStrategyCollateral()

      const crabRatio = wdiv(userCrabBalanceBefore, crabTotalSupply);
      const debtToRepay = wmul(crabRatio,strategyDebtAmountBefore);
      const ethCostOfDebtToRepay = wmul(debtToRepay,wSqueethPrice)
      const userCollateral = wmul(crabRatio, strategyCollateralAmountBefore)
      const ethToWithdraw = userCollateral.sub(ethCostOfDebtToRepay);
      const maxEthToPay = ethToWithdraw.mul(9).div(10)

      await expect(
        crabStrategy.connect(depositor).flashWithdraw(userCrabBalanceBefore, maxEthToPay)
      ).to.be.revertedWith("amount in greater than max");
    })

    it("should flash withdraw correct amount of ETH collateral", async () => {
      const wSqueethPrice = await oracle.getTwap(wSqueethPool.address, wSqueeth.address, weth.address, 1, false)

      const userCrabBalanceBefore = await crabStrategy.balanceOf(depositor.address);
      const crabTotalSupply = await crabStrategy.totalSupply()
      const strategyDebtAmountBefore = await crabStrategy.getStrategyDebt()
      const strategyCollateralAmountBefore = await crabStrategy.getStrategyCollateral()
      const userEthBalanceBefore = await provider.getBalance(depositor.address)
      const crabRatio = wdiv(userCrabBalanceBefore, crabTotalSupply);
      const debtToRepay = wmul(crabRatio,strategyDebtAmountBefore);
      const ethCostOfDebtToRepay = wmul(debtToRepay, wSqueethPrice)
      const userCollateral = wmul(crabRatio, strategyCollateralAmountBefore)
      const ethToWithdraw = userCollateral.sub(ethCostOfDebtToRepay);
      const maxEthToPay = ethToWithdraw.mul(15).div(10)

      await crabStrategy.connect(depositor).flashWithdraw(userCrabBalanceBefore, maxEthToPay)

      const userEthBalanceAfter = await provider.getBalance(depositor.address)
      const userCrabBalanceAfter = await crabStrategy.balanceOf(depositor.address);
      const strategyDebtAmountAfter = await crabStrategy.getStrategyDebt()
      const strategyCollateralAmountAfter = await crabStrategy.getStrategyCollateral()

      const vaultId = await crabStrategy._vaultId();
      const isVaultSafe = await controller.isVaultSafe((await crabStrategy._vaultId()))
      expect(isVaultSafe).to.be.true

      const vaultBefore = await controller.vaults(vaultId)
      const collateralAfter = vaultBefore.collateralAmount
      const debtAfter = vaultBefore.shortAmount

      expect(isSimilar(userEthBalanceAfter.sub(userEthBalanceBefore).toString(), ethToWithdraw.toString(),2)).to.be.true
      expect(userCrabBalanceAfter.eq(BigNumber.from(0))).to.be.true
      expect(userCrabBalanceBefore.sub(userCrabBalanceAfter).eq(userCrabBalanceBefore)).to.be.true
      expect(collateralAfter.eq(strategyCollateralAmountBefore.sub(userCollateral))).to.be.true
      expect(strategyDebtAmountBefore.sub(debtAfter).eq(debtToRepay)).to.be.true
      expect(strategyDebtAmountAfter.eq(BigNumber.from(0))).to.be.true
      expect(strategyCollateralAmountAfter.eq(BigNumber.from(0))).to.be.true
    })  
  })
})