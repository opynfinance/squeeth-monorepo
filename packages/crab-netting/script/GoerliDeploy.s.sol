// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import { DeployScript } from "./Deploy.s.sol";

contract GoerliDeploy is DeployScript {

   address public constant crabAddress = 0x3fF39f6BF8156bdA997D93E3EFF6904c2bc4481f;
   address public constant swapRouterAddress = 0x833A158dA5ceBc44901211427E9Df936023EC0d3;
   
      constructor() {
        setAddressParamsAtConstructor(
            crabAddress,
            swapRouterAddress
        );

       
    }

}