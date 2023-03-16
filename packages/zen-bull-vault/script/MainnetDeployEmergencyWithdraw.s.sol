// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.7.6;

import "forge-std/Script.sol";

import { IERC20 } from "openzeppelin/token/ERC20/IERC20.sol";
import { EmergencyWithdraw } from "../src/EmergencyWithdraw.sol";

contract MainnetDeployEmergencyWithdraw is Script {
    address payable public constant ZEN_BULL = 0xb46Fb07b0c80DBC3F97cae3BFe168AcaD46dF507;
    address public constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address public constant CRAB = 0x3B960E47784150F5a63777201ee2B15253D713e8;
    address public constant UNI_FACTORY = 0x1F98431c8aD98523631AE4a59f267346ea31F984;
    address public constant WPOWERPERP = 0xf1B99e3E573A1a9C5E6B2Ce818b617F0E664E86B;

    // Deploy contracts
    EmergencyWithdraw emergencyWithdraw;

    function run() public {
        uint256 deployerKey = vm.envUint("DEPLOYER_PK");
        address deployerAddress = vm.rememberKey(deployerKey);

        vm.startBroadcast(deployerAddress);

        emergencyWithdraw = new EmergencyWithdraw(CRAB, ZEN_BULL, WETH, WPOWERPERP, UNI_FACTORY);

        vm.stopBroadcast();

        require(emergencyWithdraw.zenBullSupply() == IERC20(ZEN_BULL).totalSupply());
    }
}
