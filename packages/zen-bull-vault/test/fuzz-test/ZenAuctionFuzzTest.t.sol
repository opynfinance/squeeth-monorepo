pragma solidity =0.7.6;

pragma abicoder v2;

// test dependency
import "forge-std/Test.sol";
import { console } from "forge-std/console.sol";
//interface
import { IERC20 } from "openzeppelin/token/ERC20/IERC20.sol";
import { IWETH9 } from "squeeth-monorepo/interfaces/IWETH9.sol";
import { IController } from "squeeth-monorepo/interfaces/IController.sol";
import { IEulerMarkets } from "../../src/interface/IEulerMarkets.sol";
import { IEulerEToken } from "../../src/interface/IEulerEToken.sol";
import { IEulerDToken } from "../../src/interface/IEulerDToken.sol";
import { ISwapRouter } from "v3-periphery/interfaces/ISwapRouter.sol";
// contract
import { TestUtil } from "../util/TestUtil.t.sol";
import { SwapRouter } from "v3-periphery/SwapRouter.sol";
import { Quoter } from "v3-periphery/lens/Quoter.sol";
import { ZenBullStrategy } from "../../src/ZenBullStrategy.sol";
import { CrabStrategyV2 } from "squeeth-monorepo/strategy/CrabStrategyV2.sol";
import { Controller } from "squeeth-monorepo/core/Controller.sol";
import { ZenAuction } from "../../src/ZenAuction.sol";
import { FlashZen } from "../../src/FlashZen.sol";
import { SigUtil } from "../util/SigUtil.sol";
// lib
import { VaultLib } from "squeeth-monorepo/libs/VaultLib.sol";
import { StrategyMath } from "squeeth-monorepo/strategy/base/StrategyMath.sol"; // StrategyMath licensed under AGPL-3.0-only
import { UniOracle } from "../../src/UniOracle.sol";

/**
 * @notice fuzz testing
 */
