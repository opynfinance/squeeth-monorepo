// SPDX-License-Identifier: MIT

pragma solidity >=0.8.0 <0.9.0;

interface IOracle {
    function getTwaPrice(
        address _pool,
        address _base,
        address _quote,
        uint32 _period
    ) external view returns (uint256);
}
