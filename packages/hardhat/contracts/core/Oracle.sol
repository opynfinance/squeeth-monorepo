// SPDX-License-Identifier: MIT

// uniswap Library only works under 0.7.6
pragma solidity =0.7.6;

import {IUniswapV3Pool} from "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import {IERC20Detailed} from "../interfaces/IERC20Detailed.sol";

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {OracleLibrary} from "../libs/OracleLibrary.sol";

/**
 * @notice read UniswapV3 pool TWAP prices, and convert to human readable term with (18 decimals)
 * @dev if ETH price is $3000, both ETH/USDC price and ETH/DAI price will be reported as 3000 * 1e18 by this oracle
 */
contract Oracle {
    using SafeMath for uint256;

    /**
     * @notice get twap converted with base & quote token decimals
     * @dev if period is longer than the current timestamp - first timestamp stored in the pool, this will revert with "OLD"
     * @param _pool uniswap pool address
     * @param _base base currency. to get eth/usd price, eth is base token
     * @param _quote quote currency. to get eth/usd price, usd is the quote currency
     * @param _period number of seconds in the past to start calculating time-weighted average
     * @return price of 1 base currency in quote currency. scaled by 1e18
     */
    function getTwap(
        address _pool,
        address _base,
        address _quote,
        uint32 _period
    ) external view returns (uint256) {
        return _fetchTwap(_pool, _base, _quote, _period);
    }

    function getHistoricalTwap(
        address _pool,
        address _base,
        address _quote,
        uint32 _secondsAgoToStartOfTwap,
        uint32 _secondsAgoToEndOfTwap
    ) external view returns (uint256) {
        return
            _fetchHistoricTwap(_pool, _base, _quote, _secondsAgoToStartOfTwap, _secondsAgoToEndOfTwap, uint256(1e18));
    }

    /**
     * @notice get twap converted with base & quote token decimals, never reverts
     * @param _pool uniswap pool address
     * @param _base base currency. to get eth/usd price, eth is base token
     * @param _quote quote currency. to get eth/usd price, usd is the quote currency
     * @param _period number of seconds in the past to start calculating time-weighted average
     * @return price of 1 base currency in quote currency. scaled by 1e18
     */
    function getTwapSafe(
        address _pool,
        address _base,
        address _quote,
        uint32 _period
    ) external view returns (uint256) {
        return _fetchTwapSafe(_pool, _base, _quote, _period);
    }

    /**
     * @notice get the max period that can be used to request twap
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
     * @notice get twap converted with base & quote token decimals, never reverts
     * @dev if period is longer than the current timestamp - first timestamp stored in the pool, this will revert with "OLD"
     * @param _pool uniswap pool address
     * @param _base base currency. to get eth/usd price, eth is base token
     * @param _quote quote currency. to get eth/usd price, usd is the quote currency
     * @param _period number of seconds in the past to start calculating time-weighted average
     * @return twap price which is scaled
     */
    function _fetchTwapSafe(
        address _pool,
        address _base,
        address _quote,
        uint32 _period
    ) internal view returns (uint256) {
        uint32 maxPeriod = _getMaxPeriod(_pool);
        uint32 requestPeriod = _period > maxPeriod ? maxPeriod : _period;
        return _fetchTwap(_pool, _base, _quote, requestPeriod);
    }

    /**
     * @notice get twap converted with base & quote token decimals
     * @dev if period is longer than the current timestamp - first timestamp stored in the pool, this will revert with "OLD"
     * @param _pool uniswap pool address
     * @param _base base currency. to get eth/usd price, eth is base token
     * @param _quote quote currency. to get eth/usd price, usd is the quote currency     * @param _period number of seconds in the past to start calculating time-weighted average
     * @return twap price which is scaled
     */
    function _fetchTwap(
        address _pool,
        address _base,
        address _quote,
        uint32 _period
    ) internal view returns (uint256) {
        uint256 quoteAmountOut = _fetchRawTwap(_pool, _base, _quote, _period, uint256(1e18));

        uint8 baseDecimals = IERC20Detailed(_base).decimals();
        uint8 quoteDecimals = IERC20Detailed(_quote).decimals();
        if (baseDecimals == quoteDecimals) return quoteAmountOut;

        // if quote token has less decimals, the returned quoteAmountOut will be lower, need to scale up by decimal difference
        if (baseDecimals > quoteDecimals) return quoteAmountOut.mul(10**(baseDecimals - quoteDecimals));

        // if quote token has more decimals, the returned quoteAmountOut will be higher, need to scale down by decimal difference
        return quoteAmountOut.div(10**(quoteDecimals - baseDecimals));
    }

    /**
     * @notice get raw twap from the uniswap pool
     * @dev if period is longer than the current timestamp - first timestamp stored in the pool, this will revert with "OLD".
     * @param _pool uniswap pool address
     * @param _base base currency. to get eth/usd price, eth is base token
     * @param _quote quote currency. to get eth/usd price, usd is the quote currency    * @param _period number of seconds in the past to start calculating time-weighted average
     * @param _amountIn amount of base currency provided in exchange for quote currency
     * @return amount of quote currency received for _amountIn of base currency
     */
    function _fetchRawTwap(
        address _pool,
        address _base,
        address _quote,
        uint32 _period,
        uint256 _amountIn
    ) internal view returns (uint256) {
        int24 twapTick = OracleLibrary.consult(_pool, _period);
        return OracleLibrary.getQuoteAtTick(twapTick, toUint128(_amountIn), _base, _quote);
    }

    function _fetchHistoricTwap(
        address _pool,
        address _base,
        address _quote,
        uint32 _secondsAgoToStartOfTwap,
        uint32 _secondsAgoToEndOfTwap,
        uint256 _amountIn
    ) internal view returns (uint256) {
        int24 twapTick = OracleLibrary.consultAtHistoricTime(_pool, _secondsAgoToStartOfTwap, _secondsAgoToEndOfTwap);

        return OracleLibrary.getQuoteAtTick(twapTick, toUint128(_amountIn), _base, _quote);
    }

    /**
     * @notice get the max period that can be used to request twap
     * @param _pool uniswap pool address
     * @return max period can be used to request twap
     */
    function _getMaxPeriod(address _pool) internal view returns (uint32) {
        IUniswapV3Pool pool = IUniswapV3Pool(_pool);
        // observationIndex: the index of the last oracle observation that was written
        // cardinality: the current maximum number of observations stored in the pool
        (, , uint16 observationIndex, uint16 cardinality, , , ) = pool.slot0();

        // first observation index
        uint16 oldestObservationIndex = (observationIndex + 1) % cardinality;

        (uint32 oldestObservationTimestamp, , , bool initialized) = pool.observations(oldestObservationIndex);

        if (initialized) return uint32(block.timestamp) - oldestObservationTimestamp;

        // (index + 1) % cardinality is not the oldest index,
        // probably because cardinality is increased after last observation.
        // in this case, observation at index 0 should be the oldest.
        (oldestObservationTimestamp, , , ) = pool.observations(0);

        return uint32(block.timestamp) - oldestObservationTimestamp;
    }

    /**
     * @notice cast a uint256 to a uint128, revert on overflow
     * @param y the uint256 to be downcasted
     * @return z the downcasted integer, now type uint128
     */
    function toUint128(uint256 y) internal pure returns (uint128 z) {
        require((z = uint128(y)) == y, "Overflow");
    }
}
