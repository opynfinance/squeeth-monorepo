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

    function setUp() public override {
        ZenBullNettingBaseSetup.setUp();

        vm.prank(owner);
        zenBullNetting.setMinWethAmount(minWeth);

        user1Pk = 0xA12CD;
        user1 = vm.addr(user1Pk);

        vm.label(user1, "User1");

        // some WETH rich address
        vm.prank(0x57757E3D981446D585Af0D9Ae4d7DF6D64647806);
        IERC20(WETH).transfer(user1, 5000e18);
    }

    function testDeployment() public {
        assertEq(zenBullNetting.MAX_OTC_PRICE_TOLERANCE(), 2e17);
        assertEq(zenBullNetting.MIN_AUCTION_TWAP(), 180);
        assertEq(zenBullNetting.otcPriceTolerance(), 5e16);
        assertEq(zenBullNetting.auctionTwapPeriod(), 420);
    }

    function testDequeueWeth() public {
        uint256 amount = 100e18;
        _queueWeth(user1, amount);

        uint256 user1WethBalanceBefore = IERC20(WETH).balanceOf(user1);
        uint256 zenBullNettingWethBalanceBefore = IERC20(WETH).balanceOf(address(zenBullNetting));

        vm.startPrank(user1);
        zenBullNetting.dequeueWeth(amount, false);
        vm.stopPrank();

        assertEq(user1WethBalanceBefore + amount, IERC20(WETH).balanceOf(user1));
        assertEq(
            zenBullNettingWethBalanceBefore - amount,
            IERC20(WETH).balanceOf(address(zenBullNetting))
        );
    }

    function testDequeueWethPartial() public {
        uint256 amountToQueue = 100e18;
        _queueWeth(user1, amountToQueue);

        uint256 user1WethBalanceBefore = IERC20(WETH).balanceOf(user1);
        uint256 zenBullNettingWethBalanceBefore = IERC20(WETH).balanceOf(address(zenBullNetting));
        uint256 amountToDequeue = amountToQueue / 2;

        vm.startPrank(user1);
        zenBullNetting.dequeueWeth(amountToDequeue, false);
        vm.stopPrank();

        (address sender, uint256 amount,) = zenBullNetting.getDepositReceipt(0);

        assertEq(user1WethBalanceBefore + amountToDequeue, IERC20(WETH).balanceOf(user1));
        assertEq(
            zenBullNettingWethBalanceBefore - amountToDequeue,
            IERC20(WETH).balanceOf(address(zenBullNetting))
        );
        assertEq(sender, user1);
        assertEq(amount, amountToQueue - amountToDequeue);
    }

    function testDequeueWethWhenAuctionIsLive() public {
        uint256 amount = 100e18;
        _queueWeth(user1, amount);

        vm.prank(owner);
        zenBullNetting.toggleAuctionLive();
        assertEq(zenBullNetting.isAuctionLive(), true);

        vm.startPrank(user1);
        vm.expectRevert(bytes("ZBN04"));
        zenBullNetting.dequeueWeth(amount, false);
        vm.stopPrank();
    }

    function testForceDequeueWethWhenAuctionIsLiveAndTimeLessThanOneWeek() public {
        uint256 amount = 100e18;
        _queueWeth(user1, amount);

        vm.prank(owner);
        zenBullNetting.toggleAuctionLive();
        assertEq(zenBullNetting.isAuctionLive(), true);

        vm.startPrank(user1);
        vm.expectRevert(bytes("ZBN06"));
        zenBullNetting.dequeueWeth(amount, true);
        vm.stopPrank();
    }

    function testForceDequeueWethWhenAuctionIsLiveAndTimeMoreThanOneWeek() public {
        uint256 amountToQueue = 100e18;
        _queueWeth(user1, amountToQueue);

        uint256 user1WethBalanceBefore = IERC20(WETH).balanceOf(user1);
        uint256 zenBullNettingWethBalanceBefore = IERC20(WETH).balanceOf(address(zenBullNetting));

        vm.prank(owner);
        zenBullNetting.toggleAuctionLive();
        assertEq(zenBullNetting.isAuctionLive(), true);

        (,, uint256 receiptTimestamp) = zenBullNetting.getDepositReceipt(0);

        vm.warp(receiptTimestamp + 1.1 weeks);

        vm.startPrank(user1);
        zenBullNetting.dequeueWeth(amountToQueue, true);
        vm.stopPrank();

        assertEq(user1WethBalanceBefore + amountToQueue, IERC20(WETH).balanceOf(user1));
        assertEq(
            zenBullNettingWethBalanceBefore - amountToQueue,
            IERC20(WETH).balanceOf(address(zenBullNetting))
        );
    }
}
