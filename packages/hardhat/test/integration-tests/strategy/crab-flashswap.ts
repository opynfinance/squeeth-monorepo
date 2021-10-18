import { ethers } from "hardhat"
import { expect } from "chai";
import { Contract, BigNumber, providers } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers";
import { WETH9, MockErc20, Controller, Oracle, WSqueeth, VaultNFTManager, CrabStrategy } from "../../../typechain";
import { deployUniswapV3, deploySqueethCoreContracts, deployWETHAndDai, addWethDaiLiquidity, addSqueethLiquidity } from '../../setup'
import { MockController, MockVaultNFTManager, MockUniswapV3Pool, MockOracle, MockWSqueeth } from "../../../typechain";
import { isSimilar, wmul, wdiv } from "../../utils"

describe("Crab flashswap integration test", function () {
  const startingPrice = 1

  let provider: providers.JsonRpcProvider;
  let owner: SignerWithAddress;
  let depositor: SignerWithAddress;
  let dai: MockErc20
  let weth: WETH9
  let positionManager: Contract
  let uniswapFactory: Contract
  let swapRouter: Contract
  let oracle: Oracle
  let controller: Controller
  let wSqueethPool: Contract
  let ethDaiPool: Contract
  let wSqueeth: WSqueeth
  let vaultNft: VaultNFTManager
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
    wSqueeth = squeethDeployments.squeeth
    oracle = squeethDeployments.oracle
    vaultNft = squeethDeployments.vaultNft
    wSqueethPool = squeethDeployments.wsqueethEthPool
    ethDaiPool = squeethDeployments.ethDaiPool

    const CrabStrategyContract = await ethers.getContractFactory("CrabStrategy");
    crabStrategy = (await CrabStrategyContract.deploy(controller.address, oracle.address, weth.address, uniswapFactory.address, wSqueethPool.address, "Opyn Crab Strategy", "Crab")) as CrabStrategy;
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

  describe("Flash withdraw", async () => {
    it("should revert if amount IN is greater than max ETH to pay", async () => {
      const userCrabBalanceBefore = await crabStrategy.balanceOf(depositor.address);
      const crabTotalSupply = await crabStrategy.totalSupply()
      const strategyCollateralAmount = await crabStrategy.getStrategyCollateral()
      const crabRatio = wdiv(userCrabBalanceBefore, crabTotalSupply);
      const ethToWithdraw = wmul(crabRatio, strategyCollateralAmount);
      const maxEthToPay = ethToWithdraw.div(BigNumber.from(2))

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