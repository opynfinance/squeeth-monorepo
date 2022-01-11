//SPDX-License-Identifier: GPL-2.0-or-later

pragma solidity =0.7.6;

import {VaultLib} from "../libs/VaultLib.sol";
import "@uniswap/v3-periphery/contracts/base/LiquidityManagement.sol";

contract VaultLibTester {

  function getUniPositionBalances(
      address _positionManager,
      uint256 _tokenId,
      int24 _wPowerPerpPoolTick,
      bool _isWethToken0
    ) external view returns (uint256 ethAmount, uint256 wPowerPerpAmount) {
        return VaultLib._getUniPositionBalances(_positionManager, _tokenId, _wPowerPerpPoolTick, _isWethToken0);
    }

  /**
   * expose this function so it's easier to test vault lib.
   */
  function getLiquidity(
    uint160 sqrtRatioX96,
    int24 tickA,
    int24 tickB,
    uint256 amount0Desired,
    uint256 amount1Desired
  ) external pure returns (uint128 liquidity) {

    uint160 sqrtRatioAX96 = TickMath.getSqrtRatioAtTick(tickA);
    uint160 sqrtRatioBX96 = TickMath.getSqrtRatioAtTick(tickB);

    liquidity = LiquidityAmounts.getLiquidityForAmounts(
        sqrtRatioX96,
        sqrtRatioAX96,
        sqrtRatioBX96,
        amount0Desired,
        amount1Desired
    );
  }

  function getLiquidityForAmount0(
    uint160 sqrtRatioAX96,
    uint160 sqrtRatioBX96,
    uint256 amount0
  ) external pure returns (uint128 liquidity) {

    // uint160 sqrtRatioAX96 = TickMath.getSqrtRatioAtTick(tickA);
    // uint160 sqrtRatioBX96 = TickMath.getSqrtRatioAtTick(tickB);

    return LiquidityAmounts.getLiquidityForAmount0(sqrtRatioAX96, sqrtRatioBX96, amount0);
  }

  function getLiquidityForAmount1(
    uint160 sqrtRatioAX96,
    uint160 sqrtRatioBX96,
    uint256 amount1
  ) external pure returns (uint128 liquidity) {
    // uint160 sqrtRatioAX96 = TickMath.getSqrtRatioAtTick(tickA);
    // uint160 sqrtRatioBX96 = TickMath.getSqrtRatioAtTick(tickB);

    return LiquidityAmounts.getLiquidityForAmount1(sqrtRatioAX96, sqrtRatioBX96, amount1);
  }

  function getAmountsForLiquidity(
    uint160 sqrtRatioX96,
    uint160 sqrtRatioAX96,
    uint160 sqrtRatioBX96,
    uint128 liquidity
  ) external pure returns (uint256 amount0, uint256 amount1) {
    return LiquidityAmounts.getAmountsForLiquidity(
      sqrtRatioX96,
      sqrtRatioAX96,
      sqrtRatioBX96,
      liquidity
    );
  }
}