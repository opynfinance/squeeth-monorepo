// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "forge-std/Test.sol";
import {ERC20} from "openzeppelin/token/ERC20/ERC20.sol";

import {CrabNetting} from "../src/CrabNetting.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";

contract FixedERC20 is ERC20 {
    constructor(uint256 initialSupply) ERC20("USDC", "USDC") {
        _mint(msg.sender, initialSupply);
    }
}

contract NettingTest is Test {
    FixedERC20 usdc;
    FixedERC20 crab;
    FixedERC20 weth;
    FixedERC20 sqth;
    CrabNetting netting;
    ISwapRouter public immutable swapRouter =
        ISwapRouter(0xE592427A0AEce92De3Edee1F18E0157C05861564);

    uint256 internal ownerPrivateKey;
    address internal owner;
    uint256 internal depositorPk;
    address internal depositor;
    uint256 internal withdrawerPk;
    address internal withdrawer;

    function setUp() public {
        usdc = new FixedERC20(10000 * 1e6);
        crab = new FixedERC20(10000 * 1e18);
        weth = new FixedERC20(10000 * 1e18);
        sqth = new FixedERC20(10000 * 1e18);

        netting = new CrabNetting(
            address(usdc),
            address(crab),
            address(weth),
            address(sqth),
            address(swapRouter)
        );

        ownerPrivateKey = 0xA11CE;
        owner = vm.addr(ownerPrivateKey);

        depositorPk = 0xA11CA;
        depositor = vm.addr(depositorPk);
        vm.label(depositor, "depositor");

        withdrawerPk = 0xA11CB;
        withdrawer = vm.addr(withdrawerPk);
        vm.label(withdrawer, "withdrawer");

        usdc.transfer(depositor, 400 * 1e6);
        crab.transfer(withdrawer, 40 * 1e18);

        vm.startPrank(depositor);
        usdc.approve(address(netting), 200 * 1e6);
        netting.depositUSDC(20 * 1e6);
        netting.depositUSDC(100 * 1e6);
        netting.depositUSDC(80 * 1e6);
        assertEq(netting.usdBalance(depositor), 200e6);
        vm.stopPrank();

        vm.startPrank(withdrawer);
        crab.approve(address(netting), 200 * 1e18);
        netting.queueCrabForWithdrawal(5 * 1e18);
        netting.queueCrabForWithdrawal(4 * 1e18);
        netting.queueCrabForWithdrawal(11 * 1e18);
        assertEq(netting.crabBalance(withdrawer), 20e18);
        vm.stopPrank();
    }

    function testNetting() public {
        // TODO turn this into a fuzzing test
        assertEq(usdc.balanceOf(withdrawer), 0, "starting balance");
        assertEq(crab.balanceOf(depositor), 0, "depositor got their crab");
        netting.netAtPrice(10e6, 100e6); // net for 100 USD where 1 crab is 10 USD, so 10 crab
        assertEq(
            usdc.balanceOf(withdrawer),
            100e6,
            "withdrawer got their usdc"
        );
        assertEq(
            crab.balanceOf(depositor),
            10e18,
            "depositor did not got their crab"
        );
    }

    function testNettingWithMultipleDeposits() public {
        assertEq(usdc.balanceOf(withdrawer), 0, "withdrawer starting balance");
        assertEq(crab.balanceOf(depositor), 0, "depositor starting balance");
        netting.netAtPrice(10e6, 200e6); // net for 100 USD where 1 crab is 10 USD, so 10 crab
        assertEq(
            usdc.balanceOf(withdrawer),
            200e6,
            "withdrawer got their usdc"
        );
        assertEq(crab.balanceOf(depositor), 20e18, "depositor got their crab");
    }

    function testNettingWithPartialReceipt() public {
        assertEq(usdc.balanceOf(withdrawer), 0, "withdrawer starting balance");
        assertEq(crab.balanceOf(depositor), 0, "depositor starting balance");
        netting.netAtPrice(10e6, 30e6); // net for 100 USD where 1 crab is 10 USD, so 10 crab
        assertEq(
            netting.depositsQueued(),
            170e6,
            "receipts were not updated correctly"
        );
        netting.netAtPrice(10e6, 170e6); // net for 100 USD where 1 crab is 10 USD, so 10 crab
        assertEq(crab.balanceOf(depositor), 20e18, "depositor got their crab");
    }

    function testNettingAfterWithdraw() public {
        assertEq(usdc.balanceOf(withdrawer), 0, "withdrawer starting balance");
        assertEq(crab.balanceOf(depositor), 0, "depositor starting balance");
        vm.prank(depositor);
        netting.withdrawUSDC(50e6);
        netting.netAtPrice(10e6, 150e6); // net for 100 USD where 1 crab is 10 USD, so 10 crab
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