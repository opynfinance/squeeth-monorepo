// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.7.6;

import "forge-std/Script.sol";

import { IERC20 } from "openzeppelin/token/ERC20/IERC20.sol";
import { EmergencyWithdraw } from "../src/EmergencyWithdraw.sol";

contract GoerliDeployEmergencyWithdraw is Script {
    address payable public constant ZEN_BULL = 0x2a5AD7582a9e42944Ee32671436593D16999c70a;
    address public constant WETH = 0x083fd3D47eC8DC56b572321bc4dA8b26f7E82103;
    address public constant CRAB = 0x3fF39f6BF8156bdA997D93E3EFF6904c2bc4481f;
    address public constant UNI_FACTORY = 0x55C0ceF3cc64F511C34b18c720bCf38feC6C6fFa;
    address public constant WPOWERPERP = 0x9421c968D28DD789363FbD8c9aA5cF2090F0a656;
    address public constant ETH_USDC_POOL = 0x5d3EfE9157003f05be0d4031F00D43F952d6F6b7;
    address public constant USDC = 0x306bf03b689f7d7e5e9D3aAC87a068F16AFF9482;
    address public constant E_TOKEN = 0xEf5e087D827194732Bc1843351ccA80982E154eB;
    address public constant D_TOKEN = 0x356079240635B276A63065478471d89340443C49;

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
            USDC,
            WPOWERPERP,
            ETH_USDC_POOL,
            E_TOKEN,
            D_TOKEN,
            UNI_FACTORY
        );

        vm.stopBroadcast();

        require(emergencyWithdraw.redeemedZenBullAmountForCrabWithdrawal() == 0);
        // require(
        //     emergencyWithdraw.redeemedRecoveryAmountForEulerWithdrawal() ==
        //         IERC20(ZEN_BULL).totalSupply()
        // );
    }
}
