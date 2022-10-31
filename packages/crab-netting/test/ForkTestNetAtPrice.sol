// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.17;

import "forge-std/Test.sol";
import {ERC20} from "openzeppelin/token/ERC20/ERC20.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import {ICrabStrategyV2} from "../src/interfaces/ICrabStrategyV2.sol";
import {CrabNetting} from "../src/CrabNetting.sol";
import {IWETH} from "../src/interfaces/IWETH.sol";

contract ForkTestNetAtPrice is Test {
    ISwapRouter public immutable swapRouter =
        ISwapRouter(0xE592427A0AEce92De3Edee1F18E0157C05861564);
    uint256 internal depositorPk;
    address internal depositor;

    uint256 internal withdrawerPk;
    address internal withdrawer;

    ICrabStrategyV2 crab;
    ERC20 usdc;
    IWETH weth;
    ERC20 sqth;
    CrabNetting netting;

    function setUp() public {
        string memory FORK_URL = vm.envString("FORK_URL");
        vm.createSelectFork(FORK_URL, 15819213);

        crab = ICrabStrategyV2(0x3B960E47784150F5a63777201ee2B15253D713e8);
        weth = IWETH(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);
        usdc = ERC20(0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48);
        sqth = ERC20(0xf1B99e3E573A1a9C5E6B2Ce818b617F0E664E86B);

        depositorPk = 0xA11CE;
        depositor = vm.addr(depositorPk);
        vm.label(depositor, "depositor");

        withdrawerPk = 0xA11CB;
        withdrawer = vm.addr(withdrawerPk);
        vm.label(withdrawer, "withdrawer");

        // this is a crab whale, get some crab token from
        vm.prank(0x06CECFbac34101aE41C88EbC2450f8602b3d164b);
        crab.transfer(withdrawer, 1e18);
        // some WETH and USDC rich address
        vm.prank(0x57757E3D981446D585Af0D9Ae4d7DF6D64647806);
        usdc.transfer(depositor, 20e6);

        netting = new CrabNetting(
            address(usdc),
            address(crab),
            address(weth),
            address(sqth),
            address(swapRouter)
        );
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
        netting.netAtPrice(1023290000, 16840842);
        assertApproxEqAbs(usdc.balanceOf(withdrawer), 16840842, 1);
        assertEq(crab.balanceOf(depositor), 16457545759266679);
    }
}
