// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "forge-std/Test.sol";
import {BaseForkSetup} from "./BaseForkSetup.t.sol";

contract NettingTest is BaseForkSetup {
    function setUp() public override {
        BaseForkSetup.setUp(); // gives you netting, depositor, withdrawer, usdc, crab
        vm.startPrank(0x57757E3D981446D585Af0D9Ae4d7DF6D64647806);
        usdc.transfer(depositor, 400e6);
        vm.stopPrank();

        vm.prank(0x06CECFbac34101aE41C88EbC2450f8602b3d164b);
        crab.transfer(withdrawer, 40e18);

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
        uint256 price = 1330e6;
        uint256 quantity = 100e6;
        netting.netAtPrice(price, quantity); // net for 100 USD where 1 crab is 10 USD, so 10 crab
        assertApproxEqAbs(
            usdc.balanceOf(withdrawer),
            quantity,
            1,
            "withdrawer did not get their usdc"
        );
        assertEq(
            crab.balanceOf(depositor),
            (quantity * 1e18) / price,
            "depositor did not get their crab"
        );
    }

    function testNettingWithMultipleDeposits() public {
        assertEq(usdc.balanceOf(withdrawer), 0, "withdrawer starting balance");
        assertEq(crab.balanceOf(depositor), 0, "depositor starting balance");
        uint256 price = 1330e6;
        uint256 quantity = 200e6;
        netting.netAtPrice(price, quantity); // net for 200 USD where 1 crab is 10 USD, so 20 crab
        assertApproxEqAbs(
            usdc.balanceOf(withdrawer),
            quantity,
            1,
            "withdrawer did not get their usdc"
        );
        assertEq(
            crab.balanceOf(depositor),
            (quantity * 1e18) / price,
            "depositor did not get their crab"
        );
    }

    function testNettingWithPartialReceipt() public {
        assertEq(usdc.balanceOf(withdrawer), 0, "withdrawer starting balance");
        assertEq(crab.balanceOf(depositor), 0, "depositor starting balance");
        uint256 price = 1330e6;
        uint256 quantity = 30e6;
        netting.netAtPrice(price, quantity); // 20 from first desposit and 10 from second (partial)
        assertEq(
            netting.depositsQueued(),
            170e6,
            "receipts were not updated correctly"
        );
        netting.netAtPrice(price, 170e6);
        assertEq(
            crab.balanceOf(depositor),
            (200e6 * 1e18) / price,
            "depositor got their crab"
        );
    }

    function testNettingAfterWithdraw() public {
        assertEq(usdc.balanceOf(withdrawer), 0, "withdrawer starting balance");
        assertEq(crab.balanceOf(depositor), 0, "depositor starting balance");
        vm.prank(depositor);
        uint256 withdrawQuantity = 50e6;
        netting.withdrawUSDC(withdrawQuantity);
        uint256 price = 1330e6;
        uint256 quantity = 200e6 - withdrawQuantity;
        netting.netAtPrice(price, quantity);
        assertEq(
            crab.balanceOf(depositor),
            (quantity * 1e18) / price,
            "depositor got their crab"
        );
    }

    function testNettingAfterARun() public {
        uint256 price = 1330e6;
        uint256 quantity = 200e6;
        vm.prank(withdrawer);
        netting.withdrawCrab(20e18 - (quantity * 1e18) / price);
        console.log(
            netting.crabBalance(withdrawer),
            "crab balance bfore first netting"
        );
        netting.netAtPrice(price, 200e6); // net for 100 USD where 1 crab is 10 USD, so 10 crab
        console.log(
            netting.crabBalance(withdrawer),
            "crab balance after first netting"
        );

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

        netting.netAtPrice(price, 200e6); // net for 100 USD where 1 crab is 10 USD, so 10 crab
        assertApproxEqAbs(
            usdc.balanceOf(withdrawer),
            400e6,
            2,
            "witadrawer got their usdc"
        );
        assertEq(
            crab.balanceOf(depositor),
            (400e6 * 1e18) / price,
            "depositor got their crab"
        );
    }

    function testCannotWithdrawMoreThanDeposited() public {
        vm.startPrank(depositor);
        vm.expectRevert(stdError.arithmeticError);
        netting.withdrawUSDC(210e6);
        vm.stopPrank();
    }
}
