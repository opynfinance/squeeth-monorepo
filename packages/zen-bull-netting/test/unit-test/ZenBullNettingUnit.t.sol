pragma solidity ^0.8.13;

pragma abicoder v2;

// test dependency
import { console } from "forge-std/console.sol";
import { ZenBullNettingBaseSetup } from "../ZenBullNettingBaseSetup.sol";

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
}
