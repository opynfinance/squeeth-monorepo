//SPDX-License-Identifier: MIT
pragma solidity =0.7.6;
pragma abicoder v2;

// interface
import "@uniswap/v3-core/contracts/interfaces/callback/IUniswapV3FlashCallback.sol";

// contract
import "@uniswap/v3-periphery/contracts/base/PeripheryPayments.sol";
import '@uniswap/v3-periphery/contracts/base/PeripheryImmutableState.sol';

// lib
import '@uniswap/v3-core/contracts/libraries/LowGasSafeMath.sol';
import '@uniswap/v3-periphery/contracts/libraries/PoolAddress.sol';
import '@uniswap/v3-periphery/contracts/libraries/CallbackValidation.sol';
import '@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol';

contract StrategyFlashSwap is IUniswapV3FlashCallback, PeripheryPayments {
    using LowGasSafeMath for uint256;
    using LowGasSafeMath for int256;

    struct FlashParams {
        address token0;
        address token1;
        uint24 fee1;
        uint256 amount0;
        uint256 amount1;
        uint24 fee2;
        uint24 fee3;
        uint8 flashSource;
    }

    struct FlashCallbackData {
        uint256 amount0;
        uint256 amount1;
        address payer;
        PoolAddress.PoolKey poolKey;
        uint24 poolFee2;
        uint24 poolFee3;
        uint8 flashSource;
    }

    constructor(
        address _factory,
        address _weth
    ) PeripheryImmutableState(_factory, _weth) {
    }

    function uniswapV3FlashCallback(
        uint256 fee0,
        uint256 fee1,
        bytes calldata data
    ) external override {
        FlashCallbackData memory decoded = abi.decode(data, (FlashCallbackData));

        CallbackValidation.verifyCallback(factory, decoded.poolKey);

        address token0 = decoded.poolKey.token0;
        address token1 = decoded.poolKey.token1;
        uint256 amount0 = decoded.amount0;
        uint256 amount1 = decoded.amount1;

        _strategyFlash(token0, token1, amount0, amount1, decoded.flashSource);

        uint256 amount0Owed = LowGasSafeMath.add(amount0, fee0);
        uint256 amount1Owed = LowGasSafeMath.add(amount1, fee1);

        TransferHelper.safeApprove(token0, address(this), amount0Owed);
        TransferHelper.safeApprove(token1, address(this), amount1Owed);

        if (amount0Owed > 0) pay(token0, address(this), msg.sender, amount0Owed);
        if (amount1Owed > 0) pay(token1, address(this), msg.sender, amount1Owed);
    }

    function initFlash(FlashParams memory params) internal {
        PoolAddress.PoolKey memory poolKey =
            PoolAddress.PoolKey({token0: params.token0, token1: params.token1, fee: params.fee1});

        IUniswapV3Pool pool = IUniswapV3Pool(PoolAddress.computeAddress(factory, poolKey));

        pool.flash(
            address(this),
            params.amount0,
            params.amount1,
            abi.encode(
                FlashCallbackData({
                    amount0: params.amount0,
                    amount1: params.amount1,
                    payer: msg.sender,
                    poolKey: poolKey,
                    poolFee2: params.fee2,
                    poolFee3: params.fee3,
                    flashSource: params.flashSource
                })
            )
        );
    }

    function _strategyFlash(address _token0, address _token1, uint256 _amount0, uint256 _amount1, uint8 _flashSource) internal virtual {}
}
