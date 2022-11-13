// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.17;

import "forge-std/Test.sol";

import {ERC20} from "openzeppelin/token/ERC20/ERC20.sol";
import {IWETH} from "../src/interfaces/IWETH.sol";
import {IOracle} from "../src/interfaces/IOracle.sol";
import {ICrabStrategyV2} from "../src/interfaces/ICrabStrategyV2.sol";
import {CrabNetting, Order} from "../src/CrabNetting.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import {IQuoter} from "@uniswap/v3-periphery/contracts/interfaces/IQuoter.sol";

contract BaseForkSetup is Test {
    ICrabStrategyV2 crab;
    ERC20 usdc;
    IWETH weth;
    ERC20 sqth;
    CrabNetting netting;
    ISwapRouter swapRouter;
    IQuoter quoter;
    IOracle oracle;
    uint256 activeFork;

    uint256 internal ownerPrivateKey;
    address internal owner;
    uint256 internal depositorPk;
    address internal depositor;
    uint256 internal withdrawerPk;
    address internal withdrawer;

    uint256 internal mm1Pk;
    address internal mm1;

    uint256 internal mm2Pk;
    address internal mm2;

    Order[] orders;

    function setUp() public virtual {
        string memory FORK_URL = vm.envString("FORK_URL");
        activeFork = vm.createSelectFork(FORK_URL, 15819213);

        crab = ICrabStrategyV2(0x3B960E47784150F5a63777201ee2B15253D713e8);
        weth = IWETH(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);
        usdc = ERC20(0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48);
        sqth = ERC20(0xf1B99e3E573A1a9C5E6B2Ce818b617F0E664E86B);
        swapRouter = ISwapRouter(0xE592427A0AEce92De3Edee1F18E0157C05861564);
        quoter = IQuoter(0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6);
        oracle = IOracle(0x65D66c76447ccB45dAf1e8044e918fA786A483A1);

        netting = new CrabNetting(address(crab), address(swapRouter));
        vm.prank(address(netting));
        payable(depositor).transfer(address(netting).balance);

        ownerPrivateKey = 0xA11CE;
        owner = vm.addr(ownerPrivateKey);

        depositorPk = 0xA11CA;
        depositor = vm.addr(depositorPk);
        vm.label(depositor, "depositor");

        withdrawerPk = 0xA11CB;
        withdrawer = vm.addr(withdrawerPk);
        vm.label(withdrawer, "withdrawer");

        mm1Pk = 0xA11CC;
        mm1 = vm.addr(mm1Pk);
        vm.label(mm1, "market maker 1");
        mm2Pk = 0xA11CA;
        mm2 = vm.addr(mm2Pk);
        vm.label(mm2, "market maker 2");
    }
}
