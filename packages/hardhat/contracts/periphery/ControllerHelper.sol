//SPDX-License-Identifier: BUSL-1.1

pragma solidity =0.7.6;
pragma abicoder v2;

import "hardhat/console.sol";

// interface
import {IWETH9} from "../interfaces/IWETH9.sol";
import {IWPowerPerp} from "../interfaces/IWPowerPerp.sol";
import {IShortPowerPerp} from "../interfaces/IShortPowerPerp.sol";
import {IOracle} from "../interfaces/IOracle.sol";
import {IController} from "../interfaces/IController.sol";
import {IUniswapV3Pool} from "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {ISwapRouter} from "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";

// contract
import {FlashControllerHelper} from "./FlashControllerHelper.sol";

// lib
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";

contract ControllerHelper is FlashControllerHelper, IERC721Receiver {
    using SafeMath for uint256;
    using Address for address payable;

    /// @dev enum to differentiate between uniswap swap callback function source
    enum FLASH_SOURCE {
        FLASH_W_MINT,
        FLASH_W_BURN
    }

    /// @dev enum to differentiate between uniswap swap callback function source
    enum FLASH_SOURCE {
        FLASH_W_MINT,
        FLASH_W_BURN
    }

    address public immutable controller;
    address public immutable oracle;
    address public immutable shortPowerPerp;
    address public immutable wPowerPerpPool;
    address public immutable wPowerPerp;
    address public immutable weth;
    address public immutable swapRouter;

    struct flashswapWMintData {
        uint256 vaultId;
        uint256 flashSwappedCollateral;
        uint256 totalCollateralToDeposit;
        uint256 wPowerPerpAmount;
    }
    struct FlashWBurnData {
        uint256 vaultId;
        uint256 wPowerPerpAmountToBurn;
        uint256 wPowerPerpAmountToBuy;
        uint256 collateralToWithdraw;
    }

    struct FlashWBurnData {
        uint256 vaultId;
        uint256 wPowerPerpAmountToBurn;
        uint256 wPowerPerpAmountToBuy;
        uint256 collateralToWithdraw;
        uint256 collateralToBuyWith;
    }

    event FlashswapWMint(
        address indexed depositor,
        uint256 vaultId,
        uint256 wPowerPerpAmount,
        uint256 swappedCollateralAmount,
        uint256 collateralAmount
    );
    event FlashWBurn(
        address indexed withdrawer,
        uint256 vaultId,
        uint256 wPowerPerpAmountToBurn,
        uint256 collateralAmountToWithdraw,
        uint256 wPowerPerpAmountToBuy
    );

    constructor(
        address _controller,
        address _oracle,
        address _shortPowerPerp,
        address _wPowerPerpPool,
        address _wPowerPerp,
        address _weth,
        address _swapRouter,
        address _uniswapFactory
    ) FlashControllerHelper(_uniswapFactory) {
        controller = _controller;
        oracle = _oracle;
        shortPowerPerp = _shortPowerPerp;
        wPowerPerpPool = _wPowerPerpPool;
        wPowerPerp = _wPowerPerp;
        swapRouter = _swapRouter;
        weth = _weth;

        IWPowerPerp(_wPowerPerp).approve(_swapRouter, type(uint256).max);
        IWETH9(_weth).approve(_swapRouter, type(uint256).max);
    }

    /**
     * @dev accept erc721 from safeTransferFrom and safeMint after callback
     * @return returns received selector
     */
    function onERC721Received(
        address,
        address,
        uint256,
        bytes memory
    ) public virtual override returns (bytes4) {
        return this.onERC721Received.selector;
    }

    /**
     * @notice receive function to allow ETH transfer to this contract
     */
    receive() external payable {
        require(msg.sender == weth || msg.sender == address(controller), "Cannot receive eth");
    }

    /**
     * @notice flash mint WPowerPerp using flashswap
     * @param _vaultId vault ID
     * @param _wPowerPerpAmount amount of WPowerPerp to mint
     * @param _collateralAmount total collateral amount to deposit
     */
    function flashswapWMint(
        uint256 _vaultId,
        uint256 _wPowerPerpAmount,
        uint256 _collateralAmount
    ) external payable {
        uint256 amountToFlashswap = _collateralAmount.sub(msg.value);

        _exactInFlashSwap(
            wPowerPerp,
            weth,
            IUniswapV3Pool(wPowerPerpPool).fee(),
            _wPowerPerpAmount,
            amountToFlashswap,
            uint8(FLASH_SOURCE.FLASH_W_MINT),
            abi.encodePacked(_vaultId, amountToFlashswap, _collateralAmount, _wPowerPerpAmount)
        );

        emit FlashswapWMint(msg.sender, _vaultId, _wPowerPerpAmount, amountToFlashswap, _collateralAmount);
    }

    /**
     * @notice flash close position and buy long squeeth
     * @dev this function
     * @param _vaultId vault ID
     * @param _wPowerPerpAmountToBurn amount of WPowerPerp to burn
     * @param _wPowerPerpAmountToBuy amount of WPowerPerp to buy
     * @param _collateralToWithdraw amount of collateral to withdraw from vault
     * @param _collateralToBuyWith amount of collateral from vault to use to buy long
     */
    function flashswapWBurnBuyLong(
        uint256 _vaultId,
        uint256 _wPowerPerpAmountToBurn,
        uint256 _wPowerPerpAmountToBuy,
        uint256 _collateralToWithdraw,
        uint256 _collateralToBuyWith
    ) external payable {
        require(_collateralToBuyWith <= _collateralToWithdraw.add(msg.value), "Not enough collateral");

        _exactOutFlashSwap(
            weth,
            wPowerPerp,
            IUniswapV3Pool(wPowerPerpPool).fee(),
            _wPowerPerpAmountToBurn.add(_wPowerPerpAmountToBuy),
            _collateralToBuyWith.add(msg.value),
            uint8(FLASH_SOURCE.FLASH_W_BURN),
            abi.encodePacked(
                _vaultId,
                _wPowerPerpAmountToBurn,
                _wPowerPerpAmountToBuy,
                _collateralToWithdraw,
                _collateralToBuyWith.add(msg.value)
            )
        );

        emit FlashWBurn(msg.sender, _vaultId, _wPowerPerpAmountToBurn, _collateralToWithdraw, _wPowerPerpAmountToBuy);
    }

    /**
     * @notice flash close position and buy long squeeth
     * @dev this function
     * @param _vaultId vault ID
     * @param _wPowerPerpAmountToBurn amount of WPowerPerp to burn
     * @param _wPowerPerpAmountToBuy amount of WPowerPerp to buy
     * @param _collateralToWithdraw amount of collateral to withdraw from vault
     * @param _maxToPay max amount of collateral to pay for WPowerPerp token
     */
    function flashswapWBurnBuyLong(
        uint256 _vaultId,
        uint256 _wPowerPerpAmountToBurn,
        uint256 _wPowerPerpAmountToBuy,
        uint256 _collateralToWithdraw,
        uint256 _maxToPay
    ) external payable {
        require(_maxToPay <= _collateralToWithdraw.add(msg.value), "Not enough collateral");

        _exactOutFlashSwap(
            weth,
            wPowerPerp,
            IUniswapV3Pool(wPowerPerpPool).fee(),
            _wPowerPerpAmountToBurn.add(_wPowerPerpAmountToBuy),
            _maxToPay,
            uint8(FLASH_SOURCE.FLASH_W_BURN),
            abi.encodePacked(_vaultId, _wPowerPerpAmountToBurn, _wPowerPerpAmountToBuy, _collateralToWithdraw)
        );

        emit FlashWBurn(msg.sender, _vaultId, _wPowerPerpAmountToBurn, _collateralToWithdraw, _wPowerPerpAmountToBuy);
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
            flashswapWMintData memory data = abi.decode(_callData, (flashswapWMintData));

            // convert WETH to ETH as Uniswap uses WETH
            IWETH9(weth).withdraw(IWETH9(weth).balanceOf(address(this)));

            //will revert if data.flashSwappedCollateral is > eth balance in contract
            // IController(controller).mintWPowerPerpAmount{value: address(this).balance}(data.vaultId, data.wPowerPerpAmount, 0);
            uint256 vaultId = IController(controller).mintWPowerPerpAmount{value: data.totalCollateralToDeposit}(
                data.vaultId,
                data.wPowerPerpAmount,
                0
            );

            //repay the flash swap
            IWPowerPerp(wPowerPerp).transfer(wPowerPerpPool, _amountToPay);

            if (address(this).balance > 0) {
                payable(_caller).sendValue(address(this).balance);
            }

            // this is a newly open vault, transfer to the user
            if (data.vaultId == 0) IShortPowerPerp(shortPowerPerp).safeTransferFrom(address(this), _caller, vaultId);
        } else if (FLASH_SOURCE(_callSource) == FLASH_SOURCE.FLASH_W_BURN) {
            FlashWBurnData memory data = abi.decode(_callData, (FlashWBurnData));

            IController(controller).burnWPowerPerpAmount(
                data.vaultId,
                data.wPowerPerpAmountToBurn,
                data.collateralToWithdraw
            );
            IWETH9(weth).deposit{value: _amountToPay}();
            IWETH9(weth).transfer(wPowerPerpPool, _amountToPay);
            IWPowerPerp(wPowerPerp).transfer(_caller, data.wPowerPerpAmountToBuy);

            if (address(this).balance > 0) {
                payable(_caller).sendValue(address(this).balance);
            }
        }
        else if (FLASH_SOURCE(_callSource) == FLASH_SOURCE.FLASH_W_BURN) {
            FlashWBurnData memory data = abi.decode(_callData, (FlashWBurnData));

            IController(controller).burnWPowerPerpAmount(
                data.vaultId,
                data.wPowerPerpAmount,
                data.collateralToWithdraw
            );

            IWETH9(weth).deposit{value: data.collateralToWithdraw}();
            IWETH9(weth).transfer(wPowerPerpPool, _amountToPay);
            IWPowerPerp(wPowerPerp).transfer(_caller, data.wPowerPerpAmountToBuy);

            if (address(this).balance > 0) {
                payable(_caller).sendValue(address(this).balance);
            }
        }
    }
}
