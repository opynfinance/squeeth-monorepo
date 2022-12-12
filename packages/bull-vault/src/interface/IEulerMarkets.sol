// SPDX-License-Identifier: GPL-3.0-only

pragma solidity =0.7.6;

interface IEulerMarkets {
    function underlyingToEToken(address underlying) external view returns (address);
    function underlyingToDToken(address underlying) external view returns (address);
    function enterMarket(uint256 subAccountId, address newMarket) external;
}
