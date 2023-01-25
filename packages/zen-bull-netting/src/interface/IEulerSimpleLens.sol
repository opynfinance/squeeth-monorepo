// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

interface IEulerSimpleLens {
    function getDTokenBalance(address underlying, address account)
        external
        view
        returns (uint256);
    function getETokenBalance(address underlying, address account)
        external
        view
        returns (uint256);
}
