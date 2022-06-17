import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { ethers } from "hardhat"
import { expect } from "chai";
import { BigNumber, providers } from "ethers";
import { MockCrab, CrabMigration} from "../../../typechain";
import { isSimilar, wmul, wdiv, one, oracleScaleFactor } from "../../utils"

describe("Crab Migration", function () {
 
    let crabStrategyV1: MockCrab;
    let crabStrategyV2: MockCrab;
    let crabMigration: CrabMigration;

    let provider: providers.JsonRpcProvider;
    let owner: SignerWithAddress;
    let random: SignerWithAddress;
    let d1: SignerWithAddress;
    let d2: SignerWithAddress;

    const deposit1Amount = ethers.utils.parseEther("10.0");
    const deposit2Amount = ethers.utils.parseEther("90.0");

    this.beforeAll("Prepare accounts", async () => {
        const accounts = await ethers.getSigners();
        const [_owner, _d1, _random, _d2] = accounts;
        d1 = _d1
        d2 = _d2
        random = _random
        owner = _owner
        provider = ethers.provider
    })
    
    this.beforeAll("Setup Mock Crabs", async () => {
        const CrabContract = await ethers.getContractFactory("MockCrab");
        crabStrategyV1 = (await CrabContract.deploy("CrabV1", "CrabV1", 18)) as MockCrab;
        crabStrategyV2 = (await CrabContract.deploy("CrabV2", "CrabV2", 18)) as MockCrab;

        await crabStrategyV1.mint(d1.address, deposit1Amount);
        await crabStrategyV1.mint(d2.address, deposit2Amount);
    })

    this.beforeAll("Deploy Migration Crab", async () => { 
        const MigrationContract = await ethers.getContractFactory("CrabMigration");
        crabMigration = (await MigrationContract.deploy(crabStrategyV1.address, crabStrategyV2.address));
    })

    describe("Test Migration", async() => { 

        it("d1 deposits crabV1 shares", async () => { 
            const crabV1BalanceBefore = await crabStrategyV1.balanceOf(crabMigration.address); 

            await crabStrategyV1.connect(d1).approve(crabMigration.address, deposit1Amount);
            await crabMigration.connect(d1).depositV1Shares(deposit1Amount);

            const crabV1BalanceAfter = await crabStrategyV1.balanceOf(crabMigration.address);
            const d1SharesDeposited  = await crabMigration.sharesDeposited(d1.address);

            expect(crabV1BalanceBefore).to.be.equal('0');
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
    })


})