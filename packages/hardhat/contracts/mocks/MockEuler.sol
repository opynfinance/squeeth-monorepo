// SPDX-License-Identifier: GPL-3.0-only

pragma solidity =0.7.6;
pragma abicoder v2;

contract MockEuler {
    uint256 a;

    function deferLiquidityCheck(address account, bytes memory data) external {
        a;
    }
}
