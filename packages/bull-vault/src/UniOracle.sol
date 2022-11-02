// SPDX-License-Identifier: GPL-2.0-or-later

pragma solidity =0.7.6;
pragma abicoder v2;

// interface
import "v3-core/interfaces/IUniswapV3Pool.sol";
import {IERC20Detailed} from "squeeth-monorepo/interfaces/IERC20Detailed.sol";

// lib
import "v3-periphery/libraries/Path.sol";
import "v3-periphery/libraries/PoolAddress.sol";
import "v3-core/libraries/SafeCast.sol";
import {OracleLibrary} from "squeeth-monorepo/libs/OracleLibrary.sol";
import {SafeMath} from "openzeppelin/math/SafeMath.sol";
import {console} from "forge-std/console.sol";

/**
 * @notice UniOracle contract
 * @dev contract that interact with Uniswap pool
 * @author opyn team
 */
library UniOracle {
    using Path for bytes;
    using SafeCast for uint256;
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
    function _getTwap(address _pool, address _base, address _quote, uint32 _period)
        internal
        view
        returns (uint256)
    {
        return _fetchTwap(_pool, _base, _quote, _period);
    }

    /**
     * @notice get twap converted with base & quote token decimals
     * @dev if period is longer than the current timestamp - first timestamp stored in the pool, this will revert with "OLD"
     * @param _pool uniswap pool address
     * @param _base base currency. to get eth/usd price, eth is base token
     * @param _quote quote currency. to get eth/usd price, usd is the quote currency
     * @param _period number of seconds in the past to start calculating time-weighted average
     * @return twap price which is scaled
     */
    function _fetchTwap(address _pool, address _base, address _quote, uint32 _period) private view returns (uint256) {
        int24 twapTick = OracleLibrary.consultAtHistoricTime(_pool, _period, 0);
        uint256 quoteAmountOut = OracleLibrary.getQuoteAtTick(twapTick, uint128(1e18), _base, _quote);

        uint8 baseDecimals = IERC20Detailed(_base).decimals();
        uint8 quoteDecimals = IERC20Detailed(_quote).decimals();
        if (baseDecimals == quoteDecimals) return quoteAmountOut;

        // if quote token has less decimals, the returned quoteAmountOut will be lower, need to scale up by decimal difference
        if (baseDecimals > quoteDecimals) return quoteAmountOut.mul(10 ** (baseDecimals - quoteDecimals));

        // if quote token has more decimals, the returned quoteAmountOut will be higher, need to scale down by decimal difference
        return quoteAmountOut.div(10 ** (quoteDecimals - baseDecimals));
    }
}
