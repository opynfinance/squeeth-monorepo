pragma solidity =0.7.6;

pragma abicoder v2;

// test dependency
import "forge-std/Test.sol";
import { console } from "forge-std/console.sol";
//interface
import { IERC20 } from "openzeppelin/token/ERC20/IERC20.sol";
import { IController } from "squeeth-monorepo/interfaces/IController.sol";
import { IEulerMarkets } from "../../src/interface/IEulerMarkets.sol";
import { IEulerEToken } from "../../src/interface/IEulerEToken.sol";
import { IEulerDToken } from "../../src/interface/IEulerDToken.sol";
// contract
import { TestUtil } from "../util/TestUtil.t.sol";
import { ZenBullStrategy } from "../../src/ZenBullStrategy.sol";
import { CrabStrategyV2 } from "squeeth-monorepo/strategy/CrabStrategyV2.sol";
import { Controller } from "squeeth-monorepo/core/Controller.sol";
import { ZenEmergencyShutdown } from "../../src/ZenEmergencyShutdown.sol";
import { Quoter } from "v3-periphery/lens/Quoter.sol";
// lib
import { VaultLib } from "squeeth-monorepo/libs/VaultLib.sol";
import { StrategyMath } from "squeeth-monorepo/strategy/base/StrategyMath.sol"; // StrategyMath licensed under AGPL-3.0-only
import { UniOracle } from "../../src/UniOracle.sol";

/**
 * @notice Ropsten fork testing
 */
