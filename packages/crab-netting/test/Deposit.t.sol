// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {BaseSetup} from "./BaseSetup.t.sol";

contract DepositTest is BaseSetup {
    function setUp() public override {
        BaseSetup.setUp(); // gives you netting, depositor, withdrawer, usdc, crab
        usdc.transfer(depositor, 20 * 1e6);
        crab.transfer(withdrawer, 20 * 1e18);
    }

    function testDepositAndWithdrawPartialUSDC() public {
        vm.startPrank(depositor);
        usdc.approve(address(netting), 2 * 1e6);

        netting.depositUSDC(2 * 1e6);
        assertEq(netting.usdBalance(depositor), 2e6);

        netting.withdrawUSDC(1 * 1e6);

        assertEq(netting.usdBalance(depositor), 1e6);
        assertEq(netting.depositsQueued(), 1e6);
    }

    function testDepositAndWithdrawFullUSDC() public {
        vm.startPrank(depositor);
        usdc.approve(address(netting), 2 * 1e6);

        netting.depositUSDC(2 * 1e6);
        assertEq(netting.usdBalance(depositor), 2e6);

        netting.withdrawUSDC(2 * 1e6);
        assertEq(netting.usdBalance(depositor), 0);
        assertEq(netting.depositsQueued(), 0);
    }

    function testLargeWithdraw() public {
        vm.startPrank(depositor);
        usdc.approve(address(netting), 4 * 1e6);

        netting.depositUSDC(2 * 1e6);
        netting.depositUSDC(2 * 1e6);
        assertEq(netting.usdBalance(depositor), 4e6);

        netting.withdrawUSDC(3 * 1e6);
        assertEq(netting.usdBalance(depositor), 1e6);
        assertEq(netting.depositsQueued(), 1e6);
    }

    function testDepositAndWithdrawCrabPartial() public {
        vm.startPrank(withdrawer);
        crab.approve(address(netting), 2 * 1e6);

        netting.queueCrabForWithdrawal(2 * 1e6);
        assertEq(netting.crabBalance(withdrawer), 2e6);

        netting.withdrawCrab(1 * 1e6);
        assertEq(netting.crabBalance(withdrawer), 1e6);
        assertEq(netting.withdrawsQueued(), 1e6);
    }

    function testDepositAndWithdrawCrabFull() public {
        vm.startPrank(withdrawer);
        crab.approve(address(netting), 2 * 1e6);

        netting.queueCrabForWithdrawal(2 * 1e6);
        assertEq(netting.crabBalance(withdrawer), 2e6);

        netting.withdrawCrab(2 * 1e6);
        assertEq(netting.crabBalance(withdrawer), 0);
        assertEq(netting.withdrawsQueued(), 0);
    }

    function testCrabDepositLargeWithdraw() public {
        vm.startPrank(withdrawer);
        crab.approve(address(netting), 4 * 1e6);

        netting.queueCrabForWithdrawal(2 * 1e6);
        netting.queueCrabForWithdrawal(2 * 1e6);
        assertEq(netting.crabBalance(withdrawer), 4e6);

        netting.withdrawCrab(3 * 1e6);

        assertEq(netting.crabBalance(withdrawer), 1e6);
        assertEq(netting.withdrawsQueued(), 1e6);
    }
}
