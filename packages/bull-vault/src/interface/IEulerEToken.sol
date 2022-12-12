// SPDX-License-Identifier: GPL-3.0-only

pragma solidity =0.7.6;

interface IEulerEToken {
    function balanceOf(address account) external view returns (uint256);
    function balanceOfUnderlying(address account) external view returns (uint256);
    function deposit(uint256 subAccountId, uint256 amount) external;
    function withdraw(uint256 subAccountId, uint256 amount) external;
}
