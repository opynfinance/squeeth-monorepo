// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.17;

import "forge-std/Test.sol";

import {Order} from "../src/CrabNetting.sol";
import {ICrabStrategyV2} from "../src/interfaces/ICrabStrategyV2.sol";

import {UniswapQuote} from "./utils/UniswapQuote.sol";
import {BaseForkSetup} from "./BaseForkSetup.t.sol";

import {ERC20} from "openzeppelin/token/ERC20/ERC20.sol";
import {IWETH} from "../src/interfaces/IWETH.sol";

struct TimeBalances {
    uint256 start;
    uint256 end;
}

contract TestWithdrawAuction is BaseForkSetup {
    function setUp() public override {
        BaseForkSetup.setUp();

        // this is a crab whale, get some crab token from
        vm.prank(0x06CECFbac34101aE41C88EbC2450f8602b3d164b);
        crab.transfer(withdrawer, 20e18);

        // send sqth to market makers todo
        vm.startPrank(0x56178a0d5F301bAf6CF3e1Cd53d9863437345Bf9);
        sqth.transfer(mm1, 1000e18);
        sqth.transfer(mm2, 1000e18);
        vm.stopPrank();

        // deposit crab for withdrawing
        vm.startPrank(withdrawer);
        crab.approve(address(netting), 13 * 1e18);
        netting.queueCrabForWithdrawal(2 * 1e18);
        netting.queueCrabForWithdrawal(3 * 1e18);
        netting.queueCrabForWithdrawal(6 * 1e18);
        vm.stopPrank();
        // 11 crabs queued for withdrawal
    }

    function testWithdrawAuction() public {
        // find the sqth to buy to make the trade
        uint256 crabToWithdraw = 10e18;
        uint256 sqthToBuy = crab.getWsqueethFromCrabAmount(crabToWithdraw);
        UniswapQuote quote = new UniswapQuote();
        uint256 sqthPrice = quote.getSqthPrice(1e18);
        uint256 clearingPrice = (sqthPrice * 1001) / 1000;

        // get the orders for that sqth
        vm.prank(mm1);
        sqth.approve(address(netting), 1000000e18);
        orders.push(
            Order(0, mm1, sqthToBuy, clearingPrice, false, 0, 0, 1, 0x00, 0x00)
        );

        // find the minUSDC to receive
        // get col and wsqth from crab amount, find the equity value in eth
        (, , uint256 collateral, ) = crab.getVaultDetails();
        uint256 collateralPortion = (crabToWithdraw * collateral) /
            crab.totalSupply();
        uint256 debtPortion = crab.getWsqueethFromCrabAmount(crabToWithdraw);
        uint256 equityInEth = collateralPortion -
            (debtPortion * clearingPrice) /
            1e18;

        uint256 minUSDC = (quote.convertWETHToUSDC(equityInEth) * 999) / 1000;
        // get equivalent usdc quote with slippage and send

        // call withdrawAuction on netting contract
        TimeBalances memory timeUSDC;
        timeUSDC.start = ERC20(usdc).balanceOf(withdrawer);
        uint256 startWETH = IWETH(weth).balanceOf(mm1);

        netting.withdrawAuction(crabToWithdraw, orders, clearingPrice, minUSDC);

        timeUSDC.end = ERC20(usdc).balanceOf(withdrawer);
        uint256 endWETHBalance = IWETH(weth).balanceOf(mm1);
        assertGe(timeUSDC.end - timeUSDC.start, minUSDC);
        assertGe(endWETHBalance - startWETH, (sqthToBuy * sqthPrice) / 1e18);

        // and eth recevied for mm
        assertEq(address(netting).balance, 0);
        assertEq(ERC20(sqth).balanceOf(address(netting)), 0, "sqth balance");
        assertLe(ERC20(usdc).balanceOf(address(netting)), 1, "usdc balance");
        assertEq(
            ICrabStrategyV2(crab).balanceOf(address(netting)),
            1e18,
            "crab balance"
        );
        assertEq(IWETH(weth).balanceOf(address(netting)), 0, "weth balance");
    }
}
