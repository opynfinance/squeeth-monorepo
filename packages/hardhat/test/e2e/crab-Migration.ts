import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { ethers } from "hardhat"
import { expect } from "chai";
import { BigNumber, providers } from "ethers";
import { CrabStrategy, CrabStrategyV2, CrabMigration, IEulerDToken, WETH9, MockEulerDToken, IEulerExec } from "../../typechain";
import { isSimilar, wmul, wdiv, one, oracleScaleFactor } from "../utils"

describe("Crab Migration", function () {

    let crabStrategyV1: CrabStrategy;
    let crabStrategyV2: CrabStrategyV2
    let crabMigration: CrabMigration;

    let weth: WETH9;
    let dToken: IEulerDToken;
    let eulerExec: IEulerExec;

    let provider: providers.JsonRpcProvider;
    let owner: SignerWithAddress;
    let random: SignerWithAddress;
    let d1: SignerWithAddress;
    let d2: SignerWithAddress;

    const eulerMainnetAddress = "0x27182842E098f60e3D576794A5bFFb0777E025d3";
    const eulerExecAddress = "0x59828FdF7ee634AaaD3f58B19fDBa3b03E2D9d80";
    const dTokenAddress = "0x62e28f054efc24b26A794F5C1249B6349454352C";
    const wethAddress = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
    const crabV1Address = "0xf205ad80BB86ac92247638914265887A8BAa437D";
    const crabV1Whale = "0x7ba50e6f1fc2bddfaad95b6bb9947949a588a038";
    const crabV1Whale2 = "0x8b08a0a2e1bb7160fa0263abd28cd2d22f18943c";
    const squeethControllerAddress = "0x64187ae08781B09368e6253F9E94951243A493D5";
    const oracleAddress = "0x65D66c76447ccB45dAf1e8044e918fA786A483A1";
    const uniswapFactoryAddress = "0x1F98431c8aD98523631AE4a59f267346ea31F984";
    const wethOsqthPoolAddress = "0x82c427AdFDf2d245Ec51D8046b41c4ee87F0d29C";

    let deposit1Amount: BigNumber
    let deposit2Amount: BigNumber

    this.beforeAll("Prepare accounts", async () => {
        const accounts = await ethers.getSigners();
        const [_owner, _d1, _random, _d2] = accounts;
        d1 = _d1
        d2 = _d2
        random = _random
        owner = _owner
        provider = ethers.provider
    })

    this.beforeAll("Setup environment", async () => {
        weth = await ethers.getContractAt("WETH9", wethAddress);
        dToken = await ethers.getContractAt("IEulerDToken", dTokenAddress);
        eulerExec = await ethers.getContractAt("IEulerExec", eulerExecAddress);
        crabStrategyV1 = await ethers.getContractAt("CrabStrategy", crabV1Address);

        deposit1Amount = await crabStrategyV1.balanceOf(crabV1Whale);
        deposit2Amount = await crabStrategyV1.balanceOf(crabV1Whale2);

        // Send Crab shares to d1
        await provider.send('hardhat_impersonateAccount', [crabV1Whale]);
        const signer1 = await ethers.provider.getSigner(crabV1Whale);
        await crabStrategyV1.connect(signer1).transfer(d1.address, deposit1Amount);
        await provider.send('evm_mine', []);
        await provider.send('hardhat_stopImpersonatingAccount', [crabV1Whale]);

        // Send Crab shares to d2
        await provider.send('hardhat_impersonateAccount', [crabV1Whale2]);
        const signer2 = await ethers.provider.getSigner(crabV1Whale2);
        await crabStrategyV1.connect(signer2).transfer(d2.address, deposit2Amount);
        await provider.send('evm_mine', []);
        await provider.send('hardhat_stopImpersonatingAccount', [crabV1Whale2]);

    })

    this.beforeAll("Deploy Crab 2", async () => {
        const CrabContract = await ethers.getContractFactory("CrabStrategyV2");
        crabStrategyV2 = (await CrabContract.deploy(
            squeethControllerAddress,
            oracleAddress,
            wethAddress,
            uniswapFactoryAddress,
            wethOsqthPoolAddress,
            random.address,
            1,
            1,
            1,
            1,
            ethers.utils.parseEther("10.0"))) as CrabStrategyV2;

        await crabStrategyV2.setStrategyCap(ethers.utils.parseEther("1000.0"));
    })

    this.beforeAll("Deploy Crab Migration", async () => {
        const MigrationContract = await ethers.getContractFactory("CrabMigration");
        crabMigration = (await MigrationContract.deploy(crabV1Address, crabStrategyV2.address, wethAddress, eulerExecAddress, dTokenAddress, eulerMainnetAddress)) as CrabMigration;
    })

    describe("Test Migration", async () => {

        it("d1 deposits crabV1 shares", async () => {
            const crabV1BalanceBefore = await crabStrategyV1.balanceOf(crabMigration.address);

            await crabStrategyV1.connect(d1).approve(crabMigration.address, deposit1Amount);
            await crabMigration.connect(d1).depositV1Shares(deposit1Amount);

            const crabV1BalanceAfter = await crabStrategyV1.balanceOf(crabMigration.address);
            const d1SharesDeposited = await crabMigration.sharesDeposited(d1.address);

            expect(crabV1BalanceBefore).to.be.equal('0');
            expect(crabV1BalanceAfter).to.be.equal(deposit1Amount);
            expect(d1SharesDeposited).to.be.equal(deposit1Amount);
        })

        it("d2 deposits crabV1 shares", async () => {
            const crabV1BalanceBefore = await crabStrategyV1.balanceOf(crabMigration.address);

            await crabStrategyV1.connect(d2).approve(crabMigration.address, deposit2Amount);
            await crabMigration.connect(d2).depositV1Shares(deposit2Amount);

            const crabV1BalanceAfter = await crabStrategyV1.balanceOf(crabMigration.address);
            const d2SharesDeposited = await crabMigration.sharesDeposited(d2.address);

            expect(crabV1BalanceAfter.sub(crabV1BalanceBefore)).to.be.equal(deposit2Amount);
            expect(d2SharesDeposited).to.be.equal(deposit2Amount);
        })

        it("should not be able to claim until strategy has been migrated", async () => {
            await expect(crabMigration.connect(d1).claimV2Shares()).to.be.revertedWith("M3");
        })

        it("batch migrate", async () => {
            const crabV1SharesBalanceBefore = await crabStrategyV1.balanceOf(crabMigration.address);
            const crabV1SupplyBefore = await crabStrategyV1.totalSupply();
            const crabV2SupplyBefore = await crabStrategyV2.totalSupply();
            const crabV1VaultDetailsBefore = await crabStrategyV1.getVaultDetails();
            const crabV2VaultDetailsBefore = await crabStrategyV2.getVaultDetails();

            await crabMigration.batchMigrate();

            // 1. check crab V1 shares in Migration before and after
            const crabV1SharesBalanceAfter = await crabStrategyV1.balanceOf(crabMigration.address);
            expect(crabV1SharesBalanceAfter).to.be.equal('0');

            // 2. check that crab v1 total supply has gone down and crab v2 total supply has increased
            const crabV1SupplyAfter = await crabStrategyV1.totalSupply();
            const changeInCrabV1Supply = crabV1SupplyBefore.sub(crabV1SupplyAfter);
            const crabV2SupplyAfter = await crabStrategyV2.totalSupply();
            const changeInCrabV2Supply = crabV2SupplyAfter.sub(crabV2SupplyBefore);

            expect(changeInCrabV1Supply).to.be.equal(crabV1SharesBalanceBefore);
            expect(crabV2SupplyBefore).to.be.equal('0');
            //    expect(changeInCrabV2Supply).to.be.equal(changeInCrabV1Supply);

            // 3. check that eth taken out of crab v1 matches eth deposited into crab v2
            const crabV1VaultDetailsAfter = await crabStrategyV1.getVaultDetails();
            const crabV2VaultDetailsAfter = await crabStrategyV2.getVaultDetails();

            const ethAmountRemovedFromCrabV1 = crabV1VaultDetailsBefore[2].sub(crabV1VaultDetailsAfter[2])
            const ethAmountDepositedToCrabV2 = crabV2VaultDetailsAfter[2].sub(crabV2VaultDetailsBefore[2]);

            expect(ethAmountDepositedToCrabV2).to.be.equal(ethAmountRemovedFromCrabV1);

            // 4. check that oSqth amt minted in crab v1 matches oSqth amt minted in crab v2
            const oSqthDebtPaidCrabV1 = crabV1VaultDetailsBefore[3].sub(crabV1VaultDetailsAfter[3])
            const oSqthMintedCrabV2 = crabV2VaultDetailsAfter[3].sub(crabV2VaultDetailsBefore[3]);

            expect(oSqthDebtPaidCrabV1).to.be.equal(oSqthMintedCrabV2);

            // 5. check that crab v2 is now initialized
            const isInitialized = await crabStrategyV2.isInitialized();
            expect(isInitialized).to.be.true;
        })

        it("d1 claims shares", async () => {
            const constractSharesBefore = await crabStrategyV2.balanceOf(crabMigration.address);
            const d1SharesBefore = await crabStrategyV2.balanceOf(d1.address);

            await crabMigration.connect(d1).claimV2Shares();

            // 1. check that shares sent from migration contract equals shares received by user
            const constractSharesAfter = await crabStrategyV2.balanceOf(crabMigration.address);
            const d1SharesAfter = await crabStrategyV2.balanceOf(d1.address);
            const sharesSent = constractSharesBefore.sub(constractSharesAfter);

            expect(d1SharesBefore).to.be.equal('0');
            expect(d1SharesAfter.sub(d1SharesBefore)).to.be.equal(sharesSent);

            // 2. check that the right amount of shares have been sent. 
            const totalV2SharesReceived = await crabMigration.totalCrabV2SharesReceived();
            const totalDepositAmount = deposit1Amount.add(deposit2Amount);
            const expectedSharesSent = deposit1Amount.mul(totalV2SharesReceived).div(totalDepositAmount);
            expect(expectedSharesSent).to.be.equal(sharesSent);
        })

        it("Should not able to claim more than their share", async () => {
            const d2sharesInMigrationBefore = await crabMigration.sharesDeposited(d2.address)

            const d2sharesToMigrate = d2sharesInMigrationBefore.mul(2)
            await expect(crabMigration.connect(d2).claimAndWithdraw(d2sharesToMigrate, ethers.constants.MaxInt256)).to.be.revertedWith("M6") // Set ETH slippage higher!
        })

        it("d2 Claim and flash withdraw 50 percent of tokens", async () => {
            const constractSharesBefore = await crabStrategyV2.balanceOf(crabMigration.address);
            const d2sharesInMigrationBefore = await crabMigration.sharesDeposited(d2.address)

            const d2sharesToMigrate = wdiv(d2sharesInMigrationBefore, one.mul(2))
            await crabMigration.connect(d2).claimAndWithdraw(d2sharesToMigrate, ethers.constants.MaxInt256) // Set ETH slippage higher!
            const d2sharesInMigrationAfter = await crabMigration.sharesDeposited(d2.address)
            const constractSharesAfter = await crabStrategyV2.balanceOf(crabMigration.address);


            const totalDepositAmount = deposit1Amount.add(deposit2Amount);
            const totalV2SharesReceived = await crabMigration.totalCrabV2SharesReceived();
            const expectedSharesWithdraw = d2sharesToMigrate.mul(totalV2SharesReceived).div(totalDepositAmount);
            expect(d2sharesInMigrationAfter).to.be.equal(d2sharesInMigrationBefore.sub(d2sharesToMigrate))
            expect(constractSharesAfter).to.be.equal(constractSharesBefore.sub(expectedSharesWithdraw))
        })

        it("d2 Claim and flash withdraw 100 percent of the tokens", async () => {
            const d2sharesInMigrationBefore = await crabMigration.sharesDeposited(d2.address)

            await crabMigration.connect(d2).claimAndWithdraw(d2sharesInMigrationBefore, ethers.constants.MaxInt256) // Set ETH slippage higher!
            const d2sharesInMigrationAfter = await crabMigration.sharesDeposited(d2.address)

            expect(d2sharesInMigrationAfter).to.be.equal("0")
        })

        it("d1 should not be able to deposit after migration", async () => {
            await expect(crabMigration.connect(d1).depositV1Shares(deposit1Amount)).to.be.revertedWith("M2");
        })
    })
})