contract ZenEmergencyShutdownTestFork is Test {
    using StrategyMath for uint256;

    TestUtil internal testUtil;
    ZenBullStrategy internal bullStrategy;
    CrabStrategyV2 internal crabV2;
    Controller internal controller;
    ZenEmergencyShutdown internal emergencyShutdown;
    Quoter internal quoter;

    uint256 internal bullOwnerPk;
    uint256 internal deployerPk;
    uint256 internal user1Pk;
    uint256 internal user2Pk;

    uint256 internal cap;

    address internal user1;
    address internal user2;
    address internal weth;
    address internal usdc;
    address internal euler;
    address internal eulerMarketsModule;
    address internal eToken;
    address internal dToken;
    address internal wPowerPerp;
    address internal deployer;
    address internal bullOwner;
    address internal crabOwner;
    address internal controllerOwner;
    address internal ethWSqueethPool;
    address internal ethUsdcPool;

    uint256 internal constant WETH_DECIMALS_DIFF = 1e12;
    uint256 internal constant ONE = 1e18;
    uint256 internal constant ONE_ONE = 1e36;
    uint32 internal constant TWAP = 420;
    uint256 internal constant INDEX_SCALE = 10000;

    function setUp() public {
        string memory FORK_URL = vm.envString("FORK_URL");
        vm.createSelectFork(FORK_URL, 15781550);

        deployerPk = 0xA11CD;
        deployer = vm.addr(deployerPk);
        bullOwnerPk = 0xB11CD;
        bullOwner = vm.addr(bullOwnerPk);

        vm.startPrank(deployer);
        euler = 0x27182842E098f60e3D576794A5bFFb0777E025d3;
        eulerMarketsModule = 0x3520d5a913427E6F0D6A83E07ccD4A4da316e4d3;
        controller = Controller(0x64187ae08781B09368e6253F9E94951243A493D5);
        controllerOwner = controller.owner();
        ethWSqueethPool = controller.wPowerPerpPool();
        ethUsdcPool = controller.ethQuoteCurrencyPool();
        crabV2 = CrabStrategyV2(0x3B960E47784150F5a63777201ee2B15253D713e8);
        crabOwner = crabV2.owner();
        bullStrategy =
            new ZenBullStrategy(address(crabV2), address(controller), euler, eulerMarketsModule);
        bullStrategy.transferOwnership(bullOwner);
        usdc = controller.quoteCurrency();
        weth = controller.weth();
        eToken = IEulerMarkets(eulerMarketsModule).underlyingToEToken(weth);
        dToken = IEulerMarkets(eulerMarketsModule).underlyingToDToken(usdc);
        wPowerPerp = controller.wPowerPerp();
        quoter = Quoter(0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6);
        emergencyShutdown =
        new ZenEmergencyShutdown(address(bullStrategy), 0x1F98431c8aD98523631AE4a59f267346ea31F984);
        emergencyShutdown.transferOwnership(bullOwner);
        testUtil =
        new TestUtil(address(bullStrategy), address (controller), eToken, dToken, address(crabV2));

        vm.stopPrank();

        cap = 100000e18;
        vm.startPrank(bullOwner);
        bullStrategy.setCap(cap);
        bullStrategy.setShutdownContract(address(emergencyShutdown));
        vm.stopPrank();
        user1Pk = 0xA11CE;
        user1 = vm.addr(user1Pk);
        user2Pk = 0xC11CE;
        user2 = vm.addr(user2Pk);

        vm.label(user1, "User 1");
        vm.label(address(bullStrategy), "BullStrategy");
        vm.label(euler, "Euler");
        vm.label(eulerMarketsModule, "EulerMarkets");
        vm.label(usdc, "USDC");
        vm.label(weth, "WETH");
        vm.label(wPowerPerp, "oSQTH");
        vm.label(address(crabV2), "crabV2");
        vm.label(user2, "User 2");

        vm.deal(user1, 100000000e18);
        vm.deal(user2, 100000000e18);
        // this is a crab whale, get some crab token from
        vm.startPrank(0x06CECFbac34101aE41C88EbC2450f8602b3d164b);
        IERC20(crabV2).transfer(user1, 100e18);
        IERC20(crabV2).transfer(user2, 100e18);
        vm.stopPrank();
        // some WETH and USDC rich address
        vm.startPrank(0x57757E3D981446D585Af0D9Ae4d7DF6D64647806);
        IERC20(weth).transfer(user1, 5000e18);
        IERC20(weth).transfer(user2, 5000e18);
        vm.stopPrank();
    }

    function testSetUpBullStrategy() public {
        assertTrue(bullStrategy.owner() == bullOwner);
        assertTrue(bullStrategy.strategyCap() == cap);
    }

    function testSetUpEmergencyShutdown() public {
        assertTrue(emergencyShutdown.owner() == bullOwner);
        assertTrue(emergencyShutdown.bullStrategy() == address(bullStrategy));
    }

    function testSetEmergencyShutdownContractCallerNotOwner() public {
        vm.startPrank(deployer);
        vm.expectRevert(bytes("Ownable: caller is not the owner"));
        bullStrategy.setShutdownContract(address(emergencyShutdown));
    }

    function testSetEmergencyShutdownContractZeroAddress() public {
        vm.startPrank(bullOwner);
        vm.expectRevert(bytes("BS6"));
        bullStrategy.setShutdownContract(address(0));
    }

    function testSetEmergencyShutdownContract() public {
        vm.startPrank(bullOwner);
        bullStrategy.setShutdownContract(address(emergencyShutdown));
        assertEq(bullStrategy.shutdownContract(), address(emergencyShutdown));
    }

    function testSetCapWhenCallerNotOwner() public {
        cap = 1000000e18;
        vm.startPrank(deployer);
        vm.expectRevert(bytes("Ownable: caller is not the owner"));
        bullStrategy.setCap(10e18);
    }

    function testRedeemShortShutdownCallerNotwner() public {
        ZenEmergencyShutdown.ShutdownParams memory params = ZenEmergencyShutdown.ShutdownParams({
            shareToUnwind: ONE,
            ethLimitPrice: 1000,
            ethPoolFee: uint24(3000)
        });

        vm.startPrank(deployer);
        vm.expectRevert(bytes("Ownable: caller is not the owner"));

        emergencyShutdown.redeemShortShutdown(params);
    }

    function testShutdownRepayAndWithdrawFromNotEmergencyShutdownContract() public {
        vm.startPrank(bullOwner);
        vm.expectRevert(bytes("BS4"));

        bullStrategy.shutdownRepayAndWithdraw(0, 0);
    }

    function testDepositShutdown() public {
        vm.startPrank(controllerOwner);
        controller.shutDown();
        assertEq(controller.isShutDown(), true);
        vm.stopPrank();

        vm.startPrank(user1);
        vm.expectRevert(bytes("BS7"));
        bullStrategy.deposit(0);
        vm.stopPrank();
    }

    function testWithdrawalShutdown() public {
        uint256 crabToDeposit = 10e18;
        uint256 bullCrabBalanceBefore = bullStrategy.getCrabBalance();
        uint256 userEthBalanceBefore = address(user1).balance;
        vm.startPrank(user1);
        (uint256 wethToLend, uint256 usdcToBorrow) = _deposit(crabToDeposit);
        vm.stopPrank();

        uint256 bullCrabBalanceAfter = bullStrategy.getCrabBalance();

        assertEq(bullCrabBalanceAfter.sub(crabToDeposit), bullCrabBalanceBefore);
        assertEq(bullStrategy.balanceOf(user1), crabToDeposit);
        assertEq(IEulerDToken(dToken).balanceOf(address(bullStrategy)), usdcToBorrow);
        assertTrue(
            wethToLend.sub(IEulerEToken(eToken).balanceOfUnderlying(address(bullStrategy))) <= 1
        );
        assertEq(userEthBalanceBefore.sub(address(user1).balance), wethToLend);
        assertEq(IERC20(usdc).balanceOf(user1), usdcToBorrow);

        vm.startPrank(controllerOwner);
        controller.shutDown();
        assertEq(controller.isShutDown(), true);
        vm.stopPrank();

        vm.startPrank(user1);
        vm.expectRevert();
        bullStrategy.withdraw(0);
        vm.stopPrank();
    }

    function testEmergencyShutdown() public {
        // this is repeat of the testSecondDeposit() logic to set up state for a shutdown
        {
            uint256 crabToDepositInitially = 10e18;
            uint256 bullCrabBalanceBefore = bullStrategy.getCrabBalance();

            vm.startPrank(user1);
            (uint256 wethToLend, uint256 usdcToBorrow) = _deposit(crabToDepositInitially);
            vm.stopPrank();

            uint256 bullCrabBalanceAfter = bullStrategy.getCrabBalance();

            assertEq(bullCrabBalanceAfter.sub(crabToDepositInitially), bullCrabBalanceBefore);
            assertEq(bullStrategy.balanceOf(user1), crabToDepositInitially);
            assertEq(IEulerDToken(dToken).balanceOf(address(bullStrategy)), usdcToBorrow);
            assertTrue(
                wethToLend.sub(IEulerEToken(eToken).balanceOfUnderlying(address(bullStrategy))) <= 1
            );
            assertEq(IERC20(usdc).balanceOf(user1), usdcToBorrow);

            bullCrabBalanceBefore = bullStrategy.getCrabBalance();
            uint256 userUsdcBalanceBefore = IERC20(usdc).balanceOf(user1);
            uint256 userBullBalanceBefore = bullStrategy.balanceOf(user1);
            uint256 crabToDepositSecond = 7e18;
            uint256 bullToMint = testUtil.calcBullToMint(crabToDepositSecond);
            vm.startPrank(user1);
            (uint256 wethToLendSecond, uint256 usdcToBorrowSecond) = _deposit(crabToDepositSecond);
            vm.stopPrank();

            bullCrabBalanceAfter = bullStrategy.getCrabBalance();

            assertEq(bullCrabBalanceAfter.sub(crabToDepositSecond), bullCrabBalanceBefore);
            assertEq(bullStrategy.balanceOf(user1).sub(userBullBalanceBefore), bullToMint);
            assertEq(
                IEulerDToken(dToken).balanceOf(address(bullStrategy)).sub(usdcToBorrow),
                usdcToBorrowSecond
            );
            assertTrue(
                wethToLendSecond.sub(
                    IEulerEToken(eToken).balanceOfUnderlying(address(bullStrategy)).sub(wethToLend)
                ) <= 1
            );
            assertEq(IERC20(usdc).balanceOf(user1).sub(usdcToBorrowSecond), userUsdcBalanceBefore);
        }

        // start shutdown test
        // percent to redeem
        uint256 percentToRedeem = ONE;
        (uint256 crabCollateral, uint256 crabDebt) = testUtil.getCrabVaultDetails();
        uint256 ethUsdPrice = UniOracle._getTwap(ethUsdcPool, weth, usdc, TWAP, false);
        uint256 crabShares = bullStrategy.getCrabBalance();

        uint256 ethInCrabAfterShutdown = crabCollateral.sub(
            crabDebt.wmul(controller.normalizationFactor()).wmul(ethUsdPrice.div(INDEX_SCALE))
        );
        uint256 ethFromCrabRedemption =
            crabShares.wdiv(crabV2.totalSupply()).wmul(ethInCrabAfterShutdown);

        vm.startPrank(controllerOwner);
        controller.shutDown();
        assertEq(controller.isShutDown(), true);
        vm.stopPrank();

        vm.startPrank(crabOwner);
        crabV2.redeemShortShutdown();
        vm.stopPrank();

        vm.startPrank(bullOwner);
        bullStrategy.setShutdownContract(address(emergencyShutdown));

        uint256 expectedEthToPay = quoter.quoteExactOutputSingle(
            weth, usdc, 3000, bullStrategy.calcUsdcToRepay(percentToRedeem), 0
        );
        uint256 effectivePrice = bullStrategy.calcUsdcToRepay(percentToRedeem).mul(
            WETH_DECIMALS_DIFF
        ).wdiv(expectedEthToPay);

        uint256 ethInLeverage = bullStrategy.calcWethToWithdraw(percentToRedeem);
        uint256 contractEthBefore = address(bullStrategy).balance;

        ZenEmergencyShutdown.ShutdownParams memory params = ZenEmergencyShutdown.ShutdownParams({
            shareToUnwind: percentToRedeem,
            ethLimitPrice: effectivePrice.wmul(0.9e18),
            ethPoolFee: uint24(3000)
        });

        emergencyShutdown.redeemShortShutdown(params);
        vm.stopPrank();

        uint256 expectedContractEthAfter =
            ethFromCrabRedemption.add(ethInLeverage.sub(expectedEthToPay)).add(contractEthBefore);
        uint256 contractEthAfter = address(bullStrategy).balance;

        assertEq(contractEthAfter, expectedContractEthAfter);
        assertEq(IEulerDToken(dToken).balanceOf(address(bullStrategy)), 0);
        assertEq(IEulerEToken(eToken).balanceOf(address(bullStrategy)), 0);
        assertEq(IEulerEToken(eToken).balanceOfUnderlying(address(bullStrategy)), 0);
        assertEq(IERC20(weth).balanceOf(address(bullStrategy)), 0);
        assertEq(IERC20(usdc).balanceOf(address(bullStrategy)), 0);
        assertEq(IERC20(crabV2).balanceOf(address(bullStrategy)), 0);

        vm.startPrank(user1);

        contractEthBefore = contractEthAfter;
        uint256 percentBullToRedeem = 0.5e18; // 50%
        uint256 userBullBalanceBeforeShutdown = bullStrategy.balanceOf(address(user1));
        uint256 bullToRedeem = percentBullToRedeem.wmul(userBullBalanceBeforeShutdown);
        uint256 expectedProceeds =
            bullToRedeem.wdiv(bullStrategy.totalSupply()).wmul(contractEthBefore);
        uint256 userEthBalanceBefore = address(user1).balance;
        uint256 bullSupplyBefore = bullStrategy.totalSupply();

        bullStrategy.withdrawShutdown(bullToRedeem);

        contractEthAfter = address(bullStrategy).balance;
        uint256 bullSupplyAfter = bullStrategy.totalSupply();
        uint256 userBullBalanceAfter = bullStrategy.balanceOf(address(user1));
        //user checks
        assertEq(address(user1).balance, userEthBalanceBefore.add(expectedProceeds));
        assertEq(userBullBalanceAfter, userBullBalanceBeforeShutdown.sub(bullToRedeem));
        //contract state checks
        assertEq(contractEthAfter, contractEthBefore.sub(expectedProceeds));
        assertEq(bullSupplyAfter, bullSupplyBefore.sub(bullToRedeem));

        vm.stopPrank();

        vm.startPrank(user1);

        contractEthBefore = contractEthAfter;
        percentBullToRedeem = 1e18; // 100%
        userBullBalanceBeforeShutdown = bullStrategy.balanceOf(address(user1));
        bullToRedeem = percentBullToRedeem.wmul(userBullBalanceBeforeShutdown);
        expectedProceeds = bullToRedeem.wdiv(bullStrategy.totalSupply()).wmul(contractEthBefore);
        userEthBalanceBefore = address(user1).balance;
        bullSupplyBefore = bullStrategy.totalSupply();

        bullStrategy.withdrawShutdown(bullToRedeem);

        contractEthAfter = address(bullStrategy).balance;
        bullSupplyAfter = bullStrategy.totalSupply();
        userBullBalanceAfter = bullStrategy.balanceOf(address(user1));
        //user checks
        assertEq(address(user1).balance, userEthBalanceBefore.add(expectedProceeds));
        assertEq(userBullBalanceAfter, userBullBalanceBeforeShutdown.sub(bullToRedeem));
        //contract state checks
        assertEq(contractEthAfter, contractEthBefore.sub(expectedProceeds));
        assertEq(bullSupplyAfter, bullSupplyBefore.sub(bullToRedeem));
        assertEq(bullSupplyAfter, 0);
        assertEq(contractEthAfter, 0);

        vm.stopPrank();
    }

    function testEmergencyShutdownPartial() public {
        // this is repeat of the testSecondDeposit() logic to set up state for a shutdown
        {
            uint256 crabToDepositInitially = 10e18;
            uint256 bullCrabBalanceBefore = bullStrategy.getCrabBalance();

            vm.startPrank(user1);
            (uint256 wethToLend, uint256 usdcToBorrow) = _deposit(crabToDepositInitially);
            vm.stopPrank();

            uint256 bullCrabBalanceAfter = bullStrategy.getCrabBalance();

            assertEq(bullCrabBalanceAfter.sub(crabToDepositInitially), bullCrabBalanceBefore);
            assertEq(bullStrategy.balanceOf(user1), crabToDepositInitially);
            assertEq(IEulerDToken(dToken).balanceOf(address(bullStrategy)), usdcToBorrow);
            assertTrue(
                wethToLend.sub(IEulerEToken(eToken).balanceOfUnderlying(address(bullStrategy))) <= 1
            );
            assertEq(IERC20(usdc).balanceOf(user1), usdcToBorrow);

            bullCrabBalanceBefore = bullStrategy.getCrabBalance();
            uint256 userUsdcBalanceBefore = IERC20(usdc).balanceOf(user2);
            uint256 userBullBalanceBefore = bullStrategy.balanceOf(user2);
            uint256 crabToDepositSecond = 7e18;
            uint256 bullToMint = testUtil.calcBullToMint(crabToDepositSecond);

            vm.startPrank(user2);
            (uint256 wethToLendSecond, uint256 usdcToBorrowSecond) = _deposit(crabToDepositSecond);
            vm.stopPrank();

            bullCrabBalanceAfter = bullStrategy.getCrabBalance();

            assertEq(bullCrabBalanceAfter.sub(crabToDepositSecond), bullCrabBalanceBefore);
            assertEq(bullStrategy.balanceOf(user2).sub(userBullBalanceBefore), bullToMint);
            assertEq(
                IEulerDToken(dToken).balanceOf(address(bullStrategy)).sub(usdcToBorrow),
                usdcToBorrowSecond
            );
            assertTrue(
                wethToLendSecond.sub(
                    IEulerEToken(eToken).balanceOfUnderlying(address(bullStrategy)).sub(wethToLend)
                ) <= 1
            );
            assertEq(IERC20(usdc).balanceOf(user2).sub(usdcToBorrowSecond), userUsdcBalanceBefore);
        }

        (uint256 crabCollateral, uint256 crabDebt) = testUtil.getCrabVaultDetails();

        {
            // start shutdown test where we redeem in 2 clips of 50%
            // percent to redeem

            uint256 percentToRedeem = ONE.div(2); //50%
            uint256 ethUsdPrice = UniOracle._getTwap(ethUsdcPool, weth, usdc, TWAP, false);
            uint256 crabBalanceBefore = bullStrategy.getCrabBalance();
            uint256 crabShares = crabBalanceBefore.wmul(percentToRedeem);
            uint256 ethFromCrabRedemption =
                testUtil.calculateCrabRedemption(crabShares, ethUsdPrice, crabCollateral, crabDebt);

            vm.startPrank(controllerOwner);
            controller.shutDown();
            assertEq(controller.isShutDown(), true);
            vm.stopPrank();

            vm.startPrank(crabOwner);
            crabV2.redeemShortShutdown();
            vm.stopPrank();

            vm.startPrank(bullOwner);
            bullStrategy.setShutdownContract(address(emergencyShutdown));

            uint256 usdcDebt = bullStrategy.calcUsdcToRepay(percentToRedeem);
            uint256 totalUsdcDebt = bullStrategy.calcUsdcToRepay(ONE);
            uint256 expectedEthToPay = quoter.quoteExactOutputSingle(weth, usdc, 3000, usdcDebt, 0);
            uint256 effectivePrice = bullStrategy.calcUsdcToRepay(percentToRedeem).mul(
                WETH_DECIMALS_DIFF
            ).wdiv(expectedEthToPay);

            uint256 totalEthInLeverage = bullStrategy.calcWethToWithdraw(ONE);
            uint256 ethInLeverage = bullStrategy.calcWethToWithdraw(percentToRedeem);
            uint256 contractEthBeforeRedeem = address(bullStrategy).balance;

            ZenEmergencyShutdown.ShutdownParams memory params = ZenEmergencyShutdown.ShutdownParams({
                shareToUnwind: percentToRedeem,
                ethLimitPrice: effectivePrice.wmul(0.9e18),
                ethPoolFee: uint24(3000)
            });

            emergencyShutdown.redeemShortShutdown(params);
            vm.stopPrank();

            uint256 contractEthAfterRedeem = address(bullStrategy).balance;

            assertEq(
                contractEthAfterRedeem,
                ethFromCrabRedemption.add(ethInLeverage.sub(expectedEthToPay)).add(
                    contractEthBeforeRedeem
                )
            );
            assertEq(
                IEulerDToken(dToken).balanceOf(address(bullStrategy)), totalUsdcDebt.sub(usdcDebt)
            );
            assertApproxEqAbs(
                IEulerEToken(eToken).balanceOfUnderlying(address(bullStrategy)),
                totalEthInLeverage.sub(ethInLeverage),
                1
            );
            assertEq(IERC20(weth).balanceOf(address(bullStrategy)), 0);
            assertEq(IERC20(usdc).balanceOf(address(bullStrategy)), 0);
            assertEq(
                IERC20(crabV2).balanceOf(address(bullStrategy)), crabBalanceBefore.sub(crabShares)
            );
        }

        // try to redeem before strategy has been totally unwound, should revert
        vm.startPrank(user1);
        uint256 balanceToWithdraw = bullStrategy.balanceOf(address(user1));
        vm.expectRevert(bytes("BS3"));
        bullStrategy.withdrawShutdown(balanceToWithdraw);
        vm.stopPrank();

        {
            //redeem the rest of crab
            uint256 percentToRedeem = ONE; //100%, remainder of crab
            uint256 ethUsdPrice = UniOracle._getTwap(ethUsdcPool, weth, usdc, TWAP, false);
            uint256 crabBalanceBefore = bullStrategy.getCrabBalance();
            uint256 crabShares = crabBalanceBefore.wmul(percentToRedeem);
            uint256 ethFromCrabRedemption =
                testUtil.calculateCrabRedemption(crabShares, ethUsdPrice, crabCollateral, crabDebt);

            vm.startPrank(bullOwner);

            uint256 usdcDebt = bullStrategy.calcUsdcToRepay(percentToRedeem);
            uint256 totalUsdcDebt = bullStrategy.calcUsdcToRepay(ONE);
            uint256 expectedEthToPay = quoter.quoteExactOutputSingle(weth, usdc, 3000, usdcDebt, 0);
            uint256 effectivePrice = bullStrategy.calcUsdcToRepay(percentToRedeem).mul(
                WETH_DECIMALS_DIFF
            ).wdiv(expectedEthToPay);

            uint256 totalEthInLeverage = bullStrategy.calcWethToWithdraw(ONE);
            uint256 ethInLeverage = bullStrategy.calcWethToWithdraw(percentToRedeem);
            uint256 contractEthBeforeRedeem = address(bullStrategy).balance;

            ZenEmergencyShutdown.ShutdownParams memory params = ZenEmergencyShutdown.ShutdownParams({
                shareToUnwind: percentToRedeem,
                ethLimitPrice: effectivePrice.wmul(0.9e18),
                ethPoolFee: uint24(3000)
            });

            emergencyShutdown.redeemShortShutdown(params);
            vm.stopPrank();

            uint256 contractEthAfterRedeem = address(bullStrategy).balance;

            assertEq(
                contractEthAfterRedeem,
                ethFromCrabRedemption.add(ethInLeverage.sub(expectedEthToPay)).add(
                    contractEthBeforeRedeem
                )
            );
            assertEq(
                IEulerDToken(dToken).balanceOf(address(bullStrategy)), totalUsdcDebt.sub(usdcDebt)
            );
            assertEq(
                IEulerEToken(eToken).balanceOfUnderlying(address(bullStrategy)),
                totalEthInLeverage.sub(ethInLeverage)
            );
            assertEq(IEulerDToken(dToken).balanceOf(address(bullStrategy)), 0);
            assertEq(IEulerEToken(eToken).balanceOf(address(bullStrategy)), 0);
            assertEq(IEulerEToken(eToken).balanceOfUnderlying(address(bullStrategy)), 0);
            assertEq(IERC20(weth).balanceOf(address(bullStrategy)), 0);
            assertEq(IERC20(usdc).balanceOf(address(bullStrategy)), 0);
            assertEq(
                IERC20(crabV2).balanceOf(address(bullStrategy)), crabBalanceBefore.sub(crabShares)
            );
            assertEq(IERC20(crabV2).balanceOf(address(bullStrategy)), 0);
        }

        // can not redeem again

        {
            vm.startPrank(bullOwner);
            ZenEmergencyShutdown.ShutdownParams memory params = ZenEmergencyShutdown.ShutdownParams({
                shareToUnwind: ONE,
                ethLimitPrice: 0,
                ethPoolFee: uint24(3000)
            });
            vm.expectRevert(bytes("ES1"));
            emergencyShutdown.redeemShortShutdown(params);
            vm.stopPrank();
        }

        vm.startPrank(user1);

        uint256 contractEthBefore = address(bullStrategy).balance;
        uint256 percentBullToRedeem = 0.5e18; // 50%
        uint256 userBullBalanceBeforeShutdown = bullStrategy.balanceOf(address(user1));
        uint256 bullToRedeem = percentBullToRedeem.wmul(userBullBalanceBeforeShutdown);
        uint256 expectedProceeds =
            bullToRedeem.wdiv(bullStrategy.totalSupply()).wmul(contractEthBefore);
        uint256 userEthBalanceBefore = address(user1).balance;
        uint256 bullSupplyBefore = bullStrategy.totalSupply();

        bullStrategy.withdrawShutdown(bullToRedeem);

        uint256 contractEthAfter = address(bullStrategy).balance;
        uint256 bullSupplyAfter = bullStrategy.totalSupply();
        uint256 userBullBalanceAfter = bullStrategy.balanceOf(address(user1));
        //user checks
        assertEq(address(user1).balance, userEthBalanceBefore.add(expectedProceeds));
        assertEq(userBullBalanceAfter, userBullBalanceBeforeShutdown.sub(bullToRedeem));
        //contract state checks
        assertEq(contractEthAfter, contractEthBefore.sub(expectedProceeds));
        assertEq(bullSupplyAfter, bullSupplyBefore.sub(bullToRedeem));

        vm.stopPrank();

        vm.startPrank(user2);

        contractEthBefore = contractEthAfter;
        percentBullToRedeem = 1e18; // 100%
        userBullBalanceBeforeShutdown = bullStrategy.balanceOf(address(user2));
        bullToRedeem = percentBullToRedeem.wmul(userBullBalanceBeforeShutdown);
        expectedProceeds = bullToRedeem.wdiv(bullStrategy.totalSupply()).wmul(contractEthBefore);
        userEthBalanceBefore = address(user2).balance;
        bullSupplyBefore = bullStrategy.totalSupply();

        bullStrategy.withdrawShutdown(bullToRedeem);

        contractEthAfter = address(bullStrategy).balance;
        bullSupplyAfter = bullStrategy.totalSupply();
        userBullBalanceAfter = bullStrategy.balanceOf(address(user2));
        //user checks
        assertEq(address(user2).balance, userEthBalanceBefore.add(expectedProceeds));
        assertEq(userBullBalanceAfter, userBullBalanceBeforeShutdown.sub(bullToRedeem));
        //contract state checks
        assertEq(contractEthAfter, contractEthBefore.sub(expectedProceeds));
        assertEq(bullSupplyAfter, bullSupplyBefore.sub(bullToRedeem));

        vm.stopPrank();

        vm.startPrank(user1);

        contractEthBefore = contractEthAfter;
        percentBullToRedeem = 1e18; // 100%
        userBullBalanceBeforeShutdown = bullStrategy.balanceOf(address(user1));
        bullToRedeem = percentBullToRedeem.wmul(userBullBalanceBeforeShutdown);
        expectedProceeds = bullToRedeem.wdiv(bullStrategy.totalSupply()).wmul(contractEthBefore);
        userEthBalanceBefore = address(user1).balance;
        bullSupplyBefore = bullStrategy.totalSupply();

        bullStrategy.withdrawShutdown(bullToRedeem);

        contractEthAfter = address(bullStrategy).balance;
        bullSupplyAfter = bullStrategy.totalSupply();
        userBullBalanceAfter = bullStrategy.balanceOf(address(user1));
        //user checks
        assertEq(address(user1).balance, userEthBalanceBefore.add(expectedProceeds));
        assertEq(userBullBalanceAfter, userBullBalanceBeforeShutdown.sub(bullToRedeem));
        //contract state checks
        assertEq(contractEthAfter, contractEthBefore.sub(expectedProceeds));
        assertEq(bullSupplyAfter, bullSupplyBefore.sub(bullToRedeem));
        assertEq(bullSupplyAfter, 0);
        assertEq(contractEthAfter, 0);

        vm.stopPrank();
    }

    /**
     *
     * /************************************************************* Helper functions for testing! ********************************************************
     */
    function _deposit(uint256 _crabToDeposit) internal returns (uint256, uint256) {
        (uint256 wethToLend, uint256 usdcToBorrow) =
            testUtil.calcCollateralAndBorrowAmount(_crabToDeposit);

        IERC20(crabV2).approve(address(bullStrategy), _crabToDeposit);
        bullStrategy.deposit{value: wethToLend}(_crabToDeposit);

        return (wethToLend, usdcToBorrow);
    }

    function _calcWPowerPerpAndCrabNeededForWithdraw(uint256 _bullAmount)
        internal
        view
        returns (uint256, uint256)
    {
        uint256 share = _bullAmount.wdiv(bullStrategy.totalSupply());
        uint256 crabToRedeem = share.wmul(bullStrategy.getCrabBalance());
        uint256 crabTotalSupply = IERC20(crabV2).totalSupply();
        (, uint256 squeethInCrab) = testUtil.getCrabVaultDetails();
        return (crabToRedeem.wmul(squeethInCrab).wdiv(crabTotalSupply), crabToRedeem);
    }

    function _calcUsdcNeededForWithdraw(uint256 _bullAmount) internal view returns (uint256) {
        uint256 share = _bullAmount.wdiv(bullStrategy.totalSupply());
        return share.wmul(IEulerDToken(dToken).balanceOf(address(bullStrategy)));
    }

    function _getRevertMsg(bytes memory _returnData) internal pure returns (string memory) {
        // If the _res length is less than 68, then the transaction failed silently (without a revert message)
        if (_returnData.length < 68) return "Transaction reverted silently";

        assembly {
            // Slice the sighash.
            _returnData := add(_returnData, 0x04)
        }
        return abi.decode(_returnData, (string)); // All that remains is the revert string
    }
}
