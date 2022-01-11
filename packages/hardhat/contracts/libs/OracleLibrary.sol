// SPDX-License-Identifier: GPL-2.0-or-later

pragma solidity >=0.5.0 <0.8.0;

//interface
import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";

//lib
import "@uniswap/v3-core/contracts/libraries/FullMath.sol";
import "@uniswap/v3-core/contracts/libraries/TickMath.sol";

/// @title oracle library
/// @notice provides functions to integrate with uniswap v3 oracle
/// @author uniswap team other than consultAtHistoricTime(), built by opyn
library OracleLibrary {
    /// @notice fetches time-weighted average tick using uniswap v3 oracle
    /// @dev written by opyn team
    /// @param pool Address of uniswap v3 pool that we want to observe
    /// @param _secondsAgoToStartOfTwap number of seconds to start of TWAP period
    /// @param _secondsAgoToEndOfTwap number of seconds to end of TWAP period
    /// @return timeWeightedAverageTick The time-weighted average tick from (block.timestamp - _secondsAgoToStartOfTwap) to _secondsAgoToEndOfTwap
    function consultAtHistoricTime(
        address pool,
        uint32 _secondsAgoToStartOfTwap,
        uint32 _secondsAgoToEndOfTwap
    ) internal view returns (int24) {
        require(_secondsAgoToStartOfTwap > _secondsAgoToEndOfTwap, "BP");
        int24 timeWeightedAverageTick;
        uint32[] memory secondAgos = new uint32[](2);

        uint32 twapDuration = _secondsAgoToStartOfTwap - _secondsAgoToEndOfTwap;

        // get TWAP from (now - _secondsAgoToStartOfTwap) -> (now - _secondsAgoToEndOfTwap)
        secondAgos[0] = _secondsAgoToStartOfTwap;
        secondAgos[1] = _secondsAgoToEndOfTwap;

        (int56[] memory tickCumulatives, ) = IUniswapV3Pool(pool).observe(secondAgos);
        int56 tickCumulativesDelta = tickCumulatives[1] - tickCumulatives[0];

        timeWeightedAverageTick = int24(tickCumulativesDelta / (twapDuration));

        // Always round to negative infinity
        if (tickCumulativesDelta < 0 && (tickCumulativesDelta % (twapDuration) != 0)) timeWeightedAverageTick--;

        return timeWeightedAverageTick;
    }

    /// @notice given a tick and a token amount, calculates the amount of token received in exchange
    /// @param tick tick value used to calculate the quote
    /// @param baseAmount amount of token to be converted
    /// @param baseToken address of an ERC20 token contract used as the baseAmount denomination
    /// @param quoteToken address of an ERC20 token contract used as the quoteAmount denomination
    /// @return quoteAmount Amount of quoteToken received for baseAmount of baseToken
    function getQuoteAtTick(
        int24 tick,
        uint128 baseAmount,
        address baseToken,
        address quoteToken
    ) internal pure returns (uint256 quoteAmount) {
        uint160 sqrtRatioX96 = TickMath.getSqrtRatioAtTick(tick);

        // Calculate quoteAmount with better precision if it doesn't overflow when multiplied by itself
        if (sqrtRatioX96 <= type(uint128).max) {
            uint256 ratioX192 = uint256(sqrtRatioX96) * sqrtRatioX96;
            quoteAmount = baseToken < quoteToken
                ? FullMath.mulDiv(ratioX192, baseAmount, 1 << 192)
                : FullMath.mulDiv(1 << 192, baseAmount, ratioX192);
        } else {
            uint256 ratioX128 = FullMath.mulDiv(sqrtRatioX96, sqrtRatioX96, 1 << 64);
            quoteAmount = baseToken < quoteToken
                ? FullMath.mulDiv(ratioX128, baseAmount, 1 << 128)
                : FullMath.mulDiv(1 << 128, baseAmount, ratioX128);
        }
    }
}
