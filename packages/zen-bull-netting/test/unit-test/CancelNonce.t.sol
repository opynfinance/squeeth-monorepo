pragma solidity ^0.8.13;

pragma abicoder v2;

// test dependency
import { console } from "forge-std/console.sol";
import { ZenBullNettingBaseSetup } from "../ZenBullNettingBaseSetup.t.sol";

/**
 * Unit tests
 */
contract CancelNonce is ZenBullNettingBaseSetup {
    uint256 public traderPk;
    address public trader1;

    function setUp() public override {
        ZenBullNettingBaseSetup.setUp();

        traderPk = 0xA12CD;
        trader1 = vm.addr(traderPk);

        vm.label(trader1, "trader1");
    }

    function testCancelNonce() public {
        uint256 nonce = 5;

        vm.prank(trader1);
        zenBullNetting.cancelNonce(nonce);

        assertEq(zenBullNetting.nonces(trader1, nonce), true);
    }
}
