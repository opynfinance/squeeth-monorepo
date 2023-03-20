// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.7.6;

import "forge-std/Script.sol";

import {IERC20} from "openzeppelin/token/ERC20/IERC20.sol";
import {EmergencyWithdraw} from "../src/EmergencyWithdraw.sol";

contract GoerliDeployEmergencyWithdraw is Script {
    address payable public constant ZEN_BULL =
        0x2a5AD7582a9e42944Ee32671436593D16999c70a;
    address public constant WETH = 0x083fd3D47eC8DC56b572321bc4dA8b26f7E82103;
    address public constant CRAB = 0x3fF39f6BF8156bdA997D93E3EFF6904c2bc4481f;
    address public constant UNI_FACTORY =
        0x55C0ceF3cc64F511C34b18c720bCf38feC6C6fFa;
    address public constant WPOWERPERP =
        0x9421c968D28DD789363FbD8c9aA5cF2090F0a656;

    // Deploy contracts
    EmergencyWithdraw emergencyWithdraw;

    function run() public {
        uint256 deployerKey = vm.envUint("DEPLOYER_PK");
        address deployerAddress = vm.rememberKey(deployerKey);

        vm.startBroadcast(deployerAddress);

        emergencyWithdraw = new EmergencyWithdraw(
            CRAB,
            ZEN_BULL,
            WETH,
            WPOWERPERP,
            UNI_FACTORY
        );

        vm.stopBroadcast();

        require(
            emergencyWithdraw.zenBullSupply() == IERC20(ZEN_BULL).totalSupply()
        );
    }
}
