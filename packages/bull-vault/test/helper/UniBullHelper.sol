// SPDX-License-Identifier: GPL-3.0-only
pragma solidity =0.7.6;

pragma abicoder v2;

// contract
import {UniBull} from "../../src/UniBull.sol";
import {console} from "forge-std/console.sol";
//interface
import {IERC20} from "openzeppelin/token/ERC20/IERC20.sol";

/**
 * @dev Helper contract to expose some function for testing
 */
contract UniBullHelper is UniBull {

    constructor(address _factory) UniBull(_factory) {}

    // TODO: to be removed
    function exactInFlashSwap(
        address _tokenIn,
        address _tokenOut,
        uint24 _fee,
        uint256 _amountIn,
        uint256 _amountOutMinimum,
        uint8 _callSource,
        bytes memory _data
    ) external {
        _exactInFlashSwap(_tokenIn, _tokenOut, _fee, _amountIn, _amountOutMinimum, _callSource, _data);
    }

    function getTwap(address _pool, address _base, address _quote, uint32 _period, bool _checkPeriod)
        external
        view
        returns (uint256)
    {
        return _getTwap(_pool, _base, _quote, _period, _checkPeriod);
    }

    // TODO: to be removed
<<<<<<< HEAD
    function _uniFlashSwap(
        UniFlashswapCallbackData memory _uniFlashSwapData
    ) internal override {
=======
    function _uniFlashSwap(UniFlashswapCallbackData memory _uniFlashSwapData) internal override {
>>>>>>> c7f1baf08dfd0df481a9fdc1b4a3972c43d1b2ad
        if (uint8(_uniFlashSwapData.callSource) == 0) {
            // ETH-USDC swap
            _exactInFlashSwap(
                0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48,
                0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2,
                3000,
                uint256(1000e6),
                0,
                uint8(1),
                ""
            );

            console.log("oSQTH amount to repay second", _uniFlashSwapData.amountToPay);
            IERC20(_uniFlashSwapData.tokenIn).transfer(_uniFlashSwapData.pool, _uniFlashSwapData.amountToPay);
<<<<<<< HEAD

        }
        else if (uint8(_uniFlashSwapData.callSource) == 1) {
=======
        } else if (uint8(_uniFlashSwapData.callSource) == 1) {
>>>>>>> c7f1baf08dfd0df481a9fdc1b4a3972c43d1b2ad
            console.log("USDC amount to repay first", _uniFlashSwapData.amountToPay);
            IERC20(_uniFlashSwapData.tokenIn).transfer(_uniFlashSwapData.pool, _uniFlashSwapData.amountToPay);
        }
    }
}
