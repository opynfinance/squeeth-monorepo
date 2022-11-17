// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.17;

import "forge-std/Test.sol";
import {ERC20} from "openzeppelin/token/ERC20/ERC20.sol";

import {CrabNetting} from "../src/CrabNetting.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import {IOracle} from "../src/interfaces/IOracle.sol";

contract FixedERC20 is ERC20 {
    constructor(uint256 initialSupply) ERC20("USDC", "USDC") {
        _mint(msg.sender, initialSupply);
    }
}

contract BaseSetup is Test {
    FixedERC20 usdc;
    FixedERC20 crab;
    FixedERC20 weth;
    FixedERC20 sqth;
    CrabNetting netting;
    ISwapRouter public immutable swapRouter = ISwapRouter(0xE592427A0AEce92De3Edee1F18E0157C05861564);

    IOracle public immutable oracle = IOracle(0x65D66c76447ccB45dAf1e8044e918fA786A483A1);

    uint256 internal ownerPrivateKey;
    address internal owner;
    uint256 internal depositorPk;
    address internal depositor;
    uint256 internal withdrawerPk;
    address internal withdrawer;

    function setUp() public virtual {
        usdc = new FixedERC20(10000 * 1e6);
        crab = new FixedERC20(10000 * 1e18);
        weth = new FixedERC20(10000 * 1e18);
        sqth = new FixedERC20(10000 * 1e18);
        netting = new CrabNetting(address(crab), address(swapRouter));

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
