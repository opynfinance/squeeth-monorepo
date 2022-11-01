// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {BaseSetup} from "./BaseSetup.t.sol";

contract QueuedBalancesTest is BaseSetup {
    function setUp() public override {
        BaseSetup.setUp(); // gives you netting, depositor, withdrawer, usdc, crab
        usdc.transfer(depositor, 400 * 1e6);
        crab.transfer(withdrawer, 40 * 1e18);

        // make multiple deposits from depositor
        vm.startPrank(depositor);
        usdc.approve(address(netting), 200 * 1e6);
        netting.depositUSDC(20 * 1e6);
        netting.depositUSDC(100 * 1e6);
        netting.depositUSDC(80 * 1e6);
        assertEq(netting.usdBalance(depositor), 200e6);
        vm.stopPrank();

        // queue multiple crabs from withdrawer
        vm.startPrank(withdrawer);
        crab.approve(address(netting), 200 * 1e18);
        netting.queueCrabForWithdrawal(5 * 1e18);
        netting.queueCrabForWithdrawal(4 * 1e18);
        netting.queueCrabForWithdrawal(11 * 1e18);
        assertEq(netting.crabBalance(withdrawer), 20e18);
        vm.stopPrank();

        netting.netAtPrice(10e6, 100e6); // net for 100 USD where 1 crab is 10 USD, so 10 crab
    }

    function testcrabBalanceQueued() public {
        assertEq(netting.depositsQueued(), 100e6);
    }

    function testWithdrawsQueued() public {
        assertEq(netting.withdrawsQueued(), 10e18);
    }
}
