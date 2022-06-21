import { ethers } from "hardhat"
import { expect } from "chai";
import { Contract, BigNumber, providers } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import BigNumberJs from 'bignumber.js'
import { WETH9, MockErc20, Controller, Oracle, WPowerPerp, CrabStrategy, ISwapRouter } from "../../../../typechain";
import { deployUniswapV3, deploySqueethCoreContracts, deployWETHAndDai, addWethDaiLiquidity, addSqueethLiquidity } from '../../setup'
import { isSimilar, wmul, wdiv, one, oracleScaleFactor } from "../../utils"

BigNumberJs.set({EXPONENTIAL_AT: 30})

describe("Crab flashswap integration test: crab vault liquidation", function () {
  const startingEthPrice = 3000
  const startingEthPrice1e18 = BigNumber.from(startingEthPrice).mul(one) // 3000 * 1e18
  const scaledStartingSqueethPrice1e18 = startingEthPrice1e18.mul(11).div(10).div(oracleScaleFactor) // 0.3 * 1e18
  const scaledStartingSqueethPrice = startingEthPrice*1.1 / oracleScaleFactor.toNumber() // 0.3


  const hedgeTimeThreshold = 86400  // 24h
  const hedgePriceThreshold = ethers.utils.parseUnits('0.01')
  const auctionTime = 3600
  const minPriceMultiplier = ethers.utils.parseUnits('0.95')
  const maxPriceMultiplier = ethers.utils.parseUnits('1.05')

  let provider: providers.JsonRpcProvider;
  let owner: SignerWithAddress;
  let depositor: SignerWithAddress;
  let depositor2: SignerWithAddress;
  let liquidator: SignerWithAddress;
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
    const [_owner, _depositor, _depositor2, _liquidator, _feeRecipient ] = accounts;
    owner = _owner;
    depositor = _depositor;
    depositor2 = _depositor2;
    liquidator = _liquidator;
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

    await controller.connect(owner).setFeeRecipient(feeRecipient.address);
    await controller.connect(owner).setFeeRate(100)

    const CrabStrategyContract = await ethers.getContractFactory("CrabStrategy");
    crabStrategy = (await CrabStrategyContract.deploy(controller.address, oracle.address, weth.address, uniswapFactory.address, wSqueethPool.address, hedgeTimeThreshold, hedgePriceThreshold, auctionTime, minPriceMultiplier, maxPriceMultiplier)) as CrabStrategy;
    
    const strategyCap = ethers.utils.parseUnits("1000")
    await crabStrategy.connect(owner).setStrategyCap(strategyCap)
    const strategyCapInContract = await crabStrategy.strategyCap()
    expect(strategyCapInContract.eq(strategyCap)).to.be.true
  })

  this.beforeAll("Seed pool liquidity", async() => {
    await provider.send("evm_increaseTime", [300])
    await provider.send("evm_mine", [])

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
    const msgvalue = ethers.utils.parseUnits('10.2')
    const depositorSqueethBalanceBefore = await wSqueeth.balanceOf(depositor.address)

    await crabStrategy.connect(depositor).flashDeposit(ethToDeposit, {value: msgvalue})
    
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
    expect(isSimilar(depositorCrab.toString(),expectedEthDeposit.toString())).to.be.true
    expect(isSimilar(debtAmount.toString(), debtToMint.toString())).to.be.true
    expect(depositorSqueethBalance.eq(depositorSqueethBalanceBefore)).to.be.true
    expect(strategyContractSqueeth.eq(BigNumber.from(0))).to.be.true
    expect(lastHedgeTime.eq(timeStamp)).to.be.true
  })

  describe("liquidate vault", async () => {
    before('push weth price higher to make crab vault liquidatable', async() => {
      // set weth price higher by buying 25% of weth in the pool
      const poolWethBalance = await weth.balanceOf(ethDaiPool.address)

      const maxDai = poolWethBalance.mul(startingEthPrice).mul(5)

      const exactOutputParam = {
        tokenIn: dai.address,
        tokenOut: weth.address,
        fee: 3000,
        recipient: owner.address,
        deadline: (await provider.getBlock(await provider.getBlockNumber())).timestamp + 86400,
        amountOut: ethers.utils.parseUnits("20"),
        amountInMaximum: maxDai,
        sqrtPriceLimitX96: 0,
      }

      await dai.connect(owner).mint(owner.address, maxDai, )
      await dai.connect(owner).approve(swapRouter.address, ethers.constants.MaxUint256)      
      await (swapRouter as ISwapRouter).connect(owner).exactOutputSingle(exactOutputParam)
    })

    before('push squeeth price higher', async() => {
      // set squeeth price higher by buying 25% of squeeth in the pool
      const poolSqueethBalance = await wSqueeth.balanceOf(wSqueethPool.address)

      const maxWeth = poolSqueethBalance.mul(scaledStartingSqueethPrice1e18).mul(5).div(one)
            
      const exactOutputParam = {
        tokenIn: weth.address,
        tokenOut: wSqueeth.address,
        fee: 3000,
        recipient: owner.address,
        deadline: (await provider.getBlock(await provider.getBlockNumber())).timestamp + 86400,
        amountOut: ethers.utils.parseUnits("200000"),
        amountInMaximum: maxWeth,
        sqrtPriceLimitX96: 0,
      }

      await weth.connect(owner).deposit({value: maxWeth})
      await weth.connect(owner).approve(swapRouter.address, ethers.constants.MaxUint256)      
      await (swapRouter as ISwapRouter).connect(owner).exactOutputSingle(exactOutputParam)
    })

    before('prepare liquidator to liquidate strategy', async() => {
      await provider.send("evm_increaseTime", [600]) // increase time by 600 sec
      await provider.send("evm_mine", [])

      const vaultId = await crabStrategy.vaultId();
      const newEthPrice = await oracle.getTwap(ethDaiPool.address, weth.address, dai.address, 600, false)
      const vaultBefore = await controller.vaults(vaultId)
      
      const mintAmount = vaultBefore.shortAmount
      const collateralRequired = mintAmount.mul(newEthPrice).mul(2).div(oracleScaleFactor).div(one).mul(2)

      // mint squeeth to liquidate vault0!
      await controller.connect(liquidator).mintPowerPerpAmount(0, mintAmount, 0, {value: collateralRequired})
    })

    it("should liquidate crab vault", async () => {
      const vaultId = await crabStrategy.vaultId();
      const isVaultSafe = await controller.isVaultSafe((await crabStrategy.vaultId()))
      const normFactor = await controller.getExpectedNormalizationFactor()
      const newEthPrice = await oracle.getTwap(ethDaiPool.address, weth.address, dai.address, 600, false)
      const newSqueethPrice = await oracle.getTwap(wSqueethPool.address, wSqueeth.address, weth.address, 600, false)
      const vaultBefore = await controller.vaults(vaultId)
      const wSqueethVaultBefore = vaultBefore.shortAmount
      const collateralBefore = vaultBefore.collateralAmount

      const collatRatio = collateralBefore.mul(one).div(wSqueethVaultBefore.mul(normFactor).mul(newEthPrice).div(one).div(one).div(oracleScaleFactor))
      
      expect(isVaultSafe).to.be.false

      // state before liquidation
      const liquidatorSqueethBefore = await wSqueeth.balanceOf(liquidator.address)
      const liquidatorBalanceBefore = await provider.getBalance(liquidator.address)

      const wSqueethAmountToLiquidate = vaultBefore.shortAmount.div(2)

      await controller.connect(liquidator).liquidate(vaultId, wSqueethAmountToLiquidate);
      
      const collateralToGet = newSqueethPrice.mul(wSqueethAmountToLiquidate).div(one).mul(11).div(10)

      const vaultAfter = await controller.vaults(vaultId)
      const liquidatorBalanceAfter = await provider.getBalance(liquidator.address)
      const liquidatorSqueethAfter = await wSqueeth.balanceOf(liquidator.address)

      expect(isSimilar((vaultBefore.shortAmount.div(2)).toString(),(vaultAfter.shortAmount).toString())).to.be.true
      expect(vaultAfter.shortAmount.gt(BigNumber.from(0))).to.be.true
      expect(vaultAfter.collateralAmount.gt(BigNumber.from(0))).to.be.true
      // expect(collateralToGet.eq(liquidatorBalanceAfter.sub(liquidatorBalanceBefore))).to.be.true
      expect(vaultBefore.shortAmount.sub(vaultAfter.shortAmount).eq(liquidatorSqueethBefore.sub(liquidatorSqueethAfter))).to.be.true
    })

    it("should let user deposit post liquidation and update vault state and provide correct wSqueeth and crab tokens", async () => {
      
      //                               (userEthDeposit * strategyDebtBeforeDeposit) 
      //  wSqueethToMint =  ----------------------------------------------------------------------------------------
      //                    (strategyCollateralBeforeDeposit + strategyDebtBeforeDeposit*squeethEthPrice*fee%)

      
      const vaultId = await crabStrategy.vaultId();
      const isVaultSafe = await controller.isVaultSafe((await crabStrategy.vaultId()))
      const normFactor = await controller.getExpectedNormalizationFactor()
      const newEthPrice = await oracle.getTwap(ethDaiPool.address, weth.address, dai.address, 600, false)
      const newSqueethPrice = await oracle.getTwap(wSqueethPool.address, wSqueeth.address, weth.address, 600, false)
      const vaultBefore = await controller.vaults(vaultId)
      const wSqueethVaultBefore = vaultBefore.shortAmount
      const collateralBefore = vaultBefore.collateralAmount

      const collatRatio = collateralBefore.mul(one).div(wSqueethVaultBefore.mul(normFactor).mul(newEthPrice).div(one).div(one).div(oracleScaleFactor))

      const debtBefore = vaultBefore.shortAmount
      const ratio = debtBefore.mul(one).div(collateralBefore)

      const ethToDeposit = ethers.utils.parseUnits('20')
      const msgvalue = ethers.utils.parseUnits('15')  
      const totalSupplyBefore = (await crabStrategy.totalSupply())
      const depositorCrabBefore = (await crabStrategy.balanceOf(depositor2.address))
      const depositorSqueethBalanceBefore = await wSqueeth.balanceOf(depositor.address)

      await crabStrategy.connect(depositor2).flashDeposit(ethToDeposit, {value: msgvalue})      
      
      const currentScaledSquethPrice = (await oracle.getTwap(wSqueethPool.address, wSqueeth.address, weth.address, 300, false))
      const feeRate = await controller.feeRate()
      const ethFeePerWSqueeth = currentScaledSquethPrice.mul(feeRate).div(10000)
      const debtToMint = ethToDeposit.mul(debtBefore).div(collateralBefore.add(debtBefore.mul(ethFeePerWSqueeth).div(one)))
      const expectedEthDeposit = ethToDeposit.sub(debtToMint.mul(ethFeePerWSqueeth).div(one))
      const depositorShare = one.mul(expectedEthDeposit).div(collateralBefore.add(expectedEthDeposit))
      const crabMintAmount = totalSupplyBefore.mul(depositorShare).div(one.sub(depositorShare))

      const strategyVaultAfter = await controller.vaults(vaultId)
      const strategyDebtAmountAfter = strategyVaultAfter.shortAmount
      const strategyCollateralAmountAfter = strategyVaultAfter.collateralAmount
      const depositorCrabAfter = (await crabStrategy.balanceOf(depositor2.address))
      const depositorSqueethBalanceAfter = await wSqueeth.balanceOf(depositor2.address)
      const strategyContractSqueeth = await wSqueeth.balanceOf(crabStrategy.address)
      const totalSupplyAfter = (await crabStrategy.totalSupply())
      // const depositorEthBalanceAfter = await provider.getBalance(depositor2.address)

      expect(isSimilar((strategyCollateralAmountAfter.sub(collateralBefore)).toString(),(expectedEthDeposit).toString())).to.be.true
      expect(isSimilar(strategyDebtAmountAfter.toString(),(debtBefore.add(debtToMint)).toString())).to.be.true
      expect(isSimilar((strategyDebtAmountAfter.sub(debtBefore)).toString(),(debtToMint).toString())).to.be.true      
      expect(isSimilar((totalSupplyAfter.sub(totalSupplyBefore)).toString(),(crabMintAmount).toString())).to.be.true
      expect((depositorSqueethBalanceAfter.sub(depositorSqueethBalanceBefore)).eq(BigNumber.from(0))).to.be.true
      expect(strategyContractSqueeth.eq(BigNumber.from(0))).to.be.true
      expect(isSimilar((depositorCrabAfter.sub(depositorCrabBefore)).toString(),(crabMintAmount).toString())).to.be.true
    })

    it("depositor should withdraw correct amount of ETH collateral", async () => {
      const wSqueethPrice = await oracle.getTwap(wSqueethPool.address, wSqueeth.address, weth.address, 1, false)

      const userCrabBalanceBefore = await crabStrategy.balanceOf(depositor.address);
      const crabTotalSupply = await crabStrategy.totalSupply()
      const strategyVault = await controller.vaults(await crabStrategy.vaultId());
      const strategyDebtAmountBefore = strategyVault.shortAmount
      const strategyCollateralAmountBefore = strategyVault.collateralAmount
      const userEthBalanceBefore = await provider.getBalance(depositor.address)
      const crabRatio = wdiv(userCrabBalanceBefore, crabTotalSupply);
      const debtToRepay = wmul(crabRatio,strategyDebtAmountBefore);
      const ethCostOfDebtToRepay = wmul(debtToRepay,wSqueethPrice)
      const userCollateral = wmul(crabRatio, strategyCollateralAmountBefore)
      const ethToWithdraw = userCollateral.sub(ethCostOfDebtToRepay);
      const maxEthToPay = ethCostOfDebtToRepay.mul(101).div(100)

      await crabStrategy.connect(depositor).flashWithdraw(userCrabBalanceBefore, maxEthToPay)

      const userEthBalanceAfter = await provider.getBalance(depositor.address)
      const userCrabBalanceAfter = await crabStrategy.balanceOf(depositor.address);
      const vaultId = await crabStrategy.vaultId();
      const isVaultSafe = await controller.isVaultSafe((await crabStrategy.vaultId()))
      expect(isVaultSafe).to.be.true

      const vaultBefore = await controller.vaults(vaultId)
      const collateralAfter = vaultBefore.collateralAmount
      const debtAfter = vaultBefore.shortAmount

      expect(isSimilar(userEthBalanceAfter.sub(userEthBalanceBefore).toString(), ethToWithdraw.toString(),2)).to.be.true
      expect(userCrabBalanceAfter.eq(BigNumber.from(0))).to.be.true
      expect(userCrabBalanceBefore.sub(userCrabBalanceAfter).eq(userCrabBalanceBefore)).to.be.true
      expect(collateralAfter.eq(strategyCollateralAmountBefore.sub(userCollateral))).to.be.true
      // use isSimilar to prevent last digits rounding error
      expect(isSimilar(strategyDebtAmountBefore.sub(debtAfter).toString(), debtToRepay.toString(), 10)).to.be.true
    })

    it("depositor2 should withdraw correct amount of ETH collateral", async () => {
      
      
      const wSqueethPrice = await oracle.getTwap(wSqueethPool.address, wSqueeth.address, weth.address, 1, false)

      const userCrabBalanceBefore = await crabStrategy.balanceOf(depositor2.address);
      const crabTotalSupply = await crabStrategy.totalSupply()
      const strategyVault = await controller.vaults(await crabStrategy.vaultId());
      const strategyDebtAmountBefore = strategyVault.shortAmount
      const strategyCollateralAmountBefore = strategyVault.collateralAmount
      const userEthBalanceBefore = await provider.getBalance(depositor2.address)
      const crabRatio = wdiv(userCrabBalanceBefore, crabTotalSupply);
      const debtToRepay = wmul(crabRatio,strategyDebtAmountBefore);
      const ethCostOfDebtToRepay = wmul(debtToRepay,wSqueethPrice)
      const userCollateral = wmul(crabRatio, strategyCollateralAmountBefore)
      const ethToWithdraw = userCollateral.sub(ethCostOfDebtToRepay);
      const maxEthToPay = ethCostOfDebtToRepay.mul(11).div(10)

      await crabStrategy.connect(depositor2).flashWithdraw(userCrabBalanceBefore, maxEthToPay)

      const strategyVaultAfter = await controller.vaults(await crabStrategy.vaultId());
      const userEthBalanceAfter = await provider.getBalance(depositor2.address)
      const userCrabBalanceAfter = await crabStrategy.balanceOf(depositor2.address);
      const strategyDebtAmountAfter = strategyVaultAfter.shortAmount
      const strategyCollateralAmountAfter = strategyVaultAfter.collateralAmount

      const vaultId = await crabStrategy.vaultId();
      const isVaultSafe = await controller.isVaultSafe((await crabStrategy.vaultId()))
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
