// SPDX-License-Identifier: GPL-2.0-or-later

pragma solidity =0.7.6;
pragma abicoder v2;

// interface
import "v3-core/interfaces/callback/IUniswapV3SwapCallback.sol";
import "v3-core/interfaces/IUniswapV3Pool.sol";
import {IERC20Detailed} from "squeeth-monorepo/interfaces/IERC20Detailed.sol";

// lib
import "v3-periphery/libraries/Path.sol";
import "v3-periphery/libraries/PoolAddress.sol";
import "v3-periphery/libraries/CallbackValidation.sol";
import "v3-core/libraries/TickMath.sol";
import "v3-core/libraries/SafeCast.sol";
import {OracleLibrary} from "squeeth-monorepo/libs/OracleLibrary.sol";
import {SafeMath} from "openzeppelin/math/SafeMath.sol";

/**
 * @notice UniBull contract
 * @dev contract that interact with Uniswap pool
 * @author opyn team
 */
contract UniBull is IUniswapV3SwapCallback {
    using Path for bytes;
    using SafeCast for uint256;
    using SafeMath for uint256;

    uint128 private constant ONE = 1e18;

    /// @dev Uniswap factory address
    address internal immutable factory;

    struct SwapCallbackData {
        bytes path;
        address caller;
        uint8 callSource;
        bytes callData;
    }

    /**
     * @dev constructor
     * @param _factory uniswap factory address
     */
    constructor(address _factory) {
        require(_factory != address(0), "invalid factory address");
        factory = _factory;
    }

    /**
     * @notice uniswap swap callback function for flashes
     * @param amount0Delta amount of token0
     * @param amount1Delta amount of token1
     * @param _data callback data encoded as SwapCallbackData struct
     */
    function uniswapV3SwapCallback(int256 amount0Delta, int256 amount1Delta, bytes calldata _data) external override {
        require(amount0Delta > 0 || amount1Delta > 0); // swaps entirely within 0-liquidity regions are not supported

        SwapCallbackData memory data = abi.decode(_data, (SwapCallbackData));
        (address tokenIn, address tokenOut, uint24 fee) = data.path.decodeFirstPool();

        //ensure that callback comes from uniswap pool
        address pool = address(CallbackValidation.verifyCallback(factory, tokenIn, tokenOut, fee));

        //determine the amount that needs to be repaid as part of the flashswap
        uint256 amountToPay = amount0Delta > 0 ? uint256(amount0Delta) : uint256(amount1Delta);

        //calls the strategy function that uses the proceeds from flash swap and executes logic to have an amount of token to repay the flash swap
        _uniFlashSwap(data.caller, pool, tokenIn, tokenOut, fee, amountToPay, data.callData, data.callSource);
    }

    /**
     * @notice function to be called by uniswap callback.
     * @dev this function should be overridden by the child contract
     * param _caller initial strategy function caller
     * param _tokenIn token address sold
     * param _tokenOut token address bought
     * param _fee pool fee
     * param _amountToPay amount to pay for the pool second token
     * param _callData arbitrary data assigned with the flashswap call
     * param _callSource function call source
     */
    function _uniFlashSwap(
        address, /*_caller*/
        address, /*_pool*/
        address, /*_tokenIn*/
        address, /*_tokenOut*/
        uint24, /*_fee*/
        uint256, /*_amountToPay*/
        bytes memory _callData,
        uint8 _callSource
    ) internal virtual {}

    /**
     * @notice get twap converted with base & quote token decimals
     * @dev if period is longer than the current timestamp - first timestamp stored in the pool, this will revert with "OLD"
     * @param _pool uniswap pool address
     * @param _base base currency. to get eth/usd price, eth is base token
     * @param _quote quote currency. to get eth/usd price, usd is the quote currency
     * @param _period number of seconds in the past to start calculating time-weighted average
     * @return price of 1 base currency in quote currency. scaled by 1e18
     */
    function _getTwap(address _pool, address _base, address _quote, uint32 _period, bool _checkPeriod)
        internal
        view
        returns (uint256)
    {
        // if the period is already checked, request TWAP directly. Will revert if period is too long.
        if (!_checkPeriod) return _fetchTwap(_pool, _base, _quote, _period);

        // make sure the requested period < maxPeriod the pool recorded.
        uint32 maxPeriod = _getMaxPeriod(_pool);
        uint32 requestPeriod = _period > maxPeriod ? maxPeriod : _period;
        return _fetchTwap(_pool, _base, _quote, requestPeriod);
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
    function _fetchTwap(address _pool, address _base, address _quote, uint32 _period) internal view returns (uint256) {
        int24 twapTick = OracleLibrary.consultAtHistoricTime(_pool, _period, 0);
        uint256 quoteAmountOut = OracleLibrary.getQuoteAtTick(twapTick, ONE, _base, _quote);

        uint8 baseDecimals = IERC20Detailed(_base).decimals();
        uint8 quoteDecimals = IERC20Detailed(_quote).decimals();
        if (baseDecimals == quoteDecimals) return quoteAmountOut;

        // if quote token has less decimals, the returned quoteAmountOut will be lower, need to scale up by decimal difference
        if (baseDecimals > quoteDecimals) return quoteAmountOut.mul(10 ** (baseDecimals - quoteDecimals));

        // if quote token has more decimals, the returned quoteAmountOut will be higher, need to scale down by decimal difference
        return quoteAmountOut.div(10 ** (quoteDecimals - baseDecimals));
    }

    /**
     * @notice execute an exact-in flash swap (specify an exact amount to pay)
     * @param _tokenIn token address to sell
     * @param _tokenOut token address to receive
     * @param _fee pool fee
     * @param _amountIn amount to sell
     * @param _amountOutMinimum minimum amount to receive
     * @param _callSource function call source
     * @param _data arbitrary data assigned with the call
     */
    function _exactInFlashSwap(
        address _tokenIn,
        address _tokenOut,
        uint24 _fee,
        uint256 _amountIn,
        uint256 _amountOutMinimum,
        uint8 _callSource,
        bytes memory _data
    ) internal {
        //calls internal uniswap swap function that will trigger a callback for the flash swap
        uint256 amountOut = _exactInputInternal(
            _amountIn,
            address(this),
            uint160(0),
            SwapCallbackData({
                path: abi.encodePacked(_tokenIn, _fee, _tokenOut),
                caller: msg.sender,
                callSource: _callSource,
                callData: _data
            })
        );

        //slippage limit check
        require(amountOut >= _amountOutMinimum, "amount out less than min");
    }

    /**
     * @notice execute an exact-out flash swap (specify an exact amount to receive)
     * @param _tokenIn token address to sell
     * @param _tokenOut token address to receive
     * @param _fee pool fee
     * @param _amountOut exact amount to receive
     * @param _amountInMaximum maximum amount to sell
     * @param _callSource function call source
     * @param _data arbitrary data assigned with the call
     */
    function _exactOutFlashSwap(
        address _tokenIn,
        address _tokenOut,
        uint24 _fee,
        uint256 _amountOut,
        uint256 _amountInMaximum,
        uint8 _callSource,
        bytes memory _data
    ) internal {
        //calls internal uniswap swap function that will trigger a callback for the flash swap
        uint256 amountIn = _exactOutputInternal(
            _amountOut,
            address(this),
            uint160(0),
            SwapCallbackData({
                path: abi.encodePacked(_tokenOut, _fee, _tokenIn),
                caller: msg.sender,
                callSource: _callSource,
                callData: _data
            })
        );

        //slippage limit check
        require(amountIn <= _amountInMaximum, "amount in greater than max");
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
        (,, uint16 observationIndex, uint16 cardinality,,,) = pool.slot0();

        // first observation index
        // it's safe to use % without checking cardinality = 0 because cardinality is always >= 1
        uint16 oldestObservationIndex = (observationIndex + 1) % cardinality;

        (uint32 oldestObservationTimestamp,,, bool initialized) = pool.observations(oldestObservationIndex);

        if (initialized) return uint32(block.timestamp) - oldestObservationTimestamp;

        // (index + 1) % cardinality is not the oldest index,
        // probably because cardinality is increased after last observation.
        // in this case, observation at index 0 should be the oldest.
        (oldestObservationTimestamp,,,) = pool.observations(0);

        return uint32(block.timestamp) - oldestObservationTimestamp;
    }

    /**
     * @notice returns the uniswap pool for the given token pair and fee
     * @dev the pool contract may or may not exist
     * @param tokenA address of first token
     * @param tokenB address of second token
     * @param fee fee tier for pool
     */
    function _getPool(address tokenA, address tokenB, uint24 fee) internal view returns (IUniswapV3Pool) {
        return IUniswapV3Pool(PoolAddress.computeAddress(factory, PoolAddress.getPoolKey(tokenA, tokenB, fee)));
    }

    /**
     * @notice internal function for exact-in swap on uniswap (specify exact amount to pay)
     * @param _amountIn amount of token to pay
     * @param _recipient recipient for receive
     * @param _sqrtPriceLimitX96 price limit
     * @return amount of token bought (amountOut)
     */
    function _exactInputInternal(
        uint256 _amountIn,
        address _recipient,
        uint160 _sqrtPriceLimitX96,
        SwapCallbackData memory data
    ) private returns (uint256) {
        (address tokenIn, address tokenOut, uint24 fee) = data.path.decodeFirstPool();

        //uniswap token0 has a lower address than token1
        //if tokenIn<tokenOut, we are selling an exact amount of token0 in exchange for token1
        //zeroForOne determines which token is being sold and which is being bought
        bool zeroForOne = tokenIn < tokenOut;

        //swap on uniswap, including data to trigger call back for flashswap
        (int256 amount0, int256 amount1) = _getPool(tokenIn, tokenOut, fee).swap(
            _recipient,
            zeroForOne,
            _amountIn.toInt256(),
            _sqrtPriceLimitX96 == 0
                ? (zeroForOne ? TickMath.MIN_SQRT_RATIO + 1 : TickMath.MAX_SQRT_RATIO - 1)
                : _sqrtPriceLimitX96,
            abi.encode(data)
        );

        //determine the amountOut based on which token has a lower address
        return uint256(-(zeroForOne ? amount1 : amount0));
    }

    /**
     * @notice internal function for exact-out swap on uniswap (specify exact amount to receive)
     * @param _amountOut amount of token to receive
     * @param _recipient recipient for receive
     * @param _sqrtPriceLimitX96 price limit
     * @return amount of token sold (amountIn)
     */
    function _exactOutputInternal(
        uint256 _amountOut,
        address _recipient,
        uint160 _sqrtPriceLimitX96,
        SwapCallbackData memory data
    ) private returns (uint256) {
        (address tokenOut, address tokenIn, uint24 fee) = data.path.decodeFirstPool();

        //uniswap token0 has a lower address than token1
        //if tokenIn<tokenOut, we are buying an exact amount of token1 in exchange for token0
        //zeroForOne determines which token is being sold and which is being bought
        bool zeroForOne = tokenIn < tokenOut;

        //swap on uniswap, including data to trigger call back for flashswap
        (int256 amount0Delta, int256 amount1Delta) = _getPool(tokenIn, tokenOut, fee).swap(
            _recipient,
            zeroForOne,
            -_amountOut.toInt256(),
            _sqrtPriceLimitX96 == 0
                ? (zeroForOne ? TickMath.MIN_SQRT_RATIO + 1 : TickMath.MAX_SQRT_RATIO - 1)
                : _sqrtPriceLimitX96,
            abi.encode(data)
        );

        //determine the amountIn and amountOut based on which token has a lower address
        (uint256 amountIn, uint256 amountOutReceived) = zeroForOne
            ? (uint256(amount0Delta), uint256(-amount1Delta))
            : (uint256(amount1Delta), uint256(-amount0Delta));
        // it's technically possible to not receive the full output amount,
        // so if no price limit has been specified, require this possibility away
        if (_sqrtPriceLimitX96 == 0) require(amountOutReceived == _amountOut);

        return amountIn;
    }
}
