pragma solidity ^0.8.13;

pragma abicoder v2;

// test dependency
import { console } from "forge-std/console.sol";
import { ZenBullNettingBaseSetup } from "../../ZenBullNettingBaseSetup.t.sol";
//interface
import { IERC20 } from "openzeppelin/token/ERC20/IERC20.sol";

contract DequeueZenBull is ZenBullNettingBaseSetup {
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
        vm.stopPrank();

        (user1, user1Pk) = makeAddrAndKey("User1");
        (user2, user2Pk) = makeAddrAndKey("User2");

        // some ZenBUll rich address
        vm.startPrank(0xaae102ca930508e6dA30924Bf0374F0F247729d5);
        IERC20(ZEN_BULL).transfer(user1, 15e18);
        IERC20(ZEN_BULL).transfer(user2, 15e18);
        vm.stopPrank();
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
}
