pragma solidity ^0.8.13;

pragma abicoder v2;

// test dependency
import { console } from "forge-std/console.sol";
import { ZenBullNettingBaseSetup } from "../ZenBullNettingBaseSetup.t.sol";
//interface
import { IERC20 } from "openzeppelin/token/ERC20/IERC20.sol";

/**
 * Unit tests
 */
contract ZenBullNettingUnit is ZenBullNettingBaseSetup {
    uint256 public user1Pk;
    address public user1;

    uint256 minWeth = 5e18;
    uint256 minZenBull = 3e18;

    function setUp() public override {
        ZenBullNettingBaseSetup.setUp();

        user1Pk = 0xA12CD;
        user1 = vm.addr(user1Pk);

        vm.label(user1, "User1");

        vm.deal(user1, 5000e18);
        // some ZenBUll rich address
        vm.prank(0xaae102ca930508e6dA30924Bf0374F0F247729d5);
        IERC20(ZEN_BULL).transfer(user1, 30e18);
    }

    function testOwner() public {
        assertEq(zenBullNetting.owner(), owner);
    }

    function testDeployment() public {
        assertEq(zenBullNetting.MAX_OTC_PRICE_TOLERANCE(), 2e17);
        assertEq(zenBullNetting.MIN_AUCTION_TWAP(), 180);
        assertEq(zenBullNetting.otcPriceTolerance(), 5e16);
        assertEq(zenBullNetting.auctionTwapPeriod(), 420);
    }

    function testToggleAuctionLive() public {
        assertEq(zenBullNetting.isAuctionLive(), false);

        vm.prank(owner);
        zenBullNetting.toggleAuctionLive();

        assertEq(zenBullNetting.isAuctionLive(), true);
    }

    function testToggleAuctionLiveWhenCallerNotOwner() public {
        vm.prank(user1);
        vm.expectRevert(bytes("Ownable: caller is not the owner"));
        zenBullNetting.toggleAuctionLive();
    }

    function testSetMinWethAmount() public {
        _setMinWethAmount();
        assertEq(zenBullNetting.minEthAmount(), minWeth);
    }

    function testSetMinWethAmountWhenCallerNotOwner() public {
        vm.prank(user1);
        vm.expectRevert(bytes("Ownable: caller is not the owner"));
        zenBullNetting.setMinEthAmount(minWeth);
    }

    function testSetMinBullAmount() public {
        vm.prank(owner);
        zenBullNetting.setMinZenBullAmount(3e18);

        assertEq(zenBullNetting.minZenBullAmount(), 3e18);
    }

    function testSetMinBullAmountWhenCallerNotOwner() public {
        vm.prank(user1);
        vm.expectRevert(bytes("Ownable: caller is not the owner"));
        zenBullNetting.setMinZenBullAmount(3e18);
    }

    function testSetDepositsIndex() public {
        vm.prank(owner);
        zenBullNetting.setDepositsIndex(2);

        assertEq(zenBullNetting.depositsIndex(), 2);
    }

    function testSetDepositsIndexWhenCallerNotOwner() public {
        vm.prank(user1);
        vm.expectRevert(bytes("Ownable: caller is not the owner"));
        zenBullNetting.setDepositsIndex(2);
    }

    function testSetWithdrawsIndex() public {
        vm.prank(owner);
        zenBullNetting.setWithdrawsIndex(4);

        assertEq(zenBullNetting.withdrawsIndex(), 4);
    }

    function testSetWithdrawsIndexWhenCallerNotOwner() public {
        vm.prank(user1);
        vm.expectRevert(bytes("Ownable: caller is not the owner"));
        zenBullNetting.setWithdrawsIndex(2);
    }

    function testSetAuctionTwapPeriod() public {
        vm.prank(owner);
        zenBullNetting.setAuctionTwapPeriod(42069);

        assertEq(zenBullNetting.auctionTwapPeriod(), 42069);
    }

    function testSetAuctionTwapPeriodWhenCallerNotOwner() public {
        vm.prank(user1);
        vm.expectRevert(bytes("Ownable: caller is not the owner"));
        zenBullNetting.setAuctionTwapPeriod(42069);
    }

    function testSetAuctionTwapPeriodWhenPeriodLessThanMinimum() public {
        uint32 minAuctionTwap = zenBullNetting.MIN_AUCTION_TWAP();
        vm.prank(owner);
        vm.expectRevert(bytes("ZBN01"));
        zenBullNetting.setAuctionTwapPeriod(minAuctionTwap - 1);
    }

    function testSetOTCPriceTolerance() public {
        vm.prank(owner);
        zenBullNetting.setOTCPriceTolerance(2e16);

        assertEq(zenBullNetting.otcPriceTolerance(), 2e16);
    }

    function testSetOTCPriceToleranceWhenCallerNotOwner() public {
        vm.prank(user1);
        vm.expectRevert(bytes("Ownable: caller is not the owner"));
        zenBullNetting.setOTCPriceTolerance(2e16);
    }

    function testSetOTCPriceToleranceWhenPeriodLessThanMinimum() public {
        uint256 maxOtcPriceTolerance = zenBullNetting.MAX_OTC_PRICE_TOLERANCE();
        vm.prank(owner);
        vm.expectRevert(bytes("ZBN02"));
        zenBullNetting.setOTCPriceTolerance(maxOtcPriceTolerance + 1);
    }

    function testQueueEth() public {
        uint256 amount = 100e18;
        uint256 user1EthBalanceBefore = user1.balance;
        uint256 zenBullNettingEthBalanceBefore = address(zenBullNetting).balance;

        _queueEth(user1, amount);

        assertEq(zenBullNetting.ethBalance(user1), amount);
        assertEq(address(zenBullNetting).balance - zenBullNettingEthBalanceBefore, amount);
        assertEq(user1.balance + amount, user1EthBalanceBefore);
        assertEq(zenBullNetting.depositsQueued(), amount);
    }

    function testQueueEthWhenAmountLessThanMinAmount() public {
        _setMinWethAmount();
        uint256 amount = zenBullNetting.minEthAmount() - 1;

        vm.startPrank(user1);
        IERC20(WETH).approve(address(zenBullNetting), amount);
        vm.expectRevert(bytes("ZBN03"));
        zenBullNetting.queueEth{value: amount}();
        vm.stopPrank();
    }

    function testQueueZenBull() public {
        uint256 amount = 5e18;
        uint256 user1ZenBalanceBefore = IERC20(ZEN_BULL).balanceOf(user1);
        uint256 zenBullNettingZenhBalanceBefore =
            IERC20(ZEN_BULL).balanceOf(address(zenBullNetting));

        _queueZenBull(user1, amount);

        assertEq(zenBullNetting.zenBullBalance(user1), amount);
        assertEq(
            IERC20(ZEN_BULL).balanceOf(address(zenBullNetting)) - zenBullNettingZenhBalanceBefore,
            amount
        );
        assertEq(IERC20(ZEN_BULL).balanceOf(user1) + amount, user1ZenBalanceBefore);
        assertEq(zenBullNetting.withdrawsQueued(), amount);
    }

    function testQueueZenBullWhenAmountLessThanMinAmount() public {
        _setMinZenBullAmount();
        uint256 amount = zenBullNetting.minZenBullAmount() - 1;

        vm.startPrank(user1);
        IERC20(ZEN_BULL).approve(address(zenBullNetting), amount);
        vm.expectRevert(bytes("ZBN07"));
        zenBullNetting.queueZenBull(amount);
        vm.stopPrank();
    }

    function _setMinWethAmount() internal {
        vm.prank(owner);
        zenBullNetting.setMinEthAmount(minWeth);
    }

    function _setMinZenBullAmount() internal {
        vm.prank(owner);
        zenBullNetting.setMinZenBullAmount(minZenBull);
    }
}
