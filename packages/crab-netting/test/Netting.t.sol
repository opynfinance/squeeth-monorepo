// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "forge-std/Test.sol";
import {BaseSetup} from "./BaseSetup.t.sol";

contract NettingTest is BaseSetup {
    function setUp() public override {
        BaseSetup.setUp(); // gives you netting, depositor, withdrawer, usdc, crab
        usdc.transfer(depositor, 400 * 1e6);
        crab.transfer(withdrawer, 40 * 1e18);

        vm.startPrank(depositor); // makes some USDC deposits
        usdc.approve(address(netting), 200 * 1e6);
        netting.depositUSDC(20 * 1e6);
        netting.depositUSDC(100 * 1e6);
        netting.depositUSDC(80 * 1e6);
        assertEq(netting.usdBalance(depositor), 200e6);
        vm.stopPrank();

        vm.startPrank(withdrawer); // queue some crab
        crab.approve(address(netting), 200 * 1e18);
        netting.queueCrabForWithdrawal(5 * 1e18);
        netting.queueCrabForWithdrawal(4 * 1e18);
        netting.queueCrabForWithdrawal(11 * 1e18);
        assertEq(netting.crabBalance(withdrawer), 20e18);
        vm.stopPrank();

        // withdrawer has 20 queued and depositor 200
    }

    function testNetting() public {
        // TODO turn this into a fuzzing test
        assertEq(usdc.balanceOf(withdrawer), 0, "starting balance");
        assertEq(crab.balanceOf(depositor), 0, "depositor got their crab");
        netting.netAtPrice(10e6, 100e6); // net for 100 USD where 1 crab is 10 USD, so 10 crab
        assertEq(
            usdc.balanceOf(withdrawer),
            100e6,
            "withdrawer did not get their usdc"
        );
        assertEq(
            crab.balanceOf(depositor),
            10e18,
            "depositor did not get their crab"
        );
    }

    function testNettingWithMultipleDeposits() public {
        assertEq(usdc.balanceOf(withdrawer), 0, "withdrawer starting balance");
        assertEq(crab.balanceOf(depositor), 0, "depositor starting balance");
        netting.netAtPrice(10e6, 200e6); // net for 200 USD where 1 crab is 10 USD, so 20 crab
        assertEq(
            usdc.balanceOf(withdrawer),
            200e6,
            "withdrawer did not get their usdc"
        );
        assertEq(
            crab.balanceOf(depositor),
            20e18,
            "depositor did not get their crab"
        );
    }

    function testNettingWithPartialReceipt() public {
        assertEq(usdc.balanceOf(withdrawer), 0, "withdrawer starting balance");
        assertEq(crab.balanceOf(depositor), 0, "depositor starting balance");
        netting.netAtPrice(10e6, 30e6); // 20 from first desposit and 10 from second (partial)
        assertEq(
            netting.depositsQueued(),
            170e6,
            "receipts were not updated correctly"
        );
        netting.netAtPrice(10e6, 170e6);
        assertEq(crab.balanceOf(depositor), 20e18, "depositor got their crab");
    }

    function testNettingAfterWithdraw() public {
        assertEq(usdc.balanceOf(withdrawer), 0, "withdrawer starting balance");
        assertEq(crab.balanceOf(depositor), 0, "depositor starting balance");
        vm.prank(depositor);
        netting.withdrawUSDC(50e6);
        netting.netAtPrice(10e6, 150e6);
        assertEq(crab.balanceOf(depositor), 15e18, "depositor got their crab");
    }

    function testNettingAfterARun() public {
        netting.netAtPrice(10e6, 200e6); // net for 100 USD where 1 crab is 10 USD, so 10 crab

        // queue more
        vm.startPrank(depositor);
        usdc.approve(address(netting), 200 * 1e6);
        netting.depositUSDC(20 * 1e6);
        netting.depositUSDC(100 * 1e6);
        netting.depositUSDC(80 * 1e6);
        assertEq(
            netting.usdBalance(depositor),
            200e6,
            "usd balance not reflecting correctly"
        );
        vm.stopPrank();

        vm.startPrank(withdrawer);
        crab.approve(address(netting), 200 * 1e18);
        netting.queueCrabForWithdrawal(5 * 1e18);
        netting.queueCrabForWithdrawal(4 * 1e18);
        netting.queueCrabForWithdrawal(11 * 1e18);
        assertEq(
            netting.crabBalance(withdrawer),
            20e18,
            "crab balance not reflecting correctly"
        );
        vm.stopPrank();

        netting.netAtPrice(10e6, 200e6); // net for 100 USD where 1 crab is 10 USD, so 10 crab
        assertEq(
            usdc.balanceOf(withdrawer),
            400e6,
            "witadrawer got their usdc"
        );
        assertEq(crab.balanceOf(depositor), 40e18, "depositor got their crab");
    }

    function testCannotWithdrawMoreThanDeposited() public {
        vm.startPrank(depositor);
        vm.expectRevert(stdError.arithmeticError);
        netting.withdrawUSDC(210e6);
        vm.stopPrank();
    }
}
