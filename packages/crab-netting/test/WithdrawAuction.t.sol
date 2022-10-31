// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.17;

import "forge-std/Test.sol";

import {IWETH} from "../src/interfaces/IWETH.sol";

import {CrabNetting, Order} from "../src/CrabNetting.sol";
import {ERC20} from "openzeppelin/token/ERC20/ERC20.sol";
import {IQuoter} from "@uniswap/v3-periphery/contracts/interfaces/IQuoter.sol";
import {ICrabStrategyV2} from "../src/interfaces/ICrabStrategyV2.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";

import {UniswapQuote} from "./utils/UniswapQuote.sol";

struct TimeBalances {
    uint256 start;
    uint256 end;
}

contract TestWithdrawAuction is Test {
    ISwapRouter public immutable swapRouter =
        ISwapRouter(0xE592427A0AEce92De3Edee1F18E0157C05861564);
    uint256 internal withdrawerPk;
    address internal withdrawer;

    uint256 internal mm1Pk;
    address internal mm1;

    uint256 internal mm2Pk;
    address internal mm2;

    ICrabStrategyV2 crab;
    IWETH weth;
    ERC20 usdc;
    ERC20 sqth;
    CrabNetting netting;
    Order[] orders;
    IQuoter quoter;

    function setUp() public {
        string memory FORK_URL = vm.envString("FORK_URL");
        vm.createSelectFork(FORK_URL, 15819213); // price of eth in this block is 1,343.83
        quoter = IQuoter(0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6);
        crab = ICrabStrategyV2(0x3B960E47784150F5a63777201ee2B15253D713e8);
        weth = IWETH(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);
        vm.label(address(weth), "weth");
        usdc = ERC20(0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48);
        sqth = ERC20(0xf1B99e3E573A1a9C5E6B2Ce818b617F0E664E86B);

        withdrawerPk = 0xA11CE;
        withdrawer = vm.addr(withdrawerPk);
        mm1Pk = 0xA11CC;
        mm1 = vm.addr(mm1Pk);
        vm.label(mm1, "mm1");
        mm2Pk = 0xA11CA;
        mm2 = vm.addr(mm2Pk);

        // this is a crab whale, get some crab token from
        vm.prank(0x06CECFbac34101aE41C88EbC2450f8602b3d164b);
        crab.transfer(withdrawer, 20e18);

        // send sqth to market makers todo
        vm.startPrank(0x56178a0d5F301bAf6CF3e1Cd53d9863437345Bf9);
        sqth.transfer(mm1, 1000e18);
        sqth.transfer(mm2, 1000e18);
        vm.stopPrank();

        netting = new CrabNetting(
            address(usdc),
            address(crab),
            address(weth),
            address(sqth),
            address(swapRouter)
        );

        // deposit crab for withdrawing
        vm.startPrank(withdrawer);
        crab.approve(address(netting), 13 * 1e18);
        netting.queueCrabForWithdrawal(2 * 1e18);
        netting.queueCrabForWithdrawal(3 * 1e18);
        netting.queueCrabForWithdrawal(6 * 1e18);
        vm.stopPrank();
    }

    function testWithdrawAuction() public {
        assert(true);
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
