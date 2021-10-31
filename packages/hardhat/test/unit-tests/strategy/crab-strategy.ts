import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers";
import { ethers } from "hardhat"
import { expect } from "chai";
import { BigNumber, providers } from "ethers";
import { MockController, WETH9, MockShortPowerPerp, MockUniswapV3Pool, MockOracle, MockWPowerPerp, CrabStrategy } from "../../../typechain";
import { isSimilar, wmul, wdiv, one } from "../../utils"

describe("Crab Strategy", function () {
  const hedgeTimeTolerance = 86400  // 24h
  const hedgePriceTolerance = ethers.utils.parseUnits('0.15')
  const auctionTime = 3600
  const minAuctionSlippage = ethers.utils.parseUnits('0.95')
  const maxAuctionSlippage = ethers.utils.parseUnits('1.05')

  let provider: providers.JsonRpcProvider;
  let owner: SignerWithAddress;
  let random: SignerWithAddress;
  let depositor: SignerWithAddress;
  let depositor2: SignerWithAddress;

  let squeeth: MockWPowerPerp;
  let weth: WETH9;
  let wSqueethEthPool: MockUniswapV3Pool;
  let shortSqueeth: MockShortPowerPerp;
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

    const MockSQUContract = await ethers.getContractFactory("MockWPowerPerp");
    squeeth = (await MockSQUContract.deploy()) as MockWPowerPerp;

    const MockUniswapV3PoolContract = await ethers.getContractFactory("MockUniswapV3Pool");
    wSqueethEthPool = (await MockUniswapV3PoolContract.deploy()) as MockUniswapV3Pool;

    const MockOracle = await ethers.getContractFactory("MockOracle");
    oracle = (await MockOracle.deploy()) as MockOracle;

    const NFTContract = await ethers.getContractFactory("MockShortPowerPerp");
    shortSqueeth = (await NFTContract.deploy()) as MockShortPowerPerp;

    const ControllerContract = await ethers.getContractFactory("MockController");
    controller = (await ControllerContract.deploy()) as MockController;

    await controller.connect(owner).init(shortSqueeth.address, squeeth.address);
  })

  describe("Deployment", async () => {

    it("Should revert if weth is address 0", async function () {
      const CrabStrategyContract = await ethers.getContractFactory("CrabStrategy");
      await expect(CrabStrategyContract.deploy(
        controller.address, 
        oracle.address, 
        ethers.constants.AddressZero, 
        random.address, 
        wSqueethEthPool.address, 
        hedgeTimeTolerance, 
        hedgePriceTolerance, 
        auctionTime, 
        minAuctionSlippage, 
        maxAuctionSlippage)).to.be.revertedWith("invalid weth address");
    });

    it("Should revert if controller is address 0", async function () {
      const CrabStrategyContract = await ethers.getContractFactory("CrabStrategy");
      await expect(CrabStrategyContract.deploy(
        ethers.constants.AddressZero, 
        oracle.address, 
        weth.address, 
        random.address, 
        wSqueethEthPool.address, 
        hedgeTimeTolerance, 
        hedgePriceTolerance, 
        auctionTime, 
        minAuctionSlippage, 
        maxAuctionSlippage)).to.be.revertedWith("invalid power token controller address");
    });

    it("Should revert if oracle is address 0", async function () {
      const CrabStrategyContract = await ethers.getContractFactory("CrabStrategy");
      await expect(CrabStrategyContract.deploy(
        controller.address, 
        ethers.constants.AddressZero, 
        weth.address, 
        random.address, 
        wSqueethEthPool.address,
        hedgeTimeTolerance, 
        hedgePriceTolerance, 
        auctionTime, 
        minAuctionSlippage, 
        maxAuctionSlippage)).to.be.revertedWith("invalid oracle address");
    });

    it("Should revert if uniswap factory is address 0", async function () {
      const CrabStrategyContract = await ethers.getContractFactory("CrabStrategy");
      await expect(CrabStrategyContract.deploy(
        controller.address, 
        oracle.address, 
        weth.address, 
        ethers.constants.AddressZero, 
        wSqueethEthPool.address, 
        hedgeTimeTolerance, 
        hedgePriceTolerance, 
        auctionTime, minAuctionSlippage, 
        maxAuctionSlippage)).to.be.revertedWith("invalid factory address");
    });

    it("Should revert if wSqueethEth pool is address 0", async function () {
      const CrabStrategyContract = await ethers.getContractFactory("CrabStrategy");
      await expect(CrabStrategyContract.deploy(
        controller.address,
        oracle.address, 
        weth.address, 
        random.address, 
        ethers.constants.AddressZero, 
        hedgeTimeTolerance, 
        hedgePriceTolerance, 
        auctionTime, 
        minAuctionSlippage, 
        maxAuctionSlippage)).to.be.revertedWith("invalid ETH:WSqueeth address");
    });

    it("Should revert if hedge time tolerrance is 0", async function () {
      const CrabStrategyContract = await ethers.getContractFactory("CrabStrategy");
      await expect(CrabStrategyContract.deploy(
        controller.address,
        oracle.address, 
        weth.address, 
        random.address, 
        wSqueethEthPool.address, 
        0, 
        hedgePriceTolerance, 
        auctionTime, 
        minAuctionSlippage, 
        maxAuctionSlippage)).to.be.revertedWith("invalid hedge time threshold");
    });

    it("Should revert if hedge price tolerance is 0", async function () {
      const CrabStrategyContract = await ethers.getContractFactory("CrabStrategy");
      await expect(CrabStrategyContract.deploy(
        controller.address,
        oracle.address, 
        weth.address, 
        random.address, 
        wSqueethEthPool.address, 
        hedgeTimeTolerance, 
        0, 
        auctionTime, 
        minAuctionSlippage, 
        maxAuctionSlippage)).to.be.revertedWith("invalid hedge price threshold");
    });

    it("Should revert if invalid auction time is 0", async function () {
      const CrabStrategyContract = await ethers.getContractFactory("CrabStrategy");
      await expect(CrabStrategyContract.deploy(
        controller.address,
        oracle.address, 
        weth.address, 
        random.address, 
        wSqueethEthPool.address, 
        hedgeTimeTolerance, 
        hedgePriceTolerance, 
        0, 
        minAuctionSlippage, 
        maxAuctionSlippage)).to.be.revertedWith("invalid auction time");
    });
    
    it("Should revert if min auction slippage > 1e18 ", async function () {
      const CrabStrategyContract = await ethers.getContractFactory("CrabStrategy");
      await expect(CrabStrategyContract.deploy(
        controller.address,
        oracle.address, 
        weth.address, 
        random.address, 
        wSqueethEthPool.address, 
        hedgeTimeTolerance, 
        hedgePriceTolerance, 
        auctionTime, 
        ethers.utils.parseUnits('1.01'), 
        maxAuctionSlippage)).to.be.revertedWith("auction min price multiplier too high");
    });
    
    it("Should revert if min price multiplier is 0", async function () {
      const CrabStrategyContract = await ethers.getContractFactory("CrabStrategy");
      await expect(CrabStrategyContract.deploy(
        controller.address,
        oracle.address, 
        weth.address, 
        random.address, 
        wSqueethEthPool.address, 
        hedgeTimeTolerance, 
        hedgePriceTolerance, 
        auctionTime, 
        0, 
        maxAuctionSlippage)).to.be.revertedWith("invalid auction min price multiplier");
    });
    
    it("Should revert if max price multplier < 1e18", async function () {
      const CrabStrategyContract = await ethers.getContractFactory("CrabStrategy");
      await expect(CrabStrategyContract.deploy(
        controller.address,
        oracle.address, 
        weth.address, 
        random.address, 
        wSqueethEthPool.address, 
        hedgeTimeTolerance, 
        hedgePriceTolerance, 
        auctionTime, 
        minAuctionSlippage, 
        ethers.utils.parseUnits('0.99'))).to.be.revertedWith("auction max price multiplier too low");
    });
    
    
    it("Deployment", async function () {
      const CrabStrategyContract = await ethers.getContractFactory("CrabStrategy");
      crabStrategy = (await CrabStrategyContract.deploy(controller.address, oracle.address, weth.address, random.address, wSqueethEthPool.address, hedgeTimeTolerance, hedgePriceTolerance, auctionTime, minAuctionSlippage, maxAuctionSlippage)) as CrabStrategy;
    });
  });

  describe("Crab strategy vault", async () => {
    it("Check crab details",  async () => {
      const name = await crabStrategy.name()
      const symbol = await crabStrategy.symbol()

      expect(name).to.be.eq("Crab Strategy")
      expect(symbol).to.be.eq("Crab")
    })
    it("Check crab strategy opened vault", async () => {
      const openedVaultId = await crabStrategy.getStrategyVaultId()

      expect(openedVaultId).to.be.eq(BigNumber.from(1))
    });
  });

  describe("receive checks", async () => {
    it('should revert when sending eth to crab strategy contract from an EOA', async() => {
      await expect(random.sendTransaction({to: crabStrategy.address, value:1})).to.be.revertedWith('Cannot receive eth')
    })
});

  describe("Deposit into strategy", async () => {
    const wSqueethEthPrice = BigNumber.from(100).mul(one)

    before(async () => {
      // set ETH:DAI price
      await oracle.connect(owner).setPrice(wSqueethEthPool.address, wSqueethEthPrice)
    })

    it("Should deposit and mint correct LP when initial debt = 0", async () => {
      const normFactor = BigNumber.from(1)
      const ethToDeposit = BigNumber.from(60).mul(one)
      const squeethDelta = wSqueethEthPrice.mul(2);
      const debtToMint = ethToDeposit.mul(one).div(squeethDelta);
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

    it("Should deposit and mint correct LP when initial debt != 0 and return the correct amount of wSqueeth debt per crab strategy token", async () => {
      const normFactor = BigNumber.from(1)
      const strategyCollateralBefore = await crabStrategy.getStrategyCollateral()
      const strategyDebtBefore = await crabStrategy.getStrategyDebt()
      const totalCrabBefore = await crabStrategy.totalSupply()

      const ethToDeposit = BigNumber.from(20).mul(one)
      const depositorShare = wdiv(ethToDeposit, (strategyCollateralBefore.add(ethToDeposit)))
      const expectedDepositorCrab = wdiv(wmul(totalCrabBefore, depositorShare), (one.sub(depositorShare)))
      
      const debtToMint = ethToDeposit.mul(strategyDebtBefore).div(strategyCollateralBefore);
      const expectedMintedWsqueeth = debtToMint.mul(normFactor)

      await crabStrategy.connect(depositor2).deposit({value: ethToDeposit});

      const totalCrabAfter = (await crabStrategy.totalSupply())
      const depositorCrab = (await crabStrategy.balanceOf(depositor2.address))
      const debtAmount = (await crabStrategy.getStrategyDebt())
      const depositorSqueethBalance = await squeeth.balanceOf(depositor2.address)
      const strategyContractSqueeth = await squeeth.balanceOf(crabStrategy.address)
      const depositorWSqueethDebt = await crabStrategy.getWsqueethFromCrabAmount(depositorCrab)

      expect(totalCrabAfter.eq(totalCrabBefore.add(expectedDepositorCrab))).to.be.true
      expect(depositorCrab.eq(expectedDepositorCrab)).to.be.true
      expect(debtAmount.eq(strategyDebtBefore.add(debtToMint))).to.be.true
      expect(depositorSqueethBalance.eq(expectedMintedWsqueeth)).to.be.true
      expect(strategyContractSqueeth.eq(BigNumber.from(0))).to.be.true
      expect(depositorWSqueethDebt.eq(depositorSqueethBalance))    
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
    
    it("should revert withdrawing from a random account", async () => {
      const depositorSqueethBalanceBefore = await squeeth.balanceOf(depositor.address)
      const depositorCrabBefore = (await crabStrategy.balanceOf(depositor.address))
      const wSqueethAmount = depositorSqueethBalanceBefore

      await squeeth.connect(random).approve(crabStrategy.address, depositorCrabBefore)

      await expect(
        crabStrategy.connect(random).withdraw(depositorCrabBefore, wSqueethAmount)
      ).to.be.revertedWith("ERC20: transfer amount exceeds balance");
    })

    it("should withdraw 0 correctly", async () => {
      const strategyCollateralBefore = await crabStrategy.getStrategyCollateral()
      const strategyDebtBefore = await crabStrategy.getStrategyDebt()
      const totalCrabBefore = await crabStrategy.totalSupply()
      const depositorCrabBefore = (await crabStrategy.balanceOf(depositor.address))
      const depositorSqueethBalanceBefore = await squeeth.balanceOf(depositor.address)
      const depositorEthBalanceBefore = await provider.getBalance(depositor.address)

      const expectedCrabPercentage = wdiv(depositorCrabBefore, totalCrabBefore)
      const expectedEthToWithdraw = wmul(strategyCollateralBefore, expectedCrabPercentage)

      await squeeth.connect(depositor).approve(crabStrategy.address, 0)
      await crabStrategy.connect(depositor).withdraw(0, 0);  

      const strategyCollateralAfter = await crabStrategy.getStrategyCollateral()
      const strategyDebtAfter = await crabStrategy.getStrategyDebt()
      const totalCrabAfter = await crabStrategy.totalSupply()
      const depositorCrabAfter = (await crabStrategy.balanceOf(depositor.address))
      const depositorSqueethBalanceAfter = await squeeth.balanceOf(depositor.address)
      const depositorEthBalanceAfter = await provider.getBalance(depositor.address)

      expect(depositorSqueethBalanceAfter.eq(depositorSqueethBalanceBefore)).to.be.true
      expect(depositorCrabAfter.eq(depositorCrabBefore)).to.be.true
      expect(totalCrabAfter.eq(totalCrabBefore)).to.be.true
      expect(strategyCollateralAfter.eq(strategyCollateralBefore)).to.be.true
      expect(strategyDebtAfter.eq(strategyDebtBefore)).to.be.true
      expect(isSimilar(depositorEthBalanceAfter.toString(),depositorEthBalanceBefore.toString())).to.be.true
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
