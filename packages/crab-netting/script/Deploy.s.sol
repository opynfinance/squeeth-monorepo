// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "forge-std/Script.sol";

import { CrabNetting } from "../src/CrabNetting.sol";

contract DeployScript is Script {
  
    address private crabAddress;
    address private swapRouterAddress;

    CrabNetting crabNetting;

    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PK");
        address deployerAddress = vm.rememberKey(deployerKey);

        vm.startBroadcast(deployerAddress);
 
        crabNetting =
        new CrabNetting(crabAddress, swapRouterAddress);

        vm.stopBroadcast();
    }

      function setAddressParamsAtConstructor(
        address _crabAddress,
        address _swapRouterAddress
    ) internal {
        crabAddress = _crabAddress;
        swapRouterAddress = _swapRouterAddress;
      
    }
}