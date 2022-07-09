import { ethers } from "hardhat";
import { expect } from "chai";
import { Contract, providers } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import BigNumberJs from "bignumber.js";
import {
    WETH9,
    MockErc20,
    Controller,
    Oracle,
    WPowerPerp,
    CrabStrategyV2,
    Timelock,
    StrategyBase,
} from "../../../typechain";
import {
    deployUniswapV3,
    deploySqueethCoreContracts,
    deployWETHAndDai,
} from "../../setup";
import { oracleScaleFactor } from "../../utils";

BigNumberJs.set({ EXPONENTIAL_AT: 30 });

describe("Crab v2 Integration test: Timelock", function () {
    const startingEthPrice = 3000;
    const scaledStartingSqueethPrice = (startingEthPrice * 1.1) / oracleScaleFactor.toNumber(); // 0.3

    const hedgeTimeThreshold = 86400; // 24h
    const hedgePriceThreshold = ethers.utils.parseUnits("0.01");
    const abi = new ethers.utils.AbiCoder();
    const signature = "transferVault(address)";
    const twoDays = 2 * 24 * 60 * 60;

    let provider: providers.JsonRpcProvider;
    let owner: SignerWithAddress;
    let depositor: SignerWithAddress;
    let depositor2: SignerWithAddress;
    let depositor3: SignerWithAddress;
    let crabMigration: SignerWithAddress;
    let liquidator: SignerWithAddress;
    let feeRecipient: SignerWithAddress;
    let dai: MockErc20;
    let weth: WETH9;
    let positionManager: Contract;
    let uniswapFactory: Contract;
    let swapRouter: Contract;
    let oracle: Oracle;
    let controller: Controller;
    let wSqueethPool: Contract;
    let wSqueeth: WPowerPerp;
    let crabStrategy: CrabStrategyV2;
    let ethDaiPool: Contract;
    let timelock: Timelock;

    this.beforeAll("Deploy uniswap protocol & setup uniswap pool", async () => {
        const accounts = await ethers.getSigners();
        const [_owner, _depositor, _depositor2, _liquidator, _feeRecipient, _depositor3, _crabMigration] = accounts;
        owner = _owner;
        depositor = _depositor;
        depositor2 = _depositor2;
        liquidator = _liquidator;
        feeRecipient = _feeRecipient;
        depositor3 = _depositor3;
        crabMigration = _crabMigration;
        provider = ethers.provider;

        const { dai: daiToken, weth: wethToken } = await deployWETHAndDai();

        dai = daiToken;
        weth = wethToken;

        const uniDeployments = await deployUniswapV3(weth);
        positionManager = uniDeployments.positionManager;
        uniswapFactory = uniDeployments.uniswapFactory;
        swapRouter = uniDeployments.swapRouter;

        // this will not deploy a new pool, only reuse old onces
        const squeethDeployments = await deploySqueethCoreContracts(
            weth,
            dai,
            positionManager,
            uniswapFactory,
            scaledStartingSqueethPrice,
            startingEthPrice
        );
        controller = squeethDeployments.controller;
        wSqueeth = squeethDeployments.wsqueeth;
        oracle = squeethDeployments.oracle;
        // shortSqueeth = squeethDeployments.shortSqueeth
        wSqueethPool = squeethDeployments.wsqueethEthPool;
        ethDaiPool = squeethDeployments.ethDaiPool;

        await controller.connect(owner).setFeeRecipient(feeRecipient.address);
        await controller.connect(owner).setFeeRate(100);

        const TimelockContract = await ethers.getContractFactory("Timelock");
        timelock = (await TimelockContract.deploy(owner.address, twoDays)) as Timelock;

        const CrabStrategyContract = await ethers.getContractFactory("CrabStrategyV2");
        crabStrategy = (await CrabStrategyContract.deploy(
            controller.address,
            oracle.address,
            weth.address,
            uniswapFactory.address,
            wSqueethPool.address,
            timelock.address,
            crabMigration.address,
            hedgeTimeThreshold,
            hedgePriceThreshold
        )) as CrabStrategyV2;
    });

    this.beforeAll("Seed pool liquidity", async () => {
        await provider.send("evm_increaseTime", [1500]);
        await provider.send("evm_mine", []);
    });
    before("Initialize strategy", async () => {
        const strategyCap = ethers.utils.parseUnits("1000");

        await crabStrategy.connect(crabMigration).initialize(ethers.utils.parseUnits("0.2"), ethers.utils.parseUnits("0.2"), 0, 0, strategyCap, { value: ethers.utils.parseUnits("1") });
        const strategyCapInContract = await crabStrategy.strategyCap();
        expect(strategyCapInContract.eq(strategyCap)).to.be.true;

    });

    describe("Transfer vault with timelock", async () => {
        let txHash = "";
        let eta = 0;
        let currentBlockNumber = 0;
        let currentBlockTimestamp = 0;
        let data = "";

        this.beforeAll(async () => {
            currentBlockNumber = await provider.getBlockNumber();
            const currentBlock = await provider.getBlock(currentBlockNumber);
            eta = currentBlock.timestamp + twoDays + 300;
            currentBlockTimestamp = currentBlock.timestamp;

            data = abi.encode(["address"], [depositor2.address]);

            txHash = ethers.utils.keccak256(
                abi.encode(
                    ["address", "uint256", "string", "bytes", "uint256"],
                    [crabStrategy.address, "0", signature, data, eta]
                )
            );
            await timelock.connect(owner).queueTransaction(crabStrategy.address, 0, signature, data, eta);
        });

        it("Should transfer vault", async () => {
            await provider.send("evm_setNextBlockTimestamp", [eta + 100]);

            expect(
                await timelock.connect(owner).executeTransaction(crabStrategy.address, 0, signature, data, eta)
            ).to.emit(crabStrategy.address, "VaultTransferred");
            expect((await crabStrategy.strategyCap()).eq(0)).to.be.true;
        });

        it("Should not allow user to deposit post vault transfer", async () => {
            await expect(
                crabStrategy.connect(depositor2).deposit({ value: ethers.utils.parseUnits("1") })
            ).to.be.revertedWith("C16");
        });

        it("Should not allow user to withdraw post vault transfer", async () => {
            const depositorCrabBefore = await crabStrategy.balanceOf(depositor3.address);
            const depositorSqueethBalanceBefore = await wSqueeth.balanceOf(depositor3.address);

            await wSqueeth.connect(depositor3).approve(crabStrategy.address, depositorSqueethBalanceBefore);
            await expect(crabStrategy.connect(depositor).withdraw(depositorCrabBefore)).to.be.revertedWith("C20");
        });
    });
});
