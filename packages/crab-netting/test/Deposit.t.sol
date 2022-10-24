// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "forge-std/Test.sol";
import {ERC20} from "openzeppelin/token/ERC20/ERC20.sol";

import {CrabNetting} from "../src/CrabNetting.sol";

<<<<<<< HEAD
contract FixedERC20 is ERC20 {
=======
contract USDC is ERC20 {
>>>>>>> 3342065f (deposit for crab netting)
    constructor(uint256 initialSupply) ERC20("USDC", "USDC") {
        _mint(msg.sender, initialSupply);
    }
}

contract DepositTest is Test {
<<<<<<< HEAD
    FixedERC20 usdc;
    FixedERC20 crab;
=======
    USDC usdc;
>>>>>>> 3342065f (deposit for crab netting)
    CrabNetting netting;

    uint256 internal ownerPrivateKey;
    address internal owner;
    uint256 internal depositorPk;
    address internal depositor;
    uint256 internal withdrawerPk;
    address internal withdrawer;

    function setUp() public {
<<<<<<< HEAD
        usdc = new FixedERC20(10000 * 1e18);
        crab = new FixedERC20(10000 * 1e18);
        netting = new CrabNetting(address(usdc), address(crab));
=======
        usdc = new USDC(10000 * 1e18);
        netting = new CrabNetting(address(usdc));
>>>>>>> 3342065f (deposit for crab netting)

        ownerPrivateKey = 0xA11CE;
        owner = vm.addr(ownerPrivateKey);

        depositorPk = 0xA11CA;
        depositor = vm.addr(depositorPk);

        withdrawerPk = 0xA11CB;
        withdrawer = vm.addr(withdrawerPk);

        usdc.transfer(depositor, 2 * 1e18);
<<<<<<< HEAD
        crab.transfer(withdrawer, 2 * 1e18);
=======
>>>>>>> 3342065f (deposit for crab netting)
    }

    function testDepositAndWithdraw() public {
        vm.startPrank(depositor);
        usdc.approve(address(netting), 2 * 1e18);
        netting.depositUSDC(2 * 1e18);

        assertEq(netting.balanceOf(depositor), 2e18);
        netting.withdrawUSDC(1 * 1e18);
        assertEq(netting.balanceOf(depositor), 1e18);
    }
<<<<<<< HEAD

    function testCrabDepositAndWithdraw() public {
        vm.startPrank(withdrawer);
        crab.approve(address(netting), 2 * 1e18);
        netting.depositCrab(2 * 1e18);

        assertEq(netting.crabBalanceOf(withdrawer), 2e18);
        netting.withdrawCrab(1 * 1e18);
        assertEq(netting.crabBalanceOf(withdrawer), 1e18);
    }
=======
>>>>>>> 3342065f (deposit for crab netting)
}
