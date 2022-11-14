// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.17;

import "forge-std/Test.sol";

import {Order, WithdrawAuctionParams} from "../src/CrabNetting.sol";
import {ICrabStrategyV2} from "../src/interfaces/ICrabStrategyV2.sol";

import {UniswapQuote} from "./utils/UniswapQuote.sol";
import {BaseForkSetup} from "./BaseForkSetup.t.sol";

import {ERC20} from "openzeppelin/token/ERC20/ERC20.sol";
import {IWETH} from "../src/interfaces/IWETH.sol";

import {SigUtils} from "./utils/SigUtils.sol";

struct TimeBalances {
    uint256 start;
    uint256 end;
}

struct Portion {
    uint256 collateral;
    uint256 debt;
}

struct Sign {
    uint8 v;
    bytes32 r;
    bytes32 s;
}

contract TestWithdrawAuction is BaseForkSetup {
    SigUtils sig;

    function setUp() public override {
        BaseForkSetup.setUp();
        sig = new SigUtils(netting.DOMAIN_SEPARATOR());

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
        crab.approve(address(netting), 19 * 1e18);
        netting.queueCrabForWithdrawal(2 * 1e18);
        netting.queueCrabForWithdrawal(3 * 1e18);
        netting.queueCrabForWithdrawal(6 * 1e18);
        vm.stopPrank();
        // 11 crabs queued for withdrawal
    }

    function testWithdrawAuction() public {
        WithdrawAuctionParams memory params;
        // find the sqth to buy to make the trade
        params.crabToWithdraw = 10e18;
        uint256 sqthToBuy = crab.getWsqueethFromCrabAmount(params.crabToWithdraw);
        UniswapQuote quote = new UniswapQuote();
        uint256 sqthPrice = quote.getSqthPrice(1e18);
        params.clearingPrice = (sqthPrice * 1001) / 1000;

        // get the orders for that sqth
        vm.prank(mm1);
        sqth.approve(address(netting), 1000000e18);

        Order memory order0 = Order(0, mm1, 1e18, params.clearingPrice, false, block.timestamp, 2, 1, 0x00, 0x00);
        Sign memory s0;
        (s0.v, s0.r, s0.s) = vm.sign(mm1Pk, sig.getTypedDataHash(order0));
        order0.v = s0.v;
        order0.r = s0.r;
        order0.s = s0.s;
        orders.push(order0);

        Order memory order =
            Order(0, mm1, sqthToBuy - 1e18, params.clearingPrice, false, block.timestamp, 0, 1, 0x00, 0x00);
        Sign memory s1;
        (s1.v, s1.r, s1.s) = vm.sign(mm1Pk, sig.getTypedDataHash(order));
        order.v = s1.v;
        order.r = s1.r;
        order.s = s1.s;
        orders.push(order);
        params.orders = orders;

        // find the minUSDC to receive
        // get col and wsqth from crab amount, find the equity value in eth
        (,, uint256 collateral,) = crab.getVaultDetails();
        Portion memory p;
        p.collateral = (params.crabToWithdraw * collateral) / crab.totalSupply();
        p.debt = crab.getWsqueethFromCrabAmount(params.crabToWithdraw);
        uint256 equityInEth = p.collateral - (p.debt * params.clearingPrice) / 1e18;

        params.minUSDC = (quote.convertWETHToUSDC(equityInEth) * 999) / 1000;
        params.ethUSDFee = 500;
        // get equivalent usdc quote with slippage and send

        // call withdrawAuction on netting contract
        TimeBalances memory timeUSDC;
        TimeBalances memory timeWETH;
        timeUSDC.start = ERC20(usdc).balanceOf(withdrawer);
        timeWETH.start = IWETH(weth).balanceOf(mm1);

        netting.withdrawAuction(params);

        timeUSDC.end = ERC20(usdc).balanceOf(withdrawer);
        timeWETH.end = IWETH(weth).balanceOf(mm1);
        assertGe(timeUSDC.end - timeUSDC.start, params.minUSDC);
        assertGe(timeWETH.end - timeWETH.start, (sqthToBuy * sqthPrice) / 1e18);

        // and eth recevied for mm
        assertEq(address(netting).balance, 0);
        assertEq(ERC20(sqth).balanceOf(address(netting)), 0, "sqth balance");
        assertLe(ERC20(usdc).balanceOf(address(netting)), 1, "usdc balance");
        assertEq(ICrabStrategyV2(crab).balanceOf(address(netting)), 1e18, "crab balance");
        assertEq(netting.crabBalance(address(withdrawer)), 11e18 - params.crabToWithdraw);
        assertEq(IWETH(weth).balanceOf(address(netting)), 0, "weth balance");
    }

    function testWithdrawAuctionAfterFullWithdraw() public {
        vm.startPrank(withdrawer);
        netting.dequeueCrab(6e18);
        netting.queueCrabForWithdrawal(6e18);
        vm.stopPrank();

        WithdrawAuctionParams memory params;
        // find the sqth to buy to make the trade
        params.crabToWithdraw = 10e18;
        uint256 sqthToBuy = crab.getWsqueethFromCrabAmount(params.crabToWithdraw);
        UniswapQuote quote = new UniswapQuote();
        uint256 sqthPrice = quote.getSqthPrice(1e18);
        params.clearingPrice = (sqthPrice * 1001) / 1000;

        // get the orders for that sqth
        vm.prank(mm1);
        sqth.approve(address(netting), 1000000e18);

        Order memory order0 = Order(0, mm1, 1e18, params.clearingPrice, false, block.timestamp, 2, 1, 0x00, 0x00);
        Sign memory s0;
        (s0.v, s0.r, s0.s) = vm.sign(mm1Pk, sig.getTypedDataHash(order0));
        order0.v = s0.v;
        order0.r = s0.r;
        order0.s = s0.s;
        orders.push(order0);

        Order memory order =
            Order(0, mm1, sqthToBuy - 1e18, params.clearingPrice, false, block.timestamp, 0, 1, 0x00, 0x00);
        Sign memory s1;
        (s1.v, s1.r, s1.s) = vm.sign(mm1Pk, sig.getTypedDataHash(order));
        order.v = s1.v;
        order.r = s1.r;
        order.s = s1.s;
        orders.push(order);
        params.orders = orders;

        // find the minUSDC to receive
        // get col and wsqth from crab amount, find the equity value in eth
        (,, uint256 collateral,) = crab.getVaultDetails();
        Portion memory p;
        p.collateral = (params.crabToWithdraw * collateral) / crab.totalSupply();
        p.debt = crab.getWsqueethFromCrabAmount(params.crabToWithdraw);
        uint256 equityInEth = p.collateral - (p.debt * params.clearingPrice) / 1e18;

        params.minUSDC = (quote.convertWETHToUSDC(equityInEth) * 999) / 1000;
        params.ethUSDFee = 500;
        // get equivalent usdc quote with slippage and send

        // call withdrawAuction on netting contract
        TimeBalances memory timeUSDC;
        TimeBalances memory timeWETH;
        timeUSDC.start = ERC20(usdc).balanceOf(withdrawer);
        timeWETH.start = IWETH(weth).balanceOf(mm1);

        netting.withdrawAuction(params);

        timeUSDC.end = ERC20(usdc).balanceOf(withdrawer);
        timeWETH.end = IWETH(weth).balanceOf(mm1);
        assertGe(timeUSDC.end - timeUSDC.start, params.minUSDC);
        assertGe(timeWETH.end - timeWETH.start, (sqthToBuy * sqthPrice) / 1e18);

        // and eth recevied for mm
        assertEq(address(netting).balance, 0);
        assertEq(ERC20(sqth).balanceOf(address(netting)), 0, "sqth balance");
        assertLe(ERC20(usdc).balanceOf(address(netting)), 1, "usdc balance");
        assertEq(ICrabStrategyV2(crab).balanceOf(address(netting)), 1e18, "crab balance");
        assertEq(netting.crabBalance(address(withdrawer)), 11e18 - params.crabToWithdraw);
        assertEq(IWETH(weth).balanceOf(address(netting)), 0, "weth balance");
    }

    function testSqthPriceAboveThreshold() public {
        WithdrawAuctionParams memory params;
        // find the sqth to buy to make the trade
        params.crabToWithdraw = 10e18;
        uint256 sqthToBuy = 1e6;
        UniswapQuote quote = new UniswapQuote();
        uint256 sqthPrice = quote.getSqthPrice(1e18);
        params.clearingPrice = (sqthPrice * 106) / 100;

        // get the orders for that sqth

        Order memory order = Order(0, mm1, sqthToBuy, params.clearingPrice, false, block.timestamp, 0, 1, 0x00, 0x00);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(mm1Pk, sig.getTypedDataHash(order));
        order.v = v;
        order.r = r;
        order.s = s;
        orders.push(order);
        params.orders = orders;

        params.minUSDC = 1e6;
        params.ethUSDFee = 500;
        // get equivalent usdc quote with slippage and send

        vm.expectRevert(bytes("Price too high relative to Uniswap twap."));
        netting.withdrawAuction(params);
    }
}
