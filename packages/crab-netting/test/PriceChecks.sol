// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "forge-std/Test.sol";
import {BaseForkSetup} from "./BaseForkSetup.t.sol";

contract PriceChecks is BaseForkSetup {
    uint256 crabsToWithdraw = 40e18;
    uint256 price = 1269e6; // 1335 bounds are 1267 and 1401
    uint256 totalUSDCRequired = (crabsToWithdraw * price) / 1e18;

    function setUp() public override {
        BaseForkSetup.setUp(); // gives you netting, depositor, withdrawer, usdc, crab
        vm.prank(0x57757E3D981446D585Af0D9Ae4d7DF6D64647806);
        usdc.transfer(depositor, totalUSDCRequired);

        vm.prank(0x06CECFbac34101aE41C88EbC2450f8602b3d164b);
        crab.transfer(withdrawer, crabsToWithdraw);

        // make multiple deposits from depositor
        vm.startPrank(depositor);
        usdc.approve(address(netting), totalUSDCRequired);
        netting.depositUSDC(totalUSDCRequired);
        vm.stopPrank();

        // queue multiple crabs from withdrawer
        vm.startPrank(withdrawer);
        crab.approve(address(netting), crabsToWithdraw);
        netting.queueCrabForWithdrawal(crabsToWithdraw);
        vm.stopPrank();
    }

    function testCrabPriceHigh() public {
        console.log("expecting a high crdab price");
        vm.expectRevert(bytes("Crab Price too high"));
        netting.netAtPrice(1500e6, totalUSDCRequired / 2);
    }

    function testCrabPriceLow() public {
        vm.expectRevert(bytes("Crab Price too low"));
        netting.netAtPrice(1100e6, totalUSDCRequired / 2);
    }
}
