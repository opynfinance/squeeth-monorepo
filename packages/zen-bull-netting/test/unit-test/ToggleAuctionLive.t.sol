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
