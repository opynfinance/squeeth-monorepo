// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.7.6;

interface IEulerDToken {
    function balanceOf(address account) external view returns (uint256);
    function borrow(uint256 subAccountId, uint256 amount) external;
    function repay(uint256 subAccountId, uint256 amount) external;
}
