import { ethers, network } from "hardhat"
import { expect } from "chai";
import { Contract, BigNumber, providers } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import BigNumberJs from 'bignumber.js'
import { WETH9, MockErc20, Controller, Oracle, WPowerPerp, CrabStrategyV2, ISwapRouter, Timelock, CrabHelper, CrabOTC } from "../../../typechain";
import { deployUniswapV3, deploySqueethCoreContracts, deployWETHAndDai, addWethDaiLiquidity, addSqueethLiquidity, createUniPool } from '../../setup'
import { isSimilar, wmul, wdiv, one, oracleScaleFactor, signTypedData, getGasPaid } from "../../utils"

BigNumberJs.set({ EXPONENTIAL_AT: 30 })

describe("Crab V2 integration test: Crab OTC", function () {
  const startingEthPrice = 3000
  const startingEthPrice1e18 = BigNumber.from(startingEthPrice).mul(one) // 3000 * 1e18
  const scaledStartingSqueethPrice1e18 = startingEthPrice1e18.mul(11).div(10).div(oracleScaleFactor) // 0.3 * 1e18
  const scaledStartingSqueethPrice = startingEthPrice * 1.1 / oracleScaleFactor.toNumber() // 0.3


  const hedgeTimeThreshold = 86400  // 24h
  const hedgePriceThreshold = ethers.utils.parseUnits('0.01')
  let poolFee: BigNumber;
  let poolFeePool2: BigNumber

  let provider: providers.JsonRpcProvider;
  let owner: SignerWithAddress;
  let depositor: SignerWithAddress;
  let trader: SignerWithAddress;
  let crabMigration: SignerWithAddress;
  let feeRecipient: SignerWithAddress;
  let dai: MockErc20
  let weth: WETH9
  let positionManager: Contract
  let uniswapFactory: Contract
  let swapRouter: Contract
  let oracle: Oracle
  let controller: Controller
  let wSqueethPool: Contract
  let wSqueethPool2: Contract
  let wSqueeth: WPowerPerp
  let crabStrategy: CrabStrategyV2
  let ethDaiPool: Contract
  let timelock: Timelock;
  let crabOTC: CrabOTC;

  this.beforeAll("Deploy uniswap protocol & setup uniswap pool", async () => {
    const accounts = await ethers.getSigners();
    const [_owner, _depositor, _trader, _feeRecipient, _crabMigration] = accounts;
    owner = _owner;
    depositor = _depositor;
    trader = _trader;
    feeRecipient = _feeRecipient;
    crabMigration = _crabMigration;
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

    wSqueethPool2 = await createUniPool(scaledStartingSqueethPrice, weth, wSqueeth, positionManager, uniswapFactory, 10000) as Contract
    await wSqueethPool2.increaseObservationCardinalityNext(500) 
  
    poolFee = await wSqueethPool.fee()
    poolFeePool2 = await wSqueethPool2.fee()


    // await controller.connect(owner).setFeeRecipient(feeRecipient.address);
    // await controller.connect(owner).setFeeRate(100)

    const TimelockContract = await ethers.getContractFactory("Timelock");
    timelock = (await TimelockContract.deploy(owner.address, 3 * 24 * 60 * 60)) as Timelock;

    const CrabStrategyContract = await ethers.getContractFactory("CrabStrategyV2");
    crabStrategy = (await CrabStrategyContract.deploy(controller.address, oracle.address, weth.address, uniswapFactory.address, wSqueethPool.address, timelock.address, crabMigration.address, hedgeTimeThreshold, hedgePriceThreshold)) as CrabStrategyV2;
  })

  this.beforeAll("Seed pool liquidity", async () => {
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

  })

  this.beforeAll("Deploy Crab Helper", async () => {
    const CrabHelperContract = await ethers.getContractFactory("CrabOTC");
    crabOTC = (await CrabHelperContract.deploy(crabStrategy.address)) as CrabOTC;
  })

  this.beforeAll("Initialize strategy", async () => {
    const ethToDeposit = ethers.utils.parseUnits("20");

    const normFactor = await controller.normalizationFactor();
    const currentScaledSquethPrice = await oracle.getTwap(
        wSqueethPool.address,
        wSqueeth.address,
        weth.address,
        300,
        false
    );
    const feeRate = await controller.feeRate();
    const ethFeePerWSqueeth = currentScaledSquethPrice.mul(feeRate).div(10000);
    const squeethDelta = scaledStartingSqueethPrice1e18.mul(2); // .66*10^18
    const debtToMint = wdiv(ethToDeposit, squeethDelta.add(ethFeePerWSqueeth));
    const expectedEthDeposit = ethToDeposit.sub(debtToMint.mul(ethFeePerWSqueeth).div(one));

    const strategyCap = ethers.utils.parseUnits("1000")

    await crabStrategy.connect(crabMigration).initialize(debtToMint, expectedEthDeposit, 1, 1, strategyCap, { value: ethToDeposit });
    const strategyCapInContract = await crabStrategy.strategyCap()
    expect(strategyCapInContract.eq(strategyCap)).to.be.true
  });

  const getOSQTHPrice = () => oracle.getTwap(wSqueethPool.address, wSqueeth.address, weth.address, 600, false);

  const getTypeAndDomainData = () => {
    const typeData = {
        Order: [
            { type: "address", name: "initiator" },
            { type: "address", name: "trader" },
            { type: "uint256", name: "quantity" },
            { type: "uint256", name: "price" },
            { type: "bool", name: "isBuying" },
            { type: "uint256", name: "expiry" },
            { type: "uint256", name: "nonce" },
        ],
    };
    const domainData = {
        name: "CrabOTC",
        version: "2",
        chainId: network.config.chainId,
        verifyingContract: crabOTC.address,
    };
    return { typeData, domainData };
  };



  describe("Deposit", () => {
    it("Should deposit OTC",async () => {
      const start_eth_balance = await depositor.getBalance();
      const ethToDeposit = ethers.utils.parseEther('5')
      const oSqthPrice = await getOSQTHPrice()
      const limitPrice = oSqthPrice.mul(99).div(100) // 1%

      const [, , collat, debt] = await crabStrategy.getVaultDetails()
      const cr0 = wdiv(debt, collat)

      const oSqthToMint = wdiv(debt.sub(wmul(cr0, collat)).sub(wmul(cr0, ethToDeposit)), wmul(cr0, limitPrice).sub(one))
      const neededETH = wdiv(oSqthToMint, cr0)


      const traderPrice = oSqthPrice.mul(995).div(1000) // .5%
      // and prepare the trade
      const orderHash = {
        bidId: 0,
        initiator: depositor.address,
        trader: trader.address,
        quantity: oSqthToMint, // 0.03sqth
        price: traderPrice.toString(),
        isBuying: true,
        expiry: (await provider.getBlock(await provider.getBlockNumber())).timestamp + 600,
        nonce: 1
      };

      // Mint and Approve WETH
      await weth.connect(trader).deposit({
        value: wmul(oSqthToMint, traderPrice),
      })

      await weth.connect(trader).approve(crabOTC.address, ethers.constants.MaxUint256)

      const { typeData, domainData } = getTypeAndDomainData();
      const signedOrder = await signTypedData(trader, domainData, typeData, orderHash);

      console.log('Osqth to mint:', oSqthToMint.toString(), 'CR0:',cr0.toString(), 'Osqth Price:',oSqthPrice.toString(), 'Collat:', collat.toString(), 'Debt:',debt.toString(), 'Limit price:', limitPrice.toString())

      const tx1 = await crabOTC.connect(depositor).deposit(neededETH, limitPrice, signedOrder, {
        value: ethToDeposit
      })
      const gas_paid = await getGasPaid(tx1);
      
      const [, , collat1, debt1] = await crabStrategy.getVaultDetails();
      const cr1 = wdiv(debt1, collat1);
      expect(cr1.sub(cr0).toNumber()).to.be.lt(2).to.be.gt(-2)

      const deposit_crab_after = await crabStrategy.connect(depositor).balanceOf(depositor.address);

      // ensure user is not loosing money
      // balance before = eth balance after + crab value + slippage lost + gazzzz
      const final_eth_balance = await depositor.getBalance();
      const eth_spent = start_eth_balance.sub(final_eth_balance);
      const totalSupply = await crabStrategy.totalSupply();
      const crab_share = wdiv(collat1.sub(wmul(debt1, oSqthPrice)), totalSupply)
      const crab_value = wmul(crab_share, deposit_crab_after);

      const debt_minted = await crabStrategy.getWsqueethFromCrabAmount(deposit_crab_after);
      const slippage = wmul(debt_minted, oSqthPrice.sub(traderPrice));
      expect(eth_spent.sub(crab_value).sub(slippage).sub(gas_paid)).to.lt(5).to.be.gt(-5); // 5 wei rounding error; should be zero
    })
    it("Should withdraw OTC",async () => {
      const start_eth_balance = await depositor.getBalance();


      const [, , collat, debt] = await crabStrategy.getVaultDetails()
      const cr0 = wdiv(debt, collat)

      const oSqthPrice = await getOSQTHPrice()
      const traderPrice = oSqthPrice.mul(1005).div(1000) // .5%
      const tx0 = await crabStrategy.connect(depositor).approve(crabOTC.address, ethers.constants.MaxUint256);
      const deposit_crab_after = await crabStrategy.connect(depositor).balanceOf(depositor.address);
      const debt_minted = await crabStrategy.getWsqueethFromCrabAmount(deposit_crab_after);
      const startingCrabValue = wdiv(debt_minted , cr0).sub(wmul(debt_minted, oSqthPrice))

      // and prepare the trade
      const orderHash = {
        bidId: 0,
        initiator: depositor.address,
        trader: trader.address,
        quantity: debt_minted, // 0.03sqth
        price: traderPrice.toString(),
        isBuying: false,
        expiry: (await provider.getBlock(await provider.getBlockNumber())).timestamp + 600,
        nonce: 2
      };

      // Mint and Approve oSQTH
      await controller.connect(trader).mintWPowerPerpAmount("0", debt_minted, "0", { value:  ethers.utils.parseUnits('100000000')});
      await wSqueeth.connect(trader).approve(crabOTC.address, ethers.constants.MaxUint256)

      const { typeData, domainData } = getTypeAndDomainData();
      const signedOrder = await signTypedData(trader, domainData, typeData, orderHash);
      // await expect(crabOTC.connect(depositor).withdraw(deposit_crab_after, traderPrice, signedOrder)).to.emit(crabOTC, "WithdrawOTC")
      const tx1 = await crabOTC.connect(depositor).withdraw(deposit_crab_after, traderPrice, signedOrder);
      const gas_paid0 = await getGasPaid(tx0);
      const gas_paid = await getGasPaid(tx1);


      const [, , collat1, debt1] = await crabStrategy.getVaultDetails();
      const cr1 = wdiv(debt1, collat1);
      expect(cr1.sub(cr0).toNumber()).to.be.lt(2).to.be.gt(-2)


      // depositor should not have lost money
      const ending_eth_balance = await depositor.getBalance();
      // ending eth - starting eth = crab value -slippage - gas paid
      const slippage = wmul(debt_minted, traderPrice.sub(oSqthPrice));
      const val = ending_eth_balance.sub(start_eth_balance).sub(startingCrabValue).add(slippage);
      // expect(ending_eth_balance.sub(start_eth_balance).toString()).to.eq('4925361440493556482');
      expect(val.add(gas_paid).add(gas_paid0).toNumber()).to.lt(5).to.be.gt(-5);

      // ensure trader gets his fair share
      // his ending balance - starting balance - sqth*price = 0
    })
  })
})