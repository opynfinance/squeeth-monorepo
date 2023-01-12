// SPDX-License-Identifier: GPL-3.0-only

pragma solidity =0.7.6;
pragma abicoder v2;

interface IEulerExec {
    function deferLiquidityCheck(address account, bytes memory data) external;
}

interface IDToken {
    function underlyingAsset() external view returns (address);

    function borrow(uint256 subAccountId, uint256 amount) external;

    function repay(uint256 subAccountId, uint256 amount) external;
}
