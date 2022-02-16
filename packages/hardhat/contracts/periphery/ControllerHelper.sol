//SPDX-License-Identifier: BUSL-1.1

pragma solidity =0.7.6;
pragma abicoder v2;

// interface
import {IWETH9} from "../interfaces/IWETH9.sol";
import {IWPowerPerp} from "../interfaces/IWPowerPerp.sol";
import {IShortPowerPerp} from "../interfaces/IShortPowerPerp.sol";
import {IOracle} from "../interfaces/IOracle.sol";
import {IController} from "../interfaces/IController.sol";
import {IUniswapV3Pool} from "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";

// contract
import {FlashControllerHelper} from "./FlashControllerHelper.sol";

// lib
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";

contract ControllerHelper is FlashControllerHelper {

    /// @dev enum to differentiate between uniswap swap callback function source
    enum FLASH_SOURCE {
        FLASH_W_MINT
    }

    address public immutable controller;
    address public immutable oracle;
    address public immutable wPowerPerpPool;
    address public immutable wPowerPerp;
    address public immutable weth;

    struct FlashWMintData {
        uint256 vaultId;
        uint256 flashSwapedCollateral;
        uint256 wPowerPerpAmount;
    }

    event FlashWMint(address indexed depositor, uint256 vaultId, uint256 wPowerPerpAmount, uint256 collateralAmount);

    constructor(address _controller, address _oracle, address _wPowerPerpPool, address _wPowerPerp, address _weth, address _uniswapFactory) FlashControllerHelper(_uniswapFactory) {
        controller = _controller;
        oracle = _oracle;
        wPowerPerpPool = _wPowerPerpPool;
        wPowerPerp = _wPowerPerp;
        weth = _weth;
    }

    function flashWMint(uint256 _vaultId, uint256 _wPowerPerpAmount, uint256 _collateralAmount) external payable {
        _exactInFlashSwap(
            wPowerPerp,
            weth,
            IUniswapV3Pool(wPowerPerpPool).fee(),
            _wPowerPerpAmount,
            _collateralAmount,
            uint8(FLASH_SOURCE.FLASH_W_MINT),
            abi.encodePacked(_vaultId, _collateralAmount, _wPowerPerpAmount)
        );
    }

    /**
     * @notice uniswap flash swap callback function
     * @dev this function will be called by flashswap callback function uniswapV3SwapCallback()
     * @param _caller address of original function caller
     * @param _amountToPay amount to pay back for flashswap
     * @param _callData arbitrary data attached to callback
     * @param _callSource identifier for which function triggered callback
     */
    function _swapCallback(
        address _caller,
        address, /*_tokenIn*/
        address, /*_tokenOut*/
        uint24, /*_fee*/
        uint256 _amountToPay,
        bytes memory _callData,
        uint8 _callSource
    ) internal override {
        if (FLASH_SOURCE(_callSource) == FLASH_SOURCE.FLASH_W_MINT) {
            FlashWMintData memory data = abi.decode(_callData, (FlashWMintData));

            // convert WETH to ETH as Uniswap uses WETH
            IWETH9(weth).withdraw(data.flashSwapedCollateral);

            //will revert if data.flashSwapedCollateral is > eth balance in contract
            IController(controller).mintWPowerPerpAmount{value: data.flashSwapedCollateral}(data.vaultId, data.wPowerPerpAmount, 0);

            //repay the flash swap
            IWPowerPerp(wPowerPerp).transfer(wPowerPerpPool, _amountToPay);

            emit FlashWMint(_caller, data.vaultId, data.wPowerPerpAmount, data.flashSwapedCollateral);   
        }
    }
}
