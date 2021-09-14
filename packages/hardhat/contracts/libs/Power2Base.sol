// SPDX-License-Identifier: MIT

pragma solidity =0.7.6;

import {IUniswapV3Pool} from "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import {OracleLibrary} from "@uniswap/v3-periphery/contracts/libraries/OracleLibrary.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {IOracle} from "../interfaces/IOracle.sol";

library Power2Base {
    using SafeMath for uint256;

    /**
     * @dev return the index of the power perp
     * @return for squeeth, return ethPrice^2
     */
    function _getIndex(
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
     * @dev return the mark price of the power perp
     * @return for squeeth, return ethPrice * squeethPriceInEth
     */
    function _getDenormalizedMark(
        uint32 _period,
        address _oracle,
        address _squeethEthPool,
        address _ethDaiPool,
        address _weth,
        address _dai,
        address _wsqueeth,
        uint256 _normalizationFactor
    ) internal view returns (uint256) {
        uint256 ethDaiPrice = _getTwap(_oracle, _ethDaiPool, _weth, _dai, _period);
        uint256 squeethEthPrice = _getTwap(_oracle, _squeethEthPool, address(_wsqueeth), _weth, _period);

        return squeethEthPrice.mul(ethDaiPrice).div(_normalizationFactor);
    }

    /**
     * @dev get how much collateral can be given out to the liquidator
     * @param _debtAmount wSqueeth amount paid by liquidator
     * @return collateralToSell amount the liquidator can get.
     */
    function _getCollateralToSell(
        uint256 _debtAmount,
        address _oracle,
        address _ethDaiPool,
        address _weth,
        address _dai,
        uint256 _normalizationFactor
    ) internal view returns (uint256 collateralToSell) {
        uint256 ethDaiPrice = IOracle(_oracle).getTwapSafe(_ethDaiPool, _weth, _dai, 600);
        collateralToSell = _debtAmount.mul(_normalizationFactor).mul(ethDaiPrice).div(1e36);
        // add a 10% on top of debt * index price.
        collateralToSell = collateralToSell.add(collateralToSell.div(10));
    }

    /**
     * @dev request twap from our oracle.
     * @return price scaled by 1e18
     */
    function _getTwap(
        address _oracle,
        address _pool,
        address _base,
        address _quote,
        uint32 _period
    ) internal view returns (uint256) {
        // period reaching this point should be check, otherwise might revert
        uint256 twap = IOracle(_oracle).getTwap(_pool, _base, _quote, _period);
        require(twap != 0, "WAP WAP WAP");

        return twap;
    }
}
