import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers";
import { ethers } from "hardhat"
import { expect } from "chai";
import { BigNumber, providers } from "ethers";
import { MockController, WETH9, MockShortPowerPerp, MockUniswapV3Pool, MockOracle, MockWPowerPerp, CrabStrategy, MockErc20 } from "../../../typechain";
import { isSimilar, wmul, wdiv, one, oracleScaleFactor } from "../../utils"

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
  let ethUSDPool: MockUniswapV3Pool;
  let shortSqueeth: MockShortPowerPerp;
  let controller: MockController;
  let oracle: MockOracle;
  let crabStrategy: CrabStrategy;
  let usdc: MockErc20;

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
    ethUSDPool = (await MockUniswapV3PoolContract.deploy()) as MockUniswapV3Pool;

    const MockErc20Contract = await ethers.getContractFactory("MockErc20");
    usdc = (await MockErc20Contract.deploy("USDC", "USDC", 6)) as MockErc20;

    const MockOracle = await ethers.getContractFactory("MockOracle");
    oracle = (await MockOracle.deploy()) as MockOracle;

    const NFTContract = await ethers.getContractFactory("MockShortPowerPerp");
    shortSqueeth = (await NFTContract.deploy()) as MockShortPowerPerp;

    const ControllerContract = await ethers.getContractFactory("MockController");
    controller = (await ControllerContract.deploy()) as MockController;

    await controller.connect(owner).init(shortSqueeth.address, squeeth.address, ethUSDPool.address, usdc.address);
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

  describe("set strategy cap", async () => {
    const strategyCap = ethers.utils.parseUnits("100")
    const wSqueethEthPrice = BigNumber.from('3030').mul(one).div(oracleScaleFactor)
    const ethUSDPrice = BigNumber.from('3000').mul(one)

    before(async () => {
      await oracle.connect(owner).setPrice(wSqueethEthPool.address, wSqueethEthPrice)
      await oracle.connect(random).setPrice(ethUSDPool.address , ethUSDPrice)  // usdc per 1 eth
    })

    it('should revert non owner tries to set the strategy cap', async() => {
      await expect(crabStrategy.connect(random).setStrategyCap(strategyCap)).to.be.revertedWith("Ownable: caller is not the owner")
    })

    it('should revert if no cap is set (initially 0 cap)', async() => {
      const strategyCap = await crabStrategy.strategyCap()
      const ethToDeposit = 1
      expect(strategyCap.eq(0)).to.be.true

      await expect(crabStrategy.connect(depositor2).deposit({value: 1})).to.be.revertedWith("Deposit exceeds strategy cap");
    })

    it('should allow owner to increase the strategy cap', async() => {
      await crabStrategy.connect(owner).setStrategyCap(strategyCap.mul(2))
      const strategyCapInContract = await crabStrategy.strategyCap()
      expect(strategyCapInContract.eq(strategyCap.mul(2))).to.be.true
    })

    it('should allow owner to reduce the strategy cap', async() => {
      await crabStrategy.connect(owner).setStrategyCap(strategyCap)
      const strategyCapInContract = await crabStrategy.strategyCap()
      expect(strategyCapInContract.eq(strategyCap)).to.be.true
    })
  });

  describe("Deposit into strategy", async () => {
    const wSqueethEthPrice = BigNumber.from('3030').mul(one).div(oracleScaleFactor)
    const ethUSDPrice = BigNumber.from('3000').mul(one)
    
    before(async () => {
      await oracle.connect(owner).setPrice(wSqueethEthPool.address, wSqueethEthPrice)
      await oracle.connect(random).setPrice(ethUSDPool.address , ethUSDPrice)  // usdc per 1 eth
    })

    it("Should deposit and mint correct LP when initial debt = 0", async () => {
      const normFactor = BigNumber.from(1)
      const ethToDeposit = BigNumber.from(60).mul(one)
      const squeethDelta = wSqueethEthPrice.mul(2);
      // const feeAdj = ethUSDPrice.mul(100).div(10000)
      const feeAdj = 0
      const debtToMint = ethToDeposit.mul(one).div(squeethDelta.add(feeAdj));
      const expectedMintedWsqueeth = debtToMint.mul(normFactor)

      await crabStrategy.connect(depositor).deposit({value: ethToDeposit});

      const totalSupply = (await crabStrategy.totalSupply())
      const depositorCrab = (await crabStrategy.balanceOf(depositor.address))
      const strategyVault = await controller.vaults(await crabStrategy.vaultId());
      const debtAmount = strategyVault.shortAmount
      const depositorSqueethBalance = await squeeth.balanceOf(depositor.address)
      const strategyContractSqueeth = await squeeth.balanceOf(crabStrategy.address)

      expect(totalSupply.eq(ethToDeposit)).to.be.true
      expect(depositorCrab.eq(ethToDeposit)).to.be.true
      expect(isSimilar(debtAmount.toString(), debtToMint.toString(), 10)).to.be.true
      expect(isSimilar(depositorSqueethBalance.toString(), expectedMintedWsqueeth.toString(), 10)).to.be.true
      expect(strategyContractSqueeth.eq(BigNumber.from(0))).to.be.true
    })

    it("Should deposit and mint correct LP when initial debt != 0 and return the correct amount of wSqueeth debt per crab strategy token", async () => {
      const normFactor = BigNumber.from(1)
      const strategyVault = await controller.vaults(await crabStrategy.vaultId());
      const strategyDebtBefore = strategyVault.shortAmount
      const strategyCollateralBefore = strategyVault.collateralAmount
      const totalCrabBefore = await crabStrategy.totalSupply()

      const ethToDeposit = BigNumber.from(20).mul(one)
      const depositorShare = wdiv(ethToDeposit, (strategyCollateralBefore.add(ethToDeposit)))
      const expectedDepositorCrab = wdiv(wmul(totalCrabBefore, depositorShare), (one.sub(depositorShare)))
    //   const squeethDelta = wSqueethEthPrice.mul(2);

      // const feeAdj = ethUSDPrice.mul(100).div(10000)
      const feeAdj = 0
      const debtToMint = ethToDeposit.mul(strategyDebtBefore).div(strategyCollateralBefore.add(strategyDebtBefore.mul(feeAdj).div(one)));
      const expectedMintedWsqueeth = debtToMint.mul(normFactor)

      await crabStrategy.connect(depositor2).deposit({value: ethToDeposit});

      const totalCrabAfter = (await crabStrategy.totalSupply())
      const depositorCrab = (await crabStrategy.balanceOf(depositor2.address))
      const strategyVaultAfter = await controller.vaults(await crabStrategy.vaultId());
      const debtAmount = strategyVaultAfter.shortAmount
      const depositorSqueethBalance = await squeeth.balanceOf(depositor2.address)
      const strategyContractSqueeth = await squeeth.balanceOf(crabStrategy.address)
      const depositorWSqueethDebt = await crabStrategy.getWsqueethFromCrabAmount(depositorCrab)

      expect(totalCrabAfter.eq(totalCrabBefore.add(expectedDepositorCrab))).to.be.true
      expect(depositorCrab.eq(expectedDepositorCrab)).to.be.true
      expect(isSimilar(strategyDebtBefore.add(debtToMint).toString(), debtAmount.toString(), 10)).to.be.true
      expect(isSimilar(depositorSqueethBalance.toString(), expectedMintedWsqueeth.toString(), 10)).to.be.true
      expect(strategyContractSqueeth.eq(BigNumber.from(0))).to.be.true
      expect(depositorWSqueethDebt.eq(depositorSqueethBalance))    
    })
    it('should revert if cap is hit', async() => {
      const strategyCap = await crabStrategy.strategyCap()
      const result = await crabStrategy.getVaultDetails()
      const ethToDeposit = strategyCap.sub(result[2]).add(1)

      await expect(crabStrategy.connect(depositor2).deposit({value: ethToDeposit})).to.be.revertedWith("Deposit exceeds strategy cap");
    })
  })

  describe("Withdraw from strategy", async () => {
    it("should revert withdrawing from a random account", async () => {
      const depositorSqueethBalanceBefore = await squeeth.balanceOf(depositor.address)
      const depositorCrabBefore = (await crabStrategy.balanceOf(depositor.address))
      const wSqueethAmount = depositorSqueethBalanceBefore

      await squeeth.connect(random).approve(crabStrategy.address, depositorCrabBefore)

      await expect(
        crabStrategy.connect(random).withdraw(depositorCrabBefore)
      ).to.be.revertedWith("ERC20: transfer amount exceeds balance");
    })

    it("should withdraw 0 correctly", async () => {
      const strategyVault = await controller.vaults(await crabStrategy.vaultId());
      const strategyDebtBefore = strategyVault.shortAmount
      const strategyCollateralBefore = strategyVault.collateralAmount
      const totalCrabBefore = await crabStrategy.totalSupply()
      const depositorCrabBefore = (await crabStrategy.balanceOf(depositor.address))
      const depositorSqueethBalanceBefore = await squeeth.balanceOf(depositor.address)
      const depositorEthBalanceBefore = await provider.getBalance(depositor.address)

      const expectedCrabPercentage = wdiv(depositorCrabBefore, totalCrabBefore)
      const expectedEthToWithdraw = wmul(strategyCollateralBefore, expectedCrabPercentage)

      await squeeth.connect(depositor).approve(crabStrategy.address, 0)
      await crabStrategy.connect(depositor).withdraw(0);  

      const strategyVaultAfter = await controller.vaults(await crabStrategy.vaultId());
      const strategyCollateralAfter = strategyVaultAfter.collateralAmount
      const strategyDebtAfter = strategyVaultAfter.shortAmount
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
      const strategyVault = await controller.vaults(await crabStrategy.vaultId());
      const strategyDebtBefore = strategyVault.shortAmount
      const strategyCollateralBefore = strategyVault.collateralAmount
      const totalCrabBefore = await crabStrategy.totalSupply()
      const depositorCrabBefore = (await crabStrategy.balanceOf(depositor.address))
      const depositorSqueethBalanceBefore = await squeeth.balanceOf(depositor.address)
      const depositorEthBalanceBefore = await provider.getBalance(depositor.address)

      const expectedCrabPercentage = wdiv(depositorCrabBefore, totalCrabBefore)
      const expectedEthToWithdraw = wmul(strategyCollateralBefore, expectedCrabPercentage)

      await squeeth.connect(depositor).approve(crabStrategy.address, depositorSqueethBalanceBefore)
      await crabStrategy.connect(depositor).withdraw(depositorCrabBefore);  

      const strategyVaultAfter = await controller.vaults(await crabStrategy.vaultId());
      const strategyCollateralAfter = strategyVaultAfter.collateralAmount
      const strategyDebtAfter = strategyVaultAfter.shortAmount
      const totalCrabAfter = await crabStrategy.totalSupply()
      const depositorCrabAfter = (await crabStrategy.balanceOf(depositor.address))
      const depositorSqueethBalanceAfter = await squeeth.balanceOf(depositor.address)
      const depositorEthBalanceAfter = await provider.getBalance(depositor.address)

      expect(depositorSqueethBalanceAfter.eq(BigNumber.from(0))).to.be.true
      expect(depositorSqueethBalanceBefore.gt(BigNumber.from(0))).to.be.true
      expect(depositorCrabAfter.eq(BigNumber.from(0))).to.be.true
      expect(totalCrabAfter.eq(totalCrabBefore.sub(depositorCrabBefore))).to.be.true
      expect(strategyCollateralAfter.eq(strategyCollateralBefore.sub(expectedEthToWithdraw))).to.be.true
      expect(strategyDebtAfter.eq(strategyDebtBefore.sub(depositorSqueethBalanceBefore))).to.be.true
      expect(isSimilar(depositorEthBalanceAfter.sub(depositorEthBalanceBefore).toString(), expectedEthToWithdraw.toString())).to.be.true
    })
  })  
})
