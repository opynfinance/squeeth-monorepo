// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.7.6;

import "forge-std/Script.sol";

import { ShutdownEmergencyWithdraw } from "../src/ShutdownEmergencyWithdraw.sol";

/**
 * Before running the deployment script, make sure to copy `.env.example` in a `.env` file and set the environment variables. (Mainly the MAINNET_RPC_URL, DEPLOYER_PK and ETHERSCAN_API_KEY vars)
 * This script can be executed using the below command:
 * - source .env
 * - forge script script/MainnetDeployShutdownEmergencyWithdraw.s.sol:MainnetDeployShutdownEmergencyWithdraw --rpc-url $MAINNET_RPC_URL --broadcast --verify -vvvv
 */
contract MainnetDeployShutdownEmergencyWithdraw is Script {
    address payable public constant ZEN_BULL = 0xb46Fb07b0c80DBC3F97cae3BFe168AcaD46dF507;
    address public constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address public constant USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    address payable public constant CRAB = 0x3B960E47784150F5a63777201ee2B15253D713e8;
    address public constant OSQTH = 0xf1B99e3E573A1a9C5E6B2Ce818b617F0E664E86B;
    address public constant ETH_USDC_POOL = 0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8;
    address payable public constant CONTROLLER = 0x64187ae08781B09368e6253F9E94951243A493D5;
    address public constant ORACLE = 0x65D66c76447ccB45dAf1e8044e918fA786A483A1;
    address public constant ZEN_BULL_EMERGENCY_WITHDRAW = 0x3DdC956B08c0A6dA2249f8c528fF0594F5AEa381;

    // multisig owner
    address public constant OWNER = 0xAfE66363c27EedB597a140c28B70b32F113fd5a8;

    // Deploy contracts
    ShutdownEmergencyWithdraw shutdownEmergencyWithdraw;

    function run() public {
        uint256 deployerKey = vm.envUint("DEPLOYER_PK");
        address deployerAddress = vm.rememberKey(deployerKey);

        vm.startBroadcast(deployerAddress);

        shutdownEmergencyWithdraw = new ShutdownEmergencyWithdraw(
            CRAB,
            ZEN_BULL,
            WETH,
            USDC,
            OSQTH,
            ETH_USDC_POOL,
            ORACLE,
            ZEN_BULL_EMERGENCY_WITHDRAW,
            CONTROLLER,
            OWNER
        );

        vm.stopBroadcast();
    }
}
