// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

interface IOracle {
    function getTwap(address _pool, address _base, address _quote, uint32 _period, bool _checkPeriod)
        external
        view
        returns (uint256);
}
