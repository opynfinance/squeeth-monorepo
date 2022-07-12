import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { ethers } from "hardhat"
import { expect } from "chai";
import { BigNumber, providers } from "ethers";
import { MockCrab, CrabMigration, MockErc20, WETH9, MockEulerDToken, MockEuler} from "../../../typechain";
import { isSimilar, wmul, wdiv, one, oracleScaleFactor } from "../../utils"

describe("Crab Migration", function () {
 
    let crabStrategyV1: MockCrab;
    let crabStrategyV2: MockCrab;
    let crabMigration: CrabMigration;

    let weth: MockErc20;
    let usdc: MockErc20;
    let dToken: MockEulerDToken;
    let dTokenUsdc: MockEulerDToken;
    let euler: MockEuler;

    let provider: providers.JsonRpcProvider;
    let owner: SignerWithAddress;
    let random: SignerWithAddress;
    let d1: SignerWithAddress;
    let d2: SignerWithAddress;

    const deposit1Amount = ethers.utils.parseEther("10.0");
    const deposit2Amount = ethers.utils.parseEther("90.0");
    const collateral = deposit1Amount.add(deposit2Amount);

    this.beforeAll("Prepare accounts", async () => {
        const accounts = await ethers.getSigners();
        const [_owner, _d1, _random, _d2] = accounts;
        d1 = _d1
        d2 = _d2
        random = _random
        owner = _owner
        provider = ethers.provider
    })

    this.beforeAll("Setup mock contracts", async () => { 
        const MockErc20Contract = await ethers.getContractFactory("MockErc20");
        weth = (await MockErc20Contract.deploy("WETH", "WETH", 18)) as MockErc20;

        const MockNonWethErc20Contract = await ethers.getContractFactory("MockErc20");
        usdc = (await MockNonWethErc20Contract.deploy("USDC", "USDC", 18)) as MockErc20;

        const MockEulerDTokenContract = await ethers.getContractFactory("MockEulerDToken");
        dToken = (await MockEulerDTokenContract.deploy(weth.address)) as MockEulerDToken;

        const MockIncorrectEulerDTokenContract = await ethers.getContractFactory("MockEulerDToken");
        dTokenUsdc = (await MockIncorrectEulerDTokenContract.deploy(usdc.address)) as MockEulerDToken;

        const MockEulerContract = await ethers.getContractFactory("MockEuler");
        euler = (await MockEulerContract.deploy()) as MockEuler;

        await weth.mint(dToken.address, collateral);
    })
    
    this.beforeAll("Setup Mock Crabs", async () => {
        const CrabContract = await ethers.getContractFactory("MockCrab");
        crabStrategyV1 = (await CrabContract.deploy("CrabV1", "CrabV1", 18)) as MockCrab;
        crabStrategyV2 = (await CrabContract.deploy("CrabV2", "CrabV2", 18)) as MockCrab;

        await crabStrategyV1.mint(d1.address, deposit1Amount);
        await crabStrategyV1.mint(d2.address, deposit2Amount);

        await crabStrategyV1.setVaultDetails(1, collateral, collateral.div(2));
    })

    describe("Deployment tests", async() => { 

        it("should revert if deploying to a dToken that is not weth", async () => { 
            const MigrationContract = await ethers.getContractFactory("CrabMigration");
            await expect(MigrationContract.connect(owner).deploy(crabStrategyV1.address, weth.address, euler.address, dTokenUsdc.address, euler.address)).to.be.revertedWith("dToken underlying asset should be weth");
            })

        it("should deploy if correct dToken is specified", async () => { 
            const MigrationContract = await ethers.getContractFactory("CrabMigration");
            crabMigration = (await MigrationContract.connect(owner).deploy(crabStrategyV1.address, weth.address, euler.address, dToken.address, euler.address)) as CrabMigration;
            })
    })
  

    describe("Test Migration", async() => { 

        it("Should revert if address of euler deposit token is 0", async function () {
            const MigrationContract = await ethers.getContractFactory("CrabMigration");
            await expect(MigrationContract.connect(owner).deploy(
                crabStrategyV1.address, weth.address, euler.address, ethers.constants.AddressZero, euler.address)).to.be.revertedWith("invalid _dToken address");
        });

        it("Should revert if address of euler deployment on mainnet is 0", async function () {
            const MigrationContract = await ethers.getContractFactory("CrabMigration");
            await expect(MigrationContract.connect(owner).deploy(
                crabStrategyV1.address, weth.address, euler.address, dToken.address, ethers.constants.AddressZero)).to.be.revertedWith("invalid _eulerMainnet address");
        });

        it("Should revert if address of euler exec contract is 0", async function () {
            const MigrationContract = await ethers.getContractFactory("CrabMigration");
            await expect(MigrationContract.connect(owner).deploy(
                crabStrategyV1.address, weth.address, ethers.constants.AddressZero, dToken.address, euler.address)).to.be.revertedWith("invalid _eulerExec address");
        });

        it("Should revert if address of crab v1 is 0", async function () {
            const MigrationContract = await ethers.getContractFactory("CrabMigration");
            await expect(MigrationContract.connect(owner).deploy(
                ethers.constants.AddressZero, weth.address, euler.address, dToken.address, euler.address)).to.be.revertedWith("invalid _crabv1 address");
        });

        it("Should revert if address of weth is 0", async function () {
            const MigrationContract = await ethers.getContractFactory("CrabMigration");
            await expect(MigrationContract.connect(owner).deploy(
                crabStrategyV1.address, ethers.constants.AddressZero, euler.address, dToken.address, euler.address)).to.be.revertedWith("invalid _weth address");
        });

        it("should not allow 0 to be set as crab address", async () => {
            await expect(crabMigration.connect(owner).setCrabV2(ethers.constants.AddressZero)).to.be.revertedWith("M7");
        })

        it("should set crabV2 with proper address", async () => {
            await crabMigration.connect(owner).setCrabV2(crabStrategyV2.address)
            expect(await crabMigration.crabV2()).to.be.equal(crabStrategyV2.address)
        })


        it("d1 deposits crabV1 shares", async () => { 
            const crabV1BalanceBefore = await crabStrategyV1.balanceOf(crabMigration.address); 

            await crabStrategyV1.connect(d1).approve(crabMigration.address, deposit1Amount);
            await crabMigration.connect(d1).depositV1Shares(deposit1Amount.div(2));

            const crabV1BalanceAfter = await crabStrategyV1.balanceOf(crabMigration.address);
            const d1SharesDeposited  = await crabMigration.sharesDeposited(d1.address);

            expect(crabV1BalanceBefore).to.be.equal('0');
            expect(crabV1BalanceAfter).to.be.equal(deposit1Amount.div(2));
            expect(d1SharesDeposited).to.be.equal(deposit1Amount.div(2));
        })

        it("d1 deposits more crabV1 shares", async () => { 
            const crabV1BalanceBefore = await crabStrategyV1.balanceOf(crabMigration.address); 

            await crabStrategyV1.connect(d1).approve(crabMigration.address, deposit1Amount);
            await crabMigration.connect(d1).depositV1Shares(deposit1Amount.div(2));

            const crabV1BalanceAfter = await crabStrategyV1.balanceOf(crabMigration.address);
            const d1SharesDeposited  = await crabMigration.sharesDeposited(d1.address);

            expect(crabV1BalanceBefore).to.be.equal(deposit1Amount.div(2));
            expect(crabV1BalanceAfter).to.be.equal(deposit1Amount);
            expect(d1SharesDeposited).to.be.equal(deposit1Amount);
        })

        it("d2 deposits crabV1 shares", async () => { 
            const crabV1BalanceBefore = await crabStrategyV1.balanceOf(crabMigration.address); 

            await crabStrategyV1.connect(d2).approve(crabMigration.address, deposit2Amount);
            await crabMigration.connect(d2).depositV1Shares(deposit2Amount);

            const crabV1BalanceAfter = await crabStrategyV1.balanceOf(crabMigration.address);
            const d2SharesDeposited  = await crabMigration.sharesDeposited(d2.address);

            expect(crabV1BalanceAfter.sub(crabV1BalanceBefore)).to.be.equal(deposit2Amount);
            expect(d2SharesDeposited).to.be.equal(deposit2Amount);
        })

        it("d2 withdraws more shares than they have deposited crabV1 shares", async () => { 
            await expect(crabMigration.connect(d2).withdrawV1Shares(deposit2Amount.mul(2))).to.be.revertedWith("ds-math-sub-underflow");
        })

        it("d2 withdraws 50% of crabV1 shares", async () => { 
            const crabV1BalanceBefore = await crabStrategyV1.balanceOf(crabMigration.address); 

            await crabMigration.connect(d2).withdrawV1Shares(deposit2Amount.div(2));

            const crabV1BalanceAfter = await crabStrategyV1.balanceOf(crabMigration.address);
            const d2SharesDeposited  = await crabMigration.sharesDeposited(d2.address);

            expect(crabV1BalanceBefore.sub(crabV1BalanceAfter)).to.be.equal(deposit2Amount.div(2));
            expect(d2SharesDeposited).to.be.equal(deposit2Amount.sub(deposit2Amount.div(2)));
        })


        it("should not be able to claim until strategy has been migrated", async () => { 
            await expect(crabMigration.connect(d1).claimV2Shares()).to.be.revertedWith("M2");
        })

        it("random should not be able to call onDeferredLiquidity()", async () => { 
            const data = "0x0000000000000000000000000000000000000000"
            await expect((crabMigration.connect(random).onDeferredLiquidityCheck(data))).to.be.revertedWith("M3");
        })

        it("random should not be able to migrate shares", async () => { 
            await expect(crabMigration.connect(random).batchMigrate(1)).to.be.revertedWith("Ownable: caller is not the owner");
        })

        it("batchMigrate", async () => { 
            await crabMigration.connect(owner).batchMigrate(1);
        })
    })


})