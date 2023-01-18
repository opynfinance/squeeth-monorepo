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

    uint256 minWeth = 5e18;
    uint256 minZenBull = 3e18;

    function setUp() public override {
        ZenBullNettingBaseSetup.setUp();

        vm.startPrank(owner);
        zenBullNetting.setMinEthAmount(minWeth);
        zenBullNetting.setMinZenBullAmount(minZenBull);
        vm.stopPrank();

        user1Pk = 0xA12CD;
        user1 = vm.addr(user1Pk);

        vm.label(user1, "User1");

        vm.deal(user1, 5000e18);
        // some ZenBUll rich address
        vm.prank(0xaae102ca930508e6dA30924Bf0374F0F247729d5);
        IERC20(ZEN_BULL).transfer(user1, 30e18);
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
        assertEq(
            zenBullNettingEthBalanceBefore - amount,
            address(zenBullNetting).balance
        );
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
        assertEq(
            zenBullNettingEthBalanceBefore - amountToDequeue,
            address(zenBullNetting).balance
        );
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
        assertEq(
            zenBullNettingEthBalanceBefore - amountToQueue,
            address(zenBullNetting).balance
        );
    }

    function _queueWeth(address _user, uint256 _amount) internal {
        vm.startPrank(_user);
        IERC20(WETH).approve(address(zenBullNetting), _amount);
        zenBullNetting.queueWeth(_amount);
        vm.stopPrank();
    }

    /**
     * as
     */

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
}
