// SPDX-License-Identifier: GPL-2.0-or-later

pragma solidity =0.7.6;
pragma abicoder v2;

import "hardhat/console.sol";

// interface
import "@uniswap/v3-core/contracts/interfaces/callback/IUniswapV3SwapCallback.sol";
import "@uniswap/v3-core/contracts/interfaces/callback/IUniswapV3FlashCallback.sol";
import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";

// lib
import "@uniswap/v3-core/contracts/libraries/LowGasSafeMath.sol";
import "@uniswap/v3-periphery/contracts/libraries/Path.sol";
import "@uniswap/v3-periphery/contracts/libraries/PoolAddress.sol";
import "@uniswap/v3-periphery/contracts/libraries/CallbackValidation.sol";
import "@uniswap/v3-core/contracts/libraries/TickMath.sol";
import "@uniswap/v3-core/contracts/libraries/SafeCast.sol";

contract UniswapControllerHelper is IUniswapV3SwapCallback {
    using Path for bytes;
    using SafeCast for uint256;
    using LowGasSafeMath for uint256;
    using LowGasSafeMath for int256;

    /// @dev Uniswap factory address
    address public immutable factory;

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
        require(_factory != address(0));
        factory = _factory;
    }

    /**
     * @notice uniswap swap callback function for flashswap
     * @param amount0Delta amount of token0
     * @param amount1Delta amount of token1
     * @param _data callback data encoded as SwapCallbackData struct
     */
    function uniswapV3SwapCallback(
        int256 amount0Delta,
        int256 amount1Delta,
        bytes calldata _data
    ) external override {
        require(amount0Delta > 0 || amount1Delta > 0); // swaps entirely within 0-liquidity regions are not supported

        SwapCallbackData memory data = abi.decode(_data, (SwapCallbackData));
        (address tokenIn, address tokenOut, uint24 fee) = data.path.decodeFirstPool();

        //ensure that callback comes from uniswap pool
        CallbackValidation.verifyCallback(factory, tokenIn, tokenOut, fee);

        //determine the amount that needs to be repaid as part of the flashswap
        uint256 amountToPay = amount0Delta > 0 ? uint256(amount0Delta) : uint256(amount1Delta);

        //calls the function that uses the proceeds from flash swap and executes logic to have an amount of token to repay the flash swap
        _swapCallback(data.caller, tokenIn, tokenOut, fee, amountToPay, data.callData, data.callSource);
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
    ) internal returns (uint256) {
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
        require(amountOut >= _amountOutMinimum);

        return amountOut;
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
        require(amountIn <= _amountInMaximum);
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
    function _swapCallback(
        address, /*_caller*/
        address, /*_tokenIn*/
        address, /*_tokenOut*/
        uint24, /*_fee*/
        uint256, /*_amountToPay*/
        bytes memory _callData,
        uint8 _callSource
    ) internal virtual {}

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

    /**
     * @notice returns the uniswap pool for the given token pair and fee
     * @dev the pool contract may or may not exist
     * @param tokenA address of first token
     * @param tokenB address of second token
     * @param fee fee tier for pool
     */
    function _getPool(
        address tokenA,
        address tokenB,
        uint24 fee
    ) private view returns (IUniswapV3Pool) {
        return IUniswapV3Pool(PoolAddress.computeAddress(factory, PoolAddress.getPoolKey(tokenA, tokenB, fee)));
    }
}
