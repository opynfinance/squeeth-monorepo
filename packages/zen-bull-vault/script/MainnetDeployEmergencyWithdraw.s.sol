// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.7.6;

import "forge-std/Script.sol";

import { IERC20 } from "openzeppelin/token/ERC20/IERC20.sol";
import { EmergencyWithdraw } from "../src/EmergencyWithdraw.sol";

/**
 * Before running the deployment script, make sure to copy `.env.example` in a `.env` file and set the environment variables. (Mainly the MAINNET_RPC_URL, DEPLOYER_PK and ETHERSCAN_API_KEY vars)
 * This script can be executed using the below command:
 * - source .env
 * - forge script script/MainnetDeployEmergencyWithdraw.s.sol:MainnetDeployEmergencyWithdraw --rpc-url $MAINNET_RPC_URL --broadcast --verify -vvvv
 */
contract MainnetDeployEmergencyWithdraw is Script {
    address payable public constant ZEN_BULL = 0xb46Fb07b0c80DBC3F97cae3BFe168AcaD46dF507;
    address public constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address public constant CRAB = 0x3B960E47784150F5a63777201ee2B15253D713e8;
    address public constant UNI_FACTORY = 0x1F98431c8aD98523631AE4a59f267346ea31F984;
    address public constant WPOWERPERP = 0xf1B99e3E573A1a9C5E6B2Ce818b617F0E664E86B;
    address public constant ETH_USDC_POOL = 0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640;
    address public constant USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    address public constant E_TOKEN = 0x1b808F49ADD4b8C6b5117d9681cF7312Fcf0dC1D;
    address public constant D_TOKEN = 0x84721A3dB22EB852233AEAE74f9bC8477F8bcc42;

    // Deploy contracts
    EmergencyWithdraw emergencyWithdraw;

    function run() public {
        uint256 deployerKey = vm.envUint("DEPLOYER_PK");
        address deployerAddress = vm.rememberKey(deployerKey);

        vm.startBroadcast(deployerAddress);

        emergencyWithdraw =
        new EmergencyWithdraw(CRAB, ZEN_BULL, WETH, USDC, WPOWERPERP, ETH_USDC_POOL, E_TOKEN, D_TOKEN, UNI_FACTORY);

        vm.stopBroadcast();

        require(emergencyWithdraw.redeemedZenBullAmountForCrabWithdrawal() == 0);
        require(emergencyWithdraw.redeemedRecoveryAmountForEulerWithdrawal() == 0);
    }
}
