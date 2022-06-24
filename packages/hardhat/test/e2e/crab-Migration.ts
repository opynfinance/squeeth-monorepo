import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { ethers } from "hardhat"
import { expect } from "chai";
import { BigNumber, providers } from "ethers";
import { CrabStrategy, CrabStrategyV2, CrabMigration, IDToken, WETH9, IEulerExec, Timelock, Oracle } from "../../typechain";

import { isSimilar, wmul, wdiv, one, oracleScaleFactor } from "../utils"

describe("Crab Migration", function () {
    if (!process.env.MAINNET_FORK) return;

    let crabStrategyV1: CrabStrategy;
    let crabStrategyV2: CrabStrategyV2
    let crabMigration: CrabMigration;
    let controller: Controller;
    let oracle: Oracle;

    let weth: WETH9;
    let dToken: IDToken;
    let eulerExec: IEulerExec;

    let provider: providers.JsonRpcProvider;
    let owner: SignerWithAddress;
    let random: SignerWithAddress;
    let d1: SignerWithAddress;
    let d2: SignerWithAddress;
    let d3: SignerWithAddress;
    let d4: SignerWithAddress;
    let d5: SignerWithAddress;


    let timelock: Timelock;

    const eulerMainnetAddress = "0x27182842E098f60e3D576794A5bFFb0777E025d3";
    const eulerExecAddress = "0x59828FdF7ee634AaaD3f58B19fDBa3b03E2D9d80";
    const dTokenAddress = "0x62e28f054efc24b26A794F5C1249B6349454352C";
    const wethAddress = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
    const crabV1Address = "0xf205ad80BB86ac92247638914265887A8BAa437D";
    const crabV1Whale = "0x7ba50e6f1fc2bddfaad95b6bb9947949a588a038";
    const crabV1Whale2 = "0x8b08a0a2e1bb7160fa0263abd28cd2d22f18943c";
    const crabV1Whale3 = "0x52b768d3487686fb75902c38f794ffc1843e0a43";
    const crabV1Whale4 = "0x5599b4eaddd319e2f462b27fc8378b0bfad309ca";
    const crabV1Whale5 = "0x1f5be3c931deb102a9e2c489c8abd074a6450e1a";
    const squeethControllerAddress = "0x64187ae08781B09368e6253F9E94951243A493D5";
    const oracleAddress = "0x65D66c76447ccB45dAf1e8044e918fA786A483A1";
    const uniswapFactoryAddress = "0x1F98431c8aD98523631AE4a59f267346ea31F984";
    const wethOsqthPoolAddress = "0x82c427AdFDf2d245Ec51D8046b41c4ee87F0d29C";
    const squeethAddress = "0xf1b99e3e573a1a9c5e6b2ce818b617f0e664e86b";


    let totalV2SharesReceived: BigNumber
    let totalCrabV1SharesMigrated: BigNumber

    let deposit1Amount: BigNumber
    let deposit2Amount: BigNumber
    let deposit3Amount: BigNumber
    let deposit4Amount: BigNumber
    let deposit5Amount: BigNumber

    this.beforeAll("Prepare accounts", async () => {
        const accounts = await ethers.getSigners();
        const [_owner, _d1, _random, _d2, _d3, _d4, _d5] = accounts;
        d1 = _d1
        d2 = _d2
        d3 = _d3
        d4 = _d4
        d5 = _d5
        random = _random
        owner = _owner
        provider = ethers.provider
    })

    this.beforeAll("Setup environment", async () => {
        weth = await ethers.getContractAt("WETH9", wethAddress);
        dToken = await ethers.getContractAt("IDToken", dTokenAddress);
        eulerExec = await ethers.getContractAt("IEulerExec", eulerExecAddress);
        crabStrategyV1 = await ethers.getContractAt("CrabStrategy", crabV1Address);
        controller = await ethers.getContractAt("Controller", squeethControllerAddress);
        oracle = await ethers.getContractAt("Oracle", oracleAddress);

        deposit1Amount = await crabStrategyV1.balanceOf(crabV1Whale);
        deposit2Amount = await crabStrategyV1.balanceOf(crabV1Whale2);
        deposit3Amount = await crabStrategyV1.balanceOf(crabV1Whale3);
        deposit4Amount = await crabStrategyV1.balanceOf(crabV1Whale4);
        deposit5Amount = await crabStrategyV1.balanceOf(crabV1Whale5);

        // Send Crab shares to d1
        await provider.send('hardhat_impersonateAccount', [crabV1Whale]);
        const signer1 = ethers.provider.getSigner(crabV1Whale);
        await crabStrategyV1.connect(signer1).transfer(d1.address, deposit1Amount);
        await provider.send('evm_mine', []);
        await provider.send('hardhat_stopImpersonatingAccount', [crabV1Whale]);

        // Send Crab shares to d2
        await provider.send('hardhat_impersonateAccount', [crabV1Whale2]);
        const signer2 = ethers.provider.getSigner(crabV1Whale2);
        await crabStrategyV1.connect(signer2).transfer(d2.address, deposit2Amount);
        await provider.send('evm_mine', []);
        await provider.send('hardhat_stopImpersonatingAccount', [crabV1Whale2]);

        // Send crab shares to d3
        await provider.send('hardhat_impersonateAccount', [crabV1Whale3]);
        const signer3 = ethers.provider.getSigner(crabV1Whale3);
        await crabStrategyV1.connect(signer3).transfer(d3.address, deposit3Amount);
        await provider.send('evm_mine', []);
        await provider.send('hardhat_stopImpersonatingAccount', [crabV1Whale3]);

        // Send crab shares to d4
        await owner.sendTransaction({ to: crabV1Whale4, value: ethers.utils.parseEther('.1') })
        await provider.send('hardhat_impersonateAccount', [crabV1Whale4]);
        const signer4 = ethers.provider.getSigner(crabV1Whale4);
        await crabStrategyV1.connect(signer4).transfer(d4.address, deposit4Amount);
        await provider.send('evm_mine', []);
        await provider.send('hardhat_stopImpersonatingAccount', [crabV1Whale4]);

        // Send crab shares to d5
        await owner.sendTransaction({ to: crabV1Whale5, value: ethers.utils.parseEther('.1') })
        await provider.send('hardhat_impersonateAccount', [crabV1Whale5]);
        const signer5 = ethers.provider.getSigner(crabV1Whale5);
        await crabStrategyV1.connect(signer5).transfer(d5.address, deposit5Amount);
        await provider.send('evm_mine', []);
        await provider.send('hardhat_stopImpersonatingAccount', [crabV1Whale5]);
    })

    this.beforeAll("Deploy Crab Migration", async () => {
        const MigrationContract = await ethers.getContractFactory("CrabMigration");
        crabMigration = (await MigrationContract.deploy(crabV1Address, wethAddress, eulerExecAddress, dTokenAddress, eulerMainnetAddress)) as CrabMigration;
    })

    this.beforeAll("Deploy Crab 2", async () => {
        const TimelockContract = await ethers.getContractFactory("Timelock");
        timelock = (await TimelockContract.deploy(owner.address, 3 * 24 * 60 * 60)) as Timelock;
        const CrabContract = await ethers.getContractFactory("CrabStrategyV2");
        crabStrategyV2 = (await CrabContract.deploy(
            squeethControllerAddress,
            oracleAddress,
            wethAddress,
            uniswapFactoryAddress,
            wethOsqthPoolAddress,
            timelock.address,
            crabMigration.address,
            1,
            1)) as CrabStrategyV2;
        await crabStrategyV2.setStrategyCap(ethers.utils.parseEther("1000.0"));
        await crabMigration.connect(owner).setCrabV2(crabStrategyV2.address);
    })


    this.beforeEach("Set migration values", async () => {
        totalV2SharesReceived = await crabMigration.totalCrabV2SharesReceived();
        totalCrabV1SharesMigrated = await crabMigration.totalCrabV1SharesMigrated();
    })

    const getV2SqthAndEth = async (share: BigNumber) => {
        const [, , eth, sqth] = await crabStrategyV2.getVaultDetails();
        const supply = await crabStrategyV2.totalSupply();
        const userEth = wdiv(wmul(share, eth), supply)
        const userSqth = wdiv(wmul(share, sqth), supply)

        return [userEth, userSqth]
    }

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

        it("Should not be able to flash migrate until strategy is migrated", async () => {
            await expect(crabMigration.connect(d3).flashMigrateFromV1toV2(0, 0, 0)).to.be.revertedWith("M3")
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
            expect(changeInCrabV2Supply).to.be.equal(changeInCrabV1Supply);

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
            totalV2SharesReceived = await crabMigration.totalCrabV2SharesReceived();
            const totalDepositAmount = deposit1Amount.add(deposit2Amount);
            const expectedSharesSent = deposit1Amount.mul(totalV2SharesReceived).div(totalDepositAmount);
            expect(expectedSharesSent).to.be.equal(sharesSent);
        })

        it("Should not able to claim more than their share", async () => {
            const d2sharesInMigrationBefore = await crabMigration.sharesDeposited(d2.address)

            const d2sharesV2ToMigrate = wdiv(wmul(d2sharesInMigrationBefore, totalCrabV1SharesMigrated), totalV2SharesReceived).add(1)

            await expect(crabMigration.connect(d2).claimAndWithdraw(d2sharesV2ToMigrate, ethers.constants.MaxUint256)).to.be.revertedWith("M6") // Set ETH slippage higher!
        })

        it("d2 Claim and flash withdraw 50 percent of tokens", async () => {
            const constractSharesBefore = await crabStrategyV2.balanceOf(crabMigration.address);
            const d2sharesInMigrationBefore = await crabMigration.sharesDeposited(d2.address);
            const d2EthBalanceBefore = await provider.getBalance(d2.address);

            const d2sharesV1ToMigrate = wdiv(d2sharesInMigrationBefore, one.mul(2))
            const d2sharesV2ToMigrate = wdiv(wmul(d2sharesV1ToMigrate, totalCrabV1SharesMigrated), totalV2SharesReceived)

            const [ethToGet, sqthToSell] = await getV2SqthAndEth(d2sharesV2ToMigrate);
            const sqthPrice = await oracle.getTwap(wethOsqthPoolAddress, squeethAddress, wethAddress, 1, false)

            const ethSpentToBuyBack = wdiv(wmul(wmul(sqthToSell, sqthPrice), BigNumber.from(105)), BigNumber.from(100))

            await crabMigration.connect(d2).claimAndWithdraw(d2sharesV2ToMigrate, ethSpentToBuyBack) // Set ETH slippage higher!
            const d2sharesInMigrationAfter = await crabMigration.sharesDeposited(d2.address)
            const constractSharesAfter = await crabStrategyV2.balanceOf(crabMigration.address);
            const d2EthBalanceAfter = await provider.getBalance(d2.address);

            expect(d2sharesInMigrationAfter).to.be.equal(d2sharesInMigrationBefore.sub(d2sharesV1ToMigrate))
            expect(constractSharesAfter).to.be.equal(constractSharesBefore.sub(d2sharesV2ToMigrate))
            // Check if minimum ETH is returned
            expect(d2EthBalanceAfter.sub(d2EthBalanceBefore).gte(ethToGet.sub(ethSpentToBuyBack))).to.be.true
        })

        it("d2 Claim and flash withdraw 100 percent of the tokens", async () => {
            const constractSharesBefore = await crabStrategyV2.balanceOf(crabMigration.address);
            const d2sharesInMigrationBefore = await crabMigration.sharesDeposited(d2.address)
            const d2sharesV2ToMigrate = wdiv(wmul(d2sharesInMigrationBefore, totalCrabV1SharesMigrated), totalV2SharesReceived)
            const d2EthBalanceBefore = await provider.getBalance(d2.address);

            const [ethToGet, sqthToSell] = await getV2SqthAndEth(d2sharesV2ToMigrate);
            const sqthPrice = await oracle.getTwap(wethOsqthPoolAddress, squeethAddress, wethAddress, 1, false)
            const ethSpentToBuyBack = wdiv(wmul(wmul(sqthToSell, sqthPrice), BigNumber.from(105)), BigNumber.from(100))


            await crabMigration.connect(d2).claimAndWithdraw(d2sharesV2ToMigrate, ethSpentToBuyBack) // Set ETH slippage higher!
            const d2sharesInMigrationAfter = await crabMigration.sharesDeposited(d2.address)
            const constractSharesAfter = await crabStrategyV2.balanceOf(crabMigration.address);
            const d2EthBalanceAfter = await provider.getBalance(d2.address);

            expect(d2sharesInMigrationAfter).to.be.equal("0")
            expect(constractSharesAfter).to.be.equal(constractSharesBefore.sub(d2sharesV2ToMigrate))
            // Check if minimum ETH is returned
            expect(d2EthBalanceAfter.sub(d2EthBalanceBefore).gte(ethToGet.sub(ethSpentToBuyBack))).to.be.true
        })

        it("d1 should not be able to deposit after migration", async () => {
            await expect(crabMigration.connect(d1).depositV1Shares(deposit1Amount)).to.be.revertedWith("M2");
        })
    })

    describe("Individual claim after migration", () => {
        let vaultIdV1: BigNumber
        let collatV1: BigNumber
        let collatV2: BigNumber
        let shortV1: BigNumber
        let shortV2: BigNumber
        let crabV1Supply: BigNumber
        let crabV2Supply: BigNumber
        let crabV1SharesBefore: BigNumber
        let crabV2ShareBefore: BigNumber
        let userEthBalance: BigNumber

        const initialize = async (address: string) => {
            vaultIdV1 = await crabStrategyV1.vaultId();
            [, , collatV1, shortV1] = await crabStrategyV1.getVaultDetails();
            [, , collatV2, shortV2] = await crabStrategyV2.getVaultDetails();
            crabV1Supply = await crabStrategyV1.totalSupply()
            crabV2Supply = await crabStrategyV2.totalSupply()
            crabV1SharesBefore = await crabStrategyV1.balanceOf(address)
            crabV2ShareBefore = await crabStrategyV2.balanceOf(address)
            userEthBalance = await provider.getBalance(address)
        }

        const increaseCR1 = async () => {
            // Set ETH to crab contract and use that ETH deposit collat to increase CR1
            await provider.send("hardhat_setBalance", [crabStrategyV1.address, ethers.utils.parseEther('11').toHexString()])
            await provider.send("hardhat_impersonateAccount", [crabStrategyV1.address]);

            const signer = ethers.provider.getSigner(crabStrategyV1.address);
            await controller.connect(signer).deposit(vaultIdV1, { value: ethers.utils.parseEther('10') })

            await provider.send("hardhat_setBalance", [crabStrategyV1.address, "0x0"])
            await provider.send('evm_mine', []);
            await provider.send('hardhat_stopImpersonatingAccount', [crabStrategyV1.address]);

            [, , collatV1, shortV1] = await crabStrategyV1.getVaultDetails();
            [, , collatV2, shortV2] = await crabStrategyV2.getVaultDetails();
        }

        const decreaseCR1 = async () => {
            // Withdraw from crabv1's vault to decrease CR1
            await provider.send("hardhat_setBalance", [crabStrategyV1.address, ethers.utils.parseEther('10').toHexString()]) // Gas
            await provider.send("hardhat_impersonateAccount", [crabStrategyV1.address]);

            const signer = ethers.provider.getSigner(crabStrategyV1.address);
            await controller.connect(signer).withdraw(vaultIdV1, ethers.utils.parseEther("10"))

            await provider.send("hardhat_setBalance", [crabStrategyV1.address, "0x0"])
            await provider.send('evm_mine', []);
            await provider.send('hardhat_stopImpersonatingAccount', [crabStrategyV1.address]);

            [, , collatV1, shortV1] = await crabStrategyV1.getVaultDetails();
            [, , collatV2, shortV2] = await crabStrategyV2.getVaultDetails();
        }

        it("Should migrate d3 when CR1 = CR2", async () => {
            await initialize(d3.address)
            const expectedCollatToDeposit = crabV1SharesBefore.mul(collatV1).div(crabV1Supply)
            const expectedV2Shares = expectedCollatToDeposit.mul(crabV2Supply).div(collatV2)

            expect(wdiv(collatV1, shortV1)).to.be.equal(wdiv(collatV2, shortV2))
            await crabStrategyV1.connect(d3).approve(crabMigration.address, crabV1SharesBefore);
            await crabMigration.connect(d3).flashMigrateFromV1toV2(0, 0, 0);

            const crabV1SharesAfter = await crabStrategyV1.balanceOf(d3.address)
            const crabV2SharesAfter = await crabStrategyV2.balanceOf(d3.address)
            const crabV1SharesInMigration = await crabStrategyV1.balanceOf(crabMigration.address)
            const [, , collatV2After] = await crabStrategyV2.getVaultDetails();

            expect(crabV1SharesAfter.eq(0)).to.be.true
            expect(crabV1SharesInMigration.eq(0)).to.be.true
            expect(isSimilar(expectedV2Shares.add(crabV2ShareBefore).toString(), crabV2SharesAfter.toString())).to.be.true
            expect(isSimilar(collatV2.add(expectedCollatToDeposit).toString(), collatV2After.toString())).to.be.true
        })

        it("Should migrate d4 when CR1 > CR2", async () => {
            await initialize(d4.address)
            await increaseCR1()
            const [isFlashMigrate, ethNeededForV2, v1oSqthToPay, ethToGetFromV1] = await crabMigration.flashMigrationDetails(d4.address)

            expect(wdiv(collatV1, shortV1).gt(wdiv(collatV2, shortV2))).to.be.true
            expect(isFlashMigrate).to.be.true
            expect(ethToGetFromV1.gt(ethNeededForV2)).to.be.true

            const excessEth = ethToGetFromV1.sub(ethNeededForV2)
            const ethToFlashDeposit = excessEth.mul(180).div(100) // 1.8 times Something smaller than 2

            await crabStrategyV1.connect(d4).approve(crabMigration.address, crabV1SharesBefore);
            await crabMigration.connect(d4).flashMigrateFromV1toV2(ethToFlashDeposit, 0, 0);

            const crabV1SharesAfter = await crabStrategyV1.balanceOf(d4.address)
            const crabV2SharesAfter = await crabStrategyV2.balanceOf(d4.address)
            const crabV1SharesInMigration = await crabStrategyV1.balanceOf(crabMigration.address)
            const userEthBalanceAfter = await provider.getBalance(d4.address)

            expect(crabV1SharesAfter.eq(0)).to.be.true
            expect(crabV1SharesInMigration.eq(0)).to.be.true
            expect(crabV2SharesAfter.gte(crabV2SharesAfter)).to.be.true // There will lil more crab because of the flash deposit
            expect(userEthBalanceAfter.gt(userEthBalance)).to.be.true // Unused ETH from flash deposit will be returned
        })

        it("Should migrate d5 when CR1 < CR2", async () => {
            await initialize(d5.address)
            await decreaseCR1()
            const [isFlashMigrate, ethNeededForV2, v1oSqthToPay, ethToGetFromV1] = await crabMigration.flashMigrationDetails(d5.address)

            expect(wdiv(collatV1, shortV1).gt(wdiv(collatV2, shortV2))).to.be.false
            expect(isFlashMigrate).to.be.false
            expect(ethToGetFromV1.gt(ethNeededForV2)).to.be.false

            const oSqthPrice = await oracle.getTwap(wethOsqthPoolAddress, oSqthAddress, wethAddress, 1, false)

            const numerator = ethToGetFromV1.sub(wmul(v1oSqthToPay, oSqthPrice).mul(101).div(100)) // 1% slippage
            const denominator = one.sub(wdiv(oSqthPrice.mul(101).div(100), wdiv(collatV2, shortV2)))
            const ethToFlashLoan = wdiv(numerator, denominator)
            const expectedSqthFromV2 = wdiv(wmul(ethToFlashLoan, shortV2), collatV2)
            const v1SqthToFlashWithdraw = v1oSqthToPay.sub(expectedSqthFromV2)
            const maxEthToPay = wmul(v1SqthToFlashWithdraw, oSqthPrice).mul(101).div(100) // 1% slippage        

            await crabStrategyV1.connect(d5).approve(crabMigration.address, ethers.constants.MaxUint256);
            await expect(crabMigration.connect(d5).flashMigrateFromV1toV2(one, 0, 0)).to.be.revertedWith("M8");
            await expect(crabMigration.connect(d5).flashMigrateFromV1toV2(one, one, 0)).to.be.revertedWith("M8");
            await expect(crabMigration.connect(d5).flashMigrateFromV1toV2(one, 0, one)).to.be.revertedWith("M8");
            // Don't flash deposit and return back ETH. For the sake of simplicity. Flash deposit is already tested in previous tests
            await crabMigration.connect(d5).flashMigrateFromV1toV2(0, ethToFlashLoan, maxEthToPay)

            const crabV1SharesAfter = await crabStrategyV1.balanceOf(d5.address)
            const crabV1SharesInMigration = await crabStrategyV1.balanceOf(crabMigration.address)

            expect(crabV1SharesAfter.eq(0)).to.be.true
            expect(crabV1SharesInMigration.eq(0)).to.be.true
        })
    })
})