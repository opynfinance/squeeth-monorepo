// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {BaseForkSetup} from "./BaseForkSetup.t.sol";

contract DepositTest is BaseForkSetup {
    function setUp() public override {
        BaseForkSetup.setUp(); // gives you netting, depositor, withdrawer, usdc, crab
    }

    function testTurnOffToggle() public {
        netting.toggleAuctionLive();
        skip(8 * 24 * 60 * 60);
        netting.turnOffAuctionLive();
        assertFalse(netting.isAuctionLive());
    }
}
