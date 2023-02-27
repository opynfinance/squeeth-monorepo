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
contract QueueEth is ZenBullNettingBaseSetup {
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

    function testQueueEthThroughDirectEthSend() public {
        uint256 amount = 100e18;
        uint256 user1EthBalanceBefore = user1.balance;
        uint256 zenBullNettingEthBalanceBefore = address(zenBullNetting).balance;

        // _queueEth(user1, amount);
        vm.prank(user1);
        (bool success,) = address(zenBullNetting).call{ value: amount }("");

        assertTrue(success);
        assertEq(zenBullNetting.ethBalance(user1), amount);
        assertEq(address(zenBullNetting).balance - zenBullNettingEthBalanceBefore, amount);
        assertEq(user1.balance + amount, user1EthBalanceBefore);
        assertEq(zenBullNetting.depositsQueued(), amount);
    }

    function testQueueEthWhenAmountLessThanMinAmount() public {
        vm.prank(owner);
        zenBullNetting.setMinEthAmount(minWeth);

        uint256 amount = zenBullNetting.minEthAmount() - 1;

        vm.startPrank(user1);
        vm.expectRevert(bytes("ZBN03"));
        zenBullNetting.queueEth{ value: amount }();
        vm.stopPrank();
    }
}
