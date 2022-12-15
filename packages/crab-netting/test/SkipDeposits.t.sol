// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {BaseForkSetup} from "./BaseForkSetup.t.sol";

contract SkipDeposits is BaseForkSetup {
    function setUp() public override {
        BaseForkSetup.setUp(); // gives you netting, depositor, withdrawer, usdc, crab

        vm.startPrank(0x57757E3D981446D585Af0D9Ae4d7DF6D64647806);
        usdc.transfer(depositor, 20e6);
        vm.stopPrank();

        vm.prank(0x06CECFbac34101aE41C88EbC2450f8602b3d164b);
        crab.transfer(withdrawer, 20e18);
    }

    function testSkipDeposits() public {
        netting.setMinUSDC(1e6);
        vm.startPrank(depositor);
        usdc.approve(address(netting), 2 * 1e6);
        netting.depositUSDC(1e6);
        netting.depositUSDC(1e6);
        vm.stopPrank();
        assertEq(netting.depositsQueued(), 2e6);
        netting.setDepositsIndex(1);
        assertEq(netting.depositsQueued(), 1e6);
    }

    function testSkipWithdraws() public {
        netting.setMinCrab(1e18);
        vm.startPrank(withdrawer);
        crab.approve(address(netting), 2 * 1e18);
        netting.queueCrabForWithdrawal(1e18);
        netting.queueCrabForWithdrawal(1e18);
        vm.stopPrank();
        assertEq(netting.withdrawsQueued(), 2e18);
        netting.setWithdrawsIndex(1);
        assertEq(netting.withdrawsQueued(), 1e18);
    }
}
