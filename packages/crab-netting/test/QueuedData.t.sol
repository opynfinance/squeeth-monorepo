// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "forge-std/Test.sol";
import {ERC20} from "openzeppelin/token/ERC20/ERC20.sol";

import {CrabNetting} from "../src/CrabNetting.sol";

contract FixedERC20 is ERC20 {
    constructor(uint256 initialSupply) ERC20("USDC", "USDC") {
        _mint(msg.sender, initialSupply);
    }
}

contract QueuedDataTest is Test {
    FixedERC20 usdc;
    FixedERC20 crab;
    CrabNetting netting;

    uint256 internal ownerPrivateKey;
    address internal owner;
    uint256 internal depositorPk;
    address internal depositor;
    uint256 internal withdrawerPk;
    address internal withdrawer;

    function setUp() public {
        usdc = new FixedERC20(10000 * 1e18);
        crab = new FixedERC20(10000 * 1e18);
        netting = new CrabNetting(address(usdc), address(crab));

        ownerPrivateKey = 0xA11CE;
        owner = vm.addr(ownerPrivateKey);

        depositorPk = 0xA11CA;
        depositor = vm.addr(depositorPk);

        withdrawerPk = 0xA11CB;
        withdrawer = vm.addr(withdrawerPk);

        usdc.transfer(depositor, 400 * 1e18);
        crab.transfer(withdrawer, 40 * 1e18);

        vm.startPrank(depositor);
        usdc.approve(address(netting), 200 * 1e18);
        netting.depositUSDC(20 * 1e18);
        netting.depositUSDC(100 * 1e18);
        netting.depositUSDC(80 * 1e18);
        assertEq(netting.usd_balance(depositor), 200e18);
        vm.stopPrank();

        vm.startPrank(withdrawer);
        crab.approve(address(netting), 200 * 1e18);
        netting.depositCrab(5 * 1e18);
        netting.depositCrab(4 * 1e18);
        netting.depositCrab(11 * 1e18);
        assertEq(netting.crab_balance(withdrawer), 20e18);
        vm.stopPrank();

        netting.netAtPrice(10, 100e18); // net for 100 USD where 1 crab is 10 USD, so 10 crab
    }

    function testDepositsQueued() public {
        assertEq(netting.depositsQueued(), 100e18);
    }

    function testWithdrawsQueued() public {
        assertEq(netting.withdrawsQueued(), 10e18);
    }
}
