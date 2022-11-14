// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.17;

import "forge-std/Test.sol";
import {BaseForkSetup} from "./BaseForkSetup.t.sol";

contract ForkTestNetAtPrice is BaseForkSetup {
    function setUp() public override {
        BaseForkSetup.setUp();
        // this is a crab whale, get some crab token from
        vm.prank(0x06CECFbac34101aE41C88EbC2450f8602b3d164b);
        crab.transfer(withdrawer, 1e18);

        // some WETH and USDC rich address
        vm.prank(0x57757E3D981446D585Af0D9Ae4d7DF6D64647806);
        usdc.transfer(depositor, 20e6);
    }

    function testForkTestNetAtPrice() public {
        vm.startPrank(depositor);
        usdc.approve(address(netting), 17e6);
        netting.depositUSDC(17e6);
        vm.stopPrank();

        vm.startPrank(withdrawer);
        crab.approve(address(netting), 1e18);
        netting.queueCrabForWithdrawal(1e18);
        vm.stopPrank();

        assertEq(usdc.balanceOf(withdrawer), 0);
        assertEq(crab.balanceOf(depositor), 0);
        uint256 priceToNet = 1336290000;
        uint256 quantityToNet = 16840842;
        netting.netAtPrice(priceToNet, quantityToNet); // $1336.29 per crab and nets $16.84
        assertApproxEqAbs(usdc.balanceOf(withdrawer), quantityToNet, 1); // withdrawer gets that amount
        uint256 crabReceived = (quantityToNet * 1e18) / priceToNet;
        assertEq(crab.balanceOf(depositor), crabReceived); // depositor gets 0.01265755 crab
        assertEq(netting.crabBalance(withdrawer), 1e18 - crabReceived); // ensure crab remains
    }
}
