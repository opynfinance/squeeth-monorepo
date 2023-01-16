pragma solidity ^0.8.13;

pragma abicoder v2;

// test dependency
import { console } from "forge-std/console.sol";
import { ZenBullNettingBaseSetup } from "../ZenBullNettingBaseSetup.t.sol";

/**
 * Unit tests
 */
contract ZenBullNettingUnit is ZenBullNettingBaseSetup {
    uint256 public user1Pk;
    address public user1;

    function setUp() public override {
        ZenBullNettingBaseSetup.setUp();

        user1Pk = 0xA12CD;
        user1 = vm.addr(user1Pk);

        vm.label(user1, "User1");
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
        vm.prank(owner);   
        zenBullNetting.setMinWethAmount(5e18);

        assertEq(zenBullNetting.minWethAmount(), 5e18);   
    }

    function testSetMinWethAmountWhenCallerNotOwner() public {
        vm.prank(user1);   
        vm.expectRevert(bytes("Ownable: caller is not the owner"));
        zenBullNetting.setMinWethAmount(5e18);
    }

    function testSetMinBullAmount() public {
        vm.prank(owner);   
        zenBullNetting.setMinBullAmount(3e18);

        assertEq(zenBullNetting.minBullAmount(), 3e18);   
    }

    function testSetMinBullAmountWhenCallerNotOwner() public {
        vm.prank(user1);   
        vm.expectRevert(bytes("Ownable: caller is not the owner"));
        zenBullNetting.setMinBullAmount(3e18);
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
        vm.prank(owner);   
        vm.expectRevert(bytes("ZBN01"));
        zenBullNetting.setAuctionTwapPeriod(zenBullNetting.MIN_AUCTION_TWAP() - 1);
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
        vm.prank(owner);   
        vm.expectRevert(bytes("ZBN02"));
        zenBullNetting.setOTCPriceTolerance(zenBullNetting.MAX_OTC_PRICE_TOLERANCE() + 1);
    }
}
