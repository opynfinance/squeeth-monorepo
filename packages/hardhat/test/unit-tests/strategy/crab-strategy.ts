import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers";
import { ethers } from "hardhat"
import { expect } from "chai";
import { BigNumber, providers } from "ethers";
import { MockController, WETH9, MockVaultNFTManager, MockUniswapV3Pool, MockOracle, MockWSqueeth, CrabStrategy } from "../../../typechain";
import { isSimilar, wmul, wdiv } from "../../utils"

describe("Crab Strategy", function () {
  let provider: providers.JsonRpcProvider;
  let owner: SignerWithAddress;
  let random: SignerWithAddress;
  let depositor: SignerWithAddress;
  let depositor2: SignerWithAddress;
  let squeeth: MockWSqueeth;
  let weth: WETH9;
  let wSqueethEthPool: MockUniswapV3Pool;
  let shortNFT: MockVaultNFTManager;
  let controller: MockController;
  let oracle: MockOracle;
  let crabStrategy: CrabStrategy;

  this.beforeAll("Prepare accounts", async() => {
    const accounts = await ethers.getSigners();
    const [_owner, _depositor, _random, _depositor2] = accounts;
    depositor = _depositor
    depositor2 = _depositor2
    random = _random
    owner = _owner
    provider = ethers.provider
  })

  this.beforeAll("Setup environment", async () => {
    const WETH9Contract = await ethers.getContractFactory("WETH9");
    weth = (await WETH9Contract.deploy()) as WETH9;

    const MockSQUContract = await ethers.getContractFactory("MockWSqueeth");
    squeeth = (await MockSQUContract.deploy()) as MockWSqueeth;

    const MockUniswapV3PoolContract = await ethers.getContractFactory("MockUniswapV3Pool");
    wSqueethEthPool = (await MockUniswapV3PoolContract.deploy()) as MockUniswapV3Pool;

    const MockOracle = await ethers.getContractFactory("MockOracle");
    oracle = (await MockOracle.deploy()) as MockOracle;

    const NFTContract = await ethers.getContractFactory("MockVaultNFTManager");
    shortNFT = (await NFTContract.deploy()) as MockVaultNFTManager;

    const ControllerContract = await ethers.getContractFactory("MockController");
    controller = (await ControllerContract.deploy()) as MockController;

    await controller.connect(owner).init(shortNFT.address, squeeth.address);
  })

  describe("Deployment", async () => {
    it("Deployment", async function () {
      const CrabStrategyContract = await ethers.getContractFactory("CrabStrategy");
      crabStrategy = (await CrabStrategyContract.deploy(controller.address, oracle.address, weth.address, wSqueethEthPool.address, "Opyn Crab Strategy", "OCS")) as CrabStrategy;
    });
  });

  describe("Crab strategy vault", async () => {
    it("Check crab details",  async () => {
      const name = await crabStrategy.name()
      const symbol = await crabStrategy.symbol()

      expect(name).to.be.eq("Opyn Crab Strategy")
      expect(symbol).to.be.eq("OCS")
    })
    it("Check crab strategy opened vault", async () => {
      const openedVaultId = await crabStrategy.getStrategyVaultId()

      expect(openedVaultId).to.be.eq(BigNumber.from(1))
    });
  });

  describe("Deposit into strategy", async () => {
    const wSqueethEthPrice = BigNumber.from(100).mul(BigNumber.from(10).pow(18))

    before(async () => {
      // set ETH:DAI price
      await oracle.connect(owner).setPrice(wSqueethEthPool.address, wSqueethEthPrice)
    })

    it("Should deposit and mint correct LP when initial debt = 0", async () => {
      const normFactor = BigNumber.from(1)
      const ethToDeposit = BigNumber.from(60).mul(BigNumber.from(10).pow(18))
      const squeethDelta = wSqueethEthPrice.mul(2);
      const debtToMint = ethToDeposit.mul(BigNumber.from(10).pow(18)).div(squeethDelta);
      const expectedMintedWsqueeth = debtToMint.mul(normFactor)

      await crabStrategy.connect(depositor).deposit({value: ethToDeposit});

      const totalSupply = (await crabStrategy.totalSupply())
      const depositorCrab = (await crabStrategy.balanceOf(depositor.address))
      const debtAmount = (await crabStrategy.getStrategyDebt())
      const depositorSqueethBalance = await squeeth.balanceOf(depositor.address)
      const strategyContractSqueeth = await squeeth.balanceOf(crabStrategy.address)
  
      expect(totalSupply.eq(ethToDeposit)).to.be.true
      expect(depositorCrab.eq(ethToDeposit)).to.be.true
      expect(debtAmount.eq(debtToMint)).to.be.true
      expect(depositorSqueethBalance.eq(expectedMintedWsqueeth)).to.be.true
      expect(strategyContractSqueeth.eq(BigNumber.from(0))).to.be.true
    })

    it("Should deposit and mint correct LP when initial debt != 0", async () => {
      const normFactor = BigNumber.from(1)
      const strategyCollateralBefore = await crabStrategy.getStrategyCollateral()
      const strategyDebtBefore = await crabStrategy.getStrategyDebt()
      const totalCrabBefore = await crabStrategy.totalSupply()

      const ethToDeposit = BigNumber.from(20).mul(BigNumber.from(10).pow(18))
      const depositorShare = wdiv(ethToDeposit, (strategyCollateralBefore.add(ethToDeposit)))
      const expectedDepositorCrab = wdiv(wmul(totalCrabBefore, depositorShare), (BigNumber.from(10).pow(18).sub(depositorShare)))
      
      const debtToMint = ethToDeposit.mul(strategyDebtBefore).div(strategyCollateralBefore);
      const expectedMintedWsqueeth = debtToMint.mul(normFactor)

      await crabStrategy.connect(depositor2).deposit({value: ethToDeposit});

      const totalCrabAfter = (await crabStrategy.totalSupply())
      const depositorCrab = (await crabStrategy.balanceOf(depositor2.address))
      const debtAmount = (await crabStrategy.getStrategyDebt())
      const depositorSqueethBalance = await squeeth.balanceOf(depositor2.address)
      const strategyContractSqueeth = await squeeth.balanceOf(crabStrategy.address)

      expect(totalCrabAfter.eq(totalCrabBefore.add(expectedDepositorCrab))).to.be.true
      expect(depositorCrab.eq(expectedDepositorCrab)).to.be.true
      expect(debtAmount.eq(strategyDebtBefore.add(debtToMint))).to.be.true
      expect(depositorSqueethBalance.eq(expectedMintedWsqueeth)).to.be.true
      expect(strategyContractSqueeth.eq(BigNumber.from(0))).to.be.true
    })

    it("Should deposit and mint correct LP when initial debt != 0, and keep minted wSqueeth in contract when flashswap = true", async () => {
      const normFactor = BigNumber.from(1)
      const strategyCollateralBefore = await crabStrategy.getStrategyCollateral()
      const strategyDebtBefore = await crabStrategy.getStrategyDebt()
      const totalCrabBefore = await crabStrategy.totalSupply()
      const depositorCrabBefore = (await crabStrategy.balanceOf(depositor2.address))
      const depositorSqueethBalanceBefore = await squeeth.balanceOf(depositor2.address)

      const ethToDeposit = BigNumber.from(20).mul(BigNumber.from(10).pow(18))
      const depositorShare = wdiv(ethToDeposit, (strategyCollateralBefore.add(ethToDeposit)))
      const expectedDepositorCrab = wdiv(wmul(totalCrabBefore, depositorShare), (BigNumber.from(10).pow(18).sub(depositorShare)))
      
      const debtToMint = ethToDeposit.mul(strategyDebtBefore).div(strategyCollateralBefore);
      const expectedMintedWsqueeth = debtToMint.mul(normFactor)

      await crabStrategy.connect(depositor2).flashDeposit({value: ethToDeposit});

      const totalCrabAfter = (await crabStrategy.totalSupply())
      const depositorCrab = (await crabStrategy.balanceOf(depositor2.address))
      const debtAmount = (await crabStrategy.getStrategyDebt())
      const depositorSqueethBalance = await squeeth.balanceOf(depositor2.address)
      const strategyContractSqueeth = await squeeth.balanceOf(crabStrategy.address)

      expect(totalCrabAfter.eq(totalCrabBefore.add(expectedDepositorCrab))).to.be.true
      expect(depositorCrab.sub(depositorCrabBefore).eq(expectedDepositorCrab)).to.be.true
      expect(debtAmount.eq(strategyDebtBefore.add(debtToMint))).to.be.true
      expect(depositorSqueethBalance.eq(depositorSqueethBalanceBefore)).to.be.true
      expect(strategyContractSqueeth.eq(expectedMintedWsqueeth)).to.be.true
    })
  })

  describe("Withdraw from strategy", async () => {
    it("should revert withdrawing with unequal share/wSqueeth ratio", async () => {
      const depositorSqueethBalanceBefore = await squeeth.balanceOf(depositor.address)
      const depositorCrabBefore = (await crabStrategy.balanceOf(depositor.address))
      const wSqueethAmount = depositorSqueethBalanceBefore.div(2)

      await squeeth.connect(depositor).approve(crabStrategy.address, depositorCrabBefore)

      await expect(
        crabStrategy.connect(depositor).withdraw(depositorCrabBefore, wSqueethAmount)
      ).to.be.revertedWith("invalid ratio");
    })

    it("should withdraw correct amount", async () => {
      const strategyCollateralBefore = await crabStrategy.getStrategyCollateral()
      const strategyDebtBefore = await crabStrategy.getStrategyDebt()
      const totalCrabBefore = await crabStrategy.totalSupply()
      const depositorCrabBefore = (await crabStrategy.balanceOf(depositor.address))
      const depositorSqueethBalanceBefore = await squeeth.balanceOf(depositor.address)
      const depositorEthBalanceBefore = await provider.getBalance(depositor.address)

      const expectedCrabPercentage = wdiv(depositorCrabBefore, totalCrabBefore)
      const expectedEthToWithdraw = wmul(strategyCollateralBefore, expectedCrabPercentage)

      await squeeth.connect(depositor).approve(crabStrategy.address, depositorCrabBefore)
      await crabStrategy.connect(depositor).withdraw(depositorCrabBefore, depositorSqueethBalanceBefore);  

      const strategyCollateralAfter = await crabStrategy.getStrategyCollateral()
      const strategyDebtAfter = await crabStrategy.getStrategyDebt()
      const totalCrabAfter = await crabStrategy.totalSupply()
      const depositorCrabAfter = (await crabStrategy.balanceOf(depositor.address))
      const depositorSqueethBalanceAfter = await squeeth.balanceOf(depositor.address)
      const depositorEthBalanceAfter = await provider.getBalance(depositor.address)

      expect(depositorSqueethBalanceAfter.eq(BigNumber.from(0))).to.be.true
      expect(depositorCrabAfter.eq(BigNumber.from(0))).to.be.true
      expect(totalCrabAfter.eq(totalCrabBefore.sub(depositorCrabBefore))).to.be.true
      expect(strategyCollateralAfter.eq(strategyCollateralBefore.sub(expectedEthToWithdraw))).to.be.true
      expect(strategyDebtAfter.eq(strategyDebtBefore.sub(depositorSqueethBalanceBefore))).to.be.true
      expect(isSimilar(depositorEthBalanceAfter.sub(depositorEthBalanceBefore).toString(), expectedEthToWithdraw.toString())).to.be.true
    })
  })  
})
