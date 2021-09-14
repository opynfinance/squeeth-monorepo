// SPDX-License-Identifier: MIT

// uniswap Library only works under 0.7.6
pragma solidity =0.7.6;

import {IUniswapV3Pool} from "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import {OracleLibrary} from "@uniswap/v3-periphery/contracts/libraries/OracleLibrary.sol";

contract Oracle {
    /**
     * @notice get twap from the uniswap pool
     * @dev if period is longer than the current timestamp - first timestamp stored in the pool, this will revert with "OLD".
     * @param _pool uniswap pool address
     * @param _base base currency. to get eth/dai price, eth is base token
     * @param _quote quote currency. to get eth/dai price, dai is the quote currency
     * @param _period number of seconds in the past to start calculating time-weighted average
     * @return price scaled by 1e18
     */
    function getTwap(
        address _pool,
        address _base,
        address _quote,
        uint32 _period
    ) external view returns (uint256) {
        return _fetchTwap(_pool, _base, _quote, _period, uint256(1e18));
    }

    /**
     * @notice get twap from the uniswap pool, never revert
     * @dev if period is larger than the max period stored by the pool, default to the max period.
     * @param _pool uniswap pool address
     * @param _base base currency. to get eth/dai price, eth is base token
     * @param _quote quote currency. to get eth/dai price, dai is the quote currency
     * @param _period number of seconds in the past to start calculating time-weighted average
     * @return price scaled by 1e18
     */
    function getTwapSafe(
        address _pool,
        address _base,
        address _quote,
        uint32 _period
    ) external view returns (uint256) {
        return _fetchTwapSafe(_pool, _base, _quote, _period, uint256(1e18));
    }

    /**
     * @notice get the max period that can be used to request twap.
     * @param _pool uniswap pool address
     * @return max period can be used to request twap
     */
    function getMaxPeriod(address _pool) external view returns (uint32) {
        return _getMaxPeriod(_pool);
    }

    /**
     * @notice get time weighed average tick, not converted to price
     * @dev this function will not revert
     * @param _pool address of the pool
     * @param _period period in second that we want to calculate average on
     * @return timeWeightedAverageTick the time weighted average tick
     */
    function getTimeWeightedAverageTickSafe(address _pool, uint32 _period)
        external
        view
        returns (int24 timeWeightedAverageTick)
    {
        uint32 maxPeriod = _getMaxPeriod(_pool);
        uint32 requestPeriod = _period > maxPeriod ? maxPeriod : _period;
        return OracleLibrary.consult(_pool, requestPeriod);
    }

    /**
     * @notice get twap from the uniswap pool, never revert
     * @dev if period is larger than the max period stored by the pool, default to the max period.
     * @param _pool uniswap pool address
     * @param _base base currency. to get eth/dai price, eth is base token
     * @param _quote quote currency. to get eth/dai price, dai is the quote currency
     * @param _period number of seconds in the past to start calculating time-weighted average
     * @param _amountIn Amount of token to be converted
     * @return amountOut Amount of quoteToken received for baseAmount of baseToken
     */
    function _fetchTwapSafe(
        address _pool,
        address _base,
        address _quote,
        uint32 _period,
        uint256 _amountIn
    ) internal view returns (uint256 amountOut) {
        // make sure the max period we use is reasonable
        uint32 maxPeriod = _getMaxPeriod(_pool);
        uint32 requestPeriod = _period > maxPeriod ? maxPeriod : _period;
        return _fetchTwap(_pool, _base, _quote, requestPeriod, _amountIn);
    }

    /**
     * @notice get twap from the uniswap pool
     * @dev if period is longer than the current timestamp - first timestamp stored in the pool, this will revert with "OLD".
     * @param _pool uniswap pool address
     * @param _base base currency. to get eth/dai price, eth is base token
     * @param _quote quote currency. to get eth/dai price, dai is the quote currency
     * @param _period number of seconds in the past to start calculating time-weighted average
     * @return price scaled by 1e18
     */
    function _fetchTwap(
        address _pool,
        address _base,
        address _quote,
        uint32 _period,
        uint256 _amountIn
    ) internal view returns (uint256) {
        int24 twapTick = OracleLibrary.consult(_pool, _period);

        return OracleLibrary.getQuoteAtTick(twapTick, toUint128(_amountIn), _base, _quote);
    }

    /**
     * @notice get the max period that can be used to request twap.
     * @param _pool uniswap pool address
     * @return max period can be used to request twap
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

    /**
     * @notice Cast a uint256 to a uint128, revert on overflow
     * @param y The uint256 to be downcasted
     * @return z The downcasted integer, now type uint128
     */
    function toUint128(uint256 y) internal pure returns (uint128 z) {
        require((z = uint128(y)) == y);
    }
}
