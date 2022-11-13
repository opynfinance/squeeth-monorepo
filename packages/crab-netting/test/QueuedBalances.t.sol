// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {BaseForkSetup} from "./BaseForkSetup.t.sol";

contract QueuedBalancesTest is BaseForkSetup {
    uint256 crabsToWithdraw = 40e18;
    uint256 price = 1279e6; // 1338 bounds are 1271 and 1404
    uint256 totalUSDCRequired = (crabsToWithdraw * price) / 1e18;

    function setUp() public override {
        BaseForkSetup.setUp(); // gives you netting, depositor, withdrawer, usdc, crab
        vm.startPrank(0x57757E3D981446D585Af0D9Ae4d7DF6D64647806);
        usdc.transfer(depositor, totalUSDCRequired);
        vm.stopPrank();

        vm.prank(0x06CECFbac34101aE41C88EbC2450f8602b3d164b);
        crab.transfer(withdrawer, crabsToWithdraw);

        // make multiple deposits from depositor
        vm.startPrank(depositor);
        usdc.approve(address(netting), totalUSDCRequired);
        netting.depositUSDC((totalUSDCRequired * 10) / 100);
        netting.depositUSDC((totalUSDCRequired * 50) / 100);
        netting.depositUSDC((totalUSDCRequired * 40) / 100);
        assertEq(netting.usdBalance(depositor), totalUSDCRequired);
        vm.stopPrank();

        // queue multiple crabs from withdrawer
        vm.startPrank(withdrawer);
        crab.approve(address(netting), crabsToWithdraw);
        netting.queueCrabForWithdrawal((crabsToWithdraw * 25) / 100);
        netting.queueCrabForWithdrawal((crabsToWithdraw * 20) / 100);
        netting.queueCrabForWithdrawal((crabsToWithdraw * 55) / 100);
        assertEq(netting.crabBalance(withdrawer), crabsToWithdraw);
        vm.stopPrank();

        netting.netAtPrice(price, totalUSDCRequired / 2); // net for 100 USD where 1 crab is 10 USD, so 10 crab
    }

    function testcrabBalanceQueued() public {
        assertEq(netting.depositsQueued(), totalUSDCRequired / 2);
    }

    function testWithdrawsQueued() public {
        assertEq(netting.withdrawsQueued(), crabsToWithdraw / 2);
    }
}
