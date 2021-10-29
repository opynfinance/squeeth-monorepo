// SPDX-License-Identifier: MIT

pragma solidity =0.7.6;

import "hardhat/console.sol";

import {IUniswapV3Pool} from "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {IOracle} from "../interfaces/IOracle.sol";

library Power2Base {
    using SafeMath for uint256;

    uint256 constant INDEX_SCALE = 1e4;

    /**
     * @notice return the scaled down index of the power perp in USD, scaled by 18 decimals
     * @param _period period of time for the twap in seconds
     * @param _oracle oracle address
     * @param _ethDaiPool uniswap v3 pool for weth / dai
     * @param _weth weth address
     * @param _dai dai address
     * @return for squeeth, return ethPrice^2
     */
    function _getIndex(
        uint32 _period,
        address _oracle,
        address _ethDaiPool,
        address _weth,
        address _dai
    ) internal view returns (uint256) {
        uint256 ethDaiPrice = _getScaledTwap(_oracle, _ethDaiPool, _weth, _dai, _period);
        return ethDaiPrice.mul(ethDaiPrice).div(1e18);
    }

    /**
     * @notice return the unscaled index of the power perp in USD, scaled by 18 decimals
     * @param _period period of time for the twap in seconds
     * @param _oracle oracle address
     * @param _ethDaiPool uniswap v3 pool for weth / dai
     * @param _weth weth address
     * @param _dai dai address
     * @return for squeeth, return ethPrice^2
     */
    function _getUnscaledIndex(
        uint32 _period,
        address _oracle,
        address _ethDaiPool,
        address _weth,
        address _dai
    ) internal view returns (uint256) {
        uint256 ethDaiPrice = _getTwap(_oracle, _ethDaiPool, _weth, _dai, _period);
        return ethDaiPrice.mul(ethDaiPrice).div(1e18);
    }

    /**
     * @notice return the mark price of power perp in DAI, scaled by 18 decimals
     * @param _period period of time for the twap in seconds
     * @param _oracle oracle address
     * @param _wSqueethEthPool uniswap v3 pool for wSqueeth / weth
     * @param _ethDaiPool uniswap v3 pool for weth / dai
     * @param _weth weth address
     * @param _dai dai address
     * @param _wsqueeth wSqueeth address
     * @param _normalizationFactor current normalization factor
     * @return for squeeth, return ethPrice * squeethPriceInEth
     */
    function _getDenormalizedMark(
        uint32 _period,
        address _oracle,
        address _wSqueethEthPool,
        address _ethDaiPool,
        address _weth,
        address _dai,
        address _wsqueeth,
        uint256 _normalizationFactor
    ) internal view returns (uint256) {
        uint256 ethDaiPrice = _getScaledTwapSafe(_oracle, _ethDaiPool, _weth, _dai, _period);
        uint256 wsqueethEthPrice = _getTwapSafe(_oracle, _wSqueethEthPool, address(_wsqueeth), _weth, _period);

        return wsqueethEthPrice.mul(ethDaiPrice).div(_normalizationFactor);
    }

    /**
     * @notice get the fair collateral value for a _debtAmount of wSqueeth
     * @dev the actual amount liquidator can get should have a 10% bonus on top of this value.
     * @param _debtAmount wSqueeth amount paid by liquidator
     * @param _oracle oracle address
     * @param _ethDaiPool uniswap v3 pool for weth / dai
     * @param _weth weth address
     * @param _dai dai address
     * @param _normalizationFactor current normalization factor
     * @return returns equivalent collateral amount for debt
     */
    function _getCollateralByRepayAmount(
        uint256 _debtAmount,
        address _oracle,
        address _ethDaiPool,
        address _weth,
        address _dai,
        uint256 _normalizationFactor
    ) internal view returns (uint256) {
        uint256 ethDaiPrice = _getScaledTwap(_oracle, _ethDaiPool, _weth, _dai, 600);
        return _debtAmount.mul(_normalizationFactor).mul(ethDaiPrice).div(1e36);
    }

    /**
     * @notice request twap from our oracle, scaled down by INDEX_SCALE
     * @param _oracle oracle address
     * @param _pool uniswap v3 pool address
     * @param _base base currency. to get eth/dai price, eth is base token
     * @param _quote quote currency. to get eth/dai price, dai is the quote currency
     * @param _period number of seconds in the past to start calculating time-weighted average
     * @return twap price scaled down by INDEX_SCALE
     */
    function _getScaledTwap(
        address _oracle,
        address _pool,
        address _base,
        address _quote,
        uint32 _period
    ) internal view returns (uint256) {
        uint256 twap = _getTwap(_oracle, _pool, _base, _quote, _period);
        return twap.div(INDEX_SCALE);
    }

    /**
     * @notice request twap from our oracle, scaled down by INDEX_SCALE
     * @dev this won't revert if period is > max period for the pool
     * @param _oracle oracle address
     * @param _pool uniswap v3 pool address
     * @param _base base currency. to get eth/dai price, eth is base token
     * @param _quote quote currency. to get eth/dai price, dai is the quote currency
     * @param _period number of seconds in the past to start calculating time-weighted average
     * @return twap price scaled down by INDEX_SCALE
     */
    function _getScaledTwapSafe(
        address _oracle,
        address _pool,
        address _base,
        address _quote,
        uint32 _period
    ) internal view returns (uint256) {
        uint256 twap = _getTwapSafe(_oracle, _pool, _base, _quote, _period);
        return twap.div(INDEX_SCALE);
    }

    /**
     * @notice request twap from our oracle
     * @dev this will revert if period is > max period for the pool
     * @param _oracle oracle address
     * @param _pool uniswap v3 pool address
     * @param _base base currency. to get eth/dai price, eth is base token
     * @param _quote quote currency. to get eth/dai price, dai is the quote currency
     * @param _period number of seconds in the past to start calculating time-weighted average
     * @return human readable price. scaled by 1e18
     */
    function _getTwap(
        address _oracle,
        address _pool,
        address _base,
        address _quote,
        uint32 _period
    ) internal view returns (uint256) {
        // period reaching this point should be check, otherwise might revert
        return IOracle(_oracle).getTwap(_pool, _base, _quote, _period);
    }

    /**
     * @notice request twap from our oracle
     * @dev this won't revert if period is > max period for the pool
     * @param _oracle oracle address
     * @param _pool uniswap v3 pool address
     * @param _base base currency. to get eth/dai price, eth is base token
     * @param _quote quote currency. to get eth/dai price, dai is the quote currency
     * @param _period number of seconds in the past to start calculating time-weighted average
     * @return human readable price. scaled by 1e18
     */
    function _getTwapSafe(
        address _oracle,
        address _pool,
        address _base,
        address _quote,
        uint32 _period
    ) internal view returns (uint256) {
        return IOracle(_oracle).getTwapSafe(_pool, _base, _quote, _period);
    }

    /**
     * @notice get the index value of wsqueeth in wei, used when system settles
     * @dev the index of squeeth is ethPrice^2, so each squeeth will need to pay out {ethPrice} eth
     * @param _wsqueethAmount amount of wsqueeth used in settlement
     * @param _indexPriceForSettlement index price for settlement
     * @param _normalizationFactor current normalization factor
     * @return amount in wei that should be paid to the token holder
     */
    function _getLongSettlementValue(
        uint256 _wsqueethAmount,
        uint256 _indexPriceForSettlement,
        uint256 _normalizationFactor
    ) internal pure returns (uint256) {
        return _wsqueethAmount.mul(_normalizationFactor).mul(_indexPriceForSettlement).div(1e36);
    }
}
