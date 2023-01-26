pragma solidity ^0.8.13;

pragma abicoder v2;

// test dependency
import { console } from "forge-std/console.sol";
import { ZenBullNettingBaseSetup } from "../../ZenBullNettingBaseSetup.t.sol";
//interface
import { IERC20 } from "openzeppelin/token/ERC20/IERC20.sol";

contract DequeueEth is ZenBullNettingBaseSetup {
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

        vm.deal(user1, 5000e18);
        vm.deal(user2, 5000e18);
    }

    function testDequeueEth() public {
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

    function testDequeueEthPartial() public {
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

    function testDequeueEthWhenAuctionIsLive() public {
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

    function testForceDequeueEthWhenAuctionIsLiveAndTimeLessThanOneWeek() public {
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

    function testDequeueEthForceWhenAuctionIsLiveAndTimeMoreThanOneWeek() public {
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
}
