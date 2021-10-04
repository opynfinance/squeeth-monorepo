import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers";
import { ethers } from "hardhat"
import { expect } from "chai";
import { BigNumber, providers } from "ethers";
import { MockController, MockErc20, MockVaultNFTManager, MockUniswapV3Pool, MockOracle, MockWSqueeth, CrabStrategy } from "../../../typechain";

describe("Crab Strategy", function () {
  let provider: providers.JsonRpcProvider;
  let owner: SignerWithAddress;
  let random: SignerWithAddress;
  let depositor: SignerWithAddress;
  let depositor2: SignerWithAddress;
  let squeeth: MockWSqueeth;
  let weth: MockErc20;
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
    const MockErc20Contract = await ethers.getContractFactory("MockErc20");
    weth = (await MockErc20Contract.deploy("WETH", "WETH")) as MockErc20;

    const MockSQUContract = await ethers.getContractFactory("MockWSqueeth");
    squeeth = (await MockSQUContract.deploy()) as MockWSqueeth;

    const MockUniswapV3PoolContract = await ethers.getContractFactory("MockUniswapV3Pool");
    wSqueethEthPool = (await MockUniswapV3PoolContract.deploy()) as MockUniswapV3Pool;

    const MockStrategyUniOracleContract = await ethers.getContractFactory("MockOracle");
    oracle = (await MockStrategyUniOracleContract.deploy()) as MockOracle;

    const NFTContract = await ethers.getContractFactory("MockVaultNFTManager");
    shortNFT = (await NFTContract.deploy()) as MockVaultNFTManager;

    const ControllerContract = await ethers.getContractFactory("MockController");
    controller = (await ControllerContract.deploy()) as MockController;

    await controller.connect(owner).init(shortNFT.address, squeeth.address);

    // FED printing money
    const wethToMint = BigNumber.from(1000).mul(BigNumber.from(10).pow(18))
    await weth.connect(owner).mint(depositor.address, wethToMint)
    await weth.connect(owner).mint(depositor2.address, wethToMint)
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
      const wethToDeposit = BigNumber.from(100).mul(BigNumber.from(10).pow(18))
      const squeethDelta = wSqueethEthPrice.mul(2);
      const debtToMint = wethToDeposit.mul(BigNumber.from(10).pow(18)).div(squeethDelta);
      const expectedMintedWsqueeth = debtToMint.mul(normFactor)

      await weth.connect(depositor).approve(crabStrategy.address, wethToDeposit);
      await crabStrategy.connect(depositor).deposit(wethToDeposit);

      const totalSupply = (await crabStrategy.totalSupply())
      const depositorLp = (await crabStrategy.balanceOf(depositor.address))
      const debtAmount = (await crabStrategy.getStrategyDebt())
      const depositorSqueethBalance = await squeeth.balanceOf(depositor.address)
      const strategyContractSqueeth = await squeeth.balanceOf(crabStrategy.address)

      expect(totalSupply.eq(wethToDeposit)).to.be.true
      expect(depositorLp.eq(wethToDeposit)).to.be.true
      expect(debtAmount.eq(debtToMint)).to.be.true
      expect(depositorSqueethBalance.eq(expectedMintedWsqueeth)).to.be.true
      expect(strategyContractSqueeth.eq(BigNumber.from(0))).to.be.true
    })

    it("Should deposit and mint correct LP when initial debt != 0", async () => {
      const normFactor = BigNumber.from(1)
      const strategyCollateralBefore = await crabStrategy.getStrategyCollateral()
      const strategyDebtBefore = await crabStrategy.getStrategyDebt()
      const totalLpBefore = await crabStrategy.totalSupply()

      const wethToDeposit = BigNumber.from(20).mul(BigNumber.from(10).pow(18))
      const depositorShare = wethToDeposit.mul(BigNumber.from(10).pow(18)).div(strategyCollateralBefore.add(wethToDeposit))
      const expectedDepositorLp = totalLpBefore.mul(depositorShare).div(BigNumber.from(10).pow(18).sub(depositorShare))
      
      const debtToMint = wethToDeposit.mul(strategyDebtBefore).div(strategyCollateralBefore);
      const expectedMintedWsqueeth = debtToMint.mul(normFactor)

      await weth.connect(depositor2).approve(crabStrategy.address, wethToDeposit);
      await crabStrategy.connect(depositor2).deposit(wethToDeposit);

      const totalLpAfter = (await crabStrategy.totalSupply())
      const depositorLp = (await crabStrategy.balanceOf(depositor2.address))
      const debtAmount = (await crabStrategy.getStrategyDebt())
      const depositorSqueethBalance = await squeeth.balanceOf(depositor2.address)
      const strategyContractSqueeth = await squeeth.balanceOf(crabStrategy.address)

      expect(totalLpAfter.eq(totalLpBefore.add(expectedDepositorLp))).to.be.true
      expect(depositorLp.eq(expectedDepositorLp)).to.be.true
      expect(debtAmount.eq(strategyDebtBefore.add(debtToMint))).to.be.true
      expect(depositorSqueethBalance.eq(expectedMintedWsqueeth)).to.be.true
      expect(strategyContractSqueeth.eq(BigNumber.from(0))).to.be.true
    })

    it("Should deposit and mint correct LP when initial debt != 0, and keep minted wSqueeth in contract when flashswap = true", async () => {
      const normFactor = BigNumber.from(1)
      const strategyCollateralBefore = await crabStrategy.getStrategyCollateral()
      const strategyDebtBefore = await crabStrategy.getStrategyDebt()
      const totalLpBefore = await crabStrategy.totalSupply()
      const depositorLpBefore = (await crabStrategy.balanceOf(depositor2.address))
      const depositorSqueethBalanceBefore = await squeeth.balanceOf(depositor2.address)

      const wethToDeposit = BigNumber.from(20).mul(BigNumber.from(10).pow(18))
      const depositorShare = wethToDeposit.mul(BigNumber.from(10).pow(18)).div(strategyCollateralBefore.add(wethToDeposit))
      const expectedDepositorLp = totalLpBefore.mul(depositorShare).div(BigNumber.from(10).pow(18).sub(depositorShare))
      
      const debtToMint = wethToDeposit.mul(strategyDebtBefore).div(strategyCollateralBefore);
      const expectedMintedWsqueeth = debtToMint.mul(normFactor)

      await weth.connect(depositor2).approve(crabStrategy.address, wethToDeposit);
      await crabStrategy.connect(depositor2).flashDeposit(wethToDeposit);

      const totalLpAfter = (await crabStrategy.totalSupply())
      const depositorLp = (await crabStrategy.balanceOf(depositor2.address))
      const debtAmount = (await crabStrategy.getStrategyDebt())
      const depositorSqueethBalance = await squeeth.balanceOf(depositor2.address)
      const strategyContractSqueeth = await squeeth.balanceOf(crabStrategy.address)

      expect(totalLpAfter.eq(totalLpBefore.add(expectedDepositorLp))).to.be.true
      expect(depositorLp.sub(depositorLpBefore).eq(expectedDepositorLp)).to.be.true
      expect(debtAmount.eq(strategyDebtBefore.add(debtToMint))).to.be.true
      expect(depositorSqueethBalance.eq(depositorSqueethBalanceBefore)).to.be.true
      expect(strategyContractSqueeth.eq(expectedMintedWsqueeth)).to.be.true
    })


  })
})
