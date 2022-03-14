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
// import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {UniswapControllerHelper} from "./UniswapControllerHelper.sol";
import {AaveControllerHelper} from "./AaveControllerHelper.sol";

// lib
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {TransferHelper} from "@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol";

// import {ControllerHelperLib} from "./lib/ControllerHelperLib.sol";

contract ControllerHelper is UniswapControllerHelper, AaveControllerHelper, IERC721Receiver {
    using SafeMath for uint256;
    using Address for address payable;
    // using Strings for uint256;

    /// @dev enum to differentiate between uniswap swap callback function source
    enum CALLBACK_SOURCE {
        FLASH_W_MINT,
        FLASH_W_BURN,
        FLASH_SELL_LONG_W_MINT,
        SWAP_EXACTIN_WPOWERPERP_ETH,
        SWAP_EXACTOUT_ETH_WPOWERPERP,
        FLASHLOAN_W_MINT_DEPOSIT_NFT,
        FLASHLOAN_CLOSE_VAULT_LP_NFT
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

    struct FlashswapWMintData {
        uint256 vaultId;
        uint256 flashSwappedCollateral;
        uint256 totalCollateralToDeposit;
        uint256 wPowerPerpAmount;
    }
    struct FlashswapWBurnData {
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
    struct CloseVaultLpNftData {
        uint256 vaultId; // vault ID
        uint256 tokenId; // Uni NFT token ID
        uint256 liquidityPercentage; // percentage of liquidity to burn in LP position in decimals with 18 precision(e.g 60% = 0.6 = 6e17)
        uint256 wPowerPerpAmountToBurn; // amount of wPowerPerp to burn in vault
        uint256 collateralToWithdraw;
        uint256 limitPriceEthPerPowerPerp; // price limit for swapping between wPowerPerp and ETH (ETH per 1 wPowerPerp)
        uint128 amount0Min; // minimum amount of token0 to get from closing Uni LP
        uint128 amount1Min; // minimum amount of token1 to get from closing Uni LP
    }
    struct SwapExactoutEthWPowerPerpData {
        uint256 vaultId; // vault ID
        uint256 wPowerPerpAmountToBurn; // amount of wPowerPerp to burn in vault
        uint256 collateralToWithdraw; // ETH amount to withdraw from vault
    }

    // params for CloseShortWithUserNft()
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
    // struct for flashloanWMintDepositNft() params
    struct FlashloanWMintDepositNftParams {
        uint256 vaultId; // vault ID (could be zero)
        uint256 wPowerPerpAmount; // wPowerPerp amount to mint
        uint256 collateralToDeposit; // ETH collateral amount to deposit in vault (could be zero)
        uint256 collateralToLp; // ETH collateral amount to use for LPing (could be zero)
        uint256 collateralToWithdraw; // ETH amount to withdraw from vault (vault.collateralAmount >= collateralToWithdraw + flash loaned ETH)
        uint256 lpAmount0Min; // amount0Min for Uni LPing
        uint256 lpAmount1Min; // amount1Min for Uni LPing
        int24 lpLowerTick; // Uni LP lower tick
        int24 lpUpperTick; // Uni LP upper tick
    }
    struct FlashloanCloseVaultLpNftParam {
        uint256 vaultId; // vault ID
        uint256 tokenId; // Uni NFT token ID
        uint256 wPowerPerpAmountToBurn; // amount of wPowerPerp to burn in vault
        uint256 collateralToFlashloan; // amount of ETH collateral to flashloan and deposit into vault
        uint256 limitPriceEthPerPowerPerp; // price limit for swapping between wPowerPerp and ETH (ETH per 1 wPowerPerp)
        uint128 amount0Min; // minimum amount of token0 to get from closing Uni LP
        uint128 amount1Min; // minimum amount of token1 to get from closing Uni LP
    }
    struct closeUniLpParams {
        uint256 vaultId;
        uint256 tokenId;
        uint256 liquidityPercentage; // percentage of liquidity to burn in LP position in decimals with 18 precision(e.g 60% = 0.6 = 6e17)
        uint256 wPowerPerpAmountToBurn;
        uint256 collateralToWithdraw;
        uint256 limitPriceEthPerPowerPerp;
        uint128 amount0Min;
        uint128 amount1Min;
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

    constructor(
        address _controller,
        address _oracle,
        address _shortPowerPerp,
        address _wPowerPerpPool,
        address _wPowerPerp,
        address _weth,
        address _swapRouter,
        address _nonfungiblePositionManager,
        address _uniswapFactory,
        address _lendingPoolAddressProvider
    ) UniswapControllerHelper(_uniswapFactory) AaveControllerHelper(_lendingPoolAddressProvider) {
        controller = _controller;
        oracle = _oracle;
        shortPowerPerp = _shortPowerPerp;
        wPowerPerpPool = _wPowerPerpPool;
        wPowerPerp = _wPowerPerp;
        weth = _weth;
        swapRouter = _swapRouter;
        nonfungiblePositionManager = _nonfungiblePositionManager;
        isWethToken0 = _weth < _wPowerPerp;

        console.log(Address.isContract(_controller));

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
        require(msg.sender == weth || msg.sender == address(controller), "E3");
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
        uint256 _collateralAmount,
        uint256 _minToReceive
    ) external payable {
        uint256 amountToFlashswap = _collateralAmount.sub(msg.value);

        _exactInFlashSwap(
            wPowerPerp,
            weth,
            IUniswapV3Pool(wPowerPerpPool).fee(),
            _wPowerPerpAmount,
            _minToReceive,
            uint8(CALLBACK_SOURCE.FLASH_W_MINT),
            abi.encodePacked(_vaultId, amountToFlashswap, _collateralAmount, _wPowerPerpAmount)
        );

        // no need to unwrap WETH received from swap as it is done in the callback function
        payable(msg.sender).sendValue(address(this).balance);

        emit FlashswapWMint(msg.sender, _vaultId, _wPowerPerpAmount, amountToFlashswap, _collateralAmount);
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
            uint8(CALLBACK_SOURCE.FLASH_W_BURN),
            abi.encodePacked(_vaultId, _wPowerPerpAmountToBurn, _wPowerPerpAmountToBuy, _collateralToWithdraw)
        );

        payable(msg.sender).sendValue(address(this).balance);

        emit FlashWBurn(msg.sender, _vaultId, _wPowerPerpAmountToBurn, _collateralToWithdraw, _wPowerPerpAmountToBuy);
    }

    /**
     * @notice sell long wPowerPerp and flashswap mint short position
     * @dev flashswap amount = collateral amount - msg.value - ETH from selling long wPowerPerp
     * @param _vaultId vault ID
     * @param _wPowerPerpAmountToMint wPowerPerp amount to mint
     * @param _collateralAmount collateral amount to use for minting
     * @param _wPowerPerpAmountToSell long wPowerPerp amount to sell
     * @param _minToReceive min ETH amount to receive for selling long wPowerPerp amount
     */
    function flashswapSellLongWMint(
        uint256 _vaultId,
        uint256 _wPowerPerpAmountToMint,
        uint256 _collateralAmount,
        uint256 _wPowerPerpAmountToSell,
        uint256 _minToReceive
    ) external payable {
        IWPowerPerp(wPowerPerp).transferFrom(msg.sender, address(this), _wPowerPerpAmountToSell);

        // flashswap and mint short position
        _exactInFlashSwap(
            wPowerPerp,
            weth,
            IUniswapV3Pool(wPowerPerpPool).fee(),
            _wPowerPerpAmountToMint.add(_wPowerPerpAmountToSell),
            _minToReceive,
            uint8(CALLBACK_SOURCE.FLASH_SELL_LONG_W_MINT),
            abi.encodePacked(_vaultId, _wPowerPerpAmountToMint, _collateralAmount)
        );

        payable(msg.sender).sendValue(address(this).balance);
    }

    /**
     * @notice close short position with user Uniswap v3 LP NFT
     * @dev user should approve this contract for Uni NFT transfer
     */
    function closeShortWithUserNft(CloseShortWithUserNftParams calldata _params) external {
        INonfungiblePositionManager(nonfungiblePositionManager).safeTransferFrom(
            msg.sender,
            address(this),
            _params.tokenId
        );

        _closeUniLp(
            closeUniLpParams({
                vaultId: _params.vaultId,
                tokenId: _params.tokenId,
                liquidityPercentage: _params.liquidityPercentage,
                wPowerPerpAmountToBurn: _params.wPowerPerpAmountToBurn,
                collateralToWithdraw: _params.collateralToWithdraw,
                limitPriceEthPerPowerPerp: _params.limitPriceEthPerPowerPerp,
                amount0Min: _params.amount0Min,
                amount1Min: _params.amount1Min
            })
        );

        IWETH9(weth).withdraw(IWETH9(weth).balanceOf(address(this)));
        payable(msg.sender).sendValue(address(this).balance);
    }

    function flashloanCloseVaultLpNft(FlashloanCloseVaultLpNftParam calldata _params) external payable {
        _flashLoan(
            weth,
            _params.collateralToFlashloan,
            uint8(CALLBACK_SOURCE.FLASHLOAN_CLOSE_VAULT_LP_NFT),
            abi.encode(
                CloseVaultLpNftData({
                    vaultId: _params.vaultId,
                    tokenId: _params.tokenId,
                    liquidityPercentage: uint256(1e18),
                    wPowerPerpAmountToBurn: _params.wPowerPerpAmountToBurn,
                    collateralToWithdraw: _params.collateralToFlashloan,
                    limitPriceEthPerPowerPerp: _params.limitPriceEthPerPowerPerp,
                    amount0Min: _params.amount0Min,
                    amount1Min: _params.amount1Min
                })
            )
        );

        IWETH9(weth).withdraw(IWETH9(weth).balanceOf(address(this)));
        payable(msg.sender).sendValue(address(this).balance);
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
        require(msg.value == _collateralToMint.add(_collateralToLP), "E2");

        uint256 vaultId = IController(controller).mintWPowerPerpAmount{value: _collateralToMint}(
            _vaultId,
            _wPowerPerpAmount,
            0
        );
        uint256 amount0Desired = isWethToken0 ? _collateralToLP : _wPowerPerpAmount;
        uint256 amount1Desired = isWethToken0 ? _wPowerPerpAmount : _collateralToLP;

        _lpWPowerPerpPool(
            msg.sender,
            _collateralToLP,
            amount0Desired,
            amount1Desired,
            _amount0Min,
            _amount1Min,
            _deadline,
            _lowerTick,
            _upperTick
        );

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
     * @notice FLash mint short position, LP in Uni v3, use LP NFT as collateral and withdraw ETH collateral to repay flashloan
     * @dev sender can specify the amount of ETH collateral to withdraw in case vault.collateralAmount > ETH to repay for loan
     * @param _params FlashloanWMintDepositNftParams struct
     */
    function flashloanWMintDepositNft(FlashloanWMintDepositNftParams calldata _params) external payable {

        // struct FlashloanWMintDepositNftParams {
        //     uint256 vaultId; // vault ID (could be zero)
        //     uint256 wPowerPerpAmount; // wPowerPerp amount to mint
        //     uint256 collateralToDeposit; // ETH collateral amount to flashloan and deposit in vault (could be zero)
        //     uint256 collateralToLp; // ETH collateral amount to use for LPing (could be zero)
        //     uint256 collateralToWithdraw; // ETH amount to withdraw from vault (vault.collateralAmount >= collateralToWithdraw + flash loaned ETH)
        //     uint256 lpAmount0Min; // amount0Min for Uni LPing
        //     uint256 lpAmount1Min; // amount1Min for Uni LPing
        //     uint256 lpLowerTick; // Uni LP lower tick
        //     uint256 lpUpperTick; // Uni LP upper tick
        // }

        _flashLoan(
            weth,
            _params.collateralToDeposit,
            uint8(CALLBACK_SOURCE.FLASHLOAN_W_MINT_DEPOSIT_NFT),
            abi.encode(_params)
        );
    }

    function _flashCallback(
        address _initiator,
        address, /*_asset*/
        uint256 _amount,
        uint256 _premium,
        uint8 _callSource,
        bytes memory _calldata
    ) internal override {
        if (CALLBACK_SOURCE(_callSource) == CALLBACK_SOURCE.FLASHLOAN_W_MINT_DEPOSIT_NFT) {
            FlashloanWMintDepositNftParams memory data = abi.decode(_calldata, (FlashloanWMintDepositNftParams));

            // convert flashloaned WETH to ETH
            IWETH9(weth).withdraw(_amount);

            uint256 vaultId = IController(controller).mintWPowerPerpAmount{value: data.collateralToDeposit.add(msg.value)}(
                data.vaultId,
                data.wPowerPerpAmount,
                0
            );

            // LP data.wPowerPerpAmount & data.collateralToLp in Uni v3
            uint256 amount0Desired = isWethToken0 ? data.collateralToLp : data.wPowerPerpAmount;
            uint256 amount1Desired = isWethToken0 ? data.wPowerPerpAmount : data.collateralToLp;
            uint256 uniTokenId = _lpWPowerPerpPool(
                address(this),
                data.collateralToLp,
                amount0Desired,
                amount1Desired,
                data.lpAmount0Min,
                data.lpAmount1Min,
                block.timestamp,
                data.lpLowerTick,
                data.lpUpperTick
            );

            // deposit Uni NFT token in vault
            INonfungiblePositionManager(nonfungiblePositionManager).approve(controller, uniTokenId);
            IController(controller).depositUniPositionToken(vaultId, uniTokenId);

            // remove flashloan amount in ETH from vault + any amount of collateral user want to withdraw (sum <= vault.collateralAmount)
            IController(controller).burnWPowerPerpAmount(vaultId, 0, _amount.add(data.collateralToWithdraw));

            // convert flashloaned amount + fee from ETH to WETH to prepare for payback
            IWETH9(weth).deposit{value: _amount.add(_premium)}();

            // if openeded new vault, transfer vault NFT to user
            if (data.vaultId == 0) IShortPowerPerp(shortPowerPerp).safeTransferFrom(address(this), _initiator, vaultId);
        } else if (CALLBACK_SOURCE(_callSource) == CALLBACK_SOURCE.FLASHLOAN_CLOSE_VAULT_LP_NFT) {
            CloseVaultLpNftData memory data = abi.decode(_calldata, (CloseVaultLpNftData));

            // convert flashloaned WETH to ETH
            IWETH9(weth).withdraw(_amount);

            IController(controller).deposit{value: _amount}(data.vaultId);

            IController(controller).withdrawUniPositionToken(data.vaultId);

            console.log("data.limitPriceEthPerPowerPerp", data.limitPriceEthPerPowerPerp);

            _closeUniLp(
                closeUniLpParams({
                    vaultId: data.vaultId,
                    tokenId: data.tokenId,
                    liquidityPercentage: data.liquidityPercentage,
                    wPowerPerpAmountToBurn: data.wPowerPerpAmountToBurn,
                    collateralToWithdraw: data.collateralToWithdraw,
                    limitPriceEthPerPowerPerp: data.limitPriceEthPerPowerPerp,
                    amount0Min: data.amount0Min,
                    amount1Min: data.amount1Min
                })
            );
        }
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
        if (CALLBACK_SOURCE(_callSource) == CALLBACK_SOURCE.FLASH_W_MINT) {
            FlashswapWMintData memory data = abi.decode(_callData, (FlashswapWMintData));

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

            // this is a newly open vault, transfer to the user
            if (data.vaultId == 0) IShortPowerPerp(shortPowerPerp).safeTransferFrom(address(this), _caller, vaultId);
        } else if (CALLBACK_SOURCE(_callSource) == CALLBACK_SOURCE.FLASH_W_BURN) {
            FlashswapWBurnData memory data = abi.decode(_callData, (FlashswapWBurnData));

            IController(controller).burnWPowerPerpAmount(
                data.vaultId,
                data.wPowerPerpAmountToBurn,
                data.collateralToWithdraw
            );
            IWETH9(weth).deposit{value: _amountToPay}();
            IWETH9(weth).transfer(wPowerPerpPool, _amountToPay);
            IWPowerPerp(wPowerPerp).transfer(_caller, data.wPowerPerpAmountToBuy);
        } else if (CALLBACK_SOURCE(_callSource) == CALLBACK_SOURCE.FLASH_SELL_LONG_W_MINT) {
            FlashSellLongWMintData memory data = abi.decode(_callData, (FlashSellLongWMintData));

            // convert WETH to ETH as Uniswap uses WETH
            IWETH9(weth).withdraw(IWETH9(weth).balanceOf(address(this)));

            uint256 vaultId = IController(controller).mintWPowerPerpAmount{value: data.collateralAmount}(
                data.vaultId,
                data.wPowerPerpAmount,
                0
            );

            IWPowerPerp(wPowerPerp).transfer(wPowerPerpPool, _amountToPay);

            // this is a newly open vault, transfer to the user
            if (data.vaultId == 0) IShortPowerPerp(shortPowerPerp).safeTransferFrom(address(this), _caller, vaultId);
        } else if (CALLBACK_SOURCE(_callSource) == CALLBACK_SOURCE.SWAP_EXACTIN_WPOWERPERP_ETH) {
            IWPowerPerp(wPowerPerp).transfer(wPowerPerpPool, _amountToPay);
        } else if (CALLBACK_SOURCE(_callSource) == CALLBACK_SOURCE.SWAP_EXACTOUT_ETH_WPOWERPERP) {
            SwapExactoutEthWPowerPerpData memory data = abi.decode(_callData, (SwapExactoutEthWPowerPerpData));

            IController(controller).burnWPowerPerpAmount(
                data.vaultId,
                data.wPowerPerpAmountToBurn,
                data.collateralToWithdraw
            );

            console.log("_amountToPay", _amountToPay);

            IWETH9(weth).transfer(wPowerPerpPool, _amountToPay);
        }
    }

    /**
     * @notice LP into Uniswap V3 pool
     */
    function _lpWPowerPerpPool(
        address _recipient,
        uint256 _ethAmount,
        uint256 _amount0Desired,
        uint256 _amount1Desired,
        uint256 _amount0Min,
        uint256 _amount1Min,
        uint256 _deadline,
        int24 _lowerTick,
        int24 _upperTick
    ) private returns (uint256) {
        INonfungiblePositionManager.MintParams memory _params = INonfungiblePositionManager.MintParams({
            token0: isWethToken0 ? weth : wPowerPerp,
            token1: isWethToken0 ? wPowerPerp : weth,
            fee: IUniswapV3Pool(wPowerPerpPool).fee(),
            tickLower: _lowerTick,
            tickUpper: _upperTick,
            amount0Desired: _amount0Desired,
            amount1Desired: _amount1Desired,
            amount0Min: _amount0Min,
            amount1Min: _amount1Min,
            recipient: _recipient,
            deadline: _deadline
        });

        (uint256 tokenId, , , ) = INonfungiblePositionManager(nonfungiblePositionManager).mint{value: _ethAmount}(
            _params
        );

        return tokenId;
    }

    function _closeUniLp(closeUniLpParams memory _params) private {
        (, , , , , , , uint128 liquidity, , , , ) = INonfungiblePositionManager(nonfungiblePositionManager).positions(
            _params.tokenId
        );
        INonfungiblePositionManager.DecreaseLiquidityParams memory decreaseParams = INonfungiblePositionManager
            .DecreaseLiquidityParams({
                tokenId: _params.tokenId,
                liquidity: uint128(uint256(liquidity).mul(_params.liquidityPercentage).div(1e18)),
                amount0Min: _params.amount0Min,
                amount1Min: _params.amount1Min,
                deadline: block.timestamp
            });
        INonfungiblePositionManager(nonfungiblePositionManager).decreaseLiquidity(decreaseParams);

        uint256 wethAmount;
        uint256 wPowerPerpAmount;
        (isWethToken0)
            ? (wethAmount, wPowerPerpAmount) = INonfungiblePositionManager(nonfungiblePositionManager).collect(
                INonfungiblePositionManager.CollectParams({
                    tokenId: _params.tokenId,
                    recipient: address(this),
                    amount0Max: type(uint128).max,
                    amount1Max: type(uint128).max
                })
            )
            : (wPowerPerpAmount, wethAmount) = INonfungiblePositionManager(nonfungiblePositionManager).collect(
            INonfungiblePositionManager.CollectParams({
                tokenId: _params.tokenId,
                recipient: address(this),
                amount0Max: type(uint128).max,
                amount1Max: type(uint128).max
            })
        );

        console.log("wethAmount", wethAmount);
        console.log("wPowerPerpAmount", wPowerPerpAmount);

        if (wPowerPerpAmount < _params.wPowerPerpAmountToBurn) {
            console.log("wPowerPerpAmount in pool less than wPowerPerpAmountToBurn");
            console.log("_params.limitPriceEthPerPowerPerp", _params.limitPriceEthPerPowerPerp);
            console.log("_params.wPowerPerpAmountToBurn", _params.wPowerPerpAmountToBurn);
            console.log("wPowerPerpAmount", wPowerPerpAmount);
            console.log(
                "_params.wPowerPerpAmountToBurn.sub(wPowerPerpAmount)",
                _params.wPowerPerpAmountToBurn.sub(wPowerPerpAmount)
            );
            console.log(
                "_params.limitPriceEthPerPowerPerp.mul(_params.wPowerPerpAmountToBurn.sub(wPowerPerpAmount)).div(1e18)",
                _params.limitPriceEthPerPowerPerp.mul(_params.wPowerPerpAmountToBurn.sub(wPowerPerpAmount)).div(1e18)
            );

            // swap needed wPowerPerp amount to close short position
            _exactOutFlashSwap(
                weth,
                wPowerPerp,
                IUniswapV3Pool(wPowerPerpPool).fee(),
                _params.wPowerPerpAmountToBurn.sub(wPowerPerpAmount),
                _params.limitPriceEthPerPowerPerp.mul(_params.wPowerPerpAmountToBurn.sub(wPowerPerpAmount)).div(1e18),
                uint8(CALLBACK_SOURCE.SWAP_EXACTOUT_ETH_WPOWERPERP),
                abi.encodePacked(_params.vaultId, _params.wPowerPerpAmountToBurn, _params.collateralToWithdraw)
            );
        } else {
            console.log("wPowerPerpAmount in pool more than wPowerPerpAmountToBurn");

            // if LP have more wPowerPerp amount that amount to burn in vault, sell remaining amount for WETH
            IController(controller).burnWPowerPerpAmount(
                _params.vaultId,
                _params.wPowerPerpAmountToBurn,
                _params.collateralToWithdraw
            );

            uint256 wPowerPerpExcess = wPowerPerpAmount.sub(_params.wPowerPerpAmountToBurn);
            if (wPowerPerpExcess > 0) {
                _exactInFlashSwap(
                    wPowerPerp,
                    weth,
                    IUniswapV3Pool(wPowerPerpPool).fee(),
                    wPowerPerpExcess,
                    _params.limitPriceEthPerPowerPerp.mul(wPowerPerpExcess).div(1e18),
                    uint8(CALLBACK_SOURCE.SWAP_EXACTIN_WPOWERPERP_ETH),
                    ""
                );
            }
        }
    }
}
