import { ethers } from "hardhat"
import { expect } from "chai";
import { Contract, BigNumber, providers } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import BigNumberJs from 'bignumber.js'
import { WETH9, MockErc20, Controller, Oracle, WPowerPerp, CrabStrategy, ISwapRouter } from "../../../../typechain";
import { deployUniswapV3, deploySqueethCoreContracts, deployWETHAndDai, addWethDaiLiquidity, addSqueethLiquidity } from '../../setup'
import { isSimilar, wmul, wdiv, one, oracleScaleFactor } from "../../utils"

BigNumberJs.set({EXPONENTIAL_AT: 30})

describe("Crab integration test: crab vault dust liquidation with excess collateral", function () {
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
  let depositor2: SignerWithAddress;
  let liquidator: SignerWithAddress;
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
    const [_owner, _depositor, _depositor2, _liquidator ] = accounts;
    owner = _owner;
    depositor = _depositor;
    depositor2 = _depositor2;
    liquidator = _liquidator;
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
    const ethToDeposit = ethers.utils.parseUnits('0.51')
    const msgvalue = ethers.utils.parseUnits('0.51')
    const ethPrice = await oracle.getTwap(ethDaiPool.address, weth.address, dai.address, 600, true)
    const depositorSqueethBalanceBefore = await wSqueeth.balanceOf(depositor.address)

    await crabStrategy.connect(depositor).deposit({value: msgvalue})
    const [operator, nftId, collateralAmount, debtAmount] = await crabStrategy.getVaultDetails()

    const normFactor = await controller.normalizationFactor()
    const currentScaledEthPrice = (await oracle.getTwap(ethDaiPool.address, weth.address, dai.address, 300, false)).div(oracleScaleFactor)
    const feeRate = await controller.feeRate()
    const ethFeePerWSqueeth = currentScaledEthPrice.mul(normFactor).mul(feeRate).div(10000).div(one)
    const squeethDelta = scaledStartingSqueethPrice1e18.mul(2);
    const debtToMint = wdiv(ethToDeposit, (squeethDelta.add(ethFeePerWSqueeth)));
    const expectedEthDeposit = ethToDeposit.sub(debtToMint.mul(ethFeePerWSqueeth).div(one))

    const totalSupply = (await crabStrategy.totalSupply())
    const depositorCrab = (await crabStrategy.balanceOf(depositor.address))
    const strategyVault = await controller.vaults(await crabStrategy.vaultId());
    const depositorSqueethBalance = await wSqueeth.balanceOf(depositor.address)
    const strategyContractSqueeth = await wSqueeth.balanceOf(crabStrategy.address)
    const lastHedgeTime = await crabStrategy.timeAtLastHedge()
    const currentBlockNumber = await provider.getBlockNumber()
    const currentBlock = await provider.getBlock(currentBlockNumber)
    const timeStamp = currentBlock.timestamp

    expect(totalSupply.eq(ethToDeposit)).to.be.true
    expect(depositorCrab.eq(ethToDeposit)).to.be.true
    expect(isSimilar(debtAmount.toString(), debtToMint.toString())).to.be.true
    expect(isSimilar((depositorSqueethBalance.sub(depositorSqueethBalanceBefore)).toString(),(debtToMint).toString())).to.be.true
    expect(strategyContractSqueeth.eq(BigNumber.from(0))).to.be.true
    expect(lastHedgeTime.eq(timeStamp)).to.be.true
    
  })

  describe("liquidate vault", async () => {
    before('push weth price higher to make crab vault liquidatable', async() => {
      const poolWethBalance = await weth.balanceOf(ethDaiPool.address)

      const maxDai = poolWethBalance.mul(startingEthPrice).mul(5)

      const exactOutputParam = {
        tokenIn: dai.address,
        tokenOut: weth.address,
        fee: 3000,
        recipient: owner.address,
        deadline: (await provider.getBlock(await provider.getBlockNumber())).timestamp + 86400,
        amountOut: ethers.utils.parseUnits("15"),
        amountInMaximum: maxDai,
        sqrtPriceLimitX96: 0,
      }

      await dai.connect(owner).mint(owner.address, maxDai, )
      await dai.connect(owner).approve(swapRouter.address, ethers.constants.MaxUint256)      
      await (swapRouter as ISwapRouter).connect(owner).exactOutputSingle(exactOutputParam)
    })

    before('push squeeth price higher', async() => {
      // set squeeth price higher by buying 15% of squeeth in the pool
      const poolSqueethBalance = await wSqueeth.balanceOf(wSqueethPool.address)

      const maxWeth = poolSqueethBalance.mul(scaledStartingSqueethPrice1e18).mul(5).div(one)
            
      const exactOutputParam = {
        tokenIn: weth.address,
        tokenOut: wSqueeth.address,
        fee: 3000,
        recipient: owner.address,
        deadline: (await provider.getBlock(await provider.getBlockNumber())).timestamp + 86400,
        amountOut: ethers.utils.parseUnits("150000"),
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
      await controller.connect(liquidator).mintWPowerPerpAmount(0, mintAmount, 0, {value: collateralRequired})
    })

    it("should liquidate crab vault using a full dust (0 collateral >0 debt remain)", async () => {
      const vaultId = await crabStrategy.vaultId();
      const isVaultSafe = await controller.isVaultSafe((await crabStrategy.vaultId()))
      expect(isVaultSafe).to.be.false

      const newSqueethPrice = await oracle.getTwap(wSqueethPool.address, wSqueeth.address, weth.address, 600, false)
      
      const vaultBefore = await controller.vaults(vaultId)

      // state before liquidation
      const liquidatorSqueethBefore = await wSqueeth.balanceOf(liquidator.address)
      const liquidatorBalanceBefore = await provider.getBalance(liquidator.address)

      const wSqueethAmountToLiquidate = vaultBefore.shortAmount

      await controller.connect(liquidator).liquidate(vaultId, wSqueethAmountToLiquidate);
      
      const normFactor = await controller.normalizationFactor()
      const collateralToGet = newSqueethPrice.mul(wSqueethAmountToLiquidate).div(one).mul(11).div(10)

      const vaultAfter = await controller.vaults(vaultId)
      const liquidatorBalanceAfter = await provider.getBalance(liquidator.address)
      const liquidatorSqueethAfter = await wSqueeth.balanceOf(liquidator.address)
      
      // expect(collateralToGet.eq(liquidatorBalanceAfter.sub(liquidatorBalanceBefore))).to.be.true
      expect(vaultBefore.shortAmount.sub(vaultAfter.shortAmount).eq(liquidatorSqueethBefore.sub(liquidatorSqueethAfter))).to.be.true
      expect(vaultAfter.shortAmount.eq(BigNumber.from(0))).to.be.equal
      expect(vaultAfter.collateralAmount.gt(BigNumber.from(0))).to.be.equal
      
    })

    it("should revert if user flash deposits post liquidation due to AS, because of amount specified of 0", async () => {
        const vaultId = await crabStrategy.vaultId();
        const isVaultSafe = await controller.isVaultSafe((await crabStrategy.vaultId()))
        expect(isVaultSafe).to.be.true
  
        const vaultBefore = await controller.vaults(vaultId)
        const collateralBefore = vaultBefore.collateralAmount
        const debtBefore = vaultBefore.shortAmount
  
        const ethToDeposit = ethers.utils.parseUnits('20')
        const msgvalue = ethers.utils.parseUnits('15')  
        const [strategyOperatorBefore, strategyNftIdBefore, strategyCollateralAmountBefore, strategyDebtAmountBefore] = await crabStrategy.getVaultDetails()
      
        expect(strategyCollateralAmountBefore.eq(collateralBefore)).to.be.true
        expect(strategyDebtAmountBefore.eq(debtBefore)).to.be.true
  
        await expect(crabStrategy.connect(depositor2).flashDeposit(ethToDeposit, {value: msgvalue})).to.be.revertedWith("AS")
    })

    it("should let user deposit post liquidation, with only ETH, and mint no squeeth for them", async () => {
        const vaultId = await crabStrategy.vaultId();
        const isVaultSafe = await controller.isVaultSafe((await crabStrategy.vaultId()))
        expect(isVaultSafe).to.be.true
  
        const vaultBefore = await controller.vaults(vaultId)
        const collateralBefore = vaultBefore.collateralAmount
        const debtBefore = vaultBefore.shortAmount
        const msgvalue = ethers.utils.parseUnits('1')
        const totalSupplyBefore = (await crabStrategy.totalSupply())

        const expectedRatio = one.mul(msgvalue).div(collateralBefore.add(msgvalue))
        const expectedCrabMint = expectedRatio.mul(totalSupplyBefore).div(one.sub(expectedRatio))

        expect(totalSupplyBefore.gt(BigNumber.from(0))).to.be.true
        expect(collateralBefore.gt(BigNumber.from(0))).to.be.true
        expect(debtBefore.eq(BigNumber.from(0))).to.be.true

        const userEthBalanceBefore = await provider.getBalance(depositor2.address)
        const userCrabBalanceBefore = await crabStrategy.balanceOf(depositor2.address);
        const userSqueethBalanceBefore = await wSqueeth.balanceOf(depositor2.address)

        await crabStrategy.connect(depositor2).deposit({value: msgvalue})

        const userEthBalanceAfter = await provider.getBalance(depositor2.address)
        const userCrabBalanceAfter = await crabStrategy.balanceOf(depositor2.address);
        const userSqueethBalanceAfter = await wSqueeth.balanceOf(depositor2.address)
        const [strategyOperatorAfter, strategyNftIdAfter, strategyCollateralAmountAfter, strategyDebtAmountAfter] = await crabStrategy.getVaultDetails()
        const totalSupplyAfter = (await crabStrategy.totalSupply())

        // expect((userEthBalanceBefore.sub(userEthBalanceAfter)).eq(msgvalue)).to.be.true
        expect(userSqueethBalanceBefore.eq(userSqueethBalanceAfter)).to.be.true        
        expect(isSimilar((userCrabBalanceAfter.sub(userCrabBalanceBefore)).toString(),(expectedCrabMint).toString())).to.be.true
        expect(strategyDebtAmountAfter.eq(debtBefore)).to.be.true
        expect(strategyCollateralAmountAfter.eq(collateralBefore.add(msgvalue))).to.be.true
        expect(isSimilar((totalSupplyAfter.sub(totalSupplyBefore)).toString(),(expectedCrabMint).toString())).to.be.true  
      })

    it("depositor should revert trying to flashWithdraw with AS due to amount of wSqueeth to buy being 0", async () => {
      const wSqueethPrice = await oracle.getTwap(wSqueethPool.address, wSqueeth.address, weth.address, 1, false)

      const userCrabBalanceBefore = await crabStrategy.balanceOf(depositor.address);
      const crabTotalSupply = await crabStrategy.totalSupply()
      const [strategyOperatorBefore, strategyNftIdBefore, strategyCollateralAmountBefore, strategyDebtAmountBefore] = await crabStrategy.getVaultDetails()
      const crabRatio = wdiv(userCrabBalanceBefore, crabTotalSupply);
      const debtToRepay = wmul(crabRatio,strategyDebtAmountBefore);
      const ethCostOfDebtToRepay = wmul(debtToRepay,wSqueethPrice)
      const userCollateral = wmul(crabRatio, strategyCollateralAmountBefore)
      const ethToWithdraw = userCollateral.sub(ethCostOfDebtToRepay);
      const maxEthToPay = ethToWithdraw.mul(10).div(10)

      await expect( crabStrategy.connect(depositor).flashWithdraw(userCrabBalanceBefore, maxEthToPay)).to.be.revertedWith("AS")

    })

    it("depositor should be able to withdraw and get some ETH, without any wSqueeth", async () => {
      const vaultId = await crabStrategy.vaultId();
      const isVaultSafe = await controller.isVaultSafe((await crabStrategy.vaultId()))
      expect(isVaultSafe).to.be.true

      const userCrabBalanceBefore = await crabStrategy.balanceOf(depositor.address);
      const [strategyOperatorBefore, strategyNftIdBefore, strategyCollateralAmountBefore, strategyDebtAmountBefore] = await crabStrategy.getVaultDetails()
      const userEthBalanceBefore = await provider.getBalance(depositor.address)
      const userSqueethBalanceBefore = await wSqueeth.balanceOf(depositor.address)
      
      const vaultBefore = await controller.vaults(vaultId)
      const expectedWithdrawal = vaultBefore.collateralAmount.sub(ethers.utils.parseUnits("1"))
      const collateralBefore = vaultBefore.collateralAmount
      const debtBefore = vaultBefore.shortAmount
      const totalSupplyBefore = await crabStrategy.totalSupply()
      const expectedShareWithdrawal = collateralBefore.mul(userCrabBalanceBefore).div(totalSupplyBefore)

      expect(isSimilar(expectedWithdrawal.toString(), expectedShareWithdrawal.toString())).to.be.true

      await crabStrategy.connect(depositor).withdraw(userCrabBalanceBefore)

      const userEthBalanceAfter = await provider.getBalance(depositor.address)
      const userCrabBalanceAfter = await crabStrategy.balanceOf(depositor.address);
      const userSqueethBalanceAfter = await wSqueeth.balanceOf(depositor.address)
      const [strategyOperatorAfter, strategyNftIdAfter, strategyCollateralAmountAfter, strategyDebtAmountAfter] = await crabStrategy.getVaultDetails()

      const debtAfter = vaultBefore.shortAmount
      const totalSupplyAfter = await crabStrategy.totalSupply()

      // expect(isSimilar((userEthBalanceAfter.sub(userEthBalanceBefore)).toString(),(expectedShareWithdrawal).toString())).to.be.true
      expect(userCrabBalanceAfter.eq(BigNumber.from(0))).to.be.true
      expect(userCrabBalanceBefore.sub(userCrabBalanceAfter).eq(userCrabBalanceBefore)).to.be.true
      expect(userSqueethBalanceAfter.eq(userSqueethBalanceBefore)).to.be.true
      // expect(strategyCollateralAmountBefore.sub(strategyCollateralAmountAfter).eq(userEthBalanceAfter.sub(userEthBalanceBefore))).to.be.true
      expect(debtAfter.eq(debtBefore)).to.be.true
      expect(isSimilar((totalSupplyBefore.sub(totalSupplyAfter)).toString(),(userCrabBalanceBefore).toString())).to.be.true
    })
  })
})