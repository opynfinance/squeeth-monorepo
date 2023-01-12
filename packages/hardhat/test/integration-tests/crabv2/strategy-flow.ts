import { ethers } from "hardhat"
import { expect } from "chai";
import { Contract, BigNumber, providers } from "ethers";
import BigNumberJs from 'bignumber.js'

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { WETH9, MockErc20, Controller, Oracle, WPowerPerp, CrabStrategyV2, Timelock } from "../../../typechain";
import { deployUniswapV3, deploySqueethCoreContracts, deployWETHAndDai, addWethDaiLiquidity, addSqueethLiquidity, createUniPool } from '../../setup'
import { isSimilar, wmul, wdiv, one, oracleScaleFactor } from "../../utils"

BigNumberJs.set({ EXPONENTIAL_AT: 30 })

describe("Crab V2 integration test: flash deposit - deposit - withdraw", function () {
  const startingEthPrice = 3000
  const startingEthPrice1e18 = BigNumber.from(startingEthPrice).mul(one) // 3000 * 1e18
  const scaledStartingSqueethPrice1e18 = startingEthPrice1e18.div(oracleScaleFactor) // 0.3 * 1e18
  const scaledStartingSqueethPrice = startingEthPrice / oracleScaleFactor.toNumber() // 0.3


  const hedgeTimeThreshold = 86400  // 24h
  const hedgePriceThreshold = ethers.utils.parseUnits('0.01')
  const auctionTime = 3600
  const minPriceMultiplier = ethers.utils.parseUnits('0.95')
  const maxPriceMultiplier = ethers.utils.parseUnits('1.05')
  let poolFee: BigNumber
  let poolFeePool2: BigNumber

  let provider: providers.JsonRpcProvider;
  let owner: SignerWithAddress;
  let depositor: SignerWithAddress;
  let depositor2: SignerWithAddress;
  let crabMigration: SignerWithAddress; 
  let feeRecipient: SignerWithAddress;
  let dai: MockErc20
  let weth: WETH9
  let positionManager: Contract
  let uniswapFactory: Contract
  let oracle: Oracle
  let controller: Controller
  let wSqueethPool: Contract
  let wSqueethPool2: Contract
  let wSqueeth: WPowerPerp
  let crabStrategy: CrabStrategyV2
  let ethDaiPool: Contract
  let timelock: Timelock


  this.beforeAll("Deploy uniswap protocol & setup uniswap pool", async () => {
    const accounts = await ethers.getSigners();
    const [_owner, _depositor, _depositor2, _feeRecipient, _crabMigration] = accounts;
    owner = _owner;
    depositor = _depositor;
    depositor2 = _depositor2;
    crabMigration = _crabMigration;
    feeRecipient = _feeRecipient
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
    ethDaiPool = squeethDeployments.ethDaiPool

    wSqueethPool2 = await createUniPool(scaledStartingSqueethPrice, weth, wSqueeth, positionManager, uniswapFactory, 10000) as Contract
    await wSqueethPool2.increaseObservationCardinalityNext(500) 
  
    poolFee = await wSqueethPool.fee()
    poolFeePool2 = await wSqueethPool2.fee()

    await controller.connect(owner).setFeeRecipient(feeRecipient.address);
    await controller.connect(owner).setFeeRate(100)

    const TimelockContract = await ethers.getContractFactory("Timelock");
    timelock = (await TimelockContract.deploy(owner.address, 3 * 24 * 60 * 60)) as Timelock;

    const CrabStrategyContract = await ethers.getContractFactory("CrabStrategyV2");
    crabStrategy = (await CrabStrategyContract.deploy(controller.address, oracle.address, weth.address, uniswapFactory.address, wSqueethPool.address, timelock.address, crabMigration.address, hedgeTimeThreshold, hedgePriceThreshold)) as CrabStrategyV2;
  })

  this.beforeAll("Seed pool liquidity", async () => {
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
      controller,
      10000
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

  this.beforeAll("initialize contract", async () => { 
    const strategyCap = ethers.utils.parseUnits("20")

    const ethToDeposit = ethers.utils.parseUnits('20')

    const normFactor = await controller.normalizationFactor()
    const currentScaledEthPrice = (await oracle.getTwap(ethDaiPool.address, weth.address, dai.address, 300, false)).div(oracleScaleFactor)
    const feeRate = await controller.feeRate()
    const ethFeePerWSqueeth = currentScaledEthPrice.mul(normFactor).mul(feeRate).div(10000).div(one)
    const squeethDelta = scaledStartingSqueethPrice1e18.mul(2);
    const debtToMint = wdiv(ethToDeposit, (squeethDelta.add(ethFeePerWSqueeth)));
    const expectedEthDeposit = ethToDeposit.sub(debtToMint.mul(ethFeePerWSqueeth).div(one))

    await crabStrategy.connect(crabMigration).initialize(debtToMint, expectedEthDeposit, 0, 0, strategyCap, { value: ethToDeposit });
  })

  describe("deposit above strategy cap", async () => {
    it("should revert if depositing an amount that puts the strategy above the cap", async () => {
      const ethToDeposit = ethers.utils.parseUnits('20')
      const msgvalue = ethers.utils.parseUnits('10')

      await expect(
        crabStrategy.connect(depositor).flashDeposit(ethToDeposit, poolFee, { value: msgvalue })
      ).to.be.revertedWith("C16");
    })
  })

  describe("flash deposit - deposit - withdraw - flash withdraw", async () => {
    it("should let the owner set the cap", async () => {
      const strategyCap = ethers.utils.parseUnits("1000")
      await crabStrategy.connect(owner).setStrategyCap(strategyCap)
      const strategyCapInContract = await crabStrategy.strategyCap()
      expect(strategyCapInContract.eq(strategyCap)).to.be.true
    })

    it("should revert flash depositing if not enough ETH", async () => {
      const ethToDeposit = ethers.utils.parseUnits('20')
      const msgvalue = ethers.utils.parseUnits('10')

      await expect(
        crabStrategy.connect(depositor).flashDeposit(ethToDeposit, poolFee, { value: msgvalue })
      ).to.be.revertedWith("function call failed to execute");
    })

    it("should flash deposit correct amount and mint correct shares amount in 0.3% pool", async () => {
      const ethToDeposit = ethers.utils.parseUnits('20')
      const msgvalue = ethers.utils.parseUnits('10.1')
      const depositorSqueethBalanceBefore = await wSqueeth.balanceOf(depositor.address)

      await crabStrategy.connect(depositor).flashDeposit(ethToDeposit, poolFee,{ value: msgvalue })

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
      const debtAmount = strategyVault.shortAmount
      const depositorSqueethBalance = await wSqueeth.balanceOf(depositor.address)
      const strategyContractSqueeth = await wSqueeth.balanceOf(crabStrategy.address)
      const collateralAmount = await strategyVault.collateralAmount

      expect(isSimilar(totalSupply.toString(), (expectedEthDeposit.mul(2)).toString())).to.be.true
      expect(isSimilar(depositorCrab.toString(), (expectedEthDeposit).toString())).to.be.true
      expect(isSimilar(debtAmount.toString(), debtToMint.mul(2).toString())).to.be.true
      expect(depositorSqueethBalance.eq(depositorSqueethBalanceBefore)).to.be.true
      expect(strategyContractSqueeth.eq(0)).to.be.true
    })

    it("should deposit and mint correct LP and return the correct amount of wSqueeth debt per crab strategy token", async () => {
      const strategyVault = await controller.vaults(await crabStrategy.vaultId());
      const collateralBefore = strategyVault.collateralAmount
      const debtBefore = strategyVault.shortAmount
      const totalSupplyBefore = await crabStrategy.totalSupply()
      const depositorCrabBefore = (await crabStrategy.balanceOf(depositor.address))
      const depositorSqueethBalanceBefore = await wSqueeth.balanceOf(depositor.address)

      const ethToDeposit = BigNumber.from(20).mul(one)

      await crabStrategy.connect(depositor).deposit({ value: ethToDeposit });

      const normFactor = await controller.normalizationFactor()
      const currentScaledEthPrice = (await oracle.getTwap(ethDaiPool.address, weth.address, dai.address, 300, false)).div(oracleScaleFactor)
      const feeRate = await controller.feeRate()
      const ethFeePerWSqueeth = currentScaledEthPrice.mul(normFactor).mul(feeRate).div(10000).div(one)
      const debtToMint = ethToDeposit.mul(debtBefore).div(collateralBefore.add(debtBefore.mul(ethFeePerWSqueeth).div(one)))
      const expectedEthDeposit = ethToDeposit.sub(debtToMint.mul(ethFeePerWSqueeth).div(one))
      const depositorShare = one.mul(expectedEthDeposit).div(collateralBefore.add(expectedEthDeposit))
      const crabMintAmount = totalSupplyBefore.mul(depositorShare).div(one.sub(depositorShare))

      const expectedMintedWsqueeth = wmul(debtToMint, normFactor)
      const totalCrabAfter = (await crabStrategy.totalSupply())
      const depositorCrab = (await crabStrategy.balanceOf(depositor.address))
      const strategyVaultAfter = await controller.vaults(await crabStrategy.vaultId());
      const debtAmount = strategyVaultAfter.shortAmount
      const depositorSqueethBalance = await wSqueeth.balanceOf(depositor.address)
      const strategyContractSqueeth = await wSqueeth.balanceOf(crabStrategy.address)
      const depositorWSqueethDebt = await crabStrategy.getWsqueethFromCrabAmount(depositorCrab)

      expect(isSimilar(totalCrabAfter.sub(totalSupplyBefore).toString(), crabMintAmount.toString())).to.be.true
      expect(isSimilar((depositorCrab.sub(depositorCrabBefore)).toString(), (crabMintAmount).toString())).to.be.true
      expect(isSimilar(debtAmount.sub(debtBefore).toString(), (debtToMint).toString())).to.be.true
      expect(isSimilar(depositorSqueethBalance.sub(depositorSqueethBalanceBefore).toString(), expectedMintedWsqueeth.toString())).to.be.true
      expect(strategyContractSqueeth.eq(BigNumber.from(0))).to.be.true
      expect(depositorWSqueethDebt.eq(depositorSqueethBalance))
    })

    it("should flash deposit correct amount and mint correct shares amount in 1% pool", async () => {
      const strategyVault = await controller.vaults(await crabStrategy.vaultId());
      const ethToDeposit = ethers.utils.parseUnits('20')
      const msgvalue = ethers.utils.parseUnits('10.2')
      const depositorSqueethBalanceBefore = await wSqueeth.balanceOf(depositor2.address)
      const totalSupplyBefore = await crabStrategy.totalSupply()
      const depositorCrabBefore = (await crabStrategy.balanceOf(depositor2.address))
      const debtBefore = strategyVault.shortAmount
      const collateralBefore = strategyVault.collateralAmount

      await crabStrategy.connect(depositor2).flashDeposit(ethToDeposit, poolFeePool2,{ value: msgvalue })

      const normFactor = await controller.normalizationFactor()
      const currentScaledEthPrice = (await oracle.getTwap(ethDaiPool.address, weth.address, dai.address, 300, false)).div(oracleScaleFactor)
      const feeRate = await controller.feeRate()
      const ethFeePerWSqueeth = currentScaledEthPrice.mul(normFactor).mul(feeRate).div(10000).div(one)
      const debtToMint = ethToDeposit.mul(debtBefore).div(collateralBefore)
      const expectedEthDeposit = ethToDeposit.sub(debtToMint.mul(ethFeePerWSqueeth).div(one))
      const depositorShare = one.mul(ethToDeposit).div(collateralBefore.add(ethToDeposit))
      const crabMintAmount = totalSupplyBefore.mul(depositorShare).div(one.sub(depositorShare))

      const totalSupply = (await crabStrategy.totalSupply())
      const depositorCrab = (await crabStrategy.balanceOf(depositor2.address))
      const strategyVaultAfter = await controller.vaults(await crabStrategy.vaultId());
      const debtAmount = strategyVaultAfter.shortAmount
      const depositorSqueethBalance = await wSqueeth.balanceOf(depositor2.address)
      const strategyContractSqueeth = await wSqueeth.balanceOf(crabStrategy.address)
      const collateralAmount = await strategyVault.collateralAmount

      expect(isSimilar(totalSupply.sub(totalSupplyBefore).toString(), (ethToDeposit).toString(), 2)).to.be.true
      expect(isSimilar((depositorCrab.sub(depositorCrabBefore)).toString(), (crabMintAmount).toString(), 2)).to.be.true
      expect(isSimilar(debtAmount.sub(debtBefore).toString(), (debtToMint).toString(), 2)).to.be.true
      expect(depositorSqueethBalance.eq(depositorSqueethBalanceBefore)).to.be.true
      expect(strategyContractSqueeth.eq(0)).to.be.true
    })


    it("should withdraw correct amount of ETH", async () => {
      // some rounding
      const crabToBurn = (await crabStrategy.balanceOf(depositor.address)).div(2).mul(99).div(100)
      const wSqueethToBurn = await crabStrategy.getWsqueethFromCrabAmount(crabToBurn)
      const depositorWSqueethBalanceBefore = await wSqueeth.balanceOf(depositor.address)

      const strategyVault = await controller.vaults(await crabStrategy.vaultId());
      const strategyDebtBefore = strategyVault.shortAmount
      const strategyCollateralBefore = strategyVault.collateralAmount
      const totalCrabBefore = await crabStrategy.totalSupply()
      const depositorCrabBefore = (await crabStrategy.balanceOf(depositor.address))
      const depositorEthBalanceBefore = await provider.getBalance(depositor.address)


      const expectedCrabPercentage = wdiv(crabToBurn, totalCrabBefore)
      const expectedEthToWithdraw = wmul(strategyCollateralBefore, expectedCrabPercentage)

      await wSqueeth.connect(depositor).approve(crabStrategy.address, wSqueethToBurn)
      await crabStrategy.connect(depositor).withdraw(crabToBurn);

      const strategyVaultAfter = await controller.vaults(await crabStrategy.vaultId());
      const strategyCollateralAfter = strategyVaultAfter.collateralAmount
      const strategyDebtAfter = strategyVaultAfter.shortAmount
      const totalCrabAfter = await crabStrategy.totalSupply()
      const depositorCrabAfter = (await crabStrategy.balanceOf(depositor.address))
      const depositorWSqueethBalanceAfter = await wSqueeth.balanceOf(depositor.address)
      const depositorEthBalanceAfter = await provider.getBalance(depositor.address)

      expect(depositorCrabAfter.eq(depositorCrabBefore.sub(crabToBurn))).to.be.true
      expect(totalCrabAfter.eq(totalCrabBefore.sub(crabToBurn))).to.be.true
      expect(strategyCollateralAfter.eq(strategyCollateralBefore.sub(expectedEthToWithdraw))).to.be.true
      expect(strategyDebtAfter.eq(strategyDebtBefore.sub(wSqueethToBurn))).to.be.true
      expect(depositorWSqueethBalanceBefore.sub(depositorWSqueethBalanceAfter).eq(wSqueethToBurn)).to.be.true
      expect(isSimilar(depositorEthBalanceAfter.sub(depositorEthBalanceBefore).toString(), expectedEthToWithdraw.toString(), 3)).to.be.true // 0.002605896 diff
    })

    it("should revert if slippage is too high", async () => {
      const wSqueethPrice = await oracle.getTwap(wSqueethPool.address, wSqueeth.address, weth.address, 1, false)

      const userCrabBalanceBefore = await crabStrategy.balanceOf(depositor.address);
      const crabTotalSupply = await crabStrategy.totalSupply()
      const strategyVault = await controller.vaults(await crabStrategy.vaultId());
      const strategyDebtAmountBefore = strategyVault.shortAmount
      const strategyCollateralAmountBefore = strategyVault.collateralAmount

      const crabRatio = wdiv(userCrabBalanceBefore, crabTotalSupply);
      const debtToRepay = wmul(crabRatio, strategyDebtAmountBefore);
      const ethCostOfDebtToRepay = wmul(debtToRepay, wSqueethPrice)
      const userCollateral = wmul(crabRatio, strategyCollateralAmountBefore)
      const ethToWithdraw = userCollateral.sub(ethCostOfDebtToRepay);
      const maxEthToPay = ethToWithdraw.mul(9).div(10)

      await expect(
        crabStrategy.connect(depositor).flashWithdraw(userCrabBalanceBefore, maxEthToPay, poolFee)
      ).to.be.revertedWith("amount in greater than max");
    })

    it("should flash withdraw correct amount of ETH collateral in main pool (0.3%)", async () => {
      const wSqueethPrice = await oracle.getTwap(wSqueethPool.address, wSqueeth.address, weth.address, 1, false)

      const userCrabBalanceBefore = await crabStrategy.balanceOf(depositor.address);
      const crabTotalSupply = await crabStrategy.totalSupply()
      const strategyVault = await controller.vaults(await crabStrategy.vaultId());
      const strategyDebtAmountBefore = strategyVault.shortAmount
      const strategyCollateralAmountBefore = strategyVault.collateralAmount
      const userEthBalanceBefore = await provider.getBalance(depositor.address)
      const crabRatio = wdiv(userCrabBalanceBefore, crabTotalSupply);
      const debtToRepay = wmul(crabRatio, strategyDebtAmountBefore);
      const ethCostOfDebtToRepay = wmul(debtToRepay, wSqueethPrice)
      const userCollateral = wmul(crabRatio, strategyCollateralAmountBefore)
      const ethToWithdraw = userCollateral.sub(ethCostOfDebtToRepay);
      const maxEthToPay = ethCostOfDebtToRepay.mul(11).div(10)

      await crabStrategy.connect(depositor).flashWithdraw(userCrabBalanceBefore, maxEthToPay, poolFee)

      const userEthBalanceAfter = await provider.getBalance(depositor.address)
      const userCrabBalanceAfter = await crabStrategy.balanceOf(depositor.address);

      const vaultId = await crabStrategy.vaultId();
      const isVaultSafe = await controller.isVaultSafe((await crabStrategy.vaultId()))
      expect(isVaultSafe).to.be.true

      const vaultBefore = await controller.vaults(vaultId)
      const collateralAfter = vaultBefore.collateralAmount
      const debtAfter = vaultBefore.shortAmount

      expect(isSimilar(userEthBalanceAfter.sub(userEthBalanceBefore).toString(), ethToWithdraw.toString(), 2)).to.be.true
      expect(userCrabBalanceAfter.eq(BigNumber.from(0))).to.be.true
      expect(userCrabBalanceBefore.sub(userCrabBalanceAfter).eq(userCrabBalanceBefore)).to.be.true
      expect(collateralAfter.eq(strategyCollateralAmountBefore.sub(userCollateral))).to.be.true
      // TODO: fix this
      // expect(isSimilar(strategyDebtAmountBefore.sub(debtAfter).toString(), debtToRepay.toString(), 20)).to.be.true
    })
    it("should flash withdraw correct amount of ETH collateral in secondary pool (1%)", async () => {
      const wSqueethPrice = await oracle.getTwap(wSqueethPool.address, wSqueeth.address, weth.address, 1, false)

      const userCrabBalanceBefore = await crabStrategy.balanceOf(depositor2.address);
      const crabTotalSupply = await crabStrategy.totalSupply()
      const strategyVault = await controller.vaults(await crabStrategy.vaultId());
      const strategyDebtAmountBefore = strategyVault.shortAmount
      const strategyCollateralAmountBefore = strategyVault.collateralAmount
      const userEthBalanceBefore = await provider.getBalance(depositor2.address)
      const crabRatio = wdiv(userCrabBalanceBefore, crabTotalSupply);
      const debtToRepay = wmul(crabRatio, strategyDebtAmountBefore);
      const ethCostOfDebtToRepay = wmul(debtToRepay, wSqueethPrice.mul(101).div(100))
      const userCollateral = wmul(crabRatio, strategyCollateralAmountBefore)
      const ethToWithdraw = userCollateral.sub(ethCostOfDebtToRepay);
      const maxEthToPay = ethCostOfDebtToRepay.mul(11).div(10)

      await crabStrategy.connect(depositor2).flashWithdraw(userCrabBalanceBefore, maxEthToPay, poolFeePool2)

      const userEthBalanceAfter = await provider.getBalance(depositor2.address)
      const userCrabBalanceAfter = await crabStrategy.balanceOf(depositor2.address);

      const vaultId = await crabStrategy.vaultId();
      const isVaultSafe = await controller.isVaultSafe((await crabStrategy.vaultId()))
      expect(isVaultSafe).to.be.true

      const vaultBefore = await controller.vaults(vaultId)
      const collateralAfter = vaultBefore.collateralAmount
      const debtAfter = vaultBefore.shortAmount

      expect(isSimilar(userEthBalanceAfter.sub(userEthBalanceBefore).toString(), ethToWithdraw.toString(), 2)).to.be.true
      expect(userCrabBalanceAfter.eq(BigNumber.from(0))).to.be.true
      expect(userCrabBalanceBefore.sub(userCrabBalanceAfter).eq(userCrabBalanceBefore)).to.be.true
      expect(collateralAfter.eq(strategyCollateralAmountBefore.sub(userCollateral))).to.be.true
      // TODO: fix this
      // expect(isSimilar(strategyDebtAmountBefore.sub(debtAfter).toString(), debtToRepay.toString(), 20)).to.be.true
    })
  })
})