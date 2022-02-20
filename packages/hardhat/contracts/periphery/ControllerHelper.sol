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
import {INonfungiblePositionManager} from "@uniswap/v3-periphery/contracts/interfaces/INonfungiblePositionManager.sol";
import {IERC20Detailed} from "../interfaces/IERC20Detailed.sol";

// contract
import {FlashControllerHelper} from "./FlashControllerHelper.sol";

// lib
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {TransferHelper} from "@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol";
import {ControllerHelperLib} from "./lib/ControllerHelperLib.sol";

contract ControllerHelper is FlashControllerHelper, IERC721Receiver {
    using SafeMath for uint256;
    using Address for address payable;

    /// @dev enum to differentiate between uniswap swap callback function source
    enum FLASH_SOURCE {
        FLASH_W_MINT,
        FLASH_W_BURN,
        FLASH_SELL_LONG_W_MINT,
        SWAP_EXACTIN_WPOWERPERP_ETH,
        SWAP_EXACTOUT_ETH_WPOWERPERP
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
    address public immutable nonfungiblePositionManager;
    bool public immutable isWethToken0;

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
    struct FlashSellLongWMintData {
        uint256 vaultId;
        uint256 wPowerPerpAmount;
        uint256 collateralAmount;
    }
    // params for closeShortWithUserNft()
    struct CloseShortWithUserNftParams {
        uint256 vaultId; // vault ID
        uint256 tokenId; // Uni NFT token ID
        uint256 liquidityPercentage; // percentage of liquidity to burn in LP position in decimals with 18 precision(e.g 60% = 0.6 = 6e17)
        uint256 wPowerPerpAmountToBurn; // amount of wPowerPerp to burn in vault
        uint256 collateralToWithdraw; // amount of ETH collateral to withdraw from vault
        uint256 limitPriceEthPerPowerPerp; // price limit for swapping between wPowerPerp and ETH (ETH per 1 wPowerPerp)
        uint128 amount0Min; // minimum amount of token0 to get from closing Uni LP
        uint128 amount1Min; // minimum amount of token1 to get from closing Uni LP
    }

    struct FlashWBurnData {
        uint256 vaultId;
        uint256 wPowerPerpAmount;
        uint256 collateralToWithdraw;
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
    event BatchMintLp(
        address indexed depositor,
        uint256 vaultId,
        uint256 wPowerPerpAmount,
        uint256 collateralToMint,
        uint256 collateralToLP
    );

    event FlashWBurn(
        address indexed withdrawer,
        uint256 vaultId,
        uint256 wPowerPerpAmount,
        uint256 collateralAmount,
        uint256 wPowerPerpBought
    );

    constructor(
        address _controller,
        address _oracle,
        address _shortPowerPerp,
        address _wPowerPerpPool,
        address _wPowerPerp,
        address _weth,
        address _swapRouter,
        address _nonfungiblePositionManager,
        address _uniswapFactory
    ) FlashControllerHelper(_uniswapFactory) {
        controller = _controller;
        oracle = _oracle;
        shortPowerPerp = _shortPowerPerp;
        wPowerPerpPool = _wPowerPerpPool;
        wPowerPerp = _wPowerPerp;
        swapRouter = _swapRouter;
        weth = _weth;
        swapRouter = _swapRouter;
        nonfungiblePositionManager = _nonfungiblePositionManager;
        isWethToken0 = _weth < _wPowerPerp;

        IWPowerPerp(_wPowerPerp).approve(_swapRouter, type(uint256).max);
        IWETH9(_weth).approve(_swapRouter, type(uint256).max);
        IWPowerPerp(_wPowerPerp).approve(_nonfungiblePositionManager, type(uint256).max);
        IWETH9(_weth).approve(_nonfungiblePositionManager, type(uint256).max);
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
     * @param _vaultId vault ID
     * @param _wPowerPerpAmount amount of WPowerPerp to burn
     * @param _collateralToWithdraw amount of collateral to withdraw
     * @param _minToReceive minimum amount of long WPowerPerp to receive
     */
    function flashWBurnBuyLong(
        uint256 _vaultId,
        uint256 _wPowerPerpAmount,
        uint256 _collateralToWithdraw,
        uint256 _minToReceive
    ) external {
        _exactOutFlashSwap(
            weth,
            wPowerPerp,
            IUniswapV3Pool(wPowerPerpPool).fee(),
            _wPowerPerpAmount,
            _collateralToWithdraw,
            uint8(FLASH_SOURCE.FLASH_W_BURN),
            abi.encodePacked(_vaultId, _wPowerPerpAmount, _collateralToWithdraw)
        );

        ISwapRouter.ExactInputSingleParams memory swapParams = ISwapRouter.ExactInputSingleParams({
            tokenIn: weth,
            tokenOut: wPowerPerp,
            fee: IUniswapV3Pool(wPowerPerpPool).fee(),
            recipient: msg.sender,
            deadline: block.timestamp,
            amountIn: IWETH9(weth).balanceOf(address(this)),
            amountOutMinimum: _minToReceive,
            sqrtPriceLimitX96: 0
        });

        uint256 amountOut = ISwapRouter(swapRouter).exactInputSingle(swapParams);
        IWPowerPerp(wPowerPerp).transfer(msg.sender, IWPowerPerp(wPowerPerp).balanceOf(address(this)));

        emit FlashWBurn(msg.sender, _vaultId, _wPowerPerpAmount, _collateralToWithdraw, amountOut);
    }

    /**
     * @notice close short position with user Uniswap v3 LP NFT
     * @dev user should approve this contract for Uni NFT transfer
     */
    function closeShortWithUserNft(CloseShortWithUserNftParams calldata params) external {
        INonfungiblePositionManager(nonfungiblePositionManager).safeTransferFrom(
            msg.sender,
            address(this),
            params.tokenId
        );

        // get liquidity amount, and withdraw ETH and wPowerPerp amounts in LP position
        (uint128 liquidity, , ) = ControllerHelperLib._getUniPositionBalances(
            nonfungiblePositionManager,
            params.tokenId,
            IOracle(oracle).getTimeWeightedAverageTickSafe(wPowerPerpPool, 420),
            isWethToken0
        );
        // (
        //     ,
        //     ,
        //     ,
        //     ,
        //     ,
        //     ,
        //     ,
        //     uint128 liquidity,
        //     ,
        //     ,
        //     ,
        // ) = INonfungiblePositionManager(nonfungiblePositionManager).positions(params.tokenId);
        INonfungiblePositionManager.DecreaseLiquidityParams memory decreaseParams = INonfungiblePositionManager
            .DecreaseLiquidityParams({
                tokenId: params.tokenId,
                liquidity: uint128(uint256(liquidity).mul(params.liquidityPercentage).div(1e18)),
                amount0Min: params.amount0Min,
                amount1Min: params.amount1Min,
                deadline: block.timestamp
            });

        INonfungiblePositionManager(nonfungiblePositionManager).decreaseLiquidity(decreaseParams);

        uint256 wethAmount;
        uint256 wPowerPerpAmount;
        (isWethToken0)
            ? (wethAmount, wPowerPerpAmount) = INonfungiblePositionManager(nonfungiblePositionManager).collect(
                INonfungiblePositionManager.CollectParams({
                    tokenId: params.tokenId,
                    recipient: address(this),
                    amount0Max: type(uint128).max,
                    amount1Max: type(uint128).max
                })
            )
            : (wPowerPerpAmount, wethAmount) = INonfungiblePositionManager(nonfungiblePositionManager).collect(
            INonfungiblePositionManager.CollectParams({
                tokenId: params.tokenId,
                recipient: address(this),
                amount0Max: type(uint128).max,
                amount1Max: type(uint128).max
            })
        );

        if (wPowerPerpAmount < params.wPowerPerpAmountToBurn) {
            // swap needed wPowerPerp amount to close short position
            _exactOutFlashSwap(
                weth,
                wPowerPerp,
                IUniswapV3Pool(wPowerPerpPool).fee(),
                params.wPowerPerpAmountToBurn.sub(wPowerPerpAmount),
                params.limitPriceEthPerPowerPerp.mul(params.wPowerPerpAmountToBurn.sub(wPowerPerpAmount)).div(1e18),
                uint8(FLASH_SOURCE.SWAP_EXACTOUT_ETH_WPOWERPERP),
                ""
            );

            IController(controller).burnWPowerPerpAmount(
                params.vaultId,
                params.wPowerPerpAmountToBurn,
                params.collateralToWithdraw
            );
        } else {
            // if LP have more wPowerPerp amount that amount to burn in vault, sell remaining amount for WETH
            IController(controller).burnWPowerPerpAmount(
                params.vaultId,
                params.wPowerPerpAmountToBurn,
                params.collateralToWithdraw
            );

            uint256 wPowerPerpExcess = wPowerPerpAmount.sub(params.wPowerPerpAmountToBurn);
            if (wPowerPerpExcess > 0) {
                _exactInFlashSwap(
                    wPowerPerp,
                    weth,
                    IUniswapV3Pool(wPowerPerpPool).fee(),
                    wPowerPerpExcess,
                    params.limitPriceEthPerPowerPerp.mul(wPowerPerpExcess).div(1e18),
                    uint8(FLASH_SOURCE.SWAP_EXACTIN_WPOWERPERP_ETH),
                    ""
                );
            }
        }

        IWETH9(weth).withdraw(IWETH9(weth).balanceOf(address(this)));

        if (address(this).balance > 0) {
            payable(msg.sender).sendValue(address(this).balance);
        }
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
     * @notice sell long wPowerPerp and flashswap mint short position
     * @dev flahswap amount = collateral amount - msg.value - ETH from selling long wPowerPerp
     * @param _vaultId vault ID
     * @param _wPowerPerpAmountToMint wPowerPerp amount to mint
     * @param _collateralAmount collateral amount to use for minting
     * @param _wPowerPerpAmountToSell long wPowerPerp amount to sell
     * @param _minToReceive min ETH amount to receive for selling long _wPowerPerpAmountToMint+_wPowerPerpAmountToSell
     */
    function flashswapSellLongWMint(
        uint256 _vaultId,
        uint256 _wPowerPerpAmountToMint,
        uint256 _collateralAmount,
        uint256 _wPowerPerpAmountToSell,
        uint256 _minToReceive
    ) external payable {
        IWPowerPerp(wPowerPerp).transferFrom(msg.sender, address(this), _wPowerPerpAmountToSell);

        // flahswap and mint short position
        _exactInFlashSwap(
            wPowerPerp,
            weth,
            IUniswapV3Pool(wPowerPerpPool).fee(),
            _wPowerPerpAmountToMint.add(_wPowerPerpAmountToSell),
            _minToReceive,
            uint8(FLASH_SOURCE.FLASH_SELL_LONG_W_MINT),
            abi.encodePacked(_vaultId, _wPowerPerpAmountToMint, _collateralAmount)
        );
    }

    /**
     * @notice mint WPowerPerp and LP into Uniswap v3 pool
     * @param _vaultId vault ID
     * @param _wPowerPerpAmount amount of WPowerPerp token to mint
     * @param _collateralToMint collateral to use for minting
     * @param _collateralToLP collateral to use for LPing
     * @param _amount0Min minimum amount of asset0 in LP
     * @param _amount1Min minimum amount of asset1 in LP
     * @param _deadline LP position timestamp deadline
     * @param _lowerTick LP lower tick
     * @param _upperTick LP upper tick
     */
    function batchMintLp(
        uint256 _vaultId,
        uint256 _wPowerPerpAmount,
        uint256 _collateralToMint,
        uint256 _collateralToLP,
        uint256 _amount0Min,
        uint256 _amount1Min,
        uint256 _deadline,
        int24 _lowerTick,
        int24 _upperTick
    ) external payable {
        require(msg.value == _collateralToMint.add(_collateralToLP), "Wrong ETH sent");

        uint256 vaultId = IController(controller).mintWPowerPerpAmount{value: _collateralToMint}(
            _vaultId,
            _wPowerPerpAmount,
            0
        );
        address token0 = IUniswapV3Pool(wPowerPerpPool).token0();
        address token1 = IUniswapV3Pool(wPowerPerpPool).token1();

        INonfungiblePositionManager.MintParams memory params = INonfungiblePositionManager.MintParams({
            token0: token0,
            token1: token1,
            fee: IUniswapV3Pool(wPowerPerpPool).fee(),
            tickLower: _lowerTick,
            tickUpper: _upperTick,
            amount0Desired: token0 == wPowerPerp ? _wPowerPerpAmount : _collateralToLP,
            amount1Desired: token1 == wPowerPerp ? _wPowerPerpAmount : _collateralToLP,
            amount0Min: _amount0Min,
            amount1Min: _amount1Min,
            recipient: msg.sender,
            deadline: _deadline
        });

        INonfungiblePositionManager(nonfungiblePositionManager).mint{value: _collateralToLP}(params);

        uint256 remainingWPowerPerp = IWPowerPerp(wPowerPerp).balanceOf(address(this));
        if (remainingWPowerPerp > 0) {
            IController(controller).burnWPowerPerpAmount(vaultId, remainingWPowerPerp, 0);
        }
        // in case _collateralToLP > amount needed to LP, withdraw excess ETH
        INonfungiblePositionManager(nonfungiblePositionManager).refundETH();
        // if openeded new vault, transfer vault NFT to user
        if (_vaultId == 0) IShortPowerPerp(shortPowerPerp).safeTransferFrom(address(this), msg.sender, vaultId);

        payable(msg.sender).sendValue(address(this).balance);

        emit BatchMintLp(msg.sender, _vaultId, _wPowerPerpAmount, _collateralToMint, _collateralToLP);
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
        } else if (FLASH_SOURCE(_callSource) == FLASH_SOURCE.FLASH_SELL_LONG_W_MINT) {
            FlashSellLongWMintData memory data = abi.decode(_callData, (FlashSellLongWMintData));

            // convert WETH to ETH as Uniswap uses WETH
            IWETH9(weth).withdraw(IWETH9(weth).balanceOf(address(this)));

            uint256 vaultId = IController(controller).mintWPowerPerpAmount{value: data.collateralAmount}(
                data.vaultId,
                data.wPowerPerpAmount,
                0
            );

            IWPowerPerp(wPowerPerp).transfer(wPowerPerpPool, _amountToPay);

            if (address(this).balance > 0) {
                payable(_caller).sendValue(address(this).balance);
            }
            // this is a newly open vault, transfer to the user
            if (data.vaultId == 0) IShortPowerPerp(shortPowerPerp).safeTransferFrom(address(this), _caller, vaultId);
        } else if (FLASH_SOURCE(_callSource) == FLASH_SOURCE.SWAP_EXACTIN_WPOWERPERP_ETH) {
            IWPowerPerp(wPowerPerp).transfer(wPowerPerpPool, _amountToPay);
        } else if (FLASH_SOURCE(_callSource) == FLASH_SOURCE.SWAP_EXACTOUT_ETH_WPOWERPERP) {
            IWETH9(weth).transfer(wPowerPerpPool, _amountToPay);
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
        }
    }
}
