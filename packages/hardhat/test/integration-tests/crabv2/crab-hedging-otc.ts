import BigNumberJs from "bignumber.js";
import { expect } from "chai";
import { ethers, network } from "hardhat";

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { BigNumber, Contract, providers } from "ethers";
import { Controller, CrabStrategyV2, MockErc20, Timelock, Oracle, WETH9, WPowerPerp } from "../../../typechain";
import {
    addSqueethLiquidity,
    addWethDaiLiquidity,
    buyWeth,
    buyWSqueeth,
    deploySqueethCoreContracts,
    deployUniswapV3,
    deployWETHAndDai,
} from "../../setup";
import { isSimilar, one, oracleScaleFactor, signTypedData, wdiv, wmul } from "../../utils";

BigNumberJs.set({ EXPONENTIAL_AT: 30 });

describe("Crab V2 flashswap integration test: time based hedging", function () {
    const startingEthPrice = 3000;
    const startingEthPrice1e18 = BigNumber.from(startingEthPrice).mul(one); // 3000 * 1e18
    const scaledStartingSqueethPrice1e18 = startingEthPrice1e18.mul(11).div(10).div(oracleScaleFactor); // 0.303 * 1e18
    const scaledStartingSqueethPrice = (startingEthPrice * 1.1) / oracleScaleFactor.toNumber(); // 0.303

    const hedgeTimeThreshold = 86400; // 24h
    const hedgePriceThreshold = ethers.utils.parseUnits("0.01");
    const auctionTime = 3600;

    let provider: providers.JsonRpcProvider;
    let owner: SignerWithAddress;
    let depositor: SignerWithAddress;
    let random: SignerWithAddress;
    let trader: SignerWithAddress;
    let feeRecipient: SignerWithAddress;
    let crabMigration: SignerWithAddress;
    let dai: MockErc20;
    let weth: WETH9;
    let positionManager: Contract;
    let uniswapFactory: Contract;
    let swapRouter: Contract;
    let oracle: Oracle;
    let controller: Controller;
    let wSqueethPool: Contract;
    let wSqueeth: WPowerPerp;
    let crabStrategyV2: CrabStrategyV2;
    let ethDaiPool: Contract;
    let timelock: Timelock;

    this.beforeAll("Deploy uniswap protocol & setup uniswap pool", async () => {
        const accounts = await ethers.getSigners();
        const [_owner, _depositor, _random, _feeRecipient, _trader, _crabMigration] = accounts;
        owner = _owner;
        depositor = _depositor;
        random = _random;
        trader = _trader;
        feeRecipient = _feeRecipient;
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

        const TimelockContract = await ethers.getContractFactory("Timelock");
        timelock = (await TimelockContract.deploy(owner.address, 3 * 24 * 60 * 60)) as Timelock;

        const crabStrategyV2Contract = await ethers.getContractFactory("CrabStrategyV2");
        crabStrategyV2 = (await crabStrategyV2Contract.deploy(
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
        // add liquidity

        await addWethDaiLiquidity(
            startingEthPrice,
            ethers.utils.parseUnits("100"), // eth amount
            owner.address,
            dai,
            weth,
            positionManager
        );
        await provider.send("evm_increaseTime", [600]);
        await provider.send("evm_mine", []);

        await addSqueethLiquidity(
            scaledStartingSqueethPrice,
            "1000000",
            "2000000",
            owner.address,
            wSqueeth,
            weth,
            positionManager,
            controller
        );
        await provider.send("evm_increaseTime", [600]);
        await provider.send("evm_mine", []);
    });

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

        const strategyCap = ethers.utils.parseUnits("1000");

        await crabStrategyV2.connect(crabMigration).initialize(debtToMint, expectedEthDeposit, 1, 1, strategyCap, { value: ethToDeposit });
        
        const strategyCapInContract = await crabStrategyV2.strategyCap();
        expect(strategyCapInContract.eq(strategyCap)).to.be.true;

        await crabStrategyV2.connect(crabMigration).transfer(depositor.address, expectedEthDeposit);

        const totalSupply = await crabStrategyV2.totalSupply();
        const depositorCrab = await crabStrategyV2.balanceOf(depositor.address);
        const strategyVault = await controller.vaults(await crabStrategyV2.vaultId());
        const debtAmount = strategyVault.shortAmount;
        const depositorSqueethBalance = await wSqueeth.balanceOf(depositor.address);
        const strategyContractSqueeth = await wSqueeth.balanceOf(crabStrategyV2.address);
        const lastHedgeTime = await crabStrategyV2.timeAtLastHedge();
        const collateralAmount = await strategyVault.collateralAmount;

        expect(isSimilar(totalSupply.toString(), expectedEthDeposit.toString())).to.be.true;
        expect(isSimilar(depositorCrab.toString(), expectedEthDeposit.toString())).to.be.true;
        expect(isSimilar(debtAmount.toString(), debtToMint.toString())).to.be.true;
        expect(strategyContractSqueeth.eq(BigNumber.from(0))).to.be.true;
    });

    describe("Hedging", async () => {
        const getOSQTHPrice = () => oracle.getTwap(wSqueethPool.address, wSqueeth.address, weth.address, 600, false);
        const mintAndSell = async (toMint = "1000") => {
            const ethToDeposit = ethers.utils.parseUnits("1000");
            const wSqueethToMint = ethers.utils.parseUnits(toMint);
            const currentBlockTimestamp = (await provider.getBlock(await provider.getBlockNumber())).timestamp;
            await controller.connect(owner).mintWPowerPerpAmount("0", wSqueethToMint, "0", { value: ethToDeposit });
            await buyWeth(
                swapRouter,
                wSqueeth,
                weth,
                owner.address,
                await wSqueeth.balanceOf(owner.address),
                currentBlockTimestamp + 10
            );

            await provider.send("evm_increaseTime", [86400 + auctionTime / 2]);
            await provider.send("evm_mine", []);
        };
        const delta = async (vault: any) => {
            // oSQTH price before
            const oSQTHPriceBefore = await getOSQTHPrice();
            const oSQTHdelta = wmul(vault.shortAmount.mul(2), oSQTHPriceBefore);
            const delta:BigNumber = vault.collateralAmount.sub(oSQTHdelta);

            return delta;
        };
        const getTypeAndDomainData = () => {
            const typeData = {
                Order: [
                    { type: "uint256", name: "bidId" },
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
                verifyingContract: crabStrategyV2.address,
            };
            return { typeData, domainData };
        };
        it("should hedge via OTC using multiple orders while sell oSQTH and updated timeAtLastHedge", async () => {
            await mintAndSell();
            const strategyVaultBefore = await controller.vaults(await crabStrategyV2.vaultId());
            // vault state before
            const deltaStart = await delta(strategyVaultBefore);
            // trader amount to sell oSQTH to change the deltas
            expect(deltaStart.isNegative()).to.be.false;

            // Calculate new Delta and the trades to make
            const newDelta = await delta(strategyVaultBefore);
            const oSQTHPriceAfter = await getOSQTHPrice();
            const toSell = wdiv(newDelta, oSQTHPriceAfter); // 0.12sqth to sell
            const toGET = wmul(toSell, oSQTHPriceAfter); // 0.04eth to get

            // make the approvals for the trade
            await weth.connect(random).deposit({ value: toGET });
            await weth.connect(random).approve(crabStrategyV2.address, toGET); //0.04eth
            await weth.connect(trader).deposit({ value: toGET });
            await weth.connect(trader).approve(crabStrategyV2.address, toGET); //0.04eth

            // get the pre trade balances for the trader
            const oSQTHTraderBalanceBefore = await wSqueeth.balanceOf(trader.address);
            const wethTraderBalanceBefore = await weth.balanceOf(trader.address);
            const oSQTHTraderBalanceBefore_2 = await wSqueeth.balanceOf(random.address);
            const wethTraderBalanceBefore_2 = await weth.balanceOf(random.address);

            // and prepare the trade
            const orderHash = {
                bidId: 0,
                trader: random.address,
                quantity: toSell.div(4), // 0.03sqth
                price: oSQTHPriceAfter,
                isBuying: true,
                expiry: (await provider.getBlock(await provider.getBlockNumber())).timestamp + 600,
                nonce: 1
            };
            const orderHash1 = {
                bidId: 0,
                trader: trader.address,
                quantity: toSell.div(2),
                price: oSQTHPriceAfter,
                isBuying: true,
                expiry: (await provider.getBlock(await provider.getBlockNumber())).timestamp + 600,
                nonce: 1
            };
            const orderHash2 = {
                bidId: 0,
                trader: random.address,
                quantity: toSell.div(4), // 0.03sqth
                price: oSQTHPriceAfter,
                isBuying: true,
                expiry: (await provider.getBlock(await provider.getBlockNumber())).timestamp + 600,
                nonce: 101
            };

            const { typeData, domainData } = getTypeAndDomainData();
            const signedOrder = await signTypedData(random, domainData, typeData, orderHash);
            const signedOrder1 = await signTypedData(trader, domainData, typeData, orderHash1);
            const signedOrder2 = await signTypedData(random, domainData, typeData, orderHash2);

            // Do the trade
            await crabStrategyV2.connect(owner).hedgeOTC(toSell, oSQTHPriceAfter, false, [signedOrder, signedOrder1, signedOrder2]);

            // check the delta and the vaults traded quantities
            const strategyVaultAfter = await controller.vaults(await crabStrategyV2.vaultId());
            let precision = 4; // the last of 18 digit precision
            expect(strategyVaultAfter.collateralAmount).be.closeTo(
                strategyVaultBefore.collateralAmount.add(toGET),
                precision
            );
            expect(strategyVaultAfter.shortAmount).be.closeTo(strategyVaultBefore.shortAmount.add(toSell), precision);
            expect((await delta(strategyVaultAfter)).toNumber()).be.closeTo(0, precision);
            // check the delta and the vaults traded quantities

            // check trader balances
            const oSQTHTraderBalanceAfter = await wSqueeth.balanceOf(trader.address);
            const wethTraderBalanceAfter = await weth.balanceOf(trader.address);
            const oSQTHTraderBalanceAfter_2 = await wSqueeth.balanceOf(random.address);
            const wethTraderBalanceAfter_2 = await weth.balanceOf(random.address);
            expect(oSQTHTraderBalanceAfter).be.closeTo(oSQTHTraderBalanceBefore.add(toSell.div(2)), precision);
            expect(wethTraderBalanceAfter).be.closeTo(wethTraderBalanceBefore.sub(toGET.div(2)), precision);
            expect(oSQTHTraderBalanceAfter_2).be.closeTo(oSQTHTraderBalanceBefore_2.add(toSell.div(2)), precision);
            expect(wethTraderBalanceAfter_2).be.closeTo(wethTraderBalanceBefore_2.sub(toGET.div(2)), precision);

            // get hedgeBlock to be updated
            const hedgeBlockNumber = await provider.getBlockNumber();
            const hedgeBlock = await provider.getBlock(hedgeBlockNumber);

            const timeAtLastHedge = await crabStrategyV2.timeAtLastHedge();
            const priceAtLastHedge = await crabStrategyV2.priceAtLastHedge();

            expect(timeAtLastHedge.eq(hedgeBlock.timestamp)).to.be.true;
            expect(priceAtLastHedge).to.eq(oSQTHPriceAfter);
        });
        it("should hedge via OTC using one order while selling oSQTH", async () => {
            // TODO comment and organize like below test
            const strategyVaultBefore = await controller.vaults(await crabStrategyV2.vaultId());
            const oSQTHPriceBefore = await oracle.getTwap(
                wSqueethPool.address,
                wSqueeth.address,
                weth.address,
                600,
                false
            );
            const oSQTHdelta = wmul(strategyVaultBefore.shortAmount.mul(2), oSQTHPriceBefore);
            const delta = strategyVaultBefore.collateralAmount.sub(oSQTHdelta);

            const ethToDeposit = ethers.utils.parseUnits("1000");
            const wSqueethToMint = ethers.utils.parseUnits("1000");
            const currentBlockTimestamp = (await provider.getBlock(await provider.getBlockNumber())).timestamp;
            await controller.connect(owner).mintWPowerPerpAmount("0", wSqueethToMint, "0", { value: ethToDeposit });
            await buyWeth(
                swapRouter,
                wSqueeth,
                weth,
                owner.address,
                await wSqueeth.balanceOf(owner.address),
                currentBlockTimestamp + 10
            );

            await provider.send("evm_increaseTime", [86400 + auctionTime / 2]);
            await provider.send("evm_mine", []);

            const oSQTHPriceAfter = await oracle.getTwap(
                wSqueethPool.address,
                wSqueeth.address,
                weth.address,
                600,
                false
            );
            const newOSQTHdelta = wmul(strategyVaultBefore.shortAmount.mul(2), oSQTHPriceAfter);
            const newDelta = strategyVaultBefore.collateralAmount.sub(newOSQTHdelta);
            const toSell = wdiv(newDelta, oSQTHPriceAfter);
            const toGET = wmul(toSell, oSQTHPriceAfter);

            const afterOSQTHdelta = wmul(strategyVaultBefore.shortAmount.add(toSell).mul(2), oSQTHPriceAfter);
            const afterTradeDelta = strategyVaultBefore.collateralAmount.add(toGET).sub(afterOSQTHdelta);

            // expect((await crabStrategyV2.checkTimeHedge())[0]).to.be.true;

            await weth.connect(random).deposit({ value: toGET });
            await weth.connect(random).approve(crabStrategyV2.address, toGET);
            const orderHash = {
                bidId: 0,
                trader: random.address,
                quantity: toSell,
                price: oSQTHPriceAfter,
                isBuying: true,
                expiry: (await provider.getBlock(await provider.getBlockNumber())).timestamp + 600,
                nonce: 2,
            };

            const { typeData, domainData } = getTypeAndDomainData();
            const signedOrder = await signTypedData(random, domainData, typeData, orderHash);

            await crabStrategyV2.connect(owner).hedgeOTC(toSell, oSQTHPriceAfter, false, [signedOrder]);
            const strategyVaultAfter = await controller.vaults(await crabStrategyV2.vaultId());
            let precision = 4;
            expect(strategyVaultAfter.shortAmount).be.closeTo(strategyVaultBefore.shortAmount.add(toSell), precision);
            expect(strategyVaultAfter.collateralAmount).be.closeTo(
                strategyVaultBefore.collateralAmount.add(toGET),
                precision
            );
        });
        it("should hedge via OTC using one order while buying oSQTH delta negative", async () => {
            const trader = random;
            // oSQTH price before
            const oSQTHPriceBefore = await oracle.getTwap(
                wSqueethPool.address,
                wSqueeth.address,
                weth.address,
                600,
                false
            );

            // vault state before
            const strategyVaultBefore = await controller.vaults(await crabStrategyV2.vaultId());
            const oSQTHdelta = wmul(strategyVaultBefore.shortAmount.mul(2), oSQTHPriceBefore);
            const delta = strategyVaultBefore.collateralAmount.sub(oSQTHdelta);

            const ethToDeposit = ethers.utils.parseUnits("1000");
            const wSqueethToMint = ethers.utils.parseUnits("1000");
            const currentBlockTimestamp = (await provider.getBlock(await provider.getBlockNumber())).timestamp;

            // trader amount to sell
            await controller.connect(trader).mintWPowerPerpAmount("0", wSqueethToMint, "0", { value: ethToDeposit });

            // do the trade to offset delta
            await buyWSqueeth(swapRouter, wSqueeth, weth, owner.address, ethToDeposit, currentBlockTimestamp + 10);

            await provider.send("evm_increaseTime", [86400 + auctionTime / 2]);
            await provider.send("evm_mine", []);

            const oSQTHPriceAfter = await oracle.getTwap(
                wSqueethPool.address,
                wSqueeth.address,
                weth.address,
                600,
                false
            );

            // Calculate new Delta and the trades to make
            const newOSQTHdelta = wmul(strategyVaultBefore.shortAmount.mul(2), oSQTHPriceAfter);
            const newDelta = strategyVaultBefore.collateralAmount.sub(newOSQTHdelta);

            const toGET = wdiv(newDelta.abs(), oSQTHPriceAfter);
            const toSell = wmul(toGET, oSQTHPriceAfter);

            const afterOSQTHdelta = wmul(strategyVaultBefore.shortAmount.sub(toGET).mul(2), oSQTHPriceAfter);
            const afterTradeDelta = strategyVaultBefore.collateralAmount.sub(toSell).sub(afterOSQTHdelta);

            // get the pre trade balances for the trader
            const oSQTHTraderBalanceBefore = await wSqueeth.balanceOf(trader.address);
            const wethTraderBalanceBefore = await weth.balanceOf(trader.address);

            // make the approvals for the trade and prepare the trade
            await wSqueeth.connect(trader).approve(crabStrategyV2.address, toGET);

            const orderHash = {
                bidId: 0,
                trader: trader.address,
                quantity: toGET,
                price: oSQTHPriceAfter,
                isBuying: false,
                expiry: (await provider.getBlock(await provider.getBlockNumber())).timestamp + 600,
                nonce: 3,
            };

            const { typeData, domainData } = getTypeAndDomainData();
            // Do the trade
            const signedOrder = await signTypedData(trader, domainData, typeData, orderHash);
            await crabStrategyV2.connect(owner).hedgeOTC(toGET, oSQTHPriceAfter, true, [signedOrder]);

            // check the delta and the vaults traded quantities
            const strategyVaultAfter = await controller.vaults(await crabStrategyV2.vaultId());
            const afterOSQTHdeltaReal = wmul(strategyVaultAfter.shortAmount.mul(2), oSQTHPriceAfter);
            const afterTradeDeltaReal = strategyVaultAfter.collateralAmount.sub(afterOSQTHdeltaReal);
            const precision = 4;
            expect(afterTradeDeltaReal.toNumber()).be.closeTo(0, precision);
            expect(strategyVaultAfter.collateralAmount).be.closeTo(
                strategyVaultBefore.collateralAmount.sub(toSell),
                precision
            );
            expect(strategyVaultAfter.shortAmount).be.closeTo(strategyVaultBefore.shortAmount.sub(toGET), precision);

            // check trader balances
            const oSQTHTraderBalanceAfter = await wSqueeth.balanceOf(trader.address);
            const wethTraderBalanceAfter = await weth.balanceOf(trader.address);
            expect(oSQTHTraderBalanceAfter).be.closeTo(oSQTHTraderBalanceBefore.sub(toGET), precision);
            expect(wethTraderBalanceAfter).be.closeTo(wethTraderBalanceBefore.add(toSell), precision);
        });
        it("allows manager to trader fewer quantity than sum of orders", async () => {
            let precision = 4;
            const strategyVaultBefore = await controller.vaults(await crabStrategyV2.vaultId());
            // vault state before
            const deltaStart = await delta(strategyVaultBefore);
            expect(deltaStart.toNumber()).be.closeTo(0, precision);
            // trader amount to sell oSQTH to change the deltas
            await mintAndSell();

            // Calculate new Delta and the trades to make
            const newDelta = await delta(strategyVaultBefore);
            const oSQTHPriceAfter = await getOSQTHPrice();
            const toSell = wdiv(newDelta, oSQTHPriceAfter);
            const toGET = wmul(toSell, oSQTHPriceAfter);

            // make the approvals for the trade
            await weth.connect(random).deposit({ value: toGET });
            await weth.connect(random).approve(crabStrategyV2.address, toGET);
            await weth.connect(trader).deposit({ value: toGET });
            await weth.connect(trader).approve(crabStrategyV2.address, toGET);

            // get the pre trade balances for the trader
            const oSQTHTraderBalanceBefore = await wSqueeth.balanceOf(trader.address);
            const wethTraderBalanceBefore = await weth.balanceOf(trader.address);
            const oSQTHTraderBalanceBefore_2 = await wSqueeth.balanceOf(random.address);
            const wethTraderBalanceBefore_2 = await weth.balanceOf(random.address);

            // and prepare the trade
            const orderHash = {
                bidId: 0,
                trader: random.address,
                quantity: toSell.div(2),
                price: oSQTHPriceAfter,
                isBuying: true,
                expiry: (await provider.getBlock(await provider.getBlockNumber())).timestamp + 600,
                nonce: 4,
            };
            // quantity is full and not half. hence more quantity for this case, but manager trades less
            const orderHash1 = {
                bidId: 0,
                trader: trader.address,
                quantity: toSell,
                price: oSQTHPriceAfter,
                isBuying: true,
                expiry: (await provider.getBlock(await provider.getBlockNumber())).timestamp + 600,
                nonce: 4,
            };

            const { typeData, domainData } = getTypeAndDomainData();
            const signedOrder = await signTypedData(random, domainData, typeData, orderHash);
            const signedOrder1 = await signTypedData(trader, domainData, typeData, orderHash1);

            // Do the trade
            await crabStrategyV2.connect(owner).hedgeOTC(toSell, oSQTHPriceAfter, false, [signedOrder, signedOrder1]);

            // check the delta and the vaults traded quantities
            const strategyVaultAfter = await controller.vaults(await crabStrategyV2.vaultId());
            expect(strategyVaultAfter.collateralAmount).be.closeTo(
                strategyVaultBefore.collateralAmount.add(toGET),
                precision
            );
            expect(strategyVaultAfter.shortAmount).be.closeTo(strategyVaultBefore.shortAmount.add(toSell), 4);
            expect((await delta(strategyVaultAfter)).toNumber()).be.closeTo(0, precision);
            // check the delta and the vaults traded quantities

            // check trader balances
            const oSQTHTraderBalanceAfter = await wSqueeth.balanceOf(trader.address);
            const wethTraderBalanceAfter = await weth.balanceOf(trader.address);
            const oSQTHTraderBalanceAfter_2 = await wSqueeth.balanceOf(random.address);
            const wethTraderBalanceAfter_2 = await weth.balanceOf(random.address);
            expect(oSQTHTraderBalanceAfter).be.closeTo(oSQTHTraderBalanceBefore.add(toSell.div(2)), precision);
            expect(wethTraderBalanceAfter).be.closeTo(wethTraderBalanceBefore.sub(toGET.div(2)), precision);
            expect(oSQTHTraderBalanceAfter_2).be.closeTo(oSQTHTraderBalanceBefore_2.add(toSell.div(2)), precision);
            expect(wethTraderBalanceAfter_2).be.closeTo(wethTraderBalanceBefore_2.sub(toGET.div(2)), precision);
        });
        it("allows manager to trade more quantity than sum of orders", async () => {
            let precision = 4;
            const strategyVaultBefore = await controller.vaults(await crabStrategyV2.vaultId());
            // vault state before
            const deltaStart = await delta(strategyVaultBefore);
            expect(deltaStart.toNumber()).be.closeTo(0, precision);
            // trader amount to sell oSQTH to change the deltas
            await mintAndSell();

            // Calculate new Delta and the trades to make
            const newDelta = await delta(strategyVaultBefore);
            const oSQTHPriceAfter = await getOSQTHPrice();
            const toSell = wdiv(newDelta, oSQTHPriceAfter);
            const toGET = wmul(toSell, oSQTHPriceAfter);

            // make the approvals for the trade
            await weth.connect(random).deposit({ value: toGET });
            await weth.connect(random).approve(crabStrategyV2.address, toGET);
            await weth.connect(trader).deposit({ value: toGET });
            await weth.connect(trader).approve(crabStrategyV2.address, toGET);

            // get the pre trade balances for the trader
            const oSQTHTraderBalanceBefore = await wSqueeth.balanceOf(trader.address);
            const wethTraderBalanceBefore = await weth.balanceOf(trader.address);
            const oSQTHTraderBalanceBefore_2 = await wSqueeth.balanceOf(random.address);
            const wethTraderBalanceBefore_2 = await weth.balanceOf(random.address);

            // and prepare the trade
            const orderHash = {
                bidId: 0,
                trader: random.address,
                quantity: toSell.div(2), // 0.06sqth
                price: oSQTHPriceAfter,
                isBuying: true,
                expiry: (await provider.getBlock(await provider.getBlockNumber())).timestamp + 600,
                nonce: 5,
            };
            const orderHash1 = {
                bidId: 0,
                trader: trader.address,
                quantity: toSell.div(2),
                price: oSQTHPriceAfter,
                isBuying: true,
                expiry: (await provider.getBlock(await provider.getBlockNumber())).timestamp + 600,
                nonce: 5,
            };

            const { typeData, domainData } = getTypeAndDomainData();
            const signedOrder = await signTypedData(random, domainData, typeData, orderHash);
            const signedOrder1 = await signTypedData(trader, domainData, typeData, orderHash1);

            // Do the trade
            await crabStrategyV2
                .connect(owner)
                .hedgeOTC(toSell.mul(2), oSQTHPriceAfter, false, [signedOrder, signedOrder1]);

            // check the delta and the vaults traded quantities
            const strategyVaultAfter = await controller.vaults(await crabStrategyV2.vaultId());
            expect(strategyVaultAfter.collateralAmount).be.closeTo(
                strategyVaultBefore.collateralAmount.add(toGET),
                precision
            );
            expect(strategyVaultAfter.shortAmount).be.closeTo(strategyVaultBefore.shortAmount.add(toSell), precision);
            expect((await delta(strategyVaultAfter)).toNumber()).be.closeTo(0, precision);
            // check the delta and the vaults traded quantities
            const oSQTHTraderBalanceAfter = await wSqueeth.balanceOf(trader.address);
            const wethTraderBalanceAfter = await weth.balanceOf(trader.address);
            const oSQTHTraderBalanceAfter_2 = await wSqueeth.balanceOf(random.address);
            const wethTraderBalanceAfter_2 = await weth.balanceOf(random.address);
            expect(oSQTHTraderBalanceAfter).be.closeTo(oSQTHTraderBalanceBefore.add(toSell.div(2)), precision);
            expect(wethTraderBalanceAfter).be.closeTo(wethTraderBalanceBefore.sub(toGET.div(2)), precision);
            expect(oSQTHTraderBalanceAfter_2).be.closeTo(oSQTHTraderBalanceBefore_2.add(toSell.div(2)), precision);
            expect(wethTraderBalanceAfter_2).be.closeTo(wethTraderBalanceBefore_2.sub(toGET.div(2)), precision);
        });
        it("allows manager to give buy at a greater price", async () => {
            let precision = 4;
            const strategyVaultBefore = await controller.vaults(await crabStrategyV2.vaultId());
            // vault state before
            const deltaStart = await delta(strategyVaultBefore);
            // -1 is almost 0, -1/10^18
            expect(deltaStart.toNumber()).be.closeTo(0, precision);
            // trader amount to sell oSQTH to change the deltas
            await mintAndSell();

            // Calculate new Delta and the trades to make
            const newDelta = await delta(strategyVaultBefore);
            const oSQTHPriceAfter = await getOSQTHPrice();
            const toSell = wdiv(newDelta, oSQTHPriceAfter);
            const toGET = wmul(toSell, oSQTHPriceAfter);

            // make the approvals for the trade
            await weth.connect(random).deposit({ value: toGET });
            await weth.connect(random).approve(crabStrategyV2.address, toGET);
            await weth.connect(trader).deposit({ value: toGET });
            await weth.connect(trader).approve(crabStrategyV2.address, toGET);

            // get the pre trade balances for the trader
            const oSQTHTraderBalanceBefore = await wSqueeth.balanceOf(trader.address);
            const wethTraderBalanceBefore = await weth.balanceOf(trader.address);
            const oSQTHTraderBalanceBefore_2 = await wSqueeth.balanceOf(random.address);
            const wethTraderBalanceBefore_2 = await weth.balanceOf(random.address);

            // and prepare the trade
            const orderHash = {
                bidId: 0,
                trader: random.address,
                quantity: toSell.div(2), // 0.06sqth
                price: oSQTHPriceAfter,
                isBuying: true,
                expiry: (await provider.getBlock(await provider.getBlockNumber())).timestamp + 600,
                nonce: 6,
            };
            const orderHash1 = {
                bidId: 0,
                trader: trader.address,
                quantity: toSell.div(2),
                price: oSQTHPriceAfter,
                isBuying: true,
                expiry: (await provider.getBlock(await provider.getBlockNumber())).timestamp + 600,
                nonce: 6,
            };

            const { typeData, domainData } = getTypeAndDomainData();
            const signedOrder = await signTypedData(random, domainData, typeData, orderHash);
            const signedOrder1 = await signTypedData(trader, domainData, typeData, orderHash1);

            // Do the trade with 4 percent more price
            const managerBuyPrice = oSQTHPriceAfter.mul(96).div(100);
            const newtoGET = wmul(toSell, managerBuyPrice);

            await crabStrategyV2.connect(owner).hedgeOTC(toSell, managerBuyPrice, false, [signedOrder, signedOrder1]);

            // check the delta and the vaults traded quantities
            const strategyVaultAfter = await controller.vaults(await crabStrategyV2.vaultId());
            const error = 1; // this is in decimals 18 so technically 0
            // we traded full collateral sell amount and in return got lesser than oSQTH that desired, hence delta will turn negative
            expect((await delta(strategyVaultAfter)).toNumber()).to.lessThan(
                0,
                "new delta has not been in the direction of trade"
            );
            expect(strategyVaultAfter.collateralAmount).be.closeTo(
                strategyVaultBefore.collateralAmount.add(newtoGET),
                precision
            );
            expect(strategyVaultAfter.shortAmount).be.closeTo(strategyVaultBefore.shortAmount.add(toSell), precision);
            // check the delta and the vaults traded quantities
            const oSQTHTraderBalanceAfter = await wSqueeth.balanceOf(trader.address);
            const wethTraderBalanceAfter = await weth.balanceOf(trader.address);
            const oSQTHTraderBalanceAfter_2 = await wSqueeth.balanceOf(random.address);
            const wethTraderBalanceAfter_2 = await weth.balanceOf(random.address);
            expect(oSQTHTraderBalanceAfter).be.closeTo(oSQTHTraderBalanceBefore.add(toSell.div(2)), precision);
            expect(wethTraderBalanceAfter).be.closeTo(wethTraderBalanceBefore.sub(newtoGET.div(2)), precision);
            expect(oSQTHTraderBalanceAfter_2).be.closeTo(oSQTHTraderBalanceBefore_2.add(toSell.div(2)), precision);
            expect(wethTraderBalanceAfter_2).be.closeTo(wethTraderBalanceBefore_2.sub(newtoGET.div(2)), precision);

            // trader amount to sell oSQTH to change the deltas
            await mintAndSell("50");
            const dlt = await delta(await controller.vaults(await crabStrategyV2.vaultId()));
            expect(dlt.toNumber()).to.be.greaterThan(0);
        });
        it("allows manager to give buy at a greater price and specify a quantity lesser than the same of order amounts", async () => {
            const precision = 4; // this is in decimals 18 so technically 0
            const strategyVaultBefore = await controller.vaults(await crabStrategyV2.vaultId());
            // vault state before
            const deltaStart = await delta(strategyVaultBefore);
            // -1 is almost 0, -1/10^18
            expect(deltaStart.toNumber()).greaterThanOrEqual(0);
            // trader amount to sell oSQTH to change the deltas
            await mintAndSell();

            // Calculate new Delta and the trades to make
            const newDelta = await delta(strategyVaultBefore);
            const oSQTHPriceAfter = await getOSQTHPrice();
            const toSell = wdiv(newDelta, oSQTHPriceAfter);
            const toGET = wmul(toSell, oSQTHPriceAfter);

            // make the approvals for the trade
            await weth.connect(random).deposit({ value: toGET });
            await weth.connect(random).approve(crabStrategyV2.address, toGET);
            await weth.connect(trader).deposit({ value: toGET });
            await weth.connect(trader).approve(crabStrategyV2.address, toGET);

            // get the pre trade balances for the trader
            const oSQTHTraderBalanceBefore = await wSqueeth.balanceOf(random.address);
            const wethTraderBalanceBefore = await weth.balanceOf(random.address);
            const oSQTHTraderBalanceBefore_2 = await wSqueeth.balanceOf(trader.address);
            const wethTraderBalanceBefore_2 = await weth.balanceOf(trader.address);

            // and prepare the trade
            const orderHash = {
                bidId: 0,
                trader: random.address,
                quantity: toSell.div(2), // 0.06sqth
                price: oSQTHPriceAfter,
                isBuying: true,
                expiry: (await provider.getBlock(await provider.getBlockNumber())).timestamp + 600,
                nonce: 7,
            };
            const orderHash1 = {
                bidId: 0,
                trader: trader.address,
                quantity: toSell.div(2),
                price: oSQTHPriceAfter,
                isBuying: true,
                expiry: (await provider.getBlock(await provider.getBlockNumber())).timestamp + 600,
                nonce: 7,
            };

            const { typeData, domainData } = getTypeAndDomainData();
            const signedOrder = await signTypedData(random, domainData, typeData, orderHash);
            const signedOrder1 = await signTypedData(trader, domainData, typeData, orderHash1);

            // Do the trade with 4 percent lesser price
            const managerBuyPrice = oSQTHPriceAfter.mul(96).div(100);
            // and only 90% of the total trader quantities. so we swap 50% with the first order and 40% with the next
            const newToSell = toSell.mul(90).div(100);
            const firstToGet = wmul(toSell, managerBuyPrice);
            const secondToGet = wmul(newToSell, managerBuyPrice);

            await crabStrategyV2.connect(owner).hedgeOTC(newToSell, managerBuyPrice, false, [signedOrder, signedOrder1]);

            // check the delta and the vaults traded quantities
            const strategyVaultAfter = await controller.vaults(await crabStrategyV2.vaultId());
            // we traded full collateral sell amount and in return got lesser than oSQTH that desired, hence delta will turn negative
            const afterTradeDelta = (await delta(strategyVaultAfter));
            expect(afterTradeDelta.lt(newDelta)).to.be.true;
            expect(strategyVaultAfter.collateralAmount).be.closeTo(
                strategyVaultBefore.collateralAmount.add(secondToGet),
                precision
            );
            expect(strategyVaultAfter.shortAmount).be.closeTo(
                strategyVaultBefore.shortAmount.add(newToSell),
                precision
            );
            // check the delta and the vaults traded quantities
            const oSQTHTraderBalanceAfter = await wSqueeth.balanceOf(random.address);
            const wethTraderBalanceAfter = await weth.balanceOf(random.address);
            const oSQTHTraderBalanceAfter_2 = await wSqueeth.balanceOf(trader.address);
            const wethTraderBalanceAfter_2 = await weth.balanceOf(trader.address);
            expect(oSQTHTraderBalanceAfter).be.closeTo(oSQTHTraderBalanceBefore.add(toSell.div(2)), precision); // he gets the full managerAmount
            expect(wethTraderBalanceAfter).be.closeTo(wethTraderBalanceBefore.sub(firstToGet.div(2)), precision); // he gets half of the new price benefits

            const difference = toSell.mul(10).div(100);
            const second_trader_receives = toSell.div(2).sub(difference); // he gets the full - 10% as manager is trading only 90 %
            expect(oSQTHTraderBalanceAfter_2).be.closeTo(
                oSQTHTraderBalanceBefore_2.add(second_trader_receives),
                precision
            );
            expect(wethTraderBalanceBefore_2.sub(wethTraderBalanceAfter_2)).be.closeTo(
                wmul(second_trader_receives, managerBuyPrice),
                precision
            );
        });
        it("should revert on heding too quickly after the previous hedge and when price is within threshold", async () => {
            // this sets the price Threshold to 5% which ensures that the revert is not happening due to price
            await crabStrategyV2.connect(owner).setHedgePriceThreshold(BigNumber.from(10).pow(16).mul(5));

            // set the time to 1 hr from prev hedge
            const lastHedge = await crabStrategyV2.timeAtLastHedge();
            const currentBlockNumber = await provider.getBlockNumber();
            const currentBlock = await provider.getBlock(currentBlockNumber);
            await provider.send("evm_setNextBlockTimestamp", [lastHedge.toNumber() + 3600]);
            await provider.send("evm_mine", []);

            const trader = random;

            // Calculate new Delta and the trades to make
            const toGet = ethers.utils.parseUnits("1");
            const toSell = ethers.utils.parseUnits("1");

            // make the approvals for the trade and prepare the trade
            await wSqueeth.connect(trader).approve(crabStrategyV2.address, toGet);
            const oSQTHPrice = await getOSQTHPrice();
            const orderHash = {
                bidId: 0,
                trader: trader.address,
                quantity: toSell,
                price: oSQTHPrice,
                isBuying: false,
                expiry: (await provider.getBlock(await provider.getBlockNumber())).timestamp + 600,
                nonce: 8,
            };

            const { typeData, domainData } = getTypeAndDomainData();
            // Do the trade
            const signedOrder = await signTypedData(trader, domainData, typeData, orderHash);
            await expect(
                crabStrategyV2.connect(owner).hedgeOTC(toSell, oSQTHPrice, true, [signedOrder])
            ).to.be.revertedWith("C22");
        });
        it("should revert when the hedge trade oSQTH price is beyond threshold", async () => {
            // set the time to 1 hr from prev hedge
            await provider.send("evm_increaseTime", [84600 + 3600]);
            const trader = random;

            // Calculate new Delta and the trades to make
            const toGet = ethers.utils.parseUnits("3.5");
            const toSell = ethers.utils.parseUnits("1");
            const oSQTHPrice = await getOSQTHPrice();

            // make the approvals for the trade and prepare the trade
            await wSqueeth.connect(trader).approve(crabStrategyV2.address, toGet);
            const managerBuyPrice = oSQTHPrice.mul(130).div(100);

            const orderHash = {
                bidId: 0,
                trader: trader.address,
                quantity: toSell,
                price: managerBuyPrice,
                isBuying: false,
                expiry: (await provider.getBlock(await provider.getBlockNumber())).timestamp + 600,
                nonce: 9,
            };
            const { typeData, domainData } = getTypeAndDomainData();
            // Do the trade
            const signedOrder = await signTypedData(trader, domainData, typeData, orderHash);
            // manager cant siphon off money to market makers
            await expect(
                crabStrategyV2.connect(owner).hedgeOTC(toSell, managerBuyPrice, true, [signedOrder])
            ).to.be.revertedWith("Price too high relative to Uniswap twap.");
        });
        it("should revert if the market maker order has expired", async () => {
            // set the time to 1 hr from prev hedge
            await provider.send("evm_increaseTime", [84600 + 3600]);
            const trader = random;

            // Calculate new Delta and the trades to make
            const toGet = ethers.utils.parseUnits("3.5");
            const toSell = ethers.utils.parseUnits("1");
            const oSQTHPrice = await getOSQTHPrice();

            // make the approvals for the trade and prepare the trade
            await wSqueeth.connect(trader).approve(crabStrategyV2.address, toGet);

            const orderHash = {
                bidId: 0,
                trader: trader.address,
                quantity: toSell,
                price: oSQTHPrice,
                isBuying: false,
                expiry: (await provider.getBlock(await provider.getBlockNumber())).timestamp + 600,
                nonce: 10,
            };
            const { typeData, domainData } = getTypeAndDomainData();
            // expire the order
            await provider.send("evm_increaseTime", [700]);
            // Do the trade
            const signedOrder = await signTypedData(trader, domainData, typeData, orderHash);
            await expect(
                crabStrategyV2.connect(owner).hedgeOTC(toSell, oSQTHPrice, true, [signedOrder])
            ).to.be.revertedWith("C20");
        });
        it("reverts when order sign is invalid", async () => {
            const trader = random;
            // vault state before
            const strategyVaultBefore = await controller.vaults(await crabStrategyV2.vaultId());

            const ethToDeposit = ethers.utils.parseUnits("1000");
            const wSqueethToMint = ethers.utils.parseUnits("1000");
            const currentBlockTimestamp = (await provider.getBlock(await provider.getBlockNumber())).timestamp;
            // trader amount to sell
            await controller.connect(trader).mintWPowerPerpAmount("0", wSqueethToMint, "0", { value: ethToDeposit });
            // do the trade to offset delta
            await buyWSqueeth(swapRouter, wSqueeth, weth, owner.address, ethToDeposit, currentBlockTimestamp + 10);

            await provider.send("evm_increaseTime", [86400 + auctionTime / 2]);

            const oSQTHPriceAfter = await oracle.getTwap(
                wSqueethPool.address,
                wSqueeth.address,
                weth.address,
                600,
                false
            );

            // Calculate new Delta and the trades to make
            const newOSQTHdelta = wmul(strategyVaultBefore.shortAmount.mul(2), oSQTHPriceAfter);
            const newDelta = strategyVaultBefore.collateralAmount.sub(newOSQTHdelta);

            const toGET = wdiv(newDelta.abs(), oSQTHPriceAfter);
            const toSell = wmul(toGET, oSQTHPriceAfter);

            // make the approvals for the trade and prepare the trade
            await wSqueeth.connect(trader).approve(crabStrategyV2.address, toGET);

            const orderHash = {
                bidId: 0,
                trader: trader.address,
                quantity: toSell,
                price: oSQTHPriceAfter,
                isBuying: false,
                expiry: (await provider.getBlock(await provider.getBlockNumber())).timestamp + 600,
                nonce: 11,
            };

            const { typeData, domainData } = getTypeAndDomainData();
            // Do the trade with wrong order
            const signedOrder = await signTypedData(depositor, domainData, typeData, orderHash);
            await expect(
                crabStrategyV2.connect(owner).hedgeOTC(toSell, oSQTHPriceAfter, true, [signedOrder])
            ).to.be.revertedWith("C19");
        });
        it("should revert when the manager Buy price is lesser than the traders price", async () => {
            await crabStrategyV2.connect(owner).setHedgePriceThreshold(BigNumber.from(10).pow(16).mul(5));
            // set the time to 1 hr from prev hedge
            await provider.send("evm_increaseTime", [84600 + 3600]);
            const trader = random;

            // Calculate new Delta and the trades to make
            const toGet = ethers.utils.parseUnits("3.125");
            const toSell = ethers.utils.parseUnits("1");
            const oSQTHPrice = await getOSQTHPrice();

            // make the approvals for the trade and prepare the trade
            await wSqueeth.connect(trader).approve(crabStrategyV2.address, toGet);
            const orderHash = {
                bidId: 0,
                trader: trader.address,
                quantity: toSell,
                price: oSQTHPrice,
                isBuying: false,
                expiry: (await provider.getBlock(await provider.getBlockNumber())).timestamp + 600,
                nonce: 12,
            };
            const { typeData, domainData } = getTypeAndDomainData();
            // Do the trade
            const signedOrder = await signTypedData(trader, domainData, typeData, orderHash);
            const managerBuyPrice = oSQTHPrice.mul(99).div(100);
            await expect(
                crabStrategyV2.connect(owner).hedgeOTC(toSell, managerBuyPrice, true, [signedOrder])
            ).to.be.revertedWith("C18");
        });
        it("manager buy price should be greater than 0", async () => {
            // set the time to 1 hr from prev hedge
            await provider.send("evm_increaseTime", [84600 + 3600]);
            const trader = random;

            // Calculate new Delta and the trades to make
            const toGet = ethers.utils.parseUnits("3.125");
            const toSell = ethers.utils.parseUnits("1");

            // make the approvals for the trade and prepare the trade
            await wSqueeth.connect(trader).approve(crabStrategyV2.address, toGet);

            const orderHash = {
                bidId: 0,
                trader: trader.address,
                quantity: toSell,
                price: 1,
                isBuying: false,
                expiry: (await provider.getBlock(await provider.getBlockNumber())).timestamp + 600,
                nonce: 12,
            };
            const { typeData, domainData } = getTypeAndDomainData();
            // Do the trade
            const signedOrder = await signTypedData(trader, domainData, typeData, orderHash);
            const managerBuyPrice = 0;
            await expect(
                crabStrategyV2.connect(owner).hedgeOTC(toSell, managerBuyPrice, true, [signedOrder])
            ).to.be.revertedWith("C21");

            // reverting this back to one percent
            await crabStrategyV2.connect(owner).setHedgePriceThreshold(BigNumber.from(10).pow(16).mul(1));
        });
        it("market maker should be able to cancel an order by incrementing its nonce", async () => {
            // set the time to 1 hr from prev hedge
            await provider.send("evm_increaseTime", [84600 + 3600]);
            const trader = random;
            const nonce = 67345;

            // Calculate new Delta and the trades to make
            const toGet = ethers.utils.parseUnits("3.125");
            const toSell = ethers.utils.parseUnits("1");

            // make the approvals for the trade and prepare the trade
            await wSqueeth.connect(trader).approve(crabStrategyV2.address, toGet);
            await crabStrategyV2.connect(trader).setNonceTrue(nonce);

            const orderHash = {
                bidId: 0,
                trader: trader.address,
                quantity: toSell,
                price: 1,
                isBuying: false,
                expiry: (await provider.getBlock(await provider.getBlockNumber())).timestamp + 600,
                nonce: nonce,
            };
            const { typeData, domainData } = getTypeAndDomainData();
            // Do the trade
            const signedOrder = await signTypedData(trader, domainData, typeData, orderHash);
            const managerBuyPrice = 1;
            await expect(
                crabStrategyV2.connect(owner).hedgeOTC(toSell, managerBuyPrice, true, [signedOrder])
            ).to.be.revertedWith("C27");
        });
        it("nonce repeated", async () => {
            // set the time to 1 hr from prev hedge
            await provider.send("evm_increaseTime", [84600 + 3600]);
            const trader = random;

            // Calculate new Delta and the trades to make
            const toGet = ethers.utils.parseUnits("3.125");
            const toSell = ethers.utils.parseUnits("1");

            // make the approvals for the trade and prepare the trade
            await wSqueeth.connect(trader).approve(crabStrategyV2.address, toGet);

            const orderHash = {
                bidId: 0,
                trader: trader.address,
                quantity: toSell,
                price: 1,
                isBuying: false,
                expiry: (await provider.getBlock(await provider.getBlockNumber())).timestamp + 600,
                nonce: 1, // this nonce is used in the first test
            };
            const { typeData, domainData } = getTypeAndDomainData();
            // Do the trade
            const signedOrder = await signTypedData(trader, domainData, typeData, orderHash);
            const managerBuyPrice = 1;
            await expect(
                crabStrategyV2.connect(owner).hedgeOTC(toSell, managerBuyPrice, true, [signedOrder])
            ).to.be.revertedWith("C27");
        });
        it("orders should be arranged in best price first", async () => {
            const strategyVaultBefore = await controller.vaults(await crabStrategyV2.vaultId());
            // vault state before
            const deltaStart = await delta(strategyVaultBefore);
            // trader amount to sell oSQTH to change the deltas
            await mintAndSell();

            // Calculate new Delta and the trades to make
            const newDelta = await delta(strategyVaultBefore);
            const oSQTHPriceAfter = await getOSQTHPrice();
            const toSell = wdiv(newDelta, oSQTHPriceAfter);
            const toGET = wmul(toSell, oSQTHPriceAfter);

            // make the approvals for the trade
            await weth.connect(random).deposit({ value: toGET });
            await weth.connect(random).approve(crabStrategyV2.address, toGET);
            await weth.connect(trader).deposit({ value: toGET });
            await weth.connect(trader).approve(crabStrategyV2.address, toGET);

            // and prepare the trade
            const orderHash = {
                bidId: 0,
                trader: random.address,
                quantity: toSell.div(2),
                price: oSQTHPriceAfter,
                isBuying: true,
                expiry: (await provider.getBlock(await provider.getBlockNumber())).timestamp + 600,
                nonce: 13,
            };
            const orderHash1 = {
                bidId: 0,
                trader: trader.address,
                quantity: toSell.div(2),
                price: oSQTHPriceAfter.mul(102).div(100),
                isBuying: true,
                expiry: (await provider.getBlock(await provider.getBlockNumber())).timestamp + 600,
                nonce: 13,
            };

            const { typeData, domainData } = getTypeAndDomainData();
            const signedOrder = await signTypedData(random, domainData, typeData, orderHash);
            const signedOrder1 = await signTypedData(trader, domainData, typeData, orderHash1);

            // Do the trade
            await expect(
                crabStrategyV2.connect(owner).hedgeOTC(toSell, oSQTHPriceAfter, false, [signedOrder, signedOrder1])
            ).to.be.revertedWith("C25");
        });
        it("order signed for a different contract i.e EIP 712 attack", async () => {
            // set the time to 1 hr from prev hedge
            await provider.send("evm_increaseTime", [84600 + 3600]);
            const trader = random;

            // Calculate new Delta and the trades to make
            const toGet = ethers.utils.parseUnits("3.125");
            const toSell = ethers.utils.parseUnits("1");

            // make the approvals for the trade and prepare the trade
            await wSqueeth.connect(trader).approve(crabStrategyV2.address, toGet);

            const orderHash = {
                bidId: 0,
                trader: trader.address,
                quantity: toSell,
                price: 1,
                isBuying: false,
                expiry: (await provider.getBlock(await provider.getBlockNumber())).timestamp + 600,
                nonce: 909090,
            };
            const { typeData, domainData } = getTypeAndDomainData();
            domainData.verifyingContract = timelock.address;
            // Do the trade
            const signedOrder = await signTypedData(trader, domainData, typeData, orderHash);
            const managerBuyPrice = 1;
            await expect(
                crabStrategyV2.connect(owner).hedgeOTC(toSell, managerBuyPrice, true, [signedOrder])
            ).to.be.revertedWith("C19");
        });
        it("should allow manager to set thresholds", async () => {
            await expect(crabStrategyV2.connect(owner).setHedgingTwapPeriod(120)).to.be.revertedWith(
                "C14"
            );
            await crabStrategyV2.connect(owner).setHedgingTwapPeriod(190);
            expect(await crabStrategyV2.hedgingTwapPeriod()).to.eq(190);

            await expect(crabStrategyV2.connect(owner).setHedgeTimeThreshold(0)).to.be.revertedWith(
                "C7"
            );
            await crabStrategyV2.connect(owner).setHedgeTimeThreshold(9000);
            expect(await crabStrategyV2.hedgeTimeThreshold()).to.eq(9000);

            await expect(
                crabStrategyV2.connect(owner).setOTCPriceTolerance(BigNumber.from(10).pow(17).mul(3))
            ).to.be.revertedWith("C15");
            await crabStrategyV2.connect(owner).setOTCPriceTolerance(BigNumber.from(10).pow(17));
            expect((await crabStrategyV2.otcPriceTolerance()).eq(BigNumber.from(10).pow(17))).to.be.true;
        });
    });
});