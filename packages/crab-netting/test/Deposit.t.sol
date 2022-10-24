// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "forge-std/Test.sol";
import {ERC20} from "openzeppelin/token/ERC20/ERC20.sol";

import {CrabNetting} from "../src/CrabNetting.sol";

contract USDC is ERC20 {
    constructor(uint256 initialSupply) ERC20("USDC", "USDC") {
        _mint(msg.sender, initialSupply);
    }
}

contract DepositTest is Test {
    USDC usdc;
    CrabNetting netting;

    uint256 internal ownerPrivateKey;
    address internal owner;
    uint256 internal depositorPk;
    address internal depositor;
    uint256 internal withdrawerPk;
    address internal withdrawer;

    function setUp() public {
        usdc = new USDC(10000 * 1e18);
        netting = new CrabNetting(address(usdc));

        ownerPrivateKey = 0xA11CE;
        owner = vm.addr(ownerPrivateKey);

        depositorPk = 0xA11CA;
        depositor = vm.addr(depositorPk);

        withdrawerPk = 0xA11CB;
        withdrawer = vm.addr(withdrawerPk);

        usdc.transfer(depositor, 2 * 1e18);
    }

    function testDepositAndWithdraw() public {
        vm.startPrank(depositor);
        usdc.approve(address(netting), 2 * 1e18);
        netting.depositUSDC(2 * 1e18);

        assertEq(netting.balanceOf(depositor), 2e18);
        netting.withdrawUSDC(1 * 1e18);
        assertEq(netting.balanceOf(depositor), 1e18);
    }
}
