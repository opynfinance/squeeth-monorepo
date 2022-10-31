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

contract QueuedDataTest is Test {
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
        vm.etch(0xf1B99e3E573A1a9C5E6B2Ce818b617F0E664E86B, address(weth).code);

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

        withdrawerPk = 0xA11CB;
        withdrawer = vm.addr(withdrawerPk);

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

        netting.netAtPrice(10e6, 100e6); // net for 100 USD where 1 crab is 10 USD, so 10 crab
    }

    function testcrabBalanceQueued() public {
        assertEq(netting.depositsQueued(), 100e6);
    }

    function testWithdrawsQueued() public {
        assertEq(netting.withdrawsQueued(), 10e18);
    }
}
