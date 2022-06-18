import { ethers, network } from "hardhat";
import { expect } from "chai";
import BigNumberJs from "bignumber.js";

import { Contract, BigNumber, providers, Signer } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { WETH9, MockErc20, Controller, Oracle, WPowerPerp, CrabStrategyV2, IERC20 } from "../../../typechain";
import {
    deployUniswapV3,
    deploySqueethCoreContracts,
    deployWETHAndDai,
    addWethDaiLiquidity,
    addSqueethLiquidity,
    buyWSqueeth,
    buyWeth,
} from "../../setup";
import { signTypedData, isSimilar, wmul, wdiv, one, oracleScaleFactor } from "../../utils";

BigNumberJs.set({ EXPONENTIAL_AT: 30 });

describe("Crab V2 flashswap integration test: time based hedging", function () {
    const startingEthPrice = 3000;
    const startingEthPrice1e18 = BigNumber.from(startingEthPrice).mul(one); // 3000 * 1e18
    const scaledStartingSqueethPrice1e18 = startingEthPrice1e18.mul(11).div(10).div(oracleScaleFactor); // 0.303 * 1e18
    const scaledStartingSqueethPrice = (startingEthPrice * 1.1) / oracleScaleFactor.toNumber(); // 0.303

    const hedgeTimeThreshold = 86400; // 24h
    const hedgePriceThreshold = ethers.utils.parseUnits("0.01");
    const auctionTime = 3600;
    const minPriceMultiplier = ethers.utils.parseUnits("0.95");
    const maxPriceMultiplier = ethers.utils.parseUnits("1.05");

    let provider: providers.JsonRpcProvider;
    let owner: SignerWithAddress;
    let depositor: SignerWithAddress;
    let random: SignerWithAddress;
    let trader: SignerWithAddress;
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

    this.beforeAll("Deploy uniswap protocol & setup uniswap pool", async () => {
        const accounts = await ethers.getSigners();
        const [_owner, _depositor, _random, _feeRecipient, _trader] = accounts;
        owner = _owner;
        depositor = _depositor;
        random = _random;
        trader = _trader;
        feeRecipient = _feeRecipient;
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

        const CrabStrategyContract = await ethers.getContractFactory("CrabStrategyV2");
        crabStrategy = (await CrabStrategyContract.deploy(
            controller.address,
            oracle.address,
            weth.address,
            uniswapFactory.address,
            wSqueethPool.address,
            hedgeTimeThreshold,
            hedgePriceThreshold,
            auctionTime,
            minPriceMultiplier,
            maxPriceMultiplier
        )) as CrabStrategyV2;

        const strategyCap = ethers.utils.parseUnits("1000");
        await crabStrategy.connect(owner).setStrategyCap(strategyCap);
        const strategyCapInContract = await crabStrategy.strategyCap();
        expect(strategyCapInContract.eq(strategyCap)).to.be.true;
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

    this.beforeAll("Deposit into strategy", async () => {
        const ethToDeposit = ethers.utils.parseUnits("20");
        const msgvalue = ethers.utils.parseUnits("10.1");
        const depositorSqueethBalanceBefore = await wSqueeth.balanceOf(depositor.address);

        await crabStrategy.connect(depositor).flashDeposit(ethToDeposit, { value: msgvalue });

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
        const squeethDelta = scaledStartingSqueethPrice1e18.mul(2); //.66*10^18
        const debtToMint = wdiv(ethToDeposit, squeethDelta.add(ethFeePerWSqueeth));
        const expectedEthDeposit = ethToDeposit.sub(debtToMint.mul(ethFeePerWSqueeth).div(one));

        const totalSupply = await crabStrategy.totalSupply();
        const depositorCrab = await crabStrategy.balanceOf(depositor.address);
        const strategyVault = await controller.vaults(await crabStrategy.vaultId());
        const debtAmount = strategyVault.shortAmount;
        const depositorSqueethBalance = await wSqueeth.balanceOf(depositor.address);
        const strategyContractSqueeth = await wSqueeth.balanceOf(crabStrategy.address);
        const lastHedgeTime = await crabStrategy.timeAtLastHedge();
        const currentBlockNumber = await provider.getBlockNumber();
        const currentBlock = await provider.getBlock(currentBlockNumber);
        const timeStamp = currentBlock.timestamp;
        const collateralAmount = await strategyVault.collateralAmount;

        expect(isSimilar(totalSupply.toString(), expectedEthDeposit.toString())).to.be.true;
        expect(isSimilar(depositorCrab.toString(), expectedEthDeposit.toString())).to.be.true;
        expect(isSimilar(debtAmount.toString(), debtToMint.toString())).to.be.true;
        expect(depositorSqueethBalance.eq(depositorSqueethBalanceBefore)).to.be.true;
        expect(strategyContractSqueeth.eq(BigNumber.from(0))).to.be.true;
        expect(lastHedgeTime.eq(timeStamp)).to.be.true;
    });

    describe("Sell auction", async () => {
        const getOSQTHPrice = () => oracle.getTwap(wSqueethPool.address, wSqueeth.address, weth.address, 600, false);
        const mintAndSell = async () => {
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
        };
        const delta = async (vault: any) => {
            // oSQTH price before
            let oSQTHPriceBefore = await getOSQTHPrice();
            let oSQTHdelta = wmul(vault.shortAmount.mul(2), oSQTHPriceBefore);
            let delta = vault.collateralAmount.sub(oSQTHdelta);
            console.log("oSQTHPrice is ", oSQTHPriceBefore.toString());
            console.log("collateral Amount is ", vault.collateralAmount.toString());
            console.log("shortAmoun ti", vault.shortAmount.toString());
            console.log("delta is ", delta.toString());

            return delta;
        };
        xit("should hedge by selling WSqueeth for ETH and update timestamp and price at hedge", async () => {
            // change pool price for auction to be sell auction
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
            const timeAtLastHedge = await crabStrategy.timeAtLastHedge();

            const auctionTriggerTimer = timeAtLastHedge.add(hedgeTimeThreshold);

            // set next block timestamp
            const currentBlockNumber = await provider.getBlockNumber();
            const currentBlock = await provider.getBlock(currentBlockNumber);
            const hedgeBlockTimestamp = currentBlock.timestamp + 100;
            await provider.send("evm_setNextBlockTimestamp", [hedgeBlockTimestamp]);

            const auctionTimeElapsed = BigNumber.from(hedgeBlockTimestamp).sub(auctionTriggerTimer);

            //expect(await crabStrategy.checkPriceHedge(auctionTriggerTimer)).to.be.false;
            expect((await crabStrategy.checkTimeHedge())[0]).to.be.true;
            console.log("vault id is", await crabStrategy.vaultId());

            let currentWSqueethPrice = await oracle.getTwap(
                wSqueethPool.address,
                wSqueeth.address,
                weth.address,
                600,
                false
            );
            console.log(currentWSqueethPrice.toString());
            const strategyVault = await controller.vaults(await crabStrategy.vaultId());
            console.log("strategyVault ", strategyVault.toString());
            const ethDelta = strategyVault.collateralAmount;
            console.log("ethDelta ", ethDelta.toString());
            const normFactor = await controller.normalizationFactor();
            console.log("normFactor ", normFactor.toString());
            const currentScaledSquethPrice = await oracle.getTwap(
                wSqueethPool.address,
                wSqueeth.address,
                weth.address,
                300,
                false
            );
            console.log("currentScaledSquethPrice ", currentScaledSquethPrice.toString());
            const feeRate = await controller.feeRate();
            const ethFeePerWSqueeth = currentScaledSquethPrice.mul(feeRate).div(10000);
            console.log("ethFeePerWSqueeth ", ethFeePerWSqueeth.toString());

            const strategyDebt = strategyVault.shortAmount;
            console.log("strategyDebt ", strategyDebt.toString());
            const initialWSqueethDelta = wmul(strategyDebt.mul(2), currentWSqueethPrice);
            console.log("initialWSqueethDelta ", initialWSqueethDelta.toString());
            const targetHedge = wdiv(initialWSqueethDelta.sub(ethDelta), currentWSqueethPrice.add(ethFeePerWSqueeth));
            console.log("targetHedge ", targetHedge.toString());
            const isSellAuction = targetHedge.isNegative();
            console.log("isSellAuction ", isSellAuction.toString());
            const auctionExecution = auctionTimeElapsed.gte(BigNumber.from(auctionTime))
                ? one
                : wdiv(auctionTimeElapsed, BigNumber.from(auctionTime));
            console.log("auctionExecution ", auctionExecution.toString());
            const result = calcPriceMulAndAuctionPrice(
                isSellAuction,
                maxPriceMultiplier,
                minPriceMultiplier,
                auctionExecution,
                currentWSqueethPrice
            );
            console.log("result ", result.toString());
            const expectedAuctionWSqueethEthPrice = result[1];
            console.log("expectedAuctionWSqueethEthPrice ", expectedAuctionWSqueethEthPrice.toString());
            const finalWSqueethDelta = wmul(strategyDebt.mul(2), expectedAuctionWSqueethEthPrice);
            console.log("finalWSqueethDelta ", finalWSqueethDelta.toString());
            const secondTargetHedge = wdiv(
                finalWSqueethDelta.sub(ethDelta),
                expectedAuctionWSqueethEthPrice.add(ethFeePerWSqueeth)
            );
            console.log("secondTargetHedge ", secondTargetHedge.toString());
            const expectedEthProceeds = wmul(secondTargetHedge.abs(), expectedAuctionWSqueethEthPrice);
            console.log("expectedEthProceeds ", expectedEthProceeds.toString());
            const expectedEthDeposited = expectedEthProceeds.sub(wmul(ethFeePerWSqueeth, secondTargetHedge.abs()));
            console.log("expectedEthDeposited ", expectedEthDeposited.toString());

            expect(isSellAuction).to.be.true;

            const senderWsqueethBalanceBefore = await wSqueeth.balanceOf(depositor.address);
            console.log("senderWsqueethBalanceBefore ", senderWsqueethBalanceBefore.toString());

            await crabStrategy
                .connect(depositor)
                .timeHedge(isSellAuction, expectedAuctionWSqueethEthPrice, { value: expectedEthProceeds.add(1) });

            const hedgeBlockNumber = await provider.getBlockNumber();
            console.log("hedgeBlockNumber ", hedgeBlockNumber.toString());
            const hedgeBlock = await provider.getBlock(hedgeBlockNumber);
            console.log("hedgeBlock ", hedgeBlock.toString());

            currentWSqueethPrice = await oracle.getTwap(
                wSqueethPool.address,
                wSqueeth.address,
                weth.address,
                600,
                false
            );
            console.log("currentWSqueethPrice ", currentWSqueethPrice.toString());
            const senderWsqueethBalanceAfter = await wSqueeth.balanceOf(depositor.address);
            console.log("senderWsqueethBalanceAfter ", senderWsqueethBalanceAfter.toString());
            const strategyVaultAfter = await controller.vaults(await crabStrategy.vaultId());
            console.log("strategyVaultAfter ", strategyVaultAfter.toString());
            const strategyCollateralAmountAfter = strategyVaultAfter.collateralAmount;
            console.log("strategyCollateralAmountAfter ", strategyCollateralAmountAfter.toString());
            const strategyDebtAmountAfter = strategyVaultAfter.shortAmount;
            console.log("strategyDebtAmountAfter ", strategyDebtAmountAfter.toString());
            const timeAtLastHedgeAfter = await crabStrategy.timeAtLastHedge();
            console.log("timeAtLastHedgeAfter ", timeAtLastHedgeAfter.toString());
            const priceAtLastHedgeAfter = await crabStrategy.priceAtLastHedge();
            console.log("priceAtLastHedgeAfter ", priceAtLastHedgeAfter.toString());

            expect(senderWsqueethBalanceAfter.gt(senderWsqueethBalanceBefore)).to.be.true;
            expect(
                isSimilar(
                    senderWsqueethBalanceAfter.sub(senderWsqueethBalanceBefore).toString(),
                    secondTargetHedge.abs().toString()
                )
            ).to.be.true;
            expect(isSimilar(strategyDebtAmountAfter.sub(strategyDebt).toString(), secondTargetHedge.abs().toString()))
                .to.be.true;
            expect(isSimilar(strategyCollateralAmountAfter.sub(ethDelta).toString(), expectedEthDeposited.toString()))
                .to.be.true;
            expect(timeAtLastHedgeAfter.eq(hedgeBlock.timestamp)).to.be.true;
            expect(priceAtLastHedgeAfter.eq(currentWSqueethPrice)).to.be.true;
        });
        it("should hedge via OTC using multiple orders while sell oSQTH", async () => {
            const strategyVaultBefore = await controller.vaults(await crabStrategy.vaultId());
            // vault state before
            let deltaStart = await delta(strategyVaultBefore);
            expect(deltaStart.toNumber()).eql(0);
            // trader amount to sell oSQTH to change the deltas
            await mintAndSell();

            // Calculate new Delta and the trades to make
            let newDelta = await delta(strategyVaultBefore);
            let oSQTHPriceAfter = await getOSQTHPrice(); 
            let toSell = wdiv(newDelta, oSQTHPriceAfter);
            let toGET = wmul(toSell, oSQTHPriceAfter);
            console.log(oSQTHPriceAfter.toString());
            console.log("new Delta is ", newDelta.toString());
            console.log("quantity of oSQTH sell is", toSell);
            console.log("quantity of ETH to get is", toGET);

            // make the approvals for the trade
            console.log("eth balance of random is ", await provider.getBalance(random.address));
            await weth.connect(random).deposit({ value: toGET });
            await weth.connect(random).approve(crabStrategy.address, toGET);
            await weth.connect(trader).deposit({ value: toGET });
            await weth.connect(trader).approve(crabStrategy.address, toGET);

            // get the pre trade balances for the trader
            let oSQTHTraderBalanceBefore = await wSqueeth.balanceOf(trader.address);
            let wethTraderBalanceBefore = await weth.balanceOf(trader.address);
            let oSQTHTraderBalanceBefore_2 = await wSqueeth.balanceOf(random.address);
            let wethTraderBalanceBefore_2 = await weth.balanceOf(random.address);

            // and prepare the trade
            console.log("Weth balance of random is ", await weth.balanceOf(random.address));
            let orderHash = {
                bidId: 0,
                trader: random.address,
                traderToken: weth.address,
                traderAmount: toGET.div(2),
                managerToken: wSqueeth.address,
                managerAmount: toSell.div(2),
                nonce: await crabStrategy.nonces(random.address),
            };
            let orderHash1 = {
                bidId: 0,
                trader: trader.address,
                traderToken: weth.address,
                traderAmount: toGET.div(2),
                managerToken: wSqueeth.address,
                managerAmount: toSell.div(2),
                nonce: await crabStrategy.nonces(random.address),
            };

            let domainData = {
                name: "CrabOTC",
                version: "2",
                chainId: network.config.chainId,
                verifyingContract: crabStrategy.address,
            };
            let typeData = {
                Order: [
                    { type: "uint256", name: "bidId" },
                    { type: "address", name: "trader" },
                    { type: "address", name: "traderToken" },
                    { type: "uint256", name: "traderAmount" },
                    { type: "address", name: "managerToken" },
                    { type: "uint256", name: "managerAmount" },
                    { type: "uint256", name: "nonce" },
                ],
            };
            let signedOrder = await signTypedData(random, domainData, typeData, orderHash);
            let signedOrder1 = await signTypedData(trader, domainData, typeData, orderHash1);
            let managerBuyPrice = signedOrder.managerAmount.mul(one).div(signedOrder.traderAmount);

            // Do the trade
            await crabStrategy.connect(owner).hedgeOTC(toSell, managerBuyPrice, [signedOrder, signedOrder1]);

            console.log(orderHash.traderAmount.toString(), orderHash.managerAmount.toString());
            console.log(managerBuyPrice);

            // check the delta and the vaults traded quantities
            let strategyVaultAfter = await controller.vaults(await crabStrategy.vaultId());
            let divError = 1; // this is 1 in decimal of 18 , this adds to us getting less oSQTH
            expect(strategyVaultAfter.collateralAmount).eq(strategyVaultBefore.collateralAmount.add(toGET));
            expect(strategyVaultAfter.shortAmount.add(divError).toString()).eq(
                strategyVaultBefore.shortAmount.add(toSell).toString()
            );
            expect((await delta(strategyVaultAfter)).toNumber()).to.eqls(0);
            console.log("before and after for the vaults");
            console.log(strategyVaultBefore.collateralAmount.toString(), strategyVaultBefore.shortAmount.toString());
            console.log(
                strategyVaultAfter.collateralAmount.toString(),
                strategyVaultAfter.shortAmount.toString(),
                oSQTHPriceAfter.toString()
            );
            // check the delta and the vaults traded quantities

            // check trader balances
            let oSQTHTraderBalanceAfter = await wSqueeth.balanceOf(trader.address);
            let wethTraderBalanceAfter = await weth.balanceOf(trader.address);
            let oSQTHTraderBalanceAfter_2 = await wSqueeth.balanceOf(random.address);
            let wethTraderBalanceAfter_2 = await weth.balanceOf(random.address);
            expect(oSQTHTraderBalanceAfter).eq(oSQTHTraderBalanceBefore.add(toSell.div(2)));
            expect(wethTraderBalanceAfter).eq(wethTraderBalanceBefore.sub(toGET.div(2)));
            expect(oSQTHTraderBalanceAfter_2).eq(oSQTHTraderBalanceBefore_2.add(toSell.div(2)));
            expect(wethTraderBalanceAfter_2).eq(wethTraderBalanceBefore_2.sub(toGET.div(2)));
        });
        it("should hedge via OTC using one order while selling oSQTH", async () => {
            // TODO comment and organize like below test
            let strategyVaultBefore = await controller.vaults(await crabStrategy.vaultId());
            console.log(strategyVaultBefore.collateralAmount.toString());
            console.log(strategyVaultBefore.shortAmount.toString());
            let oSQTHPriceBefore = await oracle.getTwap(
                wSqueethPool.address,
                wSqueeth.address,
                weth.address,
                600,
                false
            );
            console.log(oSQTHPriceBefore.toString());
            let oSQTHdelta = wmul(strategyVaultBefore.shortAmount.mul(2), oSQTHPriceBefore);
            let delta = strategyVaultBefore.collateralAmount.sub(oSQTHdelta);
            console.log("delta is ", delta.toString());

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

            let oSQTHPriceAfter = await oracle.getTwap(
                wSqueethPool.address,
                wSqueeth.address,
                weth.address,
                600,
                false
            );
            console.log(oSQTHPriceAfter.toString());
            let newOSQTHdelta = wmul(strategyVaultBefore.shortAmount.mul(2), oSQTHPriceAfter);
            let newDelta = strategyVaultBefore.collateralAmount.sub(newOSQTHdelta);
            console.log("new Delta is ", newDelta.toString());
            let toSell = wdiv(newDelta, oSQTHPriceAfter);
            console.log("quantity of oSQTH sell is", toSell);
            let toGET = wmul(toSell, oSQTHPriceAfter);
            console.log("quantity of ETH to get is", toGET);

            let afterOSQTHdelta = wmul(strategyVaultBefore.shortAmount.add(toSell).mul(2), oSQTHPriceAfter);
            let afterTradeDelta = strategyVaultBefore.collateralAmount.add(toGET).sub(afterOSQTHdelta);
            console.log("after trade delta would be", afterTradeDelta); //div by 10*18

            //expect((await crabStrategy.checkTimeHedge())[0]).to.be.true;

            console.log("eth balance of random is ", await provider.getBalance(random.address));
            await weth.connect(random).deposit({ value: toGET });
            await weth.connect(random).approve(crabStrategy.address, toGET);
            console.log("Weth balance of random is ", await weth.balanceOf(random.address));
            let orderHash = {
                bidId: 0,
                trader: random.address,
                traderToken: weth.address,
                traderAmount: toGET,
                managerToken: wSqueeth.address,
                managerAmount: toSell,
                nonce: await crabStrategy.nonces(random.address),
            };
            console.log(orderHash.traderAmount.toString(), orderHash.managerAmount.toString());

            let domainData = {
                name: "CrabOTC",
                version: "2",
                chainId: network.config.chainId,
                verifyingContract: crabStrategy.address,
            };
            let typeData = {
                Order: [
                    { type: "uint256", name: "bidId" },
                    { type: "address", name: "trader" },
                    { type: "address", name: "traderToken" },
                    { type: "uint256", name: "traderAmount" },
                    { type: "address", name: "managerToken" },
                    { type: "uint256", name: "managerAmount" },
                    { type: "uint256", name: "nonce" },
                ],
            };
            let signedOrder = await signTypedData(random, domainData, typeData, orderHash);

            let managerBuyPrice = signedOrder.managerAmount.mul(one).div(signedOrder.traderAmount);
            console.log(managerBuyPrice);

            await crabStrategy.connect(owner).hedgeOTC(toSell, managerBuyPrice, [signedOrder]);
            let strategyVaultAfter = await controller.vaults(await crabStrategy.vaultId());
            expect(
                isSimilar(
                    strategyVaultAfter.shortAmount.toString(),
                    strategyVaultBefore.shortAmount.add(toSell).toString()
                )
            ).to.be.true;
            expect(strategyVaultAfter.collateralAmount).eq(strategyVaultBefore.collateralAmount.add(toGET));
        });
        it("should hedge via OTC using one order while buying oSQTH delta negative", async () => {
            let trader = random;
            // oSQTH price before
            let oSQTHPriceBefore = await oracle.getTwap(
                wSqueethPool.address,
                wSqueeth.address,
                weth.address,
                600,
                false
            );
            console.log(oSQTHPriceBefore.toString());

            // vault state before
            let strategyVaultBefore = await controller.vaults(await crabStrategy.vaultId());
            let oSQTHdelta = wmul(strategyVaultBefore.shortAmount.mul(2), oSQTHPriceBefore);
            let delta = strategyVaultBefore.collateralAmount.sub(oSQTHdelta);
            console.log(strategyVaultBefore.collateralAmount.toString());
            console.log(strategyVaultBefore.shortAmount.toString());
            console.log("delta is ", delta.toString());

            const ethToDeposit = ethers.utils.parseUnits("1000");
            const wSqueethToMint = ethers.utils.parseUnits("1000");
            const currentBlockTimestamp = (await provider.getBlock(await provider.getBlockNumber())).timestamp;

            // trader amount to sell
            await controller.connect(trader).mintWPowerPerpAmount("0", wSqueethToMint, "0", { value: ethToDeposit });

            // do the trade to offset delta
            await buyWSqueeth(swapRouter, wSqueeth, weth, owner.address, ethToDeposit, currentBlockTimestamp + 10);

            await provider.send("evm_increaseTime", [86400 + auctionTime / 2]);
            await provider.send("evm_mine", []);

            let oSQTHPriceAfter = await oracle.getTwap(
                wSqueethPool.address,
                wSqueeth.address,
                weth.address,
                600,
                false
            );

            // Calculate new Delta and the trades to make
            console.log(oSQTHPriceAfter.toString());
            let newOSQTHdelta = wmul(strategyVaultBefore.shortAmount.mul(2), oSQTHPriceAfter);
            let newDelta = strategyVaultBefore.collateralAmount.sub(newOSQTHdelta);
            console.log("new Delta is ", newDelta.toString());

            let toGET = wdiv(newDelta.abs(), oSQTHPriceAfter);
            let toSell = wmul(toGET, oSQTHPriceAfter);

            console.log("quantity of oSQTH to buy is", toGET);
            console.log("quantity of ETH to sell is", toSell);

            let afterOSQTHdelta = wmul(strategyVaultBefore.shortAmount.sub(toGET).mul(2), oSQTHPriceAfter);
            let afterTradeDelta = strategyVaultBefore.collateralAmount.sub(toSell).sub(afterOSQTHdelta);
            console.log("after trade delta would be", afterTradeDelta); //div by 10*18

            // get the pre trade balances for the trader
            let oSQTHTraderBalanceBefore = await wSqueeth.balanceOf(trader.address);
            let wethTraderBalanceBefore = await weth.balanceOf(trader.address);

            // make the approvals for the trade and prepare the trade
            await wSqueeth.connect(trader).approve(crabStrategy.address, toGET);

            let orderHash = {
                bidId: 0,
                trader: trader.address,
                traderToken: wSqueeth.address,
                traderAmount: toGET,
                managerToken: weth.address,
                managerAmount: toSell,
                nonce: await crabStrategy.nonces(trader.address),
            };
            console.log(orderHash.traderAmount.toString(), orderHash.managerAmount.toString());

            let domainData = {
                name: "CrabOTC",
                version: "2",
                chainId: network.config.chainId,
                verifyingContract: crabStrategy.address,
            };
            let typeData = {
                Order: [
                    { type: "uint256", name: "bidId" },
                    { type: "address", name: "trader" },
                    { type: "address", name: "traderToken" },
                    { type: "uint256", name: "traderAmount" },
                    { type: "address", name: "managerToken" },
                    { type: "uint256", name: "managerAmount" },
                    { type: "uint256", name: "nonce" },
                ],
            };
            // Do the trade
            let signedOrder = await signTypedData(trader, domainData, typeData, orderHash);
            let managerBuyPrice = signedOrder.managerAmount.mul(one).div(signedOrder.traderAmount);
            console.log(managerBuyPrice);
            await crabStrategy.connect(owner).hedgeOTC(toSell, managerBuyPrice, [signedOrder]);

            // check the delta and the vaults traded quantities
            let strategyVaultAfter = await controller.vaults(await crabStrategy.vaultId());
            console.log("before and after for the vaults");
            console.log(strategyVaultBefore.collateralAmount.toString(), strategyVaultBefore.shortAmount.toString());
            console.log(
                strategyVaultAfter.collateralAmount.toString(),
                strategyVaultAfter.shortAmount.toString(),
                oSQTHPriceAfter.toString()
            );
            let afterOSQTHdeltaReal = wmul(strategyVaultAfter.shortAmount.mul(2), oSQTHPriceAfter);
            let afterTradeDeltaReal = strategyVaultAfter.collateralAmount.sub(afterOSQTHdeltaReal);
            expect(afterTradeDeltaReal.toNumber()).to.eqls(0);
            expect(strategyVaultAfter.collateralAmount).eq(strategyVaultBefore.collateralAmount.sub(toSell));
            expect(strategyVaultAfter.shortAmount).eq(strategyVaultBefore.shortAmount.sub(toGET));

            // check trader balances
            let oSQTHTraderBalanceAfter = await wSqueeth.balanceOf(trader.address);
            let wethTraderBalanceAfter = await weth.balanceOf(trader.address);
            expect(oSQTHTraderBalanceAfter).eq(oSQTHTraderBalanceBefore.sub(toGET));
            expect(wethTraderBalanceAfter).eq(wethTraderBalanceBefore.add(toSell));
        });
    });
});
