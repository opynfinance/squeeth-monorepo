// SPDX-License-Identifier: MIT

// uniswap Library only works under 0.7.6
pragma solidity =0.7.6;

import {IUniswapV3Pool} from "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import {OracleLibrary} from "@uniswap/v3-periphery/contracts/libraries/OracleLibrary.sol";

contract Oracle {
    using OracleLibrary for address;

    function getTwaPrice(
        address _pool,
        address _base,
        address _quote,
        uint32 _period
    ) external view returns (uint256) {
        return _fetchTwap(_pool, _base, _quote, _period, uint256(1e18));
    }

    function getTwaPriceSafe(
        address _pool,
        address _base,
        address _quote,
        uint32 _period
    ) external view returns (uint256) {
        return _fetchTwapSafe(_pool, _base, _quote, _period, uint256(1e18));
    }

    function getMaxPeriod(address _pool) external view returns (uint32) {
        return _getMaxPeriod(_pool);
    }

    /**
     * request TWAP from uni v3 pool
     * if the period requested is too long, capped at max period we can go back
     */
    function _fetchTwapSafe(
        address _pool,
        address _base,
        address _quote,
        uint32 _twapPeriod,
        uint256 _amountIn
    ) internal view returns (uint256 amountOut) {
        // make sure the max period we use is reasonable
        uint32 maxPeriod = _getMaxPeriod(_pool);
        uint32 requestPeriod = _twapPeriod > maxPeriod ? maxPeriod : _twapPeriod;
        return _fetchTwap(_pool, _base, _quote, requestPeriod, _amountIn);
    }

    /**
     * request TWAP from a uni v3 pool
     */
    function _fetchTwap(
        address _pool,
        address _base,
        address _quote,
        uint32 _twapPeriod,
        uint256 _amountIn
    ) internal view returns (uint256 amountOut) {
        int24 twapTick = OracleLibrary.consult(_pool, _twapPeriod);

        return OracleLibrary.getQuoteAtTick(twapTick, toUint128(_amountIn), _base, _quote);
    }

    /**
     * get the max number of period we can use to request twap for a pool
     */
    function _getMaxPeriod(address _pool) internal view returns (uint32) {
        IUniswapV3Pool pool = IUniswapV3Pool(_pool);
        // observationIndex: the index of the last oracle observation that was written
        // cardinality: The current maximum number of observations stored in the pool
        (, , uint16 observationIndex, uint16 cardinality, , , ) = pool.slot0();

        // first observation index
        uint16 oldestObservationIndex = (observationIndex + 1) % cardinality;

        (uint32 oldestObservationTimestamp, , , bool initialized) = pool.observations(oldestObservationIndex);

        if (initialized) return uint32(block.timestamp) - oldestObservationTimestamp;

        // index + 1 % cardinality is not the oldest index,
        // probably because cardinality is increased after last observation.
        // in this case, observation at index 0 should be the oldest.
        (oldestObservationTimestamp, , , ) = pool.observations(0);

        return uint32(block.timestamp) - oldestObservationTimestamp;
    }

    /// @notice Cast a uint256 to a uint128, revert on overflow
    /// @param y The uint256 to be downcasted
    /// @return z The downcasted integer, now type uint128
    function toUint128(uint256 y) internal pure returns (uint128 z) {
        require((z = uint128(y)) == y);
    }
}
