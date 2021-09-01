// SPDX-License-Identifier: MIT

pragma solidity >=0.8.0 <0.9.0;

interface IOracle {
    function getTwaPrice(
        address _pool,
        address _base,
        address _quote,
        uint32 _period
    ) external view returns (uint256);

    function getTwaPriceSafe(
        address _pool,
        address _base,
        address _quote,
        uint32 _period
    ) external view returns (uint256);

    function getMaxPeriod(address _pool) external view returns (uint32);
}
