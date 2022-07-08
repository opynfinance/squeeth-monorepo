// ALCHEMY_KEY=XXXXXXXXX yarn test:e2e
// ALCHEMY_KEY=XXXXXXXX yarn test:e2e test/e2e/crab-Migration.ts

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { ethers } from "hardhat"
import { expect } from "chai";
import { BigNumber, providers } from "ethers";
import { Controller, CrabStrategy, CrabStrategyV2, CrabMigration, IDToken, WETH9, IEulerExec, Timelock, Oracle, WPowerPerp } from "../../typechain";

import { wmul, wdiv, one, getGasPaid } from "../utils"

describe("Crab Migration", function () {
    if (!process.env.MAINNET_FORK) return;

    let crabStrategyV1: CrabStrategy;
    let crabStrategyV2: CrabStrategyV2
    let crabMigration: CrabMigration;
    let controller: Controller;
    let oracle: Oracle;
    let oSqth: WPowerPerp

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
        oSqth = await ethers.getContractAt("WPowerPerp", squeethAddress);

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
            await expect(crabMigration.connect(d1).claimV2Shares()).to.be.revertedWith("M2");
        })

        it("Should not be able to flash migrate until strategy is migrated", async () => {
            await expect(crabMigration.connect(d3).flashMigrateFromV1toV2(0, await crabStrategyV1.balanceOf(d3.address))).to.be.revertedWith("M2")
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
            const totalDepositAmount = deposit1Amount.add(deposit2Amount);
            const expectedSharesSent = deposit1Amount;
            expect(expectedSharesSent).to.be.equal(sharesSent);
        })

        it("Should not able to claim more than their share", async () => {
            const d2sharesInMigrationBefore = await crabMigration.sharesDeposited(d2.address)

            const d2sharesV2ToMigrate = d2sharesInMigrationBefore.add(1);

            await expect(crabMigration.connect(d2).claimAndWithdraw(d2sharesV2ToMigrate, ethers.constants.MaxUint256)).to.be.revertedWith("M5") // Set ETH slippage higher!
        })

        it("d2 Claim and flash withdraw 50 percent of tokens", async () => {
            const constractSharesBefore = await crabStrategyV2.balanceOf(crabMigration.address);
            const d2sharesInMigrationBefore = await crabMigration.sharesDeposited(d2.address);
            const d2EthBalanceBefore = await provider.getBalance(d2.address);

            const d2sharesV1ToMigrate = wdiv(d2sharesInMigrationBefore, one.mul(2))
            const d2sharesV2ToMigrate = d2sharesV1ToMigrate

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
            const d2sharesV2ToMigrate = await crabMigration.sharesDeposited(d2.address)
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
            await expect(crabMigration.connect(d1).depositV1Shares(deposit1Amount)).to.be.revertedWith("M1");
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

        const increaseCR1 = async (amount: BigNumber) => {
            // Set ETH to crab contract and use that ETH deposit collat to increase CR1
            await provider.send("hardhat_setBalance", [crabStrategyV1.address, amount.add(one).toHexString()])
            await provider.send("hardhat_impersonateAccount", [crabStrategyV1.address]);

            const signer = ethers.provider.getSigner(crabStrategyV1.address);
            await controller.connect(signer).deposit(vaultIdV1, { value: amount })

            await provider.send("hardhat_setBalance", [crabStrategyV1.address, "0x0"])
            await provider.send('evm_mine', []);
            await provider.send('hardhat_stopImpersonatingAccount', [crabStrategyV1.address]);

            [, , collatV1, shortV1] = await crabStrategyV1.getVaultDetails();
            [, , collatV2, shortV2] = await crabStrategyV2.getVaultDetails();
        }

        const decreaseCR1 = async (amount: BigNumber) => {
            // Withdraw from crabv1's vault to decrease CR1
            await provider.send("hardhat_setBalance", [crabStrategyV1.address, ethers.utils.parseEther('10').toHexString()]) // Gas
            await provider.send("hardhat_impersonateAccount", [crabStrategyV1.address]);

            const signer = ethers.provider.getSigner(crabStrategyV1.address);
            await controller.connect(signer).withdraw(vaultIdV1, amount)

            await provider.send("hardhat_setBalance", [crabStrategyV1.address, "0x0"])
            await provider.send('evm_mine', []);
            await provider.send('hardhat_stopImpersonatingAccount', [crabStrategyV1.address]);

            [, , collatV1, shortV1] = await crabStrategyV1.getVaultDetails();
            [, , collatV2, shortV2] = await crabStrategyV2.getVaultDetails();
        }

        it("Should fail if wrong migration function is called", async () => {
            await initialize(d4.address)
            await increaseCR1(ethers.utils.parseEther('10'))
            await expect(crabMigration.connect(d4).flashMigrateAndWithdrawFromV1toV2(one, one, 0, one)).to.be.revertedWith("M10");
            await decreaseCR1(ethers.utils.parseEther('10'))
            await initialize(d5.address)
            await decreaseCR1(ethers.utils.parseEther('10'))
            await expect(crabMigration.connect(d5).flashMigrateFromV1toV2(one, 0)).to.be.revertedWith("M9");
            await increaseCR1(ethers.utils.parseEther('10'))
        })

        it("Should fail if _ethToBorrow or _withdrawMaxEthToPay is passed as 0", async () => {
            await expect(crabMigration.connect(d5).flashMigrateAndWithdrawFromV1toV2(one, one, 0, 0)).to.be.revertedWith("M7");
            await expect(crabMigration.connect(d5).flashMigrateAndWithdrawFromV1toV2(one, one, one, 0)).to.be.revertedWith("M7");
            await expect(crabMigration.connect(d5).flashMigrateAndWithdrawFromV1toV2(one, one, 0, one)).to.be.revertedWith("M7");
        })

        it("Should migrate d4 when CR1 > CR2", async () => {
            let gasPaid = BigNumber.from(0)
            await initialize(d4.address)
            await increaseCR1(ethers.utils.parseEther('10'))
            const [isFlashMigrate, ethNeededForV2, , ethToGetFromV1] = await crabMigration.flashMigrationDetails(crabV1SharesBefore)
            const crabV2SharesBefore = await crabStrategyV2.balanceOf(d4.address)

            expect(wdiv(collatV1, shortV1).gt(wdiv(collatV2, shortV2))).to.be.true
            expect(isFlashMigrate).to.be.true
            expect(ethToGetFromV1.gt(ethNeededForV2)).to.be.true

            const excessEth = ethToGetFromV1.sub(ethNeededForV2)
            const depositShare = wdiv(ethNeededForV2, collatV2.add(ethNeededForV2))
            const expectedV2Shares = wdiv(wmul(depositShare, crabV2Supply), one.sub(depositShare))

            const tx1 = await crabStrategyV1.connect(d4).approve(crabMigration.address, crabV1SharesBefore);
            gasPaid = await getGasPaid(tx1)

            const tx2 = await crabMigration.connect(d4).flashMigrateFromV1toV2(crabV1SharesBefore, 0);
            gasPaid = gasPaid.add(await getGasPaid(tx2))

            const crabV1SharesAfter = await crabStrategyV1.balanceOf(d4.address)
            const crabV2SharesAfter = await crabStrategyV2.balanceOf(d4.address)
            const crabV1SharesInMigration = await crabStrategyV1.balanceOf(crabMigration.address)
            const crabV2SharesInMigration = await crabStrategyV2.balanceOf(crabMigration.address)
            const userEthBalanceAfter = await provider.getBalance(d4.address)
            const squeethBalance = await oSqth.balanceOf(crabMigration.address)

            expect(crabV1SharesAfter).to.be.equal('0')
            expect(crabV1SharesInMigration).to.be.equal('0')
            expect(crabV2SharesBefore).to.be.equal('0')
            expect(crabV2SharesAfter).to.be.equal(expectedV2Shares)
            expect(userEthBalanceAfter).to.be.equal(userEthBalance.add(excessEth).sub(gasPaid))
            expect(crabV2SharesInMigration).to.be.equal('0')
            expect(squeethBalance).to.be.equal('0')
        })

        it("Should migrate d5 when CR1 < CR2", async () => {
            let gasPaid = BigNumber.from(0)
            await initialize(d5.address)
            await decreaseCR1(ethers.utils.parseEther('10'))
            const [isFlashMigrate, ethNeededForV2, v1oSqthToPay, ethToGetFromV1] = await crabMigration.flashMigrationDetails(crabV1SharesBefore)


            expect(wdiv(collatV1, shortV1).gt(wdiv(collatV2, shortV2))).to.be.false
            expect(isFlashMigrate).to.be.false
            expect(ethToGetFromV1.gt(ethNeededForV2)).to.be.false

            const oSqthPrice = await oracle.getTwap(wethOsqthPoolAddress, squeethAddress, wethAddress, 1, false)

            const numerator = ethToGetFromV1.sub(wmul(v1oSqthToPay, oSqthPrice).mul(101).div(100)) // 1% slippage
            const denominator = one.sub(wdiv(oSqthPrice.mul(101).div(100), wdiv(collatV2, shortV2)))
            const ethToFlashLoan = wdiv(numerator, denominator)
            const expectedSqthFromV2 = wdiv(wmul(ethToFlashLoan, shortV2), collatV2)
            const v1SqthToFlashWithdraw = v1oSqthToPay.sub(expectedSqthFromV2)
            const maxEthToPay = wmul(v1SqthToFlashWithdraw, oSqthPrice).mul(1005).div(1000) // .1% slippage
            const ethToGetFromWithdraw = wdiv(wmul(expectedSqthFromV2, collatV1), shortV1)
            const ethToGetFromFlashWithdraw = wdiv(wmul(v1SqthToFlashWithdraw, collatV1), shortV1).sub(maxEthToPay)
            const expectedEth = ethToGetFromFlashWithdraw.add(ethToGetFromWithdraw).sub(ethToFlashLoan)
            const squeethBalance = await oSqth.balanceOf(crabMigration.address)

            const depositShare = wdiv(ethToFlashLoan, collatV2.add(ethToFlashLoan))
            const expectedV2Shares = wdiv(wmul(depositShare, crabV2Supply), one.sub(depositShare))

            const tx1 = await crabStrategyV1.connect(d5).approve(crabMigration.address, ethers.constants.MaxUint256);
            gasPaid = await getGasPaid(tx1)
            // Don't flash deposit and return back ETH. For the sake of simplicity. Flash deposit is already tested in previous tests
            const tx2 = await crabMigration.connect(d5).flashMigrateAndWithdrawFromV1toV2(crabV1SharesBefore, 0, ethToFlashLoan, maxEthToPay)
            gasPaid = gasPaid.add(await getGasPaid(tx2))

            const crabV1SharesAfter = await crabStrategyV1.balanceOf(d5.address)
            const crabV2SharesAfter = await crabStrategyV2.balanceOf(d5.address)
            const crabV1SharesInMigration = await crabStrategyV1.balanceOf(crabMigration.address)
            const crabV2SharesInMigration = await crabStrategyV2.balanceOf(crabMigration.address)
            const userEthBalanceAfter = await provider.getBalance(d5.address)


            expect(crabV1SharesAfter).to.be.equal('0')
            expect(crabV1SharesInMigration).to.be.equal('0')
            expect(crabV2SharesInMigration).to.be.equal('0')
            expect(crabV2SharesAfter).to.be.equal(expectedV2Shares)
            expect(squeethBalance).to.be.equal('0')
            // Can't predict exact because of slippage so should be greater or equal to expected balance
            expect(userEthBalanceAfter.gte(userEthBalance.add(expectedEth).sub(gasPaid))).to.be.true
        })

        describe("Migrate crab with even supply", async function () {
            const hedgeTimeThreshold = 86400  // 24h
            const hedgePriceThreshold = ethers.utils.parseUnits('0.01')
            const auctionTime = 3600
            const minPriceMultiplier = ethers.utils.parseUnits('0.95')
            const maxPriceMultiplier = ethers.utils.parseUnits('1.05')

            this.beforeAll("Deploy and seed crab V1", async () => {
                const CrabStrategyContract = await ethers.getContractFactory("CrabStrategy");
                crabStrategyV1 = (await CrabStrategyContract.deploy(controller.address, oracle.address, weth.address, uniswapFactoryAddress, wethOsqthPoolAddress, hedgeTimeThreshold, hedgePriceThreshold, auctionTime, minPriceMultiplier, maxPriceMultiplier)) as CrabStrategy;
                crabStrategyV1.setStrategyCap(ethers.utils.parseEther('100'))
                const d1Amt = ethers.utils.parseEther('20');
                const d2Amt = ethers.utils.parseEther('5');
                const d3Amt = ethers.utils.parseEther('5');

                crabStrategyV1.connect(d1).deposit({ value: d1Amt })
                crabStrategyV1.connect(d2).deposit({ value: d2Amt })
                crabStrategyV1.connect(d3).deposit({ value: d3Amt })
                // crabStrategyV1.connect(d4).deposit({ value: d4Amt })

                oSqth.connect(d1).transfer(random.address, await oSqth.balanceOf(d1.address))
                oSqth.connect(d2).transfer(random.address, await oSqth.balanceOf(d1.address))
                oSqth.connect(d3).transfer(random.address, await oSqth.balanceOf(d1.address))
            })

            this.beforeAll("Deploy migration contract and crab v2", async () => {
                const MigrationContract = await ethers.getContractFactory("CrabMigration");
                crabMigration = (await MigrationContract.deploy(crabStrategyV1.address, wethAddress, eulerExecAddress, dTokenAddress, eulerMainnetAddress)) as CrabMigration;

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

            it("Should have even number of total supply, short and collat", async () => {
                const [, , collat, short] = await crabStrategyV1.getVaultDetails()
                expect(await crabStrategyV1.totalSupply()).to.be.equal("30000000000000000012")
                expect(collat).to.be.equal("30000000000000000000")
            })

            it("D1 deposit crab v1 shares", async () => {
                const shareToDeposit = ethers.utils.parseEther('10')

                await crabStrategyV1.connect(d1).approve(crabMigration.address, shareToDeposit);
                await crabMigration.connect(d1).depositV1Shares(shareToDeposit);

                const crabV1BalanceMigrationAfter = await crabStrategyV1.balanceOf(crabMigration.address);
                const crabV1BalanceAfter = await crabStrategyV1.balanceOf(d1.address);
                const d1SharesDeposited = await crabMigration.sharesDeposited(d1.address);

                expect(crabV1BalanceAfter).to.be.equal(shareToDeposit)
                expect(crabV1BalanceMigrationAfter).to.be.equal(shareToDeposit);
                expect(d1SharesDeposited).to.be.equal(shareToDeposit);
            })

            it("Batch migrate", async () => {
                await crabMigration.batchMigrate()

                const crabV2SupplyAfter = await crabStrategyV2.totalSupply();
                const crabV1SharesBalanceAfter = await crabStrategyV1.balanceOf(crabMigration.address);
                const crabV2SharesBalanceAfter = await crabStrategyV2.balanceOf(crabMigration.address);

                expect(crabV1SharesBalanceAfter).to.be.equal('0')
                expect(crabV2SupplyAfter).to.be.equal(ethers.utils.parseEther('10'))
                expect(crabV2SharesBalanceAfter).to.be.equal(ethers.utils.parseEther('10'))
            })

            it("d1 claims shares", async () => {
                const d1SharesBefore = await crabStrategyV2.balanceOf(d1.address);

                await crabMigration.connect(d1).claimV2Shares();

                // 1. check that shares sent from migration contract equals shares received by user
                const constractSharesAfter = await crabStrategyV2.balanceOf(crabMigration.address);
                const d1SharesAfter = await crabStrategyV2.balanceOf(d1.address);

                expect(d1SharesBefore).to.be.equal('0');
                expect(d1SharesAfter).to.be.equal(ethers.utils.parseEther('10'));
                expect(constractSharesAfter).to.be.equal('0')
            })

            it("migrate d2 with CR1 > CR2", async () => {
                let gasPaid = BigNumber.from(0)
                await initialize(d2.address)
                await increaseCR1(ethers.utils.parseEther('2'))
                const [isFlashMigrate, ethNeededForV2, , ethToGetFromV1] = await crabMigration.flashMigrationDetails(crabV1SharesBefore)
                const crabV2SharesBefore = await crabStrategyV2.balanceOf(d2.address)

                expect(wdiv(collatV1, shortV1).gt(wdiv(collatV2, shortV2))).to.be.true
                expect(isFlashMigrate).to.be.true
                expect(ethToGetFromV1.gt(ethNeededForV2)).to.be.true

                const excessEth = ethToGetFromV1.sub(ethNeededForV2)
                const depositShare = wdiv(ethNeededForV2, collatV2.add(ethNeededForV2))
                const expectedV2Shares = wdiv(wmul(depositShare, crabV2Supply), one.sub(depositShare))

                const tx1 = await crabStrategyV1.connect(d2).approve(crabMigration.address, crabV1SharesBefore);
                gasPaid = await getGasPaid(tx1)

                const tx2 = await crabMigration.connect(d2).flashMigrateFromV1toV2(crabV1SharesBefore, 0);
                gasPaid = gasPaid.add(await getGasPaid(tx2))

                const crabV1SharesAfter = await crabStrategyV1.balanceOf(d2.address)
                const crabV2SharesAfter = await crabStrategyV2.balanceOf(d2.address)
                const crabV1SharesInMigration = await crabStrategyV1.balanceOf(crabMigration.address)
                const crabV2SharesInMigration = await crabStrategyV2.balanceOf(crabMigration.address)
                const userEthBalanceAfter = await provider.getBalance(d2.address)
                const squeethBalance = await oSqth.balanceOf(crabMigration.address)


                expect(crabV1SharesAfter).to.be.equal('0')
                expect(crabV1SharesInMigration).to.be.equal('0')
                expect(crabV2SharesBefore).to.be.equal('0')
                expect(crabV2SharesAfter).to.be.equal(expectedV2Shares)
                expect(userEthBalanceAfter).to.be.equal(userEthBalance.add(excessEth).sub(gasPaid))
                expect(crabV2SharesInMigration).to.be.equal('0')
                expect(squeethBalance).to.be.equal('0')
            })

            it("migrate d3 with CR1 < CR2", async () => {
                let gasPaid = BigNumber.from(0)
                await initialize(d3.address)
                await decreaseCR1(ethers.utils.parseEther('2'))
                const [isFlashMigrate, ethNeededForV2, v1oSqthToPay, ethToGetFromV1] = await crabMigration.flashMigrationDetails(crabV1SharesBefore)


                expect(wdiv(collatV1, shortV1).gt(wdiv(collatV2, shortV2))).to.be.false
                expect(isFlashMigrate).to.be.false
                expect(ethToGetFromV1.gt(ethNeededForV2)).to.be.false

                const oSqthPrice = await oracle.getTwap(wethOsqthPoolAddress, squeethAddress, wethAddress, 1, false)

                const numerator = ethToGetFromV1.sub(wmul(v1oSqthToPay, oSqthPrice).mul(101).div(100)) // 1% slippage
                const denominator = one.sub(wdiv(oSqthPrice.mul(101).div(100), wdiv(collatV2, shortV2)))
                const ethToFlashLoan = wdiv(numerator, denominator)
                const expectedSqthFromV2 = wdiv(wmul(ethToFlashLoan, shortV2), collatV2)
                const v1SqthToFlashWithdraw = v1oSqthToPay.sub(expectedSqthFromV2)
                const maxEthToPay = wmul(v1SqthToFlashWithdraw, oSqthPrice).mul(1005).div(1000) // .1% slippage
                const ethToGetFromWithdraw = wdiv(wmul(expectedSqthFromV2, collatV1), shortV1)
                const ethToGetFromFlashWithdraw = wdiv(wmul(v1SqthToFlashWithdraw, collatV1), shortV1).sub(maxEthToPay)
                const expectedEth = ethToGetFromFlashWithdraw.add(ethToGetFromWithdraw).sub(ethToFlashLoan)

                const depositShare = wdiv(ethToFlashLoan, collatV2.add(ethToFlashLoan))
                const expectedV2Shares = wdiv(wmul(depositShare, crabV2Supply), one.sub(depositShare))

                const tx1 = await crabStrategyV1.connect(d3).approve(crabMigration.address, ethers.constants.MaxUint256);
                gasPaid = await getGasPaid(tx1)
                // Don't flash deposit and return back ETH. For the sake of simplicity. Flash deposit is already tested in previous tests
                const tx2 = await crabMigration.connect(d3).flashMigrateAndWithdrawFromV1toV2(crabV1SharesBefore, 0, ethToFlashLoan, maxEthToPay)
                gasPaid = gasPaid.add(await getGasPaid(tx2))

                const crabV1SharesAfter = await crabStrategyV1.balanceOf(d3.address)
                const crabV2SharesAfter = await crabStrategyV2.balanceOf(d3.address)
                const crabV1SharesInMigration = await crabStrategyV1.balanceOf(crabMigration.address)
                const crabV2SharesInMigration = await crabStrategyV2.balanceOf(crabMigration.address)
                const userEthBalanceAfter = await provider.getBalance(d3.address)
                const squeethBalance = await oSqth.balanceOf(crabMigration.address)


                expect(crabV1SharesAfter).to.be.equal('0')
                expect(crabV1SharesInMigration).to.be.equal('0')
                expect(crabV2SharesInMigration).to.be.equal('0')
                expect(crabV2SharesAfter).to.be.equal(expectedV2Shares)
                // Can't predict exact because of slippage so should be greater or equal to expected balance
                expect(userEthBalanceAfter.gte(userEthBalance.add(expectedEth).sub(gasPaid))).to.be.true
                expect(squeethBalance).to.be.equal('0')
            })
        })

        describe("Migrate crab with odd supply", async function () {
            const hedgeTimeThreshold = 86400  // 24h
            const hedgePriceThreshold = ethers.utils.parseUnits('0.01')
            const auctionTime = 3600
            const minPriceMultiplier = ethers.utils.parseUnits('0.95')
            const maxPriceMultiplier = ethers.utils.parseUnits('1.05')

            this.beforeAll("Deploy and seed crab V1", async () => {
                const CrabStrategyContract = await ethers.getContractFactory("CrabStrategy");
                crabStrategyV1 = (await CrabStrategyContract.deploy(controller.address, oracle.address, weth.address, uniswapFactoryAddress, wethOsqthPoolAddress, hedgeTimeThreshold, hedgePriceThreshold, auctionTime, minPriceMultiplier, maxPriceMultiplier)) as CrabStrategy;
                crabStrategyV1.setStrategyCap(ethers.utils.parseEther('100'))
                const d1Amt = ethers.utils.parseEther('20').add(1);
                const d2Amt = ethers.utils.parseEther('5');
                const d3Amt = ethers.utils.parseEther('5');
                const d4Amt = ethers.utils.parseEther('10');

                crabStrategyV1.connect(d1).deposit({ value: d1Amt })
                crabStrategyV1.connect(d2).deposit({ value: d2Amt })
                crabStrategyV1.connect(d3).deposit({ value: d3Amt })
                crabStrategyV1.connect(d4).deposit({ value: d4Amt })

                oSqth.connect(d1).transfer(random.address, await oSqth.balanceOf(d1.address))
                oSqth.connect(d2).transfer(random.address, await oSqth.balanceOf(d1.address))
                oSqth.connect(d3).transfer(random.address, await oSqth.balanceOf(d1.address))
            })

            this.beforeAll("Deploy migration contract and crab v2", async () => {
                const MigrationContract = await ethers.getContractFactory("CrabMigration");
                crabMigration = (await MigrationContract.deploy(crabStrategyV1.address, wethAddress, eulerExecAddress, dTokenAddress, eulerMainnetAddress)) as CrabMigration;

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

            it("Should have even number of total supply, short and collat", async () => {
                const [, , collat, short] = await crabStrategyV1.getVaultDetails()
                expect(await crabStrategyV1.totalSupply()).to.be.equal("40000000000000000017")
                expect(collat).to.be.equal("40000000000000000001")
            })

            it("D1 deposit crab v1 shares", async () => {
                const shareToDeposit = ethers.utils.parseEther('10')

                await crabStrategyV1.connect(d1).approve(crabMigration.address, shareToDeposit);
                await crabMigration.connect(d1).depositV1Shares(shareToDeposit);

                const crabV1BalanceMigrationAfter = await crabStrategyV1.balanceOf(crabMigration.address);
                const crabV1BalanceAfter = await crabStrategyV1.balanceOf(d1.address);
                const d1SharesDeposited = await crabMigration.sharesDeposited(d1.address);

                expect(crabV1BalanceAfter).to.be.equal(shareToDeposit.add(1))
                expect(crabV1BalanceMigrationAfter).to.be.equal(shareToDeposit);
                expect(d1SharesDeposited).to.be.equal(shareToDeposit);
            })

            it("Batch migrate", async () => {
                await crabMigration.batchMigrate()

                const crabV2SupplyAfter = await crabStrategyV2.totalSupply();
                const crabV1SharesBalanceAfter = await crabStrategyV1.balanceOf(crabMigration.address);
                const crabV2SharesBalanceAfter = await crabStrategyV2.balanceOf(crabMigration.address);

                expect(crabV1SharesBalanceAfter).to.be.equal('0')
                expect(crabV2SupplyAfter).to.be.equal(ethers.utils.parseEther('10'))
                expect(crabV2SharesBalanceAfter).to.be.equal(ethers.utils.parseEther('10'))
            })

            it("d1 claims shares", async () => {
                const d1SharesBefore = await crabStrategyV2.balanceOf(d1.address);

                await crabMigration.connect(d1).claimV2Shares();

                // 1. check that shares sent from migration contract equals shares received by user
                const constractSharesAfter = await crabStrategyV2.balanceOf(crabMigration.address);
                const d1SharesAfter = await crabStrategyV2.balanceOf(d1.address);


                expect(d1SharesBefore).to.be.equal('0');
                expect(d1SharesAfter).to.be.equal(ethers.utils.parseEther('10'));
                expect(constractSharesAfter).to.be.equal('0')
            })

            it("migrate d2 with CR1 > CR2 with flash deposit", async () => {
                let gasPaid = BigNumber.from(0)
                await initialize(d2.address)
                await increaseCR1(ethers.utils.parseEther('2'))
                const [isFlashMigrate, ethNeededForV2, , ethToGetFromV1] = await crabMigration.flashMigrationDetails(crabV1SharesBefore)
                const crabV2SharesBefore = await crabStrategyV2.balanceOf(d2.address)

                expect(wdiv(collatV1, shortV1).gt(wdiv(collatV2, shortV2))).to.be.true
                expect(isFlashMigrate).to.be.true
                expect(ethToGetFromV1.gt(ethNeededForV2)).to.be.true

                const excessEth = ethToGetFromV1.sub(ethNeededForV2)
                const ethToFlashDeposit = excessEth.mul(195).div(100) // Something less than 200%

                const depositShare = wdiv(ethNeededForV2, collatV2.add(ethNeededForV2))
                const oSqthPrice = await oracle.getTwap(wethOsqthPoolAddress, squeethAddress, wethAddress, 1, false)
                const expectedV2Shares = wdiv(wmul(depositShare, crabV2Supply), one.sub(depositShare))
                const expectedSupply = crabV2Supply.add(expectedV2Shares)
                const expectedCollat = collatV2.add(ethNeededForV2)
                const expectedShort = wdiv(wmul(ethNeededForV2, shortV2), collatV2).add(shortV2)

                const depositShareFromFlashDeposit = wdiv(ethToFlashDeposit, expectedCollat.add(ethToFlashDeposit))
                const expectedV2SharesFlashDeposit = wdiv(wmul(depositShareFromFlashDeposit, expectedSupply), one.sub(depositShareFromFlashDeposit))

                const oSqthToMintedFlash = wdiv(wmul(ethToFlashDeposit, expectedShort), expectedCollat);
                const ethToReturned = wmul(oSqthToMintedFlash, oSqthPrice)

                const expectedEth = excessEth.sub(ethToReturned)


                const tx1 = await crabStrategyV1.connect(d2).approve(crabMigration.address, crabV1SharesBefore);
                gasPaid = await getGasPaid(tx1)

                const tx2 = await crabMigration.connect(d2).flashMigrateFromV1toV2(crabV1SharesBefore, ethToFlashDeposit);
                gasPaid = gasPaid.add(await getGasPaid(tx2));

                const crabV1SharesAfter = await crabStrategyV1.balanceOf(d2.address)
                const crabV2SharesAfter = await crabStrategyV2.balanceOf(d2.address)
                const crabV1SharesInMigration = await crabStrategyV1.balanceOf(crabMigration.address)
                const crabV2SharesInMigration = await crabStrategyV2.balanceOf(crabMigration.address)
                const userEthBalanceAfter = await provider.getBalance(d2.address)
                const squeethBalance = await oSqth.balanceOf(crabMigration.address)

                const [, , collat, short] = await crabStrategyV2.getVaultDetails()
                expect(await crabStrategyV2.totalSupply()).to.be.equal(expectedSupply.add(expectedV2SharesFlashDeposit))
                expect(collat).to.be.equal(expectedCollat.add(ethToFlashDeposit))
                expect(short).to.be.equal(expectedShort.add(oSqthToMintedFlash))
                expect(crabV1SharesAfter).to.be.equal('0')
                expect(crabV1SharesInMigration).to.be.equal('0')
                expect(crabV2SharesBefore).to.be.equal('0')
                expect(crabV2SharesAfter).to.be.equal(expectedV2Shares.add(expectedV2SharesFlashDeposit))
                expect(crabV2SharesInMigration).to.be.equal('0')
                expect(squeethBalance).to.be.equal('0')
                expect(userEthBalanceAfter.gte(userEthBalance.add(expectedEth).sub(gasPaid))).to.be.true
            })

            it("migrate d3 with CR1 < CR2", async () => {
                let gasPaid = BigNumber.from(0)
                await initialize(d3.address)
                await decreaseCR1(ethers.utils.parseEther('2'))
                const [isFlashMigrate, ethNeededForV2, v1oSqthToPay, ethToGetFromV1] = await crabMigration.flashMigrationDetails(crabV1SharesBefore)


                expect(wdiv(collatV1, shortV1).gt(wdiv(collatV2, shortV2))).to.be.false
                expect(isFlashMigrate).to.be.false
                expect(ethToGetFromV1.gt(ethNeededForV2)).to.be.false

                const oSqthPrice = await oracle.getTwap(wethOsqthPoolAddress, squeethAddress, wethAddress, 1, false)

                const numerator = ethToGetFromV1.sub(wmul(v1oSqthToPay, oSqthPrice).mul(101).div(100)) // 1% slippage
                const denominator = one.sub(wdiv(oSqthPrice.mul(101).div(100), wdiv(collatV2, shortV2)))
                const ethToFlashLoan = wdiv(numerator, denominator)
                const expectedSqthFromV2 = wdiv(wmul(ethToFlashLoan, shortV2), collatV2)
                const v1SqthToFlashWithdraw = v1oSqthToPay.sub(expectedSqthFromV2)
                const maxEthToPay = wmul(v1SqthToFlashWithdraw, oSqthPrice).mul(1005).div(1000) // .1% slippage
                const ethToGetFromWithdraw = wdiv(wmul(expectedSqthFromV2, collatV1), shortV1)
                const ethToGetFromFlashWithdraw = wdiv(wmul(v1SqthToFlashWithdraw, collatV1), shortV1).sub(maxEthToPay)
                const expectedEth = ethToGetFromFlashWithdraw.add(ethToGetFromWithdraw).sub(ethToFlashLoan)

                const depositShare = wdiv(ethToFlashLoan, collatV2.add(ethToFlashLoan))
                const expectedV2Shares = wdiv(wmul(depositShare, crabV2Supply), one.sub(depositShare))

                const tx1 = await crabStrategyV1.connect(d3).approve(crabMigration.address, ethers.constants.MaxUint256);
                gasPaid = await getGasPaid(tx1)
                // Don't flash deposit and return back ETH. For the sake of simplicity. Flash deposit is already tested in previous tests
                const tx2 = await crabMigration.connect(d3).flashMigrateAndWithdrawFromV1toV2(crabV1SharesBefore, 0, ethToFlashLoan, maxEthToPay)
                gasPaid = gasPaid.add(await getGasPaid(tx2))

                const crabV1SharesAfter = await crabStrategyV1.balanceOf(d3.address)
                const crabV2SharesAfter = await crabStrategyV2.balanceOf(d3.address)
                const crabV1SharesInMigration = await crabStrategyV1.balanceOf(crabMigration.address)
                const crabV2SharesInMigration = await crabStrategyV2.balanceOf(crabMigration.address)
                const userEthBalanceAfter = await provider.getBalance(d3.address)
                const squeethBalance = await oSqth.balanceOf(crabMigration.address)


                expect(crabV1SharesAfter).to.be.equal('0')
                expect(crabV1SharesInMigration).to.be.equal('0')
                expect(crabV2SharesInMigration).to.be.equal('0')
                expect(crabV2SharesAfter).to.be.equal(expectedV2Shares)
                expect(squeethBalance).to.be.equal('0')
                // Can't predict exact because of slippage so should be greater or equal to expected balance
                expect(userEthBalanceAfter.gte(userEthBalance.add(expectedEth).sub(gasPaid))).to.be.true
            })
        })

        describe("Partial Migration", async function () {
            const hedgeTimeThreshold = 86400  // 24h
            const hedgePriceThreshold = ethers.utils.parseUnits('0.01')
            const auctionTime = 3600
            const minPriceMultiplier = ethers.utils.parseUnits('0.95')
            const maxPriceMultiplier = ethers.utils.parseUnits('1.05')

            this.beforeAll("Deploy and seed crab V1", async () => {
                const CrabStrategyContract = await ethers.getContractFactory("CrabStrategy");
                crabStrategyV1 = (await CrabStrategyContract.deploy(controller.address, oracle.address, weth.address, uniswapFactoryAddress, wethOsqthPoolAddress, hedgeTimeThreshold, hedgePriceThreshold, auctionTime, minPriceMultiplier, maxPriceMultiplier)) as CrabStrategy;
                crabStrategyV1.setStrategyCap(ethers.utils.parseEther('100'))
                const d1Amt = ethers.utils.parseEther('20');
                const d2Amt = ethers.utils.parseEther('5');
                const d3Amt = ethers.utils.parseEther('5');

                crabStrategyV1.connect(d1).deposit({ value: d1Amt })
                crabStrategyV1.connect(d2).deposit({ value: d2Amt })
                crabStrategyV1.connect(d3).deposit({ value: d3Amt })
                // crabStrategyV1.connect(d4).deposit({ value: d4Amt })

                oSqth.connect(d1).transfer(random.address, await oSqth.balanceOf(d1.address))
                oSqth.connect(d2).transfer(random.address, await oSqth.balanceOf(d1.address))
                oSqth.connect(d3).transfer(random.address, await oSqth.balanceOf(d1.address))
            })

            this.beforeAll("Deploy migration contract and crab v2", async () => {
                const MigrationContract = await ethers.getContractFactory("CrabMigration");
                crabMigration = (await MigrationContract.deploy(crabStrategyV1.address, wethAddress, eulerExecAddress, dTokenAddress, eulerMainnetAddress)) as CrabMigration;

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

            it("D1 deposit crab v1 shares", async () => {
                const shareToDeposit = ethers.utils.parseEther('10')

                await crabStrategyV1.connect(d1).approve(crabMigration.address, shareToDeposit);
                await crabMigration.connect(d1).depositV1Shares(shareToDeposit);

                const crabV1BalanceMigrationAfter = await crabStrategyV1.balanceOf(crabMigration.address);
                const crabV1BalanceAfter = await crabStrategyV1.balanceOf(d1.address);
                const d1SharesDeposited = await crabMigration.sharesDeposited(d1.address);

                expect(crabV1BalanceAfter).to.be.equal(shareToDeposit)
                expect(crabV1BalanceMigrationAfter).to.be.equal(shareToDeposit);
                expect(d1SharesDeposited).to.be.equal(shareToDeposit);
            })

            it("Batch migrate", async () => {
                await crabMigration.batchMigrate()

                const crabV2SupplyAfter = await crabStrategyV2.totalSupply();
                const crabV1SharesBalanceAfter = await crabStrategyV1.balanceOf(crabMigration.address);
                const crabV2SharesBalanceAfter = await crabStrategyV2.balanceOf(crabMigration.address);

                expect(crabV1SharesBalanceAfter).to.be.equal('0')
                expect(crabV2SupplyAfter).to.be.equal(ethers.utils.parseEther('10'))
                expect(crabV2SharesBalanceAfter).to.be.equal(ethers.utils.parseEther('10'))
            })

            it("d1 claims shares", async () => {
                const d1SharesBefore = await crabStrategyV2.balanceOf(d1.address);

                await crabMigration.connect(d1).claimV2Shares();

                // 1. check that shares sent from migration contract equals shares received by user
                const constractSharesAfter = await crabStrategyV2.balanceOf(crabMigration.address);
                const d1SharesAfter = await crabStrategyV2.balanceOf(d1.address);

                expect(d1SharesBefore).to.be.equal('0');
                expect(d1SharesAfter).to.be.equal(ethers.utils.parseEther('10'));
                expect(constractSharesAfter).to.be.equal('0')
            })

            it("Partial migrate d2 with CR1 > CR2", async () => {
                let gasPaid = BigNumber.from(0)
                await initialize(d2.address)
                await increaseCR1(ethers.utils.parseEther('2'))

                const v1CrabToMigrate = crabV1SharesBefore.div(2);

                const [isFlashMigrate, ethNeededForV2, , ethToGetFromV1] = await crabMigration.flashMigrationDetails(v1CrabToMigrate)
                const crabV2SharesBefore = await crabStrategyV2.balanceOf(d2.address)

                expect(wdiv(collatV1, shortV1).gt(wdiv(collatV2, shortV2))).to.be.true
                expect(isFlashMigrate).to.be.true
                expect(ethToGetFromV1.gt(ethNeededForV2)).to.be.true

                const excessEth = ethToGetFromV1.sub(ethNeededForV2)
                const depositShare = wdiv(ethNeededForV2, collatV2.add(ethNeededForV2))
                const expectedV2Shares = wdiv(wmul(depositShare, crabV2Supply), one.sub(depositShare))

                const tx1 = await crabStrategyV1.connect(d2).approve(crabMigration.address, v1CrabToMigrate);
                gasPaid = await getGasPaid(tx1)

                const tx2 = await crabMigration.connect(d2).flashMigrateFromV1toV2(v1CrabToMigrate, 0);
                gasPaid = gasPaid.add(await getGasPaid(tx2))

                const crabV1SharesAfter = await crabStrategyV1.balanceOf(d2.address)
                const crabV2SharesAfter = await crabStrategyV2.balanceOf(d2.address)
                const crabV1SharesInMigration = await crabStrategyV1.balanceOf(crabMigration.address)
                const crabV2SharesInMigration = await crabStrategyV2.balanceOf(crabMigration.address)
                const userEthBalanceAfter = await provider.getBalance(d2.address)
                const squeethBalance = await oSqth.balanceOf(crabMigration.address)


                expect(crabV1SharesAfter).to.be.equal(v1CrabToMigrate)
                expect(crabV1SharesInMigration).to.be.equal('0')
                expect(crabV2SharesBefore).to.be.equal('0')
                expect(crabV2SharesAfter).to.be.equal(expectedV2Shares)
                expect(userEthBalanceAfter).to.be.equal(userEthBalance.add(excessEth).sub(gasPaid))
                expect(crabV2SharesInMigration).to.be.equal('0')
                expect(squeethBalance).to.be.equal('0')
            })

            it("Partial migrate d2 with CR1 < CR2", async () => {
                let gasPaid = BigNumber.from(0)
                await initialize(d2.address)
                await decreaseCR1(ethers.utils.parseEther('2'))
                const v1CrabToMigrate = crabV1SharesBefore.div(2);
                const [isFlashMigrate, ethNeededForV2, v1oSqthToPay, ethToGetFromV1] = await crabMigration.flashMigrationDetails(v1CrabToMigrate)


                expect(wdiv(collatV1, shortV1).gt(wdiv(collatV2, shortV2))).to.be.false
                expect(isFlashMigrate).to.be.false
                expect(ethToGetFromV1.gt(ethNeededForV2)).to.be.false

                const oSqthPrice = await oracle.getTwap(wethOsqthPoolAddress, squeethAddress, wethAddress, 1, false)

                const numerator = ethToGetFromV1.sub(wmul(v1oSqthToPay, oSqthPrice).mul(101).div(100)) // 1% slippage
                const denominator = one.sub(wdiv(oSqthPrice.mul(101).div(100), wdiv(collatV2, shortV2)))
                const ethToFlashLoan = wdiv(numerator, denominator)
                const expectedSqthFromV2 = wdiv(wmul(ethToFlashLoan, shortV2), collatV2)
                const v1SqthToFlashWithdraw = v1oSqthToPay.sub(expectedSqthFromV2)
                const maxEthToPay = wmul(v1SqthToFlashWithdraw, oSqthPrice).mul(1005).div(1000) // .05% slippage
                const ethToGetFromWithdraw = wdiv(wmul(expectedSqthFromV2, collatV1), shortV1)
                const ethToGetFromFlashWithdraw = wdiv(wmul(v1SqthToFlashWithdraw, collatV1), shortV1).sub(maxEthToPay)
                const expectedEth = ethToGetFromFlashWithdraw.add(ethToGetFromWithdraw).sub(ethToFlashLoan)

                const depositShare = wdiv(ethToFlashLoan, collatV2.add(ethToFlashLoan))
                const expectedV2Shares = wdiv(wmul(depositShare, crabV2Supply), one.sub(depositShare))

                const tx1 = await crabStrategyV1.connect(d2).approve(crabMigration.address, ethers.constants.MaxUint256);
                gasPaid = await getGasPaid(tx1)
                // Don't flash deposit and return back ETH. For the sake of simplicity. Flash deposit is already tested in previous tests
                const tx2 = await crabMigration.connect(d2).flashMigrateAndWithdrawFromV1toV2(v1CrabToMigrate, 0, ethToFlashLoan, maxEthToPay)
                gasPaid = gasPaid.add(await getGasPaid(tx2))

                const crabV1SharesAfter = await crabStrategyV1.balanceOf(d2.address)
                const crabV2SharesAfter = await crabStrategyV2.balanceOf(d2.address)
                const crabV1SharesInMigration = await crabStrategyV1.balanceOf(crabMigration.address)
                const crabV2SharesInMigration = await crabStrategyV2.balanceOf(crabMigration.address)
                const userEthBalanceAfter = await provider.getBalance(d2.address)
                const squeethBalance = await oSqth.balanceOf(crabMigration.address)


                expect(crabV1SharesAfter).to.be.equal(v1CrabToMigrate)
                expect(crabV1SharesInMigration).to.be.equal('0')
                expect(crabV2SharesInMigration).to.be.equal('0')
                expect(crabV2SharesAfter).to.be.equal(crabV2ShareBefore.add(expectedV2Shares))
                // Can't predict exact because of slippage so should be greater or equal to expected balance
                expect(userEthBalanceAfter.gte(userEthBalance.add(expectedEth).sub(gasPaid))).to.be.true
                expect(squeethBalance).to.be.equal('0')
            })
        })
    })
})