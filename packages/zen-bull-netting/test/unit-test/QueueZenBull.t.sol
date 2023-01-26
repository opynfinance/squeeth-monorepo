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
contract QueueZenBull is ZenBullNettingBaseSetup {
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
        vm.prank(owner);
        zenBullNetting.setMinZenBullAmount(minZenBull);

        uint256 amount = zenBullNetting.minZenBullAmount() - 1;

        vm.startPrank(user1);
        IERC20(ZEN_BULL).approve(address(zenBullNetting), amount);
        vm.expectRevert(bytes("ZBN07"));
        zenBullNetting.queueZenBull(amount);
        vm.stopPrank();
    }
}
