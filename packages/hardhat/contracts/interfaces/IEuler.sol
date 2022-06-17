// SPDX-License-Identifier: GPL-3.0-only

pragma solidity =0.7.6;
pragma abicoder v2;

interface IEuler {
    function deferLiquidityCheck(address account, bytes memory data) external;
}

interface IEulerDToken { 
    function borrow (uint256, uint256) external; 
    function repay (uint256, uint256) external; 

}