contract ZenAuctionFuzzTest is Test {
    using StrategyMath for uint256;

    uint32 internal constant TWAP = 420;
    uint128 internal constant ONE = 1e18;
    uint256 internal constant WETH_DECIMALS_DIFF = 1e12;

    ZenBullStrategy internal bullStrategy;
    FlashZen internal flashBull;
    ZenAuction internal auctionBull;
    CrabStrategyV2 internal crabV2;
    Controller internal controller;
    SwapRouter internal swapRouter;
    TestUtil internal testUtil;
    Quoter internal quoter;
    SigUtil internal sigUtil;

    uint256 internal user1Pk;
    uint256 internal user2Pk;
    uint256 internal ownerPk;
    uint256 internal deployerPk;
    uint256 internal auctionManagerPk;

    address internal user1;
    address internal user2;
    address internal owner;
    address internal deployer;
    address internal auctionManager;

    address internal weth;
    address internal usdc;
    address internal euler;
    address internal factory;
    address internal ethWSqueethPool;
    address internal ethUsdcPool;
    address internal eulerMarketsModule;
    address internal eToken;
    address internal dToken;
    address internal wPowerPerp;

    uint256 internal cap;

    /// @dev to avoid stack too deep
    uint256 currentWethInLeverage;
    uint256 currentDebt;
    uint256 targetWethInLeverage;
    uint256 targetDebt;
    uint256 userWethBalanceBeforeAuction;
    uint256 userWPowerPerpBalanceBeforeAuction;
    uint256 user2WethBalanceBeforeAuction;
    uint256 user2WPowerPerpBalanceBeforeAuction;
    ZenAuction.Order[] orders;

    function setUp() public {
        string memory FORK_URL = vm.envString("FORK_URL");
        // vm.createSelectFork(FORK_URL, 15939557);
        vm.createSelectFork(FORK_URL, 15781550);

        ownerPk = 0xA1CCE;
        owner = vm.addr(ownerPk);
        auctionManagerPk = 0xA1DCE;
        auctionManager = vm.addr(auctionManagerPk);
        deployerPk = 0xA11CE;
        deployer = vm.addr(deployerPk);
        user1Pk = 0xA11DE;
        user1 = vm.addr(user1Pk);
        user2Pk = 0xC11CE;
        user2 = vm.addr(user2Pk);

        vm.startPrank(deployer);
        quoter = Quoter(0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6);
        swapRouter = SwapRouter(0xE592427A0AEce92De3Edee1F18E0157C05861564);
        factory = 0x1F98431c8aD98523631AE4a59f267346ea31F984;
        euler = 0x27182842E098f60e3D576794A5bFFb0777E025d3;
        eulerMarketsModule = 0x3520d5a913427E6F0D6A83E07ccD4A4da316e4d3;
        controller = Controller(0x64187ae08781B09368e6253F9E94951243A493D5);
        crabV2 = CrabStrategyV2(0x3B960E47784150F5a63777201ee2B15253D713e8);
        bullStrategy = new ZenBullStrategy(
            address(crabV2),
            address(controller),
            euler,
            eulerMarketsModule
        );
        bullStrategy.transferOwnership(owner);
        flashBull = new FlashZen(address(bullStrategy), factory);
        usdc = controller.quoteCurrency();
        weth = controller.weth();
        eToken = IEulerMarkets(eulerMarketsModule).underlyingToEToken(weth);
        dToken = IEulerMarkets(eulerMarketsModule).underlyingToDToken(usdc);
        wPowerPerp = controller.wPowerPerp();
        ethWSqueethPool = controller.wPowerPerpPool();
        ethUsdcPool = controller.ethQuoteCurrencyPool();
        auctionBull = new ZenAuction(
            auctionManager,
            address(bullStrategy),
            factory,
            address(crabV2),
            eToken,
            dToken
        );
        auctionBull.transferOwnership(owner);
        testUtil = new TestUtil(
            address(bullStrategy),
            address(controller),
            eToken,
            dToken,
            address(crabV2)
        );
        sigUtil = new SigUtil(auctionBull.DOMAIN_SEPARATOR());
        vm.stopPrank();

        cap = 100000e18;
        vm.startPrank(owner);
        bullStrategy.setCap(cap);
        bullStrategy.setAuction(address(auctionBull));
        auctionBull.setCrUpperAndLower(1.8e18, 2.2e18);
        auctionBull.setDeltaUpperAndLower(0.9e18, 1.1e18);
        auctionBull.setFullRebalanceClearingPriceTolerance(2e17);
        auctionBull.setRebalanceWethLimitPriceTolerance(2e17);
        vm.stopPrank();

        vm.label(user1, "User 1");
        vm.label(user2, "User 2");
        vm.label(address(bullStrategy), "BullStrategy");
        vm.label(euler, "Euler");
        vm.label(eulerMarketsModule, "EulerMarkets");
        vm.label(usdc, "USDC");
        vm.label(weth, "WETH");
        vm.label(wPowerPerp, "oSQTH");
        vm.label(address(crabV2), "crabV2");
        vm.label(address(swapRouter), "SwapRouter");
        vm.label(address(sigUtil), "SigUtils");

        vm.deal(user1, 10000000e18);
        vm.deal(user2, 10000000e18);
        // this is a crab whale, get some crab token from
        vm.prank(0x06CECFbac34101aE41C88EbC2450f8602b3d164b);
        IERC20(crabV2).transfer(user1, 50e18);
        vm.prank(0x06CECFbac34101aE41C88EbC2450f8602b3d164b);
        IERC20(crabV2).transfer(user2, 50e18);
        // some WETH and USDC rich address
        vm.prank(0x57757E3D981446D585Af0D9Ae4d7DF6D64647806);
        IERC20(weth).transfer(user1, 5000e18);
        vm.prank(0x57757E3D981446D585Af0D9Ae4d7DF6D64647806);
        IERC20(weth).transfer(user2, 5000e18);
        vm.prank(0x40ec5B33f54e0E8A33A975908C5BA1c14e5BbbDf);
        IERC20(usdc).transfer(user1, 250000000e6);
        vm.prank(0x40ec5B33f54e0E8A33A975908C5BA1c14e5BbbDf);
        IERC20(usdc).transfer(user2, 250000000e6);
        //vm.stopPrank();
        // osQTH whale
        vm.prank(0x35AeD16f957b39342744B8366A8c13172507D7b8);
        IERC20(wPowerPerp).transfer(user1, 500e18);
        vm.prank(0x35AeD16f957b39342744B8366A8c13172507D7b8);
        IERC20(wPowerPerp).transfer(user2, 500e18);
        // mint more oSQTH
        vm.prank(user1);
        controller.mintWPowerPerpAmount{value: 100000e18}(0, 10000e18, 0);
        vm.prank(user2);
        controller.mintWPowerPerpAmount{value: 100000e18}(0, 10000e18, 0);

        _initateDepositInBull();
    }

    function testFuzzingFullRebalance(
        uint256 sellUsdcBuyWethAmount,
        uint256 sellWethBuyUsdcAmount,
        uint256 sellWethBuyWPowerPerpAmount,
        uint256 sellWPowerPerpAmountBuyWethAmount
    ) public {
        sellUsdcBuyWethAmount = bound(sellUsdcBuyWethAmount, 1, 5000000e6);
        sellWethBuyUsdcAmount = bound(sellWethBuyUsdcAmount, 1, 200e18);
        sellWethBuyWPowerPerpAmount = bound(sellWethBuyWPowerPerpAmount, 1, 200e18);
        sellWPowerPerpAmountBuyWethAmount = bound(sellWPowerPerpAmountBuyWethAmount, 1, 200e18);
        currentDebt = IEulerDToken(dToken).balanceOf(address(bullStrategy));
        currentWethInLeverage = IEulerEToken(eToken).balanceOfUnderlying(address(bullStrategy));
        {
            // All possible price moves
            vm.startPrank(user1);
            IERC20(usdc).approve(address(swapRouter), type(uint256).max);
            IERC20(weth).approve(address(swapRouter), type(uint256).max);
            IERC20(wPowerPerp).approve(address(swapRouter), type(uint256).max);
            IWETH9(weth).deposit{value: sellWethBuyWPowerPerpAmount}();
            IWETH9(weth).deposit{value: sellWethBuyUsdcAmount}();
            IERC20(wPowerPerp).approve(address(auctionBull), type(uint256).max);

            swapRouter.exactInputSingle(
                ISwapRouter.ExactInputSingleParams({
                    tokenIn: usdc,
                    tokenOut: weth,
                    fee: uint24(3000),
                    recipient: msg.sender,
                    deadline: block.timestamp,
                    amountIn: sellUsdcBuyWethAmount,
                    amountOutMinimum: 0,
                    sqrtPriceLimitX96: 0
                })
            );
            swapRouter.exactInputSingle(
                ISwapRouter.ExactInputSingleParams({
                    tokenIn: weth,
                    tokenOut: usdc,
                    fee: uint24(3000),
                    recipient: msg.sender,
                    deadline: block.timestamp,
                    amountIn: sellWethBuyUsdcAmount,
                    amountOutMinimum: 0,
                    sqrtPriceLimitX96: 0
                })
            );
            swapRouter.exactInputSingle(
                ISwapRouter.ExactInputSingleParams({
                    tokenIn: weth,
                    tokenOut: wPowerPerp,
                    fee: uint24(3000),
                    recipient: msg.sender,
                    deadline: block.timestamp,
                    amountIn: sellWethBuyWPowerPerpAmount,
                    amountOutMinimum: 0,
                    sqrtPriceLimitX96: 0
                })
            );
            swapRouter.exactInputSingle(
                ISwapRouter.ExactInputSingleParams({
                    tokenIn: wPowerPerp,
                    tokenOut: weth,
                    fee: uint24(3000),
                    recipient: msg.sender,
                    deadline: block.timestamp,
                    amountIn: sellWPowerPerpAmountBuyWethAmount,
                    amountOutMinimum: 0,
                    sqrtPriceLimitX96: 0
                })
            );
            vm.stopPrank();
            vm.warp(block.timestamp + 1000);
        }

        uint256 ethUsdPrice = UniOracle._getTwap(
            controller.ethQuoteCurrencyPool(),
            controller.weth(),
            controller.quoteCurrency(),
            TWAP,
            false
        );

        (targetWethInLeverage, targetDebt) = _calcTargetCollateralAndDebtInLeverage();

        (uint256 crabAmount, bool isDepositingInCrab) = _calcCrabAmountToTrade(
            currentWethInLeverage, currentDebt, targetWethInLeverage, targetDebt, ethUsdPrice
        );

        (uint256 ethInCrab, uint256 squeethInCrab) = _getCrabVaultDetails();
        uint256 wPowerPerpAmountToTrade =
            _calcWPowerPerpAmountFromCrab(isDepositingInCrab, crabAmount, ethInCrab, squeethInCrab);

        {
            // trader signature vars
            uint8 v;
            bytes32 r;
            bytes32 s;
            // trader signing bid
            SigUtil.Order memory orderSig = SigUtil.Order({
                bidId: 1,
                trader: user1,
                quantity: wPowerPerpAmountToTrade,
                price: isDepositingInCrab ? type(uint256).max : 1,
                isBuying: isDepositingInCrab,
                expiry: block.timestamp + 1000,
                nonce: 0
            });
            bytes32 bidDigest = sigUtil.getTypedDataHash(orderSig);
            (v, r, s) = vm.sign(user1Pk, bidDigest);
            ZenAuction.Order memory orderData = ZenAuction.Order({
                bidId: 1,
                trader: user1,
                quantity: wPowerPerpAmountToTrade,
                price: isDepositingInCrab ? type(uint256).max : 1,
                isBuying: isDepositingInCrab,
                expiry: block.timestamp + 1000,
                nonce: 0,
                v: v,
                r: r,
                s: s
            });
            orders.push(orderData);
        }
        uint256 squeethEthPrice = UniOracle._getTwap(
            controller.wPowerPerpPool(), controller.wPowerPerp(), controller.weth(), TWAP, false
        );
        vm.prank(user1);
        IERC20(weth).approve(address(auctionBull), wPowerPerpAmountToTrade.mul(squeethEthPrice));
        userWPowerPerpBalanceBeforeAuction = IERC20(wPowerPerp).balanceOf(user1);
        userWethBalanceBeforeAuction = IERC20(weth).balanceOf(user1);
        uint256 bullCrabBalanceBefore = IERC20(crabV2).balanceOf(address(bullStrategy));
        vm.prank(auctionManager);
        auctionBull.fullRebalance(
            orders,
            crabAmount,
            squeethEthPrice,
            targetWethInLeverage,
            (targetDebt < currentDebt) ? ethUsdPrice.wmul(8e17) : ethUsdPrice.wmul(12e17),
            3000,
            isDepositingInCrab
        );

        (, uint256 squeethInCrabAfter) = _getCrabVaultDetails();
        currentDebt = IEulerDToken(dToken).balanceOf(address(bullStrategy));
        currentWethInLeverage = IEulerEToken(eToken).balanceOfUnderlying(address(bullStrategy));

        assertApproxEqRel(
            IEulerEToken(eToken).balanceOfUnderlying(address(bullStrategy)),
            targetWethInLeverage,
            1e16
        );
        if (isDepositingInCrab) {
            assertEq(
                userWPowerPerpBalanceBeforeAuction.add(wPowerPerpAmountToTrade),
                IERC20(wPowerPerp).balanceOf(user1)
            );
            assertEq(
                userWethBalanceBeforeAuction.sub(wPowerPerpAmountToTrade.wmul(squeethEthPrice)),
                IERC20(weth).balanceOf(user1)
            );
            assertApproxEqRel(
                bullCrabBalanceBefore.add(crabAmount),
                IERC20(crabV2).balanceOf(address(bullStrategy)),
                1e5
            );
            assertEq(squeethInCrab.add(wPowerPerpAmountToTrade), squeethInCrabAfter);
        } else {
            assertEq(
                userWPowerPerpBalanceBeforeAuction.sub(wPowerPerpAmountToTrade),
                IERC20(wPowerPerp).balanceOf(user1)
            );
            assertEq(
                userWethBalanceBeforeAuction.add(wPowerPerpAmountToTrade.wmul(squeethEthPrice)),
                IERC20(weth).balanceOf(user1)
            );
            assertApproxEqRel(
                bullCrabBalanceBefore.sub(crabAmount),
                IERC20(crabV2).balanceOf(address(bullStrategy)),
                1e5
            );
        }
    }

    // Helper functions
    function _getCrabVaultDetails() internal view returns (uint256, uint256) {
        VaultLib.Vault memory strategyVault =
            IController(address(controller)).vaults(crabV2.vaultId());

        return (strategyVault.collateralAmount, strategyVault.shortAmount);
    }

    function calcTotalEthToBull(
        uint256 wethToLend,
        uint256 ethToCrab,
        uint256 usdcToBorrow,
        uint256 wSqueethToMint
    ) internal view returns (uint256) {
        uint256 totalEthToBull = wethToLend.add(ethToCrab).sub(usdcToBorrow.wdiv(ethPrice())).sub(
            wSqueethToMint.wmul(squeethPrice())
        ).add(1e16);
        return totalEthToBull;
    }

    /**
     * @dev calculate amount of strategy token to mint for depositor
     * @param _amount amount of ETH deposited
     * @param _strategyCollateralAmount amount of strategy collateral
     * @param _crabTotalSupply total supply of strategy token
     * @return amount of strategy token to mint
     */
    function _calcSharesToMint(
        uint256 _amount,
        uint256 _strategyCollateralAmount,
        uint256 _crabTotalSupply
    ) internal pure returns (uint256) {
        uint256 depositorShare = _amount.wdiv(_strategyCollateralAmount.add(_amount));

        if (_crabTotalSupply != 0) {
            return _crabTotalSupply.wmul(depositorShare).wdiv(uint256(ONE).sub(depositorShare));
        }

        return _amount;
    }

    function _calcWsqueethToMintAndFee(
        uint256 _depositedAmount,
        uint256 _strategyDebtAmount,
        uint256 _strategyCollateralAmount
    ) internal view returns (uint256, uint256) {
        uint256 wSqueethToMint;
        uint256 wSqueethEthPrice = squeethPrice();
        uint256 feeRate = IController(bullStrategy.powerTokenController()).feeRate();
        uint256 feeAdjustment = wSqueethEthPrice.mul(feeRate).div(10000);

        wSqueethToMint = _depositedAmount.wmul(_strategyDebtAmount).wdiv(
            _strategyCollateralAmount.add(_strategyDebtAmount.wmul(feeAdjustment))
        );

        uint256 fee = wSqueethToMint.wmul(feeAdjustment);

        return (wSqueethToMint, fee);
    }

    function squeethPrice() internal view returns (uint256) {
        return UniOracle._getTwap(ethWSqueethPool, wPowerPerp, weth, TWAP, false);
    }

    function ethPrice() internal view returns (uint256) {
        return UniOracle._getTwap(ethUsdcPool, weth, usdc, TWAP, false);
    }

    function _initateDepositInBull() internal {
        // Put some money in bull to start with
        uint256 ethToCrab = 5e18;
        (uint256 ethInCrab, uint256 squeethInCrab) = _getCrabVaultDetails();
        (uint256 wSqueethToMint, uint256 fee) =
            _calcWsqueethToMintAndFee(ethToCrab, squeethInCrab, ethInCrab);
        uint256 crabToBeMinted =
            _calcSharesToMint(ethToCrab.sub(fee), ethInCrab, IERC20(crabV2).totalSupply());
        uint256 bullCrabBalanceBefore = IERC20(crabV2).balanceOf(address(bullStrategy));

        uint256 bullShare = 1e18;
        (uint256 wethToLend, uint256 usdcToBorrow) = bullStrategy.calcLeverageEthUsdc(
            crabToBeMinted, bullShare, ethInCrab, squeethInCrab, crabV2.totalSupply()
        );

        uint256 totalEthToBull =
            calcTotalEthToBull(wethToLend, ethToCrab, usdcToBorrow, wSqueethToMint);

        FlashZen.FlashDepositParams memory params = FlashZen.FlashDepositParams({
            ethToCrab: ethToCrab,
            minEthFromSqth: 0,
            minEthFromUsdc: 0,
            wPowerPerpPoolFee: uint24(3000),
            usdcPoolFee: uint24(3000)
        });

        vm.startPrank(user1);
        flashBull.flashDeposit{value: totalEthToBull}(params);
        vm.stopPrank();

        assertEq(IEulerDToken(dToken).balanceOf(address(bullStrategy)), usdcToBorrow);
        assertApproxEqAbs(
            IEulerEToken(eToken).balanceOfUnderlying(address(bullStrategy)), wethToLend, 1
        );
        assertEq(bullStrategy.getCrabBalance().sub(crabToBeMinted), bullCrabBalanceBefore);
    }

    function _calcTargetCollateralAndDebtInLeverage() internal view returns (uint256, uint256) {
        uint256 ethUsdPrice = UniOracle._getTwap(
            controller.ethQuoteCurrencyPool(),
            controller.weth(),
            controller.quoteCurrency(),
            1,
            false
        );

        uint256 squeethEthPrice = UniOracle._getTwap(
            controller.wPowerPerpPool(), controller.wPowerPerp(), controller.weth(), TWAP, false
        );
        (uint256 ethInCrab, uint256 squeethInCrab) = _getCrabVaultDetails();
        uint256 crabUsdPrice = (
            ethInCrab.wmul(ethUsdPrice).sub(squeethInCrab.wmul(squeethEthPrice).wmul(ethUsdPrice))
        ).wdiv(crabV2.totalSupply());
        uint256 equityValue = IEulerEToken(eToken).balanceOfUnderlying(address(bullStrategy)).wmul(
            ethUsdPrice
        ).add(IERC20(crabV2).balanceOf(address(bullStrategy)).wmul(crabUsdPrice)).sub(
            IEulerDToken(dToken).balanceOf(address(bullStrategy)).mul(1e12)
        );
        uint256 targetCollateral = equityValue.wdiv(ethUsdPrice);
        uint256 _targetDebt =
            targetCollateral.wmul(ethUsdPrice).wdiv(bullStrategy.TARGET_CR()).div(1e12);
        return (targetCollateral, _targetDebt);
    }

    function _calcCrabAmountToTrade(
        uint256 _currentWethInLeverage,
        uint256 _currentDebt,
        uint256 _targetWeth,
        uint256 _targetDebt,
        uint256 _ethUsdPrice
    ) internal view returns (uint256, bool) {
        (uint256 wethDeltaInDollar, bool isWethDeltaInDollarPositive) = (
            _targetWeth > _currentWethInLeverage
        )
            ? (_targetWeth.sub(_currentWethInLeverage).wmul(_ethUsdPrice), false)
            : (_currentWethInLeverage.sub(_targetWeth).wmul(_ethUsdPrice), true);
        (uint256 debtDeltaInDollar, bool isDebtDeltaInDollarPositive) = (_targetDebt > _currentDebt)
            ? (_targetDebt.sub(_currentDebt), false)
            : (_currentDebt.sub(_targetDebt), true);
        wethDeltaInDollar = wethDeltaInDollar.div(1e12);
        bool isDepositingInCrab;
        uint256 dollarToExchangeWithCrab;

        if (isDebtDeltaInDollarPositive) {
            if (isWethDeltaInDollarPositive) {
                (dollarToExchangeWithCrab, isDepositingInCrab) = (
                    debtDeltaInDollar > wethDeltaInDollar
                )
                    ? (debtDeltaInDollar.sub(wethDeltaInDollar), false)
                    : (wethDeltaInDollar.sub(debtDeltaInDollar), true);
            } else {
                (dollarToExchangeWithCrab, isDepositingInCrab) =
                    (debtDeltaInDollar.add(wethDeltaInDollar), false);
            }
        } else {
            if (!isWethDeltaInDollarPositive) {
                (dollarToExchangeWithCrab, isDepositingInCrab) = (
                    debtDeltaInDollar > wethDeltaInDollar
                )
                    ? (debtDeltaInDollar.sub(wethDeltaInDollar), true)
                    : (wethDeltaInDollar.sub(debtDeltaInDollar), false);
            } else {
                (dollarToExchangeWithCrab, isDepositingInCrab) =
                    (debtDeltaInDollar.add(wethDeltaInDollar), true);
            }
        }
        uint256 crabAmount = dollarToExchangeWithCrab.mul(1e12).wdiv(testUtil.getCrabPrice());

        return (crabAmount, isDepositingInCrab);
    }

    function _calcWPowerPerpAmountFromCrab(
        bool _isDepositingInCrab,
        uint256 _crabAmount,
        uint256 _ethInCrab,
        uint256 _squeethInCrab
    ) internal view returns (uint256) {
        uint256 wPowerPerpAmount;
        if (_isDepositingInCrab) {
            uint256 ethToDepositInCrab =
                _crabAmount.wdiv(IERC20(crabV2).totalSupply()).wmul(_ethInCrab);
            (wPowerPerpAmount,) =
                _calcWsqueethToMintAndFee(ethToDepositInCrab, _squeethInCrab, _ethInCrab);
        } else {
            wPowerPerpAmount = _crabAmount.wmul(_squeethInCrab).wdiv(IERC20(crabV2).totalSupply());
        }

        return wPowerPerpAmount;
    }
}
