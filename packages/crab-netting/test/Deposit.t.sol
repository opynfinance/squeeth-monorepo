// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {BaseForkSetup} from "./BaseForkSetup.t.sol";

contract DepositTest is BaseForkSetup {
    function setUp() public override {
        BaseForkSetup.setUp(); // gives you netting, depositor, withdrawer, usdc, crab

        vm.startPrank(0x57757E3D981446D585Af0D9Ae4d7DF6D64647806);
        usdc.transfer(depositor, 20e6);
        vm.stopPrank();

        vm.prank(0x06CECFbac34101aE41C88EbC2450f8602b3d164b);
        crab.transfer(withdrawer, 20e18);
    }

    function testDepositMin() public {
        netting.setMinUSDC(1e6);
        vm.startPrank(depositor);
        usdc.approve(address(netting), 2 * 1e6);
        netting.depositUSDC(1e6);
        assertEq(netting.usdBalance(depositor), 1e6);
    }

    function testDepositLessThanMin() public {
        netting.setMinUSDC(1e6);
        vm.startPrank(depositor);
        usdc.approve(address(netting), 5 * 1e5);
        vm.expectRevert();
        netting.depositUSDC(5e5);
    }

    function testDepositAndWithdrawPartialUSDC() public {
        vm.startPrank(depositor);
        usdc.approve(address(netting), 2 * 1e6);

        netting.depositUSDC(2 * 1e6);
        assertEq(netting.usdBalance(depositor), 2e6);

        netting.withdrawUSDC(1 * 1e6, false);

        assertEq(netting.usdBalance(depositor), 1e6);
        assertEq(netting.depositsQueued(), 1e6);
    }

    function testDepositAndWithdrawFullUSDC() public {
        vm.startPrank(depositor);
        usdc.approve(address(netting), 2 * 1e6);

        netting.depositUSDC(2 * 1e6);
        assertEq(netting.usdBalance(depositor), 2e6);

        netting.withdrawUSDC(2 * 1e6, false);
        assertEq(netting.usdBalance(depositor), 0);
        assertEq(netting.depositsQueued(), 0);
    }

    function testLargeWithdraw() public {
        vm.startPrank(depositor);
        usdc.approve(address(netting), 4 * 1e6);

        netting.depositUSDC(2 * 1e6);
        netting.depositUSDC(2 * 1e6);
        assertEq(netting.usdBalance(depositor), 4e6);

        netting.withdrawUSDC(3 * 1e6, false);
        assertEq(netting.usdBalance(depositor), 1e6);
        assertEq(netting.depositsQueued(), 1e6);
    }

    function testDepositAndWithdrawCrabPartial() public {
        vm.startPrank(withdrawer);
        crab.approve(address(netting), 2 * 1e6);

        netting.queueCrabForWithdrawal(2 * 1e6);
        assertEq(netting.crabBalance(withdrawer), 2e6);

        netting.dequeueCrab(1 * 1e6, false);
        assertEq(netting.crabBalance(withdrawer), 1e6);
        assertEq(netting.withdrawsQueued(), 1e6);
    }

    function testDepositAndWithdrawCrabFull() public {
        vm.startPrank(withdrawer);
        crab.approve(address(netting), 2 * 1e6);

        netting.queueCrabForWithdrawal(2 * 1e6);
        assertEq(netting.crabBalance(withdrawer), 2e6);

        netting.dequeueCrab(2 * 1e6, false);
        assertEq(netting.crabBalance(withdrawer), 0);
        assertEq(netting.withdrawsQueued(), 0);
    }

    function testCrabDepositLargeWithdraw() public {
        vm.startPrank(withdrawer);
        crab.approve(address(netting), 4 * 1e6);

        netting.queueCrabForWithdrawal(2 * 1e6);
        netting.queueCrabForWithdrawal(2 * 1e6);
        assertEq(netting.crabBalance(withdrawer), 4e6);

        netting.dequeueCrab(3 * 1e6, false);

        assertEq(netting.crabBalance(withdrawer), 1e6, "withdrawer balance incorrect");
        assertEq(netting.withdrawsQueued(), 1e6, "withdraws queued balance incorrect");
    }

    function testCannotWithdrawCrabWhenAuctionLive() public {
        netting.toggleAuctionLive();

        vm.startPrank(withdrawer);
        crab.approve(address(netting), 2 * 1e18);
        netting.queueCrabForWithdrawal(2 * 1e18);

        vm.expectRevert(bytes("N2"));
        netting.dequeueCrab(2 * 1e18, false);
        vm.stopPrank();
    }

    function testCannotWithdrawUSDCWhenAuctionLive() public {
        netting.toggleAuctionLive();

        vm.startPrank(depositor);
        usdc.approve(address(netting), 2 * 1e6);
        netting.depositUSDC(2 * 1e6);

        vm.expectRevert(bytes("N2"));
        netting.withdrawUSDC(2 * 1e6, false);
        vm.stopPrank();
    }

    function testDepositAndWithdrawFail_POC() public {
        netting.setMinUSDC(10e6);
        vm.startPrank(depositor);
        usdc.approve(address(netting), 10e9);
        netting.depositUSDC(10e6);

        for (uint256 i = 0; i < 100; i++) {
            netting.depositUSDC(10e6);
            netting.withdrawUSDC{gas: 200_000}(10e6, false);
        }
    }

    function testWithdrawAndDeQueueFail_POC() public {
        netting.setMinCrab(1);
        vm.startPrank(withdrawer);
        crab.approve(address(netting), 20e18);
        netting.queueCrabForWithdrawal(10e18);

        for (uint256 i = 0; i < 100; i++) {
            netting.queueCrabForWithdrawal(10);
            netting.dequeueCrab{gas: 200_000}(10e6, false);
        }
    }

    function testForceWithdraw() public {
        uint256 startBalance = usdc.balanceOf(depositor);
        vm.startPrank(depositor);
        usdc.approve(address(netting), 2 * 1e6);
        netting.depositUSDC(2 * 1e6);
        vm.stopPrank();

        netting.toggleAuctionLive();

        vm.startPrank(depositor);
        vm.expectRevert(bytes("N2"));
        netting.withdrawUSDC(2e6, false);
        skip(8 * 24 * 60 * 60);
        netting.withdrawUSDC(2e6, true);
        assertEq(startBalance, usdc.balanceOf(depositor));
    }

    function testForceWithdrawCrab() public {
        uint256 startBalance = crab.balanceOf(withdrawer);
        vm.startPrank(withdrawer);
        crab.approve(address(netting), 2e18);
        netting.queueCrabForWithdrawal(2e18);
        vm.stopPrank();

        netting.toggleAuctionLive();

        vm.startPrank(withdrawer);
        vm.expectRevert(bytes("N2"));
        netting.dequeueCrab(2e18, false);
        skip(8 * 24 * 60 * 60);
        netting.dequeueCrab(2e18, true);
        assertEq(startBalance, crab.balanceOf(withdrawer));
    }
}
