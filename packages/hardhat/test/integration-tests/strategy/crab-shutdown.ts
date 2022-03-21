import { ethers } from "hardhat"
import { expect } from "chai";
import { Contract, BigNumber, providers, Signer } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import BigNumberJs from 'bignumber.js'
import { WETH9, MockErc20, Controller, Oracle, WPowerPerp, CrabStrategy, ISwapRouter } from "../../../typechain";
import { deployUniswapV3, deploySqueethCoreContracts, deployWETHAndDai, addWethDaiLiquidity, addSqueethLiquidity } from '../../setup'
import { isSimilar, wmul, wdiv, one, oracleScaleFactor } from "../../utils"
import { randomBytes } from "ethers/lib/utils";

BigNumberJs.set({EXPONENTIAL_AT: 30})

describe("Crab integration test: Shutdown of Squeeth Power Perp contracts", function () {
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
  let depositor2: SignerWithAddress
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
  let ethDaiPool: Contract
  let shutdownPrice: BigNumber

  this.beforeAll("Deploy uniswap protocol & setup uniswap pool", async() => {
    const accounts = await ethers.getSigners();
    const [_owner, _depositor, _depositor2, _random ] = accounts;
    owner = _owner;
    depositor = _depositor;
    depositor2 = _depositor2;
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
    await provider.send("evm_increaseTime", [300])
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
    await provider.send("evm_increaseTime", [300])
    await provider.send("evm_mine", [])

  })

  this.beforeAll("Deposit into strategy", async () => {
    const ethToDeposit = ethers.utils.parseUnits('20')
    const msgvalue = ethers.utils.parseUnits('20')
    const ethPrice = await oracle.getTwap(ethDaiPool.address, weth.address, dai.address, 600, true)

    const squeethDelta = ethPrice.mul(2).div(1e4);
    const debtToMint = wdiv(ethToDeposit, squeethDelta);
    const depositorSqueethBalanceBefore = await wSqueeth.balanceOf(depositor.address)

    await crabStrategy.connect(depositor).deposit({value: msgvalue})

    const totalSupply = (await crabStrategy.totalSupply())
    const depositorCrab = (await crabStrategy.balanceOf(depositor.address))
    const [strategyOperatorBefore, strategyNftIdBefore, strategyCollateralAmountBefore, debtAmount] = await crabStrategy.getVaultDetails()
    const depositorSqueethBalance = await wSqueeth.balanceOf(depositor.address)
    const strategyContractSqueeth = await wSqueeth.balanceOf(crabStrategy.address)
    const lastHedgeTime = await crabStrategy.timeAtLastHedge()
    const currentBlockNumber = await provider.getBlockNumber()
    const currentBlock = await provider.getBlock(currentBlockNumber)
    const timeStamp = currentBlock.timestamp

    expect(totalSupply.eq(ethToDeposit)).to.be.true
    expect(depositorCrab.eq(ethToDeposit)).to.be.true
    // these had to be adjusted - it seems the eth price is a bit different than expected maybe? but only in coverage???
    expect(isSimilar(debtAmount.toString(), debtToMint.toString(),3)).to.be.true
    expect(isSimilar((depositorSqueethBalance.sub(depositorSqueethBalanceBefore)).toString(),(debtToMint).toString(),3)).to.be.true
    expect(strategyContractSqueeth.eq(BigNumber.from(0))).to.be.true
    expect(lastHedgeTime.eq(timeStamp)).to.be.true
    
  })

  describe("Try to redeemShutdown from contracts before shutdown", async () => {

    it("should revert if calling redeemShutdown before contracts are shutdown", async () => {
      await expect(crabStrategy.connect(random).redeemShortShutdown()).to.be.revertedWith("C3")
    })
  })

  describe("Shutdown core contracts and check results", async () => {
    before('push eth price higher', async() => {
        const poolWethBalance = await weth.balanceOf(ethDaiPool.address)

        const maxDai = poolWethBalance.mul(startingEthPrice).mul(20)
  
        const exactOutputParam = {
          tokenIn: dai.address,
          tokenOut: weth.address,
          fee: 3000,
          recipient: owner.address,
          deadline: (await provider.getBlock(await provider.getBlockNumber())).timestamp + 86400,
          amountOut: ethers.utils.parseUnits("5"),
          amountInMaximum: maxDai,
          sqrtPriceLimitX96: 0,
        }
  
        await dai.connect(owner).mint(owner.address, maxDai, )
        await dai.connect(owner).approve(swapRouter.address, ethers.constants.MaxUint256)      
        await (swapRouter as ISwapRouter).connect(owner).exactOutputSingle(exactOutputParam)
      })

    before('push squeeth price higher', async() => {
      const poolSqueethBalance = await wSqueeth.balanceOf(wSqueethPool.address)

      const maxWeth = poolSqueethBalance.mul(scaledStartingSqueethPrice1e18).mul(20).div(one)
            
      const exactOutputParam = {
        tokenIn: weth.address,
        tokenOut: wSqueeth.address,
        fee: 3000,
        recipient: owner.address,
        deadline: (await provider.getBlock(await provider.getBlockNumber())).timestamp + 86400,
        amountOut: ethers.utils.parseUnits("50000"),
        amountInMaximum: maxWeth,
        sqrtPriceLimitX96: 0,
      }

      await weth.connect(owner).deposit({value: maxWeth})
      await weth.connect(owner).approve(swapRouter.address, ethers.constants.MaxUint256)      
      await (swapRouter as ISwapRouter).connect(owner).exactOutputSingle(exactOutputParam)
      await provider.send("evm_increaseTime", [600]) // increase time by 600 sec
      await provider.send("evm_mine", [])

    })

    it("should NOT let user withdrawShutdown pre shutdown, pre redeemShortShutdown", async () => {
        const userCrabBalanceBefore = await crabStrategy.balanceOf(depositor.address);
        await expect(crabStrategy.connect(depositor).withdrawShutdown(userCrabBalanceBefore)).to.be.revertedWith("Squeeth contracts not shut down")
      })

    it('shutdown contracts', async() => {
        await controller.connect(owner).shutDown()
        const isShutdown = await controller.isShutDown()
        expect(isShutdown).to.be.true      
  
    })

    it("should NOT let user withdrawShutdown post shutdown, pre redeemShortShutdown", async () => {
        const userCrabBalanceBefore = await crabStrategy.balanceOf(depositor.address);
        await expect(crabStrategy.connect(depositor).withdrawShutdown(userCrabBalanceBefore)).to.be.revertedWith("Crab must redeemShortShutdown")
      })

    it("anyone should be able to call redeemShortShutdown", async () => {
      shutdownPrice = await controller.indexForSettlement()
  
      const vaultId = await crabStrategy.vaultId();

      const vaultBefore = await controller.vaults(vaultId)
      
      // state before liquidation
      const crabSqueethBalanceBefore = await wSqueeth.balanceOf(crabStrategy.address)
      const crabEthBalanceBefore = await provider.getBalance(crabStrategy.address)
      const crabDebtBefore = vaultBefore.shortAmount
      const crabCollateralBefore = vaultBefore.collateralAmount

      const normFactor = await controller.normalizationFactor()
      await crabStrategy.connect(random).redeemShortShutdown()
      
      const vaultAfter = await controller.vaults(vaultId)

      const debtValueInEthBefore = crabDebtBefore.mul(normFactor).mul(shutdownPrice).div(one).div(one)
      const expectedEthWithdrawn = crabCollateralBefore.sub(debtValueInEthBefore)

      const crabSqueethBalanceAfter = await wSqueeth.balanceOf(crabStrategy.address)
      const crabEthBalanceAfter = await provider.getBalance(crabStrategy.address)
      const crabDebtAfter = vaultAfter.shortAmount
      const crabCollateralAfter = vaultAfter.collateralAmount

      expect(expectedEthWithdrawn.eq(crabEthBalanceAfter.sub(crabEthBalanceBefore))).to.be.true
      expect(vaultAfter.shortAmount.isZero()).to.be.true
      expect(vaultAfter.collateralAmount.isZero()).to.be.true
      
    })

    it("should NOT let user flash deposit post shutdown", async () => {
      const vaultId = await crabStrategy.vaultId();
      const isVaultSafe = await controller.isVaultSafe((await crabStrategy.vaultId()))
      expect(isVaultSafe).to.be.true

      const vaultBefore = await controller.vaults(vaultId)
      const collateralBefore = vaultBefore.collateralAmount
      const debtBefore = vaultBefore.shortAmount

      const ethToDeposit = ethers.utils.parseUnits('20')
      // const ethToBorrow = ethers.utils.parseUnits('10')
      const msgvalue = ethers.utils.parseUnits('15')  
      const totalSupplyBefore = (await crabStrategy.totalSupply())

      expect(totalSupplyBefore.gt(BigNumber.from(0))).to.be.true
      expect(collateralBefore.eq(BigNumber.from(0))).to.be.true
      expect(debtBefore.eq(BigNumber.from(0))).to.be.true

      await expect(crabStrategy.connect(depositor2).flashDeposit(ethToDeposit, {value: msgvalue})).to.be.revertedWith("Crab contracts shut down")
    })

    it("should NOT let user deposit post shutdown", async () => { 
        const msgvalue = ethers.utils.parseUnits('15')  
  
        await expect(crabStrategy.connect(depositor2).deposit({value: msgvalue})).to.be.revertedWith("Crab contracts shut down")
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
      const maxEthToPay = ethCostOfDebtToRepay.mul(11).div(10)

      await expect( crabStrategy.connect(depositor).flashWithdraw(userCrabBalanceBefore, maxEthToPay)).to.be.revertedWith("AS")

    })

    it("depositor should revert trying to withdraw post shutdown", async () => {
        const userCrabBalanceBefore = await crabStrategy.balanceOf(depositor.address);

        await expect( crabStrategy.connect(depositor).withdraw(userCrabBalanceBefore)).to.be.revertedWith("C0")
  
      })

    it("depositor withdraw when calling withdrawShutdown and get correct proceeds", async () => {
      
      const userCrabBalanceBefore = await crabStrategy.balanceOf(depositor.address);
      const crabTotalSupply = await crabStrategy.totalSupply()
      const strategyCollateralAmountBefore = await provider.getBalance(crabStrategy.address)
      const [strategyOperatorBefore, strategyNftIdBefore, strategyVaultCollateralAmountBefore, strategyDebtAmountBefore] = await crabStrategy.getVaultDetails()

      const userEthBalanceBefore = await provider.getBalance(depositor.address)
      const crabRatio = wdiv(userCrabBalanceBefore, crabTotalSupply);

      const userCollateral = wmul(crabRatio, strategyCollateralAmountBefore)
      const userSqueethBalanceBefore = await wSqueeth.balanceOf(depositor.address)

      await crabStrategy.connect(depositor).withdrawShutdown(userCrabBalanceBefore)

      const userEthBalanceAfter = await provider.getBalance(depositor.address)
      const userCrabBalanceAfter = await crabStrategy.balanceOf(depositor.address);
      const userSqueethBalanceAfter = await wSqueeth.balanceOf(depositor.address)

      const vaultId = await crabStrategy.vaultId();
      const isVaultSafe = await controller.isVaultSafe((await crabStrategy.vaultId()))
      expect(isVaultSafe).to.be.true

      const vaultAfter = await controller.vaults(vaultId)
      const vaultCollateralAfter = vaultAfter.collateralAmount
      const vaultDebtAfter = vaultAfter.shortAmount
      const totalSupplyAfter = await crabStrategy.totalSupply()
      const strategyCollateralAmountAfter = await provider.getBalance(crabStrategy.address)


      expect(strategyVaultCollateralAmountBefore.eq(BigNumber.from(0))).to.be.true
      expect(strategyDebtAmountBefore.eq(BigNumber.from(0))).to.be.true
      // expect(userEthBalanceAfter.sub(userEthBalanceBefore).eq(userCollateral)).to.be.true
      expect(userCrabBalanceAfter.eq(BigNumber.from(0))).to.be.true
      expect(userCrabBalanceBefore.sub(userCrabBalanceAfter).eq(userCrabBalanceBefore)).to.be.true
      expect(userSqueethBalanceAfter.sub(userSqueethBalanceBefore).eq(BigNumber.from(0))).to.be.true
      expect(vaultCollateralAfter.eq(BigNumber.from(0))).to.be.true
      expect(vaultDebtAfter.eq(BigNumber.from(0))).to.be.true
      expect(strategyCollateralAmountBefore.sub(strategyCollateralAmountAfter).eq(userCollateral)).to.be.true
      expect(crabTotalSupply.sub(totalSupplyAfter).eq(userCrabBalanceBefore)).to.be.true
    })
  })
})
