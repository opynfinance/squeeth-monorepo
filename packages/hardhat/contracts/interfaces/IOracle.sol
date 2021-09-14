// SPDX-License-Identifier: MIT

pragma solidity =0.7.6;

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

    function getTimeWeightedAverageTickSafe(address _pool, uint32 _period)
        external
        view
        returns (int24 timeWeightedAverageTick);
}
