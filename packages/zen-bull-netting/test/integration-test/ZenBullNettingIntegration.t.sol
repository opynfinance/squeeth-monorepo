pragma solidity ^0.8.13;

pragma abicoder v2;

// test dependency
import { console } from "forge-std/console.sol";
import { ZenBullNettingBaseSetup } from "../ZenBullNettingBaseSetup.t.sol";
//interface
import { IERC20 } from "openzeppelin/token/ERC20/IERC20.sol";
// contracts
import { ZenBullNetting } from "../../src/ZenBullNetting.sol";

/**
 * Unit tests
 */
contract ZenBullNettingIntegration is ZenBullNettingBaseSetup {
    uint256 public user1Pk;
    address public user1;
    uint256 public user2Pk;
    address public user2;

    uint256 minWeth = 5e18;
    uint256 minZenBull = 1e18;

    function setUp() public override {
        ZenBullNettingBaseSetup.setUp();

        vm.startPrank(owner);
        zenBullNetting.setMinEthAmount(minWeth);
        zenBullNetting.setMinZenBullAmount(minZenBull);
        // zenBullNetting.setOTCPriceTolerance(2e16);
        vm.stopPrank();

        (user1, user1Pk) = makeAddrAndKey("User1");
        (user2, user2Pk) = makeAddrAndKey("User2");

        vm.deal(user1, 5000e18);
        vm.deal(user2, 5000e18);
        // some ZenBUll rich address
        vm.startPrank(0xaae102ca930508e6dA30924Bf0374F0F247729d5);
        IERC20(ZEN_BULL).transfer(user1, 15e18);
        IERC20(ZEN_BULL).transfer(user2, 15e18);
        vm.stopPrank();
    }

    function testDeployment() public {
        assertEq(zenBullNetting.MAX_OTC_PRICE_TOLERANCE(), 2e17);
        assertEq(zenBullNetting.MIN_AUCTION_TWAP(), 180);
        assertEq(zenBullNetting.otcPriceTolerance(), 5e16);
        assertEq(zenBullNetting.auctionTwapPeriod(), 420);
    }

    function testDequeueWeth() public {
        uint256 amount = 100e18;
        _queueEth(user1, amount);

        uint256 user1EthBalanceBefore = user1.balance;
        uint256 zenBullNettingEthBalanceBefore = address(zenBullNetting).balance;

        vm.startPrank(user1);
        zenBullNetting.dequeueEth(amount, false);
        vm.stopPrank();

        assertEq(user1EthBalanceBefore + amount, user1.balance);
        assertEq(zenBullNettingEthBalanceBefore - amount, address(zenBullNetting).balance);
    }

    function testDequeueWethPartial() public {
        uint256 amountToQueue = 100e18;
        _queueEth(user1, amountToQueue);

        uint256 user1EthBalanceBefore = user1.balance;
        uint256 zenBullNettingEthBalanceBefore = address(zenBullNetting).balance;
        uint256 amountToDequeue = amountToQueue / 2;

        vm.startPrank(user1);
        zenBullNetting.dequeueEth(amountToDequeue, false);
        vm.stopPrank();

        (address sender, uint256 amount,) = zenBullNetting.getDepositReceipt(0);

        assertEq(user1EthBalanceBefore + amountToDequeue, user1.balance);
        assertEq(zenBullNettingEthBalanceBefore - amountToDequeue, address(zenBullNetting).balance);
        assertEq(sender, user1);
        assertEq(amount, amountToQueue - amountToDequeue);
    }

    function testDequeueWethWhenAuctionIsLive() public {
        uint256 amount = 100e18;
        _queueEth(user1, amount);

        vm.prank(owner);
        zenBullNetting.toggleAuctionLive();
        assertEq(zenBullNetting.isAuctionLive(), true);

        vm.startPrank(user1);
        vm.expectRevert(bytes("ZBN04"));
        zenBullNetting.dequeueEth(amount, false);
        vm.stopPrank();
    }

    function testForceDequeueWethWhenAuctionIsLiveAndTimeLessThanOneWeek() public {
        uint256 amount = 100e18;
        _queueEth(user1, amount);

        vm.prank(owner);
        zenBullNetting.toggleAuctionLive();
        assertEq(zenBullNetting.isAuctionLive(), true);

        vm.startPrank(user1);
        vm.expectRevert(bytes("ZBN06"));
        zenBullNetting.dequeueEth(amount, true);
        vm.stopPrank();
    }

    function testForceDequeueWethWhenAuctionIsLiveAndTimeMoreThanOneWeek() public {
        uint256 amountToQueue = 100e18;
        _queueEth(user1, amountToQueue);

        uint256 user1EthBalanceBefore = user1.balance;
        uint256 zenBullNettingEthBalanceBefore = address(zenBullNetting).balance;

        vm.prank(owner);
        zenBullNetting.toggleAuctionLive();
        assertEq(zenBullNetting.isAuctionLive(), true);

        (,, uint256 receiptTimestamp) = zenBullNetting.getDepositReceipt(0);

        vm.warp(receiptTimestamp + 1.1 weeks);

        vm.startPrank(user1);
        zenBullNetting.dequeueEth(amountToQueue, true);
        vm.stopPrank();

        assertEq(user1EthBalanceBefore + amountToQueue, user1.balance);
        assertEq(zenBullNettingEthBalanceBefore - amountToQueue, address(zenBullNetting).balance);
    }

    function testDequeueZenBull() public {
        uint256 amount = 10e18;
        _queueZenBull(user1, amount);

        uint256 user1ZenBalanceBefore = IERC20(ZEN_BULL).balanceOf(user1);
        uint256 zenBullNettingZenBalanceBefore = IERC20(ZEN_BULL).balanceOf(address(zenBullNetting));

        vm.startPrank(user1);
        zenBullNetting.dequeueZenBull(amount, false);
        vm.stopPrank();

        assertEq(user1ZenBalanceBefore + amount, IERC20(ZEN_BULL).balanceOf(user1));
        assertEq(
            zenBullNettingZenBalanceBefore - amount,
            IERC20(ZEN_BULL).balanceOf(address(zenBullNetting))
        );
    }

    function testDequeueZenBullPartial() public {
        uint256 amountToQueue = 10e18;
        _queueZenBull(user1, amountToQueue);

        uint256 user1ZenBalanceBefore = IERC20(ZEN_BULL).balanceOf(user1);
        uint256 zenBullNettingZenBalanceBefore = IERC20(ZEN_BULL).balanceOf(address(zenBullNetting));
        uint256 amountToDequeue = amountToQueue / 2;

        vm.startPrank(user1);
        zenBullNetting.dequeueZenBull(amountToDequeue, false);
        vm.stopPrank();

        (address sender, uint256 amount,) = zenBullNetting.getWithdrawReceipt(0);

        assertEq(user1ZenBalanceBefore + amountToDequeue, IERC20(ZEN_BULL).balanceOf(user1));
        assertEq(
            zenBullNettingZenBalanceBefore - amountToDequeue,
            IERC20(ZEN_BULL).balanceOf(address(zenBullNetting))
        );
        assertEq(sender, user1);
        assertEq(amount, amountToQueue - amountToDequeue);
    }

    function testDequeueZenBullPartialWhenRemainingLessThanMin() public {
        uint256 amountToQueue = 10e18;
        _queueZenBull(user1, amountToQueue);

        uint256 amountToDequeue = amountToQueue - zenBullNetting.minZenBullAmount() + 1;

        vm.startPrank(user1);
        vm.expectRevert(bytes("ZBN08"));
        zenBullNetting.dequeueZenBull(amountToDequeue, false);
        vm.stopPrank();
    }

    function testDequeueZenBullWhenAuctionIsLive() public {
        uint256 amount = 10e18;
        _queueZenBull(user1, amount);

        vm.prank(owner);
        zenBullNetting.toggleAuctionLive();
        assertEq(zenBullNetting.isAuctionLive(), true);

        vm.startPrank(user1);
        vm.expectRevert(bytes("ZBN04"));
        zenBullNetting.dequeueZenBull(amount, false);
        vm.stopPrank();
    }

    function testForceDequeueZenBullWhenAuctionIsLiveAndTimeLessThanOneWeek() public {
        uint256 amount = 10e18;
        _queueZenBull(user1, amount);

        vm.prank(owner);
        zenBullNetting.toggleAuctionLive();
        assertEq(zenBullNetting.isAuctionLive(), true);

        vm.startPrank(user1);
        vm.expectRevert(bytes("ZBN09"));
        zenBullNetting.dequeueZenBull(amount, true);
        vm.stopPrank();
    }

    function testForceDequeueZenBullWhenAuctionIsLiveAndTimeMoreThanOneWeek() public {
        uint256 amountToQueue = 10e18;
        _queueZenBull(user1, amountToQueue);

        uint256 user1ZenBalanceBefore = IERC20(ZEN_BULL).balanceOf(user1);
        uint256 zenBullNettingZenBalanceBefore = IERC20(ZEN_BULL).balanceOf(address(zenBullNetting));

        vm.prank(owner);
        zenBullNetting.toggleAuctionLive();
        assertEq(zenBullNetting.isAuctionLive(), true);

        (,, uint256 receiptTimestamp) = zenBullNetting.getWithdrawReceipt(0);

        vm.warp(receiptTimestamp + 1.1 weeks);

        vm.startPrank(user1);
        zenBullNetting.dequeueZenBull(amountToQueue, true);
        vm.stopPrank();

        assertEq(user1ZenBalanceBefore + amountToQueue, IERC20(ZEN_BULL).balanceOf(user1));
        assertEq(
            zenBullNettingZenBalanceBefore - amountToQueue,
            IERC20(ZEN_BULL).balanceOf(address(zenBullNetting))
        );
    }

    function testNetAtPrice() public {
        uint256 ethToQueue = 10e18;
        uint256 zenBullFairPrice = zenBullNetting.getZenBullPrice();
        uint256 zenBullToQueue = ethToQueue * 1e18 / zenBullFairPrice;

        _queueEth(user1, ethToQueue);
        _queueZenBull(user2, zenBullToQueue);

        (, uint256 depReceiptAmountBefore,) = zenBullNetting.getDepositReceipt(0);
        (, uint256 withReceiptAmountBefore,) = zenBullNetting.getWithdrawReceipt(0);

        uint256 user1ZenBalanceBefore = IERC20(ZEN_BULL).balanceOf(user1);
        uint256 user2EthBalanceBefore = user2.balance;
        uint256 zenBullNettingEthBalanceBefore = address(zenBullNetting).balance;
        uint256 zenBullNettingZenBalanceBefore = IERC20(ZEN_BULL).balanceOf(address(zenBullNetting));

        vm.prank(owner);
        zenBullNetting.netAtPrice(zenBullFairPrice, ethToQueue);

        (, uint256 depReceiptAmountAfter,) = zenBullNetting.getDepositReceipt(0);
        (, uint256 withReceiptAmountAfter,) = zenBullNetting.getWithdrawReceipt(0);

        assertEq(
            IERC20(ZEN_BULL).balanceOf(address(zenBullNetting)) + zenBullToQueue,
            zenBullNettingZenBalanceBefore
        );
        assertApproxEqAbs(
            address(zenBullNetting).balance + ethToQueue, zenBullNettingEthBalanceBefore, 2
        );
        assertEq(IERC20(ZEN_BULL).balanceOf(user1) - user1ZenBalanceBefore, zenBullToQueue);
        assertEq(IERC20(ZEN_BULL).balanceOf(user1) - user1ZenBalanceBefore, zenBullToQueue);
        assertApproxEqAbs(user2.balance - ethToQueue, user2EthBalanceBefore, 2);
        assertEq(withReceiptAmountBefore - zenBullToQueue, withReceiptAmountAfter);
        assertEq(depReceiptAmountBefore - ethToQueue, depReceiptAmountAfter);
    }

    function testNetAtPriceWhenZenAmountGreaterThanQueued() public {
        uint256 ethToQueue = 10e18;
        uint256 zenBullFairPrice = zenBullNetting.getZenBullPrice();
        uint256 zenBullToQueue = ethToQueue * 1e18 / zenBullFairPrice - 1;

        _queueEth(user1, ethToQueue);
        _queueZenBull(user2, zenBullToQueue);

        vm.prank(owner);
        vm.expectRevert(bytes("ZBN11"));
        zenBullNetting.netAtPrice(zenBullFairPrice, ethToQueue);
    }

    function testNetAtPriceWhenEthAmountGreaterThanQueued() public {
        uint256 ethToQueue = 10e18;
        uint256 zenBullFairPrice = zenBullNetting.getZenBullPrice();
        uint256 zenBullToQueue = ethToQueue * 1e18 / zenBullFairPrice;

        _queueEth(user1, ethToQueue - 1);
        _queueZenBull(user2, zenBullToQueue);

        vm.prank(owner);
        vm.expectRevert(bytes("ZBN10"));
        zenBullNetting.netAtPrice(zenBullFairPrice, ethToQueue);
    }

    function testNetAtPricePartially() public {
        uint256 ethToQueue = 10e18;
        uint256 zenBullFairPrice = zenBullNetting.getZenBullPrice();
        uint256 zenBullToQueue = ethToQueue * 1e18 / zenBullFairPrice;

        _queueEth(user1, ethToQueue);
        _queueZenBull(user2, zenBullToQueue);

        (, uint256 depReceiptAmountBefore,) = zenBullNetting.getDepositReceipt(0);
        (, uint256 withReceiptAmountBefore,) = zenBullNetting.getWithdrawReceipt(0);

        uint256 user1ZenBalanceBefore = IERC20(ZEN_BULL).balanceOf(user1);
        uint256 user2EthBalanceBefore = user2.balance;
        uint256 zenBullNettingEthBalanceBefore = address(zenBullNetting).balance;
        uint256 zenBullNettingZenBalanceBefore = IERC20(ZEN_BULL).balanceOf(address(zenBullNetting));

        uint256 ethToNet = ethToQueue / 2;
        uint256 zenBullToNet = ethToNet * 1e18 / zenBullFairPrice;
        vm.prank(owner);
        zenBullNetting.netAtPrice(zenBullFairPrice, ethToNet);

        (, uint256 depReceiptAmountAfter,) = zenBullNetting.getDepositReceipt(0);
        (, uint256 withReceiptAmountAfter,) = zenBullNetting.getWithdrawReceipt(0);

        assertEq(
            IERC20(ZEN_BULL).balanceOf(address(zenBullNetting)) + zenBullToNet,
            zenBullNettingZenBalanceBefore
        );
        assertApproxEqAbs(
            address(zenBullNetting).balance + ethToNet, zenBullNettingEthBalanceBefore, 2
        );
        assertEq(IERC20(ZEN_BULL).balanceOf(user1) - user1ZenBalanceBefore, zenBullToNet);
        assertEq(IERC20(ZEN_BULL).balanceOf(user1) - user1ZenBalanceBefore, zenBullToNet);
        assertApproxEqAbs(user2.balance - ethToNet, user2EthBalanceBefore, 2);
        assertEq(withReceiptAmountBefore - zenBullToNet, withReceiptAmountAfter);
        assertEq(depReceiptAmountBefore - ethToNet, depReceiptAmountAfter);
    }

    function testNetAtPriceWithEmptyDepositReceipt() public {
        uint256 ethToQueue = 10e18;
        uint256 zenBullFairPrice = zenBullNetting.getZenBullPrice();
        uint256 zenBullToQueue = ethToQueue * 1e18 / zenBullFairPrice;

        _queueEth(user1, ethToQueue);
        vm.prank(user1);
        zenBullNetting.dequeueEth(ethToQueue, false);

        _queueEth(user1, ethToQueue);
        _queueZenBull(user2, zenBullToQueue);

        (, uint256 depReceiptAmountBefore,) = zenBullNetting.getDepositReceipt(1);
        (, uint256 withReceiptAmountBefore,) = zenBullNetting.getWithdrawReceipt(0);

        uint256 user1ZenBalanceBefore = IERC20(ZEN_BULL).balanceOf(user1);
        uint256 user2EthBalanceBefore = user2.balance;
        uint256 zenBullNettingEthBalanceBefore = address(zenBullNetting).balance;
        uint256 zenBullNettingZenBalanceBefore = IERC20(ZEN_BULL).balanceOf(address(zenBullNetting));

        vm.prank(owner);
        zenBullNetting.netAtPrice(zenBullFairPrice, ethToQueue);

        (, uint256 depReceiptAmountAfter,) = zenBullNetting.getDepositReceipt(0);
        (, uint256 withReceiptAmountAfter,) = zenBullNetting.getWithdrawReceipt(0);

        assertEq(
            IERC20(ZEN_BULL).balanceOf(address(zenBullNetting)) + zenBullToQueue,
            zenBullNettingZenBalanceBefore
        );
        assertApproxEqAbs(
            address(zenBullNetting).balance + ethToQueue, zenBullNettingEthBalanceBefore, 2
        );
        assertEq(IERC20(ZEN_BULL).balanceOf(user1) - user1ZenBalanceBefore, zenBullToQueue);
        assertEq(IERC20(ZEN_BULL).balanceOf(user1) - user1ZenBalanceBefore, zenBullToQueue);
        assertApproxEqAbs(user2.balance - ethToQueue, user2EthBalanceBefore, 2);
        assertEq(withReceiptAmountBefore - zenBullToQueue, withReceiptAmountAfter);
        assertEq(depReceiptAmountBefore - ethToQueue, depReceiptAmountAfter);
    }

    function testNetAtPriceWithEmptyWithdrawReceipt() public {
        uint256 ethToQueue = 10e18;
        uint256 zenBullFairPrice = zenBullNetting.getZenBullPrice();
        uint256 zenBullToQueue = ethToQueue * 1e18 / zenBullFairPrice;

        _queueZenBull(user2, zenBullToQueue);
        vm.prank(user2);
        zenBullNetting.dequeueZenBull(zenBullToQueue, false);

        _queueEth(user1, ethToQueue);
        _queueZenBull(user2, zenBullToQueue);

        (, uint256 depReceiptAmountBefore,) = zenBullNetting.getDepositReceipt(0);
        (, uint256 withReceiptAmountBefore,) = zenBullNetting.getWithdrawReceipt(1);

        uint256 user1ZenBalanceBefore = IERC20(ZEN_BULL).balanceOf(user1);
        uint256 user2EthBalanceBefore = user2.balance;
        uint256 zenBullNettingEthBalanceBefore = address(zenBullNetting).balance;
        uint256 zenBullNettingZenBalanceBefore = IERC20(ZEN_BULL).balanceOf(address(zenBullNetting));

        vm.prank(owner);
        zenBullNetting.netAtPrice(zenBullFairPrice, ethToQueue);

        (, uint256 depReceiptAmountAfter,) = zenBullNetting.getDepositReceipt(0);
        (, uint256 withReceiptAmountAfter,) = zenBullNetting.getWithdrawReceipt(0);

        assertEq(
            IERC20(ZEN_BULL).balanceOf(address(zenBullNetting)) + zenBullToQueue,
            zenBullNettingZenBalanceBefore
        );
        assertApproxEqAbs(
            address(zenBullNetting).balance + ethToQueue, zenBullNettingEthBalanceBefore, 2
        );
        assertEq(IERC20(ZEN_BULL).balanceOf(user1) - user1ZenBalanceBefore, zenBullToQueue);
        assertEq(IERC20(ZEN_BULL).balanceOf(user1) - user1ZenBalanceBefore, zenBullToQueue);
        assertApproxEqAbs(user2.balance - ethToQueue, user2EthBalanceBefore, 2);
        assertEq(withReceiptAmountBefore - zenBullToQueue, withReceiptAmountAfter);
        assertEq(depReceiptAmountBefore - ethToQueue, depReceiptAmountAfter);
    }

    function testNetAtPriceWhenPriceIsFarBelowFairPrice() public {
        uint256 ethToQueue = 10e18;
        uint256 zenBullFairPrice = zenBullNetting.getZenBullPrice();
        zenBullFairPrice =
            (zenBullFairPrice * (1e18 - zenBullNetting.otcPriceTolerance())) / 1e18 - 1;
        uint256 zenBullToQueue = ethToQueue * 1e18 / zenBullFairPrice;

        _queueEth(user1, ethToQueue);
        _queueZenBull(user2, zenBullToQueue);

        vm.prank(owner);
        vm.expectRevert(bytes("ZBN13"));
        zenBullNetting.netAtPrice(zenBullFairPrice, ethToQueue);
    }

    function testNetAtPriceWhenPriceIsFarAboveFairPrice() public {
        uint256 ethToQueue = 10e18;
        uint256 zenBullFairPrice = zenBullNetting.getZenBullPrice();
        zenBullFairPrice =
            (zenBullFairPrice * (1e18 + zenBullNetting.otcPriceTolerance())) / 1e18 + 1;
        uint256 zenBullToQueue = ethToQueue * 1e18 / zenBullFairPrice;

        _queueEth(user1, ethToQueue);
        _queueZenBull(user2, zenBullToQueue);

        vm.prank(owner);
        vm.expectRevert(bytes("ZBN12"));
        zenBullNetting.netAtPrice(zenBullFairPrice, ethToQueue);
    }
}
