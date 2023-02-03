pragma solidity ^0.8.13;

pragma abicoder v2;

// test dependency
import { console } from "forge-std/console.sol";
import { ZenBullNettingBaseSetup } from "../../ZenBullNettingBaseSetup.t.sol";
// interface
import { IERC20 } from "openzeppelin/token/ERC20/IERC20.sol";
import { IZenBullStrategy } from "../../../src/interface/IZenBullStrategy.sol";
import { IOracle } from "../../../src/interface/IOracle.sol";
import { IEulerSimpleLens } from "../../../src/interface/IEulerSimpleLens.sol";

// contract
import { SigUtil } from "../../util/SigUtil.sol";
import { ZenBullNetting } from "../../../src/ZenBullNetting.sol";

contract WithdrawAuction is ZenBullNettingBaseSetup {
    uint256 public user1Pk;
    address public user1;
    uint256 public user2Pk;
    address public user2;
    uint256 public mm1Pk;
    address public mm1;
    uint256 public mm2Pk;
    address public mm2;

    uint256 minWeth = 5e18;
    uint256 minZenBull = 1e18;

    function setUp() public override {
        ZenBullNettingBaseSetup.setUp();

        vm.startPrank(owner);
        zenBullNetting.setMinEthAmount(minWeth);
        zenBullNetting.setMinZenBullAmount(minZenBull);
        vm.stopPrank();

        (user1, user1Pk) = makeAddrAndKey("User1");
        (user2, user2Pk) = makeAddrAndKey("User2");
        (mm1, mm1Pk) = makeAddrAndKey("MM1");
        (mm2, mm2Pk) = makeAddrAndKey("MM2");

        vm.deal(user1, 5000e18);
        vm.deal(user2, 5000e18);
        // some ZenBUll rich address
        vm.startPrank(0xaae102ca930508e6dA30924Bf0374F0F247729d5);
        IERC20(ZEN_BULL).transfer(user1, 15e18);
        IERC20(ZEN_BULL).transfer(user2, 15e18);
        vm.stopPrank();
        // some oSQTH rich person
        vm.startPrank(0x0154d25120Ed20A516fE43991702e7463c5A6F6e);
        IERC20(WPOWERPERP).transfer(mm1, 1000e18);
        IERC20(WPOWERPERP).transfer(mm2, 1000e18);
        vm.stopPrank();
    }

    function testFullWithdrawAuction() public {
        uint256 amount = 10e18;
        _queueZenBull(user1, amount);

        uint256 oSqthAmount;
        {
            uint256 share = div(amount, IZenBullStrategy(ZEN_BULL).totalSupply());
            uint256 crabAmount = mul(share, IZenBullStrategy(ZEN_BULL).getCrabBalance());
            (, uint256 crabDebt) = IZenBullStrategy(ZEN_BULL).getCrabVaultDetails();
            oSqthAmount = div(mul(crabAmount, crabDebt), IERC20(CRAB).totalSupply());
        }
        uint256 squeethEthPrice =
            IOracle(ORACLE).getTwap(ethSqueethPool, WPOWERPERP, WETH, 420, false);
        ZenBullNetting.Order[] memory orders = new ZenBullNetting.Order[](1);
        {
            // trader signature vars
            uint8 v;
            bytes32 r;
            bytes32 s;
            // trader signing bid
            SigUtil.Order memory orderSig = SigUtil.Order({
                bidId: 1,
                trader: mm1,
                quantity: oSqthAmount,
                price: squeethEthPrice,
                isBuying: false,
                expiry: block.timestamp + 1000,
                nonce: 0
            });
            bytes32 bidDigest = sigUtil.getTypedDataHash(orderSig);
            (v, r, s) = vm.sign(mm1Pk, bidDigest);
            ZenBullNetting.Order memory orderData = ZenBullNetting.Order({
                bidId: 1,
                trader: mm1,
                quantity: oSqthAmount,
                price: squeethEthPrice,
                isBuying: false,
                expiry: block.timestamp + 1000,
                nonce: 0,
                v: v,
                r: r,
                s: s
            });
            orders[0] = orderData;
        }

        ZenBullNetting.WithdrawAuctionParams memory params = ZenBullNetting.WithdrawAuctionParams({
            withdrawsToProcess: amount,
            orders: orders,
            clearingPrice: squeethEthPrice,
            maxWethForUsdc: 100000e18,
            wethUsdcPoolFee: 3000
        });

        vm.prank(mm1);
        IERC20(WPOWERPERP).approve(address(zenBullNetting), oSqthAmount);

        uint256 mm1WethBalanceBefore = IERC20(WETH).balanceOf(mm1);
        uint256 mm1WpowerPerpBalanceBefore = IERC20(WPOWERPERP).balanceOf(mm1);
        uint256 debtBalanceBefore =
            IEulerSimpleLens(EULER_SIMPLE_LENS).getDTokenBalance(USDC, ZEN_BULL);
        uint256 usdcToRepay = amount * debtBalanceBefore / IERC20(ZEN_BULL).totalSupply();
        uint256 wethInEulerBefore =
            IEulerSimpleLens(EULER_SIMPLE_LENS).getETokenBalance(WETH, ZEN_BULL);
        uint256 wethToWithdraw = amount * wethInEulerBefore / IERC20(ZEN_BULL).totalSupply();

        (, uint256 receiptAmountBefore,) = zenBullNetting.getWithdrawReceipt(0);
        uint256 user1EthBalanceBefore = user1.balance;

        vm.startPrank(owner);
        zenBullNetting.withdrawAuction(params);
        vm.stopPrank();

        (, uint256 receiptAmountAfter,) = zenBullNetting.getWithdrawReceipt(0);

        assertEq(receiptAmountBefore - amount, receiptAmountAfter);
        assertEq(IERC20(WPOWERPERP).balanceOf(mm1) + oSqthAmount, mm1WpowerPerpBalanceBefore);
        assertEq(
            IERC20(WETH).balanceOf(mm1) - (oSqthAmount * params.clearingPrice / 1e18),
            mm1WethBalanceBefore
        );
        assertLt(IERC20(WPOWERPERP).balanceOf(mm1), mm1WpowerPerpBalanceBefore);
        assertEq(
            IEulerSimpleLens(EULER_SIMPLE_LENS).getDTokenBalance(USDC, ZEN_BULL) + usdcToRepay,
            debtBalanceBefore
        );
        assertApproxEqAbs(
            IEulerSimpleLens(EULER_SIMPLE_LENS).getETokenBalance(WETH, ZEN_BULL) + wethToWithdraw,
            wethInEulerBefore,
            200
        );
        uint256 user1EthBalanceAfter = user1.balance;
        assertGt(user1EthBalanceAfter, user1EthBalanceBefore);
    }

    function testPartialWithdrawAuction() public {
        uint256 amount = 5e18;
        _queueZenBull(user1, amount * 2);

        (, uint256 crabDebt) = IZenBullStrategy(ZEN_BULL).getCrabVaultDetails();
        uint256 oSqthAmount;
        {
            uint256 share = div(amount, IZenBullStrategy(ZEN_BULL).totalSupply());
            uint256 crabAmount = mul(share, IZenBullStrategy(ZEN_BULL).getCrabBalance());
            oSqthAmount = div(mul(crabAmount, crabDebt), IERC20(CRAB).totalSupply());
        }
        uint256 squeethEthPrice =
            IOracle(ORACLE).getTwap(ethSqueethPool, WPOWERPERP, WETH, 420, false);
        ZenBullNetting.Order[] memory orders = new ZenBullNetting.Order[](1);
        {
            // trader signature vars
            uint8 v;
            bytes32 r;
            bytes32 s;
            // trader signing bid
            SigUtil.Order memory orderSig = SigUtil.Order({
                bidId: 1,
                trader: mm1,
                quantity: oSqthAmount,
                price: squeethEthPrice,
                isBuying: false,
                expiry: block.timestamp + 1000,
                nonce: 0
            });
            bytes32 bidDigest = sigUtil.getTypedDataHash(orderSig);
            (v, r, s) = vm.sign(mm1Pk, bidDigest);
            ZenBullNetting.Order memory orderData = ZenBullNetting.Order({
                bidId: 1,
                trader: mm1,
                quantity: oSqthAmount,
                price: squeethEthPrice,
                isBuying: false,
                expiry: block.timestamp + 1000,
                nonce: 0,
                v: v,
                r: r,
                s: s
            });
            orders[0] = orderData;
        }

        ZenBullNetting.WithdrawAuctionParams memory params = ZenBullNetting.WithdrawAuctionParams({
            withdrawsToProcess: amount,
            orders: orders,
            clearingPrice: squeethEthPrice,
            maxWethForUsdc: 100000e18,
            wethUsdcPoolFee: 3000
        });

        vm.prank(mm1);
        IERC20(WPOWERPERP).approve(address(zenBullNetting), oSqthAmount);

        uint256 mm1WpowerPerpBalanceBefore = IERC20(WPOWERPERP).balanceOf(mm1);
        uint256 debtBalanceBefore =
            IEulerSimpleLens(EULER_SIMPLE_LENS).getDTokenBalance(USDC, ZEN_BULL);
        uint256 usdcToRepay =
            (amount * 1e18 / IERC20(ZEN_BULL).totalSupply()) * debtBalanceBefore / 1e18;
        uint256 wethInEulerBefore =
            IEulerSimpleLens(EULER_SIMPLE_LENS).getETokenBalance(WETH, ZEN_BULL);
        uint256 wethToWithdraw = amount * wethInEulerBefore / IERC20(ZEN_BULL).totalSupply();

        vm.startPrank(owner);
        zenBullNetting.withdrawAuction(params);
        vm.stopPrank();

        assertEq(IERC20(WPOWERPERP).balanceOf(mm1) + oSqthAmount, mm1WpowerPerpBalanceBefore);
        assertEq(
            IEulerSimpleLens(EULER_SIMPLE_LENS).getDTokenBalance(USDC, ZEN_BULL) + usdcToRepay,
            debtBalanceBefore
        );
        assertApproxEqAbs(
            IEulerSimpleLens(EULER_SIMPLE_LENS).getETokenBalance(WETH, ZEN_BULL) + wethToWithdraw,
            wethInEulerBefore,
            200
        );
    }

    function testWithdrawAuctionWithAnEmptyReceipt() public {
        uint256 amount = 10e18;
        _queueZenBull(user1, amount);

        vm.prank(user1);
        zenBullNetting.dequeueZenBull(amount, false);

        _queueZenBull(user1, amount);

        (, uint256 crabDebt) = IZenBullStrategy(ZEN_BULL).getCrabVaultDetails();
        uint256 oSqthAmount;
        {
            uint256 share = div(amount, IZenBullStrategy(ZEN_BULL).totalSupply());
            uint256 crabAmount = mul(share, IZenBullStrategy(ZEN_BULL).getCrabBalance());
            oSqthAmount = div(mul(crabAmount, crabDebt), IERC20(CRAB).totalSupply());
        }
        uint256 squeethEthPrice =
            IOracle(ORACLE).getTwap(ethSqueethPool, WPOWERPERP, WETH, 420, false);
        ZenBullNetting.Order[] memory orders = new ZenBullNetting.Order[](1);
        {
            // trader signature vars
            uint8 v;
            bytes32 r;
            bytes32 s;
            // trader signing bid
            SigUtil.Order memory orderSig = SigUtil.Order({
                bidId: 1,
                trader: mm1,
                quantity: oSqthAmount,
                price: squeethEthPrice,
                isBuying: false,
                expiry: block.timestamp + 1000,
                nonce: 0
            });
            bytes32 bidDigest = sigUtil.getTypedDataHash(orderSig);
            (v, r, s) = vm.sign(mm1Pk, bidDigest);
            ZenBullNetting.Order memory orderData = ZenBullNetting.Order({
                bidId: 1,
                trader: mm1,
                quantity: oSqthAmount,
                price: squeethEthPrice,
                isBuying: false,
                expiry: block.timestamp + 1000,
                nonce: 0,
                v: v,
                r: r,
                s: s
            });
            orders[0] = orderData;
        }

        ZenBullNetting.WithdrawAuctionParams memory params = ZenBullNetting.WithdrawAuctionParams({
            withdrawsToProcess: amount,
            orders: orders,
            clearingPrice: squeethEthPrice,
            maxWethForUsdc: 100000e18,
            wethUsdcPoolFee: 3000
        });

        vm.prank(mm1);
        IERC20(WPOWERPERP).approve(address(zenBullNetting), oSqthAmount);

        uint256 mm1WpowerPerpBalanceBefore = IERC20(WPOWERPERP).balanceOf(mm1);
        uint256 debtBalanceBefore =
            IEulerSimpleLens(EULER_SIMPLE_LENS).getDTokenBalance(USDC, ZEN_BULL);
        uint256 usdcToRepay = amount * debtBalanceBefore / IERC20(ZEN_BULL).totalSupply();
        uint256 wethInEulerBefore =
            IEulerSimpleLens(EULER_SIMPLE_LENS).getETokenBalance(WETH, ZEN_BULL);
        uint256 wethToWithdraw = amount * wethInEulerBefore / IERC20(ZEN_BULL).totalSupply();

        vm.startPrank(owner);
        zenBullNetting.withdrawAuction(params);
        vm.stopPrank();

        assertEq(IERC20(WPOWERPERP).balanceOf(mm1) + oSqthAmount, mm1WpowerPerpBalanceBefore);
        assertEq(
            IEulerSimpleLens(EULER_SIMPLE_LENS).getDTokenBalance(USDC, ZEN_BULL) + usdcToRepay,
            debtBalanceBefore
        );
        assertApproxEqAbs(
            IEulerSimpleLens(EULER_SIMPLE_LENS).getETokenBalance(WETH, ZEN_BULL) + wethToWithdraw,
            wethInEulerBefore,
            200
        );
    }

    function testWithdrawAuctionWithMultipleOrders() public {
        uint256 amount = 10e18;
        _queueZenBull(user1, amount);

        (, uint256 crabDebt) = IZenBullStrategy(ZEN_BULL).getCrabVaultDetails();
        uint256 oSqthAmount;
        {
            uint256 share = div(amount, IZenBullStrategy(ZEN_BULL).totalSupply());
            uint256 crabAmount = mul(share, IZenBullStrategy(ZEN_BULL).getCrabBalance());
            oSqthAmount = div(mul(crabAmount, crabDebt), IERC20(CRAB).totalSupply());
        }
        uint256 squeethEthPrice =
            IOracle(ORACLE).getTwap(ethSqueethPool, WPOWERPERP, WETH, 420, false);
        ZenBullNetting.Order[] memory orders = new ZenBullNetting.Order[](2);
        {
            // trader signature vars
            uint8 v;
            bytes32 r;
            bytes32 s;
            // trader signing bid
            SigUtil.Order memory orderSig = SigUtil.Order({
                bidId: 1,
                trader: mm1,
                quantity: oSqthAmount / 2,
                price: squeethEthPrice,
                isBuying: false,
                expiry: block.timestamp + 1000,
                nonce: 0
            });
            bytes32 bidDigest = sigUtil.getTypedDataHash(orderSig);
            (v, r, s) = vm.sign(mm1Pk, bidDigest);
            ZenBullNetting.Order memory orderData = ZenBullNetting.Order({
                bidId: 1,
                trader: mm1,
                quantity: oSqthAmount / 2,
                price: squeethEthPrice,
                isBuying: false,
                expiry: block.timestamp + 1000,
                nonce: 0,
                v: v,
                r: r,
                s: s
            });
            orders[0] = orderData;

            // trader signing bid
            orderSig = SigUtil.Order({
                bidId: 1,
                trader: mm2,
                quantity: oSqthAmount / 2,
                price: squeethEthPrice,
                isBuying: false,
                expiry: block.timestamp + 1000,
                nonce: 0
            });
            bidDigest = sigUtil.getTypedDataHash(orderSig);
            (v, r, s) = vm.sign(mm2Pk, bidDigest);
            orderData = ZenBullNetting.Order({
                bidId: 1,
                trader: mm2,
                quantity: oSqthAmount / 2,
                price: squeethEthPrice,
                isBuying: false,
                expiry: block.timestamp + 1000,
                nonce: 0,
                v: v,
                r: r,
                s: s
            });
            orders[1] = orderData;
        }

        ZenBullNetting.WithdrawAuctionParams memory params = ZenBullNetting.WithdrawAuctionParams({
            withdrawsToProcess: amount,
            orders: orders,
            clearingPrice: squeethEthPrice,
            maxWethForUsdc: 100000e18,
            wethUsdcPoolFee: 3000
        });

        vm.prank(mm1);
        IERC20(WPOWERPERP).approve(address(zenBullNetting), oSqthAmount / 2);
        vm.prank(mm2);
        IERC20(WPOWERPERP).approve(address(zenBullNetting), oSqthAmount / 2);

        uint256 mm1WpowerPerpBalanceBefore = IERC20(WPOWERPERP).balanceOf(mm1);
        uint256 mm2WpowerPerpBalanceBefore = IERC20(WPOWERPERP).balanceOf(mm2);
        uint256 debtBalanceBefore =
            IEulerSimpleLens(EULER_SIMPLE_LENS).getDTokenBalance(USDC, ZEN_BULL);
        uint256 usdcToRepay = amount * debtBalanceBefore / IERC20(ZEN_BULL).totalSupply();
        uint256 wethInEulerBefore =
            IEulerSimpleLens(EULER_SIMPLE_LENS).getETokenBalance(WETH, ZEN_BULL);
        uint256 wethToWithdraw = amount * wethInEulerBefore / IERC20(ZEN_BULL).totalSupply();

        vm.startPrank(owner);
        zenBullNetting.withdrawAuction(params);
        vm.stopPrank();

        assertEq(IERC20(WPOWERPERP).balanceOf(mm1) + oSqthAmount / 2, mm1WpowerPerpBalanceBefore);
        assertEq(IERC20(WPOWERPERP).balanceOf(mm2) + oSqthAmount / 2, mm2WpowerPerpBalanceBefore);
        assertEq(
            IEulerSimpleLens(EULER_SIMPLE_LENS).getDTokenBalance(USDC, ZEN_BULL) + usdcToRepay,
            debtBalanceBefore
        );
        assertApproxEqAbs(
            IEulerSimpleLens(EULER_SIMPLE_LENS).getETokenBalance(WETH, ZEN_BULL) + wethToWithdraw,
            wethInEulerBefore,
            200
        );
    }

    function testWithdrawAuctionWhenPriceGreaterThanClearingPrice() public {
        uint256 amount = 10e18;
        _queueZenBull(user1, amount);

        (, uint256 crabDebt) = IZenBullStrategy(ZEN_BULL).getCrabVaultDetails();
        uint256 oSqthAmount;
        {
            uint256 share = div(amount, IZenBullStrategy(ZEN_BULL).totalSupply());
            uint256 crabAmount = mul(share, IZenBullStrategy(ZEN_BULL).getCrabBalance());
            oSqthAmount = div(mul(crabAmount, crabDebt), IERC20(CRAB).totalSupply());
        }
        uint256 squeethEthPrice =
            IOracle(ORACLE).getTwap(ethSqueethPool, WPOWERPERP, WETH, 420, false);
        ZenBullNetting.Order[] memory orders = new ZenBullNetting.Order[](1);
        {
            // trader signature vars
            uint8 v;
            bytes32 r;
            bytes32 s;
            // trader signing bid
            SigUtil.Order memory orderSig = SigUtil.Order({
                bidId: 1,
                trader: mm1,
                quantity: oSqthAmount,
                price: squeethEthPrice + 1,
                isBuying: false,
                expiry: block.timestamp + 1000,
                nonce: 0
            });
            bytes32 bidDigest = sigUtil.getTypedDataHash(orderSig);
            (v, r, s) = vm.sign(mm1Pk, bidDigest);
            ZenBullNetting.Order memory orderData = ZenBullNetting.Order({
                bidId: 1,
                trader: mm1,
                quantity: oSqthAmount,
                price: squeethEthPrice + 1,
                isBuying: false,
                expiry: block.timestamp + 1000,
                nonce: 0,
                v: v,
                r: r,
                s: s
            });
            orders[0] = orderData;
        }

        ZenBullNetting.WithdrawAuctionParams memory params = ZenBullNetting.WithdrawAuctionParams({
            withdrawsToProcess: amount,
            orders: orders,
            clearingPrice: squeethEthPrice,
            maxWethForUsdc: 100000e18,
            wethUsdcPoolFee: 3000
        });

        vm.prank(mm1);
        IERC20(WPOWERPERP).approve(address(zenBullNetting), oSqthAmount);

        vm.startPrank(owner);
        vm.expectRevert(bytes("ZBN20"));
        zenBullNetting.withdrawAuction(params);
        vm.stopPrank();
    }

    function testWithdrawAuctionWhenClearingPriceIsGreaterThanTolerance() public {
        uint256 amount = 10e18;
        _queueZenBull(user1, amount);

        (, uint256 crabDebt) = IZenBullStrategy(ZEN_BULL).getCrabVaultDetails();
        uint256 oSqthAmount;
        {
            uint256 share = div(amount, IZenBullStrategy(ZEN_BULL).totalSupply());
            uint256 crabAmount = mul(share, IZenBullStrategy(ZEN_BULL).getCrabBalance());
            oSqthAmount = div(mul(crabAmount, crabDebt), IERC20(CRAB).totalSupply());
        }
        uint256 squeethEthPrice =
            IOracle(ORACLE).getTwap(ethSqueethPool, WPOWERPERP, WETH, 420, false);
        ZenBullNetting.Order[] memory orders = new ZenBullNetting.Order[](1);
        {
            // trader signature vars
            uint8 v;
            bytes32 r;
            bytes32 s;
            // trader signing bid
            SigUtil.Order memory orderSig = SigUtil.Order({
                bidId: 1,
                trader: mm1,
                quantity: oSqthAmount,
                price: squeethEthPrice,
                isBuying: false,
                expiry: block.timestamp + 1000,
                nonce: 0
            });
            bytes32 bidDigest = sigUtil.getTypedDataHash(orderSig);
            (v, r, s) = vm.sign(mm1Pk, bidDigest);
            ZenBullNetting.Order memory orderData = ZenBullNetting.Order({
                bidId: 1,
                trader: mm1,
                quantity: oSqthAmount,
                price: squeethEthPrice,
                isBuying: false,
                expiry: block.timestamp + 1000,
                nonce: 0,
                v: v,
                r: r,
                s: s
            });
            orders[0] = orderData;
        }

        ZenBullNetting.WithdrawAuctionParams memory params = ZenBullNetting.WithdrawAuctionParams({
            withdrawsToProcess: amount,
            orders: orders,
            clearingPrice: ((squeethEthPrice * (1e18 + zenBullNetting.otcPriceTolerance())) / 1e18) + 1,
            maxWethForUsdc: 100000e18,
            wethUsdcPoolFee: 3000
        });

        vm.prank(mm1);
        IERC20(WPOWERPERP).approve(address(zenBullNetting), oSqthAmount);

        vm.startPrank(owner);
        vm.expectRevert(bytes("ZBN14"));
        zenBullNetting.withdrawAuction(params);
        vm.stopPrank();
    }

    function testWithdrawAuctionWhenOrderIsBuying() public {
        uint256 amount = 10e18;
        _queueZenBull(user1, amount);

        (, uint256 crabDebt) = IZenBullStrategy(ZEN_BULL).getCrabVaultDetails();
        uint256 oSqthAmount;
        {
            uint256 share = div(amount, IZenBullStrategy(ZEN_BULL).totalSupply());
            uint256 crabAmount = mul(share, IZenBullStrategy(ZEN_BULL).getCrabBalance());
            oSqthAmount = div(mul(crabAmount, crabDebt), IERC20(CRAB).totalSupply());
        }
        uint256 squeethEthPrice =
            IOracle(ORACLE).getTwap(ethSqueethPool, WPOWERPERP, WETH, 420, false);
        ZenBullNetting.Order[] memory orders = new ZenBullNetting.Order[](1);
        {
            // trader signature vars
            uint8 v;
            bytes32 r;
            bytes32 s;
            // trader signing bid
            SigUtil.Order memory orderSig = SigUtil.Order({
                bidId: 1,
                trader: mm1,
                quantity: oSqthAmount,
                price: squeethEthPrice,
                isBuying: true,
                expiry: block.timestamp + 1000,
                nonce: 0
            });
            bytes32 bidDigest = sigUtil.getTypedDataHash(orderSig);
            (v, r, s) = vm.sign(mm1Pk, bidDigest);
            ZenBullNetting.Order memory orderData = ZenBullNetting.Order({
                bidId: 1,
                trader: mm1,
                quantity: oSqthAmount,
                price: squeethEthPrice,
                isBuying: true,
                expiry: block.timestamp + 1000,
                nonce: 0,
                v: v,
                r: r,
                s: s
            });
            orders[0] = orderData;
        }

        ZenBullNetting.WithdrawAuctionParams memory params = ZenBullNetting.WithdrawAuctionParams({
            withdrawsToProcess: amount,
            orders: orders,
            clearingPrice: squeethEthPrice,
            maxWethForUsdc: 100000e18,
            wethUsdcPoolFee: 3000
        });

        vm.prank(mm1);
        IERC20(WPOWERPERP).approve(address(zenBullNetting), oSqthAmount);

        vm.startPrank(owner);
        vm.expectRevert(bytes("ZBN19"));
        zenBullNetting.withdrawAuction(params);
        vm.stopPrank();
    }

    function testWithdrawAuctionWhenNonceIsAlreadyUsed() public {
        uint256 amount = 10e18;
        _queueZenBull(user1, amount);

        (, uint256 crabDebt) = IZenBullStrategy(ZEN_BULL).getCrabVaultDetails();
        uint256 oSqthAmount;
        {
            uint256 share = div(amount, IZenBullStrategy(ZEN_BULL).totalSupply());
            uint256 crabAmount = mul(share, IZenBullStrategy(ZEN_BULL).getCrabBalance());
            oSqthAmount = div(mul(crabAmount, crabDebt), IERC20(CRAB).totalSupply());
        }
        uint256 squeethEthPrice =
            IOracle(ORACLE).getTwap(ethSqueethPool, WPOWERPERP, WETH, 420, false);
        ZenBullNetting.Order[] memory orders = new ZenBullNetting.Order[](2);
        {
            // trader signature vars
            uint8 v;
            bytes32 r;
            bytes32 s;
            // trader signing bid
            SigUtil.Order memory orderSig = SigUtil.Order({
                bidId: 1,
                trader: mm1,
                quantity: oSqthAmount / 2,
                price: squeethEthPrice,
                isBuying: false,
                expiry: block.timestamp + 1000,
                nonce: 0
            });
            bytes32 bidDigest = sigUtil.getTypedDataHash(orderSig);
            (v, r, s) = vm.sign(mm1Pk, bidDigest);
            ZenBullNetting.Order memory orderData = ZenBullNetting.Order({
                bidId: 1,
                trader: mm1,
                quantity: oSqthAmount / 2,
                price: squeethEthPrice,
                isBuying: false,
                expiry: block.timestamp + 1000,
                nonce: 0,
                v: v,
                r: r,
                s: s
            });
            orders[0] = orderData;

            // trader signing bid
            orderSig = SigUtil.Order({
                bidId: 2,
                trader: mm1,
                quantity: oSqthAmount / 2,
                price: squeethEthPrice,
                isBuying: false,
                expiry: block.timestamp + 1000,
                nonce: 0
            });
            bidDigest = sigUtil.getTypedDataHash(orderSig);
            (v, r, s) = vm.sign(mm1Pk, bidDigest);
            orderData = ZenBullNetting.Order({
                bidId: 2,
                trader: mm1,
                quantity: oSqthAmount / 2,
                price: squeethEthPrice,
                isBuying: false,
                expiry: block.timestamp + 1000,
                nonce: 0,
                v: v,
                r: r,
                s: s
            });
            orders[1] = orderData;
        }

        ZenBullNetting.WithdrawAuctionParams memory params = ZenBullNetting.WithdrawAuctionParams({
            withdrawsToProcess: amount,
            orders: orders,
            clearingPrice: squeethEthPrice,
            maxWethForUsdc: 100000e18,
            wethUsdcPoolFee: 3000
        });

        vm.prank(mm1);
        IERC20(WPOWERPERP).approve(address(zenBullNetting), oSqthAmount);

        vm.startPrank(owner);
        vm.expectRevert(bytes("ZBN18"));
        zenBullNetting.withdrawAuction(params);
        vm.stopPrank();
    }

    function testCheckOrder() public {
        // trader signature vars
        uint8 v;
        bytes32 r;
        bytes32 s;
        // trader signing bid
        SigUtil.Order memory orderSig = SigUtil.Order({
            bidId: 1,
            trader: mm1,
            quantity: 0,
            price: 0,
            isBuying: false,
            expiry: block.timestamp + 1000,
            nonce: 0
        });
        bytes32 bidDigest = sigUtil.getTypedDataHash(orderSig);
        (v, r, s) = vm.sign(mm1Pk, bidDigest);
        ZenBullNetting.Order memory orderData = ZenBullNetting.Order({
            bidId: 1,
            trader: mm1,
            quantity: 0,
            price: 0,
            isBuying: false,
            expiry: block.timestamp + 1000,
            nonce: 0,
            v: v,
            r: r,
            s: s
        });

        assertEq(zenBullNetting.checkOrder(orderData), true);
    }
}
