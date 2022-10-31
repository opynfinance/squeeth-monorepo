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

contract DepositTest is Test {
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
        usdc = new FixedERC20(10000 * 1e18);
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

        withdrawerPk = 0xA11CB;
        withdrawer = vm.addr(withdrawerPk);

        usdc.transfer(depositor, 2 * 1e18);
        crab.transfer(withdrawer, 2 * 1e18);
    }

    function testDepositAndWithdraw() public {
        vm.startPrank(depositor);
        usdc.approve(address(netting), 2 * 1e18);
        netting.depositUSDC(2 * 1e18);

        assertEq(netting.usdBalance(depositor), 2e18);
        netting.withdrawUSDC(1 * 1e18);
        assertEq(netting.usdBalance(depositor), 1e18);
        assertEq(netting.depositsQueued(), 1e18);
    }

    function testCrabDepositAndWithdraw() public {
        vm.startPrank(withdrawer);
        crab.approve(address(netting), 2 * 1e18);
        netting.queueCrabForWithdrawal(2 * 1e18);

        assertEq(netting.crabBalance(withdrawer), 2e18);
        netting.withdrawCrab(1 * 1e18);
        assertEq(netting.crabBalance(withdrawer), 1e18);
        assertEq(netting.withdrawsQueued(), 1e18);
    }
}
