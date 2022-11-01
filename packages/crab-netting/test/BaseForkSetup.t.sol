// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.17;

import "forge-std/Test.sol";

import {ERC20} from "openzeppelin/token/ERC20/ERC20.sol";
import {IWETH} from "../src/interfaces/IWETH.sol";
import {ICrabStrategyV2} from "../src/interfaces/ICrabStrategyV2.sol";
import {CrabNetting} from "../src/CrabNetting.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";

contract BaseForkSetup is Test {
    ICrabStrategyV2 crab;
    ERC20 usdc;
    IWETH weth;
    ERC20 sqth;
    CrabNetting netting;
    ISwapRouter swapRouter;

    uint256 internal ownerPrivateKey;
    address internal owner;
    uint256 internal depositorPk;
    address internal depositor;
    uint256 internal withdrawerPk;
    address internal withdrawer;

    function setUp() public virtual {
        string memory FORK_URL = vm.envString("FORK_URL");
        vm.createSelectFork(FORK_URL, 15819213);

        crab = ICrabStrategyV2(0x3B960E47784150F5a63777201ee2B15253D713e8);
        weth = IWETH(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);
        usdc = ERC20(0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48);
        sqth = ERC20(0xf1B99e3E573A1a9C5E6B2Ce818b617F0E664E86B);
        swapRouter = ISwapRouter(0xE592427A0AEce92De3Edee1F18E0157C05861564);

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
    }
}
