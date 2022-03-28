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
import {INonfungiblePositionManager} from "@uniswap/v3-periphery/contracts/interfaces/INonfungiblePositionManager.sol";

// contract
import {UniswapControllerHelper} from "./UniswapControllerHelper.sol";
import {AaveControllerHelper} from "./AaveControllerHelper.sol";

// lib
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {ControllerHelperDataType} from "./lib/ControllerHelperDataType.sol";
import {ControllerHelperUtil} from "./lib/ControllerHelperUtil.sol";

contract ControllerHelper is UniswapControllerHelper, AaveControllerHelper, IERC721Receiver {
    using SafeMath for uint256;
    using Address for address payable;

    address public immutable controller;
    address public immutable oracle;
    address public immutable shortPowerPerp;
    address public immutable wPowerPerpPool;
    address public immutable wPowerPerp;
    address public immutable weth;
    address public immutable nonfungiblePositionManager;
    bool public immutable isWethToken0;

    constructor(
        address _controller,
        address _nonfungiblePositionManager,
        address _uniswapFactory,
        address _lendingPoolAddressProvider
    ) UniswapControllerHelper(_uniswapFactory) AaveControllerHelper(_lendingPoolAddressProvider) {
        controller = _controller;
        nonfungiblePositionManager = _nonfungiblePositionManager;
        isWethToken0 = IController(_controller).weth() < IController(_controller).wPowerPerp();

        oracle = IController(_controller).oracle();
        shortPowerPerp = IController(_controller).shortPowerPerp();
        wPowerPerpPool = IController(_controller).wPowerPerpPool();
        wPowerPerp = IController(_controller).wPowerPerp();
        weth = IController(_controller).weth();

        IWPowerPerp(IController(_controller).wPowerPerp()).approve(_nonfungiblePositionManager, type(uint256).max);
        IWETH9(IController(_controller).weth()).approve(_nonfungiblePositionManager, type(uint256).max);
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
    receive() external payable {}

    /**
     * @notice flash close position and buy long squeeth
     * @dev this function
     * @param _params ControllerHelperDataType.FlashswapWBurnBuyLongParams struct
     */
    function flashswapWBurnBuyLong(ControllerHelperDataType.FlashswapWBurnBuyLongParams calldata _params)
        external
        payable
    {
        if (_params.vaultId != 0) require(IShortPowerPerp(shortPowerPerp).ownerOf(_params.vaultId) == msg.sender);
        require(_params.maxToPay <= _params.collateralToWithdraw.add(msg.value));

        _exactOutFlashSwap(
            weth,
            wPowerPerp,
            IUniswapV3Pool(wPowerPerpPool).fee(),
            _params.wPowerPerpAmountToBurn.add(_params.wPowerPerpAmountToBuy),
            _params.maxToPay,
            uint8(ControllerHelperDataType.CALLBACK_SOURCE.FLASH_W_BURN),
            abi.encode(_params)
        );

        payable(msg.sender).sendValue(address(this).balance);
    }

    /**
     * @notice sell long wPowerPerp and flashswap mint short position
     * @dev flashswap amount = collateral amount - msg.value - ETH from selling long wPowerPerp
     * @param _params ControllerHelperDataType.FlashSellLongWMintParams struct
     */
    function flashswapSellLongWMint(ControllerHelperDataType.FlashSellLongWMintParams calldata _params)
        external
        payable
    {
        if (_params.vaultId != 0) require(IShortPowerPerp(shortPowerPerp).ownerOf(_params.vaultId) == msg.sender);

        IWPowerPerp(wPowerPerp).transferFrom(msg.sender, address(this), _params.wPowerPerpAmountToSell);

        // flashswap and mint short position
        _exactInFlashSwap(
            wPowerPerp,
            weth,
            IUniswapV3Pool(wPowerPerpPool).fee(),
            _params.wPowerPerpAmountToMint.add(_params.wPowerPerpAmountToSell),
            _params.minToReceive,
            uint8(ControllerHelperDataType.CALLBACK_SOURCE.FLASH_SELL_LONG_W_MINT),
            abi.encode(_params)
        );

        payable(msg.sender).sendValue(address(this).balance);
    }

    /**
     * @notice close short position with user Uniswap v3 LP NFT
     * @dev user should approve this contract for Uni NFT transfer
     * @param _params ControllerHelperDataType.CloseShortWithUserNftParams struct
     */
    function closeShortWithUserNft(ControllerHelperDataType.CloseShortWithUserNftParams calldata _params) external {
        if (_params.vaultId != 0) require(IShortPowerPerp(shortPowerPerp).ownerOf(_params.vaultId) == msg.sender);

        INonfungiblePositionManager(nonfungiblePositionManager).safeTransferFrom(
            msg.sender,
            address(this),
            _params.tokenId
        );

        // close LP position
        (uint256 wPowerPerpAmountInLp, ) = ControllerHelperUtil.closeUniLp(
            nonfungiblePositionManager,
            ControllerHelperDataType.closeUniLpParams({
                tokenId: _params.tokenId,
                liquidity: _params.liquidity,
                liquidityPercentage: _params.liquidityPercentage,
                amount0Min: _params.amount0Min,
                amount1Min: _params.amount1Min
            }),
            isWethToken0
        );

        // if LP position is not fully closed, redeposit in vault or send back to user
        ControllerHelperUtil.checkPartialLpClose(
            controller,
            nonfungiblePositionManager,
            0,
            _params.tokenId,
            _params.liquidityPercentage
        );

        // burn vault debt using amounts withdrawn from LP position
        _closeShortWithAmountsFromLp(
            _params.vaultId,
            wPowerPerpAmountInLp,
            _params.wPowerPerpAmountToBurn,
            _params.collateralToWithdraw,
            _params.limitPriceEthPerPowerPerp
        );

        ControllerHelperUtil.sendBack(weth, wPowerPerp);
    }

    function flashloanCloseVaultLpNft(ControllerHelperDataType.FlashloanCloseVaultLpNftParam calldata _params)
        external
        payable
    {
        if (_params.vaultId != 0) require(IShortPowerPerp(shortPowerPerp).ownerOf(_params.vaultId) == msg.sender);

        _flashLoan(
            weth,
            _params.collateralToFlashloan,
            uint8(ControllerHelperDataType.CALLBACK_SOURCE.FLASHLOAN_CLOSE_VAULT_LP_NFT),
            abi.encode(_params)
        );

        ControllerHelperUtil.sendBack(weth, wPowerPerp);
    }

    /**
     * @notice mint WPowerPerp and LP into Uniswap v3 pool
     * @param _params ControllerHelperDataType.MintAndLpParams struct
     */
    function batchMintLp(ControllerHelperDataType.MintAndLpParams calldata _params) external payable {
        if (_params.vaultId != 0) require(IShortPowerPerp(shortPowerPerp).ownerOf(_params.vaultId) == msg.sender);
        require(msg.value == _params.collateralToDeposit.add(_params.collateralToLp));

        (uint256 vaultId, ) = ControllerHelperUtil.mintAndLp(
            controller,
            nonfungiblePositionManager,
            wPowerPerp,
            wPowerPerpPool,
            _params,
            isWethToken0
        );

        // if openeded new vault, transfer vault NFT to user
        if (_params.vaultId == 0) IShortPowerPerp(shortPowerPerp).safeTransferFrom(address(this), msg.sender, vaultId);

        payable(msg.sender).sendValue(address(this).balance);
    }

    /**
     * @notice FLash mint short position, LP in Uni v3, use LP NFT as collateral and withdraw ETH collateral to repay flashloan
     * @dev sender can specify the amount of ETH collateral to withdraw in case vault.collateralAmount > ETH to repay for loan
     * @param _params ControllerHelperDataType.FlashloanWMintDepositNftParams struct
     */
    function flashloanWMintDepositNft(ControllerHelperDataType.FlashloanWMintDepositNftParams calldata _params)
        external
        payable
    {
        if (_params.vaultId != 0) require(IShortPowerPerp(shortPowerPerp).ownerOf(_params.vaultId) == msg.sender);
        _flashLoan(
            weth,
            _params.collateralToFlashloan,
            uint8(ControllerHelperDataType.CALLBACK_SOURCE.FLASHLOAN_W_MINT_DEPOSIT_NFT),
            abi.encode(_params)
        );
    }

    /**
     * @notice sell all LP wPowerPerp amounts to WETH and send back to user
     * @param _params ControllerHelperDataType.SellAll struct
     */
    function sellAll(ControllerHelperDataType.SellAll calldata _params) external {
        INonfungiblePositionManager(nonfungiblePositionManager).safeTransferFrom(
            msg.sender,
            address(this),
            _params.tokenId
        );

        // close LP NFT and get Weth and WPowerPerp amounts
        (uint256 wPowerPerpAmountInLp, ) = ControllerHelperUtil.closeUniLp(
            nonfungiblePositionManager,
            ControllerHelperDataType.closeUniLpParams({
                tokenId: _params.tokenId,
                liquidity: _params.liquidity,
                liquidityPercentage: 1e18,
                amount0Min: uint128(_params.amount0Min),
                amount1Min: uint128(_params.amount1Min)
            }),
            isWethToken0
        );

        if (wPowerPerpAmountInLp > 0) {
            _exactInFlashSwap(
                wPowerPerp,
                weth,
                IUniswapV3Pool(wPowerPerpPool).fee(),
                wPowerPerpAmountInLp,
                _params.limitPriceEthPerPowerPerp.mul(wPowerPerpAmountInLp).div(1e18),
                uint8(ControllerHelperDataType.CALLBACK_SOURCE.SWAP_EXACTIN_WPOWERPERP_ETH),
                ""
            );
        }

        ControllerHelperUtil.sendBack(weth, wPowerPerp);
    }

    /**
     * @notice Rebalance LP nft through trading
     * @param _params ControllerHelperDataType.RebalanceWithoutVault struct
     */
    function rebalanceWithoutVault(ControllerHelperDataType.RebalanceWithoutVault calldata _params) external payable {
        // if user need to send ETH to change LP composition, wrap to WETH
        if (msg.value > 0) IWETH9(weth).deposit{value: msg.value}();

        INonfungiblePositionManager(nonfungiblePositionManager).safeTransferFrom(
            msg.sender,
            address(this),
            _params.tokenId
        );

        // close LP NFT and get Weth and WPowerPerp amounts
        (uint256 wPowerPerpAmountInLp, ) = ControllerHelperUtil.closeUniLp(
            nonfungiblePositionManager,
            ControllerHelperDataType.closeUniLpParams({
                tokenId: _params.tokenId,
                liquidity: _params.liquidity,
                liquidityPercentage: 1e18,
                amount0Min: uint128(_params.amount0Min),
                amount1Min: uint128(_params.amount1Min)
            }),
            isWethToken0
        );

        if (_params.wPowerPerpAmountDesired > wPowerPerpAmountInLp) {
            // if the new position target a higher wPowerPerp amount, swap WETH to reach the desired amount (WETH new position is lower than current WETH in LP)
            _exactOutFlashSwap(
                weth,
                wPowerPerp,
                IUniswapV3Pool(wPowerPerpPool).fee(),
                _params.wPowerPerpAmountDesired.sub(wPowerPerpAmountInLp),
                _params.limitPriceEthPerPowerPerp.mul(_params.wPowerPerpAmountDesired.sub(wPowerPerpAmountInLp)).div(
                    1e18
                ),
                uint8(ControllerHelperDataType.CALLBACK_SOURCE.SWAP_EXACTOUT_ETH_WPOWERPERP),
                ""
            );
        } else if (_params.wPowerPerpAmountDesired < wPowerPerpAmountInLp) {
            // if the new position target lower wPowerPerp amount, swap excess to WETH (position target higher WETH amount)
            uint256 wPowerPerpExcess = wPowerPerpAmountInLp.sub(_params.wPowerPerpAmountDesired);

            _exactInFlashSwap(
                wPowerPerp,
                weth,
                IUniswapV3Pool(wPowerPerpPool).fee(),
                wPowerPerpExcess,
                _params.limitPriceEthPerPowerPerp.mul(wPowerPerpExcess).div(1e18),
                uint8(ControllerHelperDataType.CALLBACK_SOURCE.SWAP_EXACTIN_WPOWERPERP_ETH),
                ""
            );
        }

        // mint new position
        ControllerHelperUtil.lpWPowerPerpPool(
            controller,
            nonfungiblePositionManager,
            wPowerPerpPool,
            wPowerPerp,
            0,
            ControllerHelperDataType.LpWPowerPerpPool({
                recipient: msg.sender,
                ethAmount: _params.ethAmountToLp,
                amount0Desired: (isWethToken0) ? _params.wethAmountDesired : _params.wPowerPerpAmountDesired,
                amount1Desired: (isWethToken0) ? _params.wPowerPerpAmountDesired : _params.wethAmountDesired,
                amount0Min: _params.amount0DesiredMin,
                amount1Min: _params.amount1DesiredMin,
                lowerTick: _params.lowerTick,
                upperTick: _params.upperTick
            })
        );

        ControllerHelperUtil.sendBack(weth, wPowerPerp);
    }

    /**
     * @notice Rebalance, increase and decrease LP liquidity through minting/burning wPowerPerp in vault
     * @param _vaultId vault ID
     * @param _collateralToFlashloan collateral amount to flashloan and deposit into vault to be able to withdraw Uni LP NFT
     * @param _params array of ControllerHelperDataType.RebalanceVaultNftParams structs
     */
    function rebalanceVaultNft(
        uint256 _vaultId,
        uint256 _collateralToFlashloan,
        ControllerHelperDataType.RebalanceVaultNftParams[] calldata _params
    ) external payable {
        _flashLoan(
            weth,
            _collateralToFlashloan,
            uint8(ControllerHelperDataType.CALLBACK_SOURCE.FLASHLOAN_REBALANCE_VAULT_NFT),
            abi.encode(_vaultId, _params)
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
        if (
            ControllerHelperDataType.CALLBACK_SOURCE(_callSource) ==
            ControllerHelperDataType.CALLBACK_SOURCE.FLASHLOAN_W_MINT_DEPOSIT_NFT
        ) {
            ControllerHelperDataType.FlashloanWMintDepositNftParams memory data = abi.decode(
                _calldata,
                (ControllerHelperDataType.FlashloanWMintDepositNftParams)
            );

            // convert flashloaned WETH to ETH
            IWETH9(weth).withdraw(_amount);

            (uint256 vaultId, uint256 uniTokenId) = ControllerHelperUtil.mintAndLp(
                controller,
                nonfungiblePositionManager,
                wPowerPerp,
                wPowerPerpPool,
                ControllerHelperDataType.MintAndLpParams({
                    recipient: address(this),
                    vaultId: data.vaultId,
                    wPowerPerpAmount: data.wPowerPerpAmount,
                    collateralToDeposit: data.collateralToDeposit.add(data.collateralToFlashloan),
                    collateralToLp: data.collateralToLp,
                    amount0Min: data.lpAmount0Min,
                    amount1Min: data.lpAmount1Min,
                    lowerTick: data.lpLowerTick,
                    upperTick: data.lpUpperTick
                }),
                isWethToken0
            );

            // deposit Uni NFT token in vault
            INonfungiblePositionManager(nonfungiblePositionManager).approve(controller, uniTokenId);
            IController(controller).depositUniPositionToken(vaultId, uniTokenId);

            // remove flashloan amount in ETH from vault + any amount of collateral user want to withdraw (sum <= vault.collateralAmount)
            IController(controller).withdraw(vaultId, _amount.add(data.collateralToWithdraw));

            // convert flashloaned amount + fee from ETH to WETH to prepare for payback
            IWETH9(weth).deposit{value: _amount.add(_premium)}();

            // if openeded new vault, transfer vault NFT to user
            if (data.vaultId == 0) IShortPowerPerp(shortPowerPerp).safeTransferFrom(address(this), _initiator, vaultId);
        } else if (
            ControllerHelperDataType.CALLBACK_SOURCE(_callSource) ==
            ControllerHelperDataType.CALLBACK_SOURCE.FLASHLOAN_CLOSE_VAULT_LP_NFT
        ) {
            ControllerHelperDataType.FlashloanCloseVaultLpNftParam memory data = abi.decode(
                _calldata,
                (ControllerHelperDataType.FlashloanCloseVaultLpNftParam)
            );

            // convert flashloaned WETH to ETH
            IWETH9(weth).withdraw(_amount);

            IController(controller).deposit{value: _amount}(data.vaultId);

            IController(controller).withdrawUniPositionToken(data.vaultId);

            (uint256 wPowerPerpAmountInLp, ) = ControllerHelperUtil.closeUniLp(
                nonfungiblePositionManager,
                ControllerHelperDataType.closeUniLpParams({
                    tokenId: data.tokenId,
                    liquidity: data.liquidity,
                    liquidityPercentage: data.liquidityPercentage,
                    amount0Min: data.amount0Min,
                    amount1Min: data.amount1Min
                }),
                isWethToken0
            );

            ControllerHelperUtil.checkPartialLpClose(
                controller,
                nonfungiblePositionManager,
                data.vaultId,
                data.tokenId,
                data.liquidityPercentage
            );

            // close short position using amounts collected from closing LP, withdraw collateralToWithdraw + deposited collateralToFlashloan
            _closeShortWithAmountsFromLp(
                data.vaultId,
                wPowerPerpAmountInLp,
                data.wPowerPerpAmountToBurn,
                data.collateralToWithdraw.add(data.collateralToFlashloan),
                data.limitPriceEthPerPowerPerp
            );
        } else if (
            ControllerHelperDataType.CALLBACK_SOURCE(_callSource) ==
            ControllerHelperDataType.CALLBACK_SOURCE.FLASHLOAN_REBALANCE_VAULT_NFT
        ) {
            // convert flashloaned WETH to ETH
            IWETH9(weth).withdraw(_amount);

            (uint256 vaultId, ControllerHelperDataType.RebalanceVaultNftParams[] memory data) = abi.decode(
                _calldata,
                (uint256, ControllerHelperDataType.RebalanceVaultNftParams[])
            );

            // deposit collateral into vault and withdraw LP NFT
            IController(controller).deposit{value: _amount}(vaultId);
            IController(controller).withdrawUniPositionToken(vaultId);

            console.log("vaultId", vaultId);

            for (uint256 i; i < data.length; i++) {
                if (
                    data[i].rebalanceVaultNftType == ControllerHelperDataType.RebalanceVaultNftType.IncreaseLpLiquidity
                ) {
                    if (address(this).balance > 0) IWETH9(weth).deposit{value: address(this).balance}();

                    // increase liquidity in LP position, this can mint wPowerPerp and increase
                    ControllerHelperDataType.IncreaseLpLiquidityParam memory increaseLiquidityParam = abi.decode(
                        data[i].data,
                        (ControllerHelperDataType.IncreaseLpLiquidityParam)
                    );

                    ControllerHelperUtil.increaseLpLiquidity(
                        controller,
                        nonfungiblePositionManager,
                        wPowerPerp,
                        vaultId,
                        increaseLiquidityParam,
                        isWethToken0
                    );
                } else if (
                    data[i].rebalanceVaultNftType == ControllerHelperDataType.RebalanceVaultNftType.DecreaseLpLiquidity
                ) {
                    // decrease liquidity in LP
                    ControllerHelperDataType.DecreaseLpLiquidityParams memory decreaseLiquidityParam = abi.decode(
                        data[i].data,
                        (ControllerHelperDataType.DecreaseLpLiquidityParams)
                    );

                    ControllerHelperUtil.closeUniLp(
                        nonfungiblePositionManager,
                        ControllerHelperDataType.closeUniLpParams({
                            tokenId: decreaseLiquidityParam.tokenId,
                            liquidity: decreaseLiquidityParam.liquidity,
                            liquidityPercentage: decreaseLiquidityParam.liquidityPercentage,
                            amount0Min: decreaseLiquidityParam.amount0Min,
                            amount1Min: decreaseLiquidityParam.amount1Min
                        }),
                        isWethToken0
                    );
                } else if (
                    // this will execute if the use case is to mint in vault, deposit collateral in vault or mint + deposit
                    data[i].rebalanceVaultNftType == ControllerHelperDataType.RebalanceVaultNftType.MintIntoVault
                ) {
                    ControllerHelperDataType.MintIntoVault memory mintIntoVaultParams = abi.decode(
                        data[i].data,
                        (ControllerHelperDataType.MintIntoVault)
                    );

                    ControllerHelperUtil.mintIntoVault(
                        controller,
                        vaultId,
                        mintIntoVaultParams.wPowerPerpToMint,
                        mintIntoVaultParams.collateralToDeposit
                    );
                } else if (
                    // this will execute if the use case is to burn wPowerPerp, withdraw collateral or burn + withdraw
                    data[i].rebalanceVaultNftType == ControllerHelperDataType.RebalanceVaultNftType.WithdrawFromVault
                ) {
                    ControllerHelperDataType.withdrawFromVault memory withdrawFromVaultParams = abi.decode(
                        data[i].data,
                        (ControllerHelperDataType.withdrawFromVault)
                    );

                    ControllerHelperUtil.withdrawFromVault(
                        controller,
                        vaultId,
                        withdrawFromVaultParams.wPowerPerpToBurn,
                        withdrawFromVaultParams.collateralToWithdraw
                    );
                } else if (data[i].rebalanceVaultNftType == ControllerHelperDataType.RebalanceVaultNftType.MintNewLp) {
                    // this will execute in the use case of fully closing old LP position, and creating new one
                    ControllerHelperDataType.LpWPowerPerpPool memory mintNewLpParams = abi.decode(
                        data[i].data,
                        (ControllerHelperDataType.LpWPowerPerpPool)
                    );

                    uint256 tokenId = ControllerHelperUtil.lpWPowerPerpPool(
                        controller,
                        nonfungiblePositionManager,
                        wPowerPerpPool,
                        wPowerPerp,
                        vaultId,
                        mintNewLpParams
                    );

                    // deposit Uni NFT token in vault
                    INonfungiblePositionManager(nonfungiblePositionManager).approve(controller, tokenId);
                    IController(controller).depositUniPositionToken(vaultId, tokenId);
                }
            }

            // remove flashloan amount in ETH from vault + any amount of collateral user want to withdraw (sum <= vault.collateralAmount)
            IController(controller).withdraw(vaultId, _amount);

            // convert flashloaned amount + fee from ETH to WETH to prepare for payback
            IWETH9(weth).deposit{value: _amount.add(_premium)}();
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
        if (
            ControllerHelperDataType.CALLBACK_SOURCE(_callSource) ==
            ControllerHelperDataType.CALLBACK_SOURCE.FLASH_W_BURN
        ) {
            ControllerHelperDataType.FlashswapWBurnBuyLongParams memory data = abi.decode(
                _callData,
                (ControllerHelperDataType.FlashswapWBurnBuyLongParams)
            );

            IController(controller).burnWPowerPerpAmount(
                data.vaultId,
                data.wPowerPerpAmountToBurn,
                data.collateralToWithdraw
            );
            IWETH9(weth).deposit{value: _amountToPay}();
            IWETH9(weth).transfer(wPowerPerpPool, _amountToPay);
            IWPowerPerp(wPowerPerp).transfer(_caller, data.wPowerPerpAmountToBuy);
        } else if (
            ControllerHelperDataType.CALLBACK_SOURCE(_callSource) ==
            ControllerHelperDataType.CALLBACK_SOURCE.FLASH_SELL_LONG_W_MINT
        ) {
            ControllerHelperDataType.FlashSellLongWMintParams memory data = abi.decode(
                _callData,
                (ControllerHelperDataType.FlashSellLongWMintParams)
            );

            // convert WETH to ETH as Uniswap uses WETH
            IWETH9(weth).withdraw(IWETH9(weth).balanceOf(address(this)));

            uint256 vaultId = IController(controller).mintWPowerPerpAmount{value: data.collateralAmount}(
                data.vaultId,
                data.wPowerPerpAmountToMint,
                0
            );

            IWPowerPerp(wPowerPerp).transfer(wPowerPerpPool, _amountToPay);

            // this is a newly open vault, transfer to the user
            if (data.vaultId == 0) IShortPowerPerp(shortPowerPerp).safeTransferFrom(address(this), _caller, vaultId);
        } else if (
            ControllerHelperDataType.CALLBACK_SOURCE(_callSource) ==
            ControllerHelperDataType.CALLBACK_SOURCE.SWAP_EXACTIN_WPOWERPERP_ETH
        ) {
            IWPowerPerp(wPowerPerp).transfer(wPowerPerpPool, _amountToPay);

            IWETH9(weth).deposit{value: address(this).balance}();
        } else if (
            ControllerHelperDataType.CALLBACK_SOURCE(_callSource) ==
            ControllerHelperDataType.CALLBACK_SOURCE.SWAP_EXACTOUT_ETH_WPOWERPERP
        ) {
            IWETH9(weth).transfer(wPowerPerpPool, _amountToPay);
        } else if (
            ControllerHelperDataType.CALLBACK_SOURCE(_callSource) ==
            ControllerHelperDataType.CALLBACK_SOURCE.SWAP_EXACTOUT_ETH_WPOWERPERP_BURN
        ) {
            ControllerHelperDataType.SwapExactoutEthWPowerPerpData memory data = abi.decode(
                _callData,
                (ControllerHelperDataType.SwapExactoutEthWPowerPerpData)
            );

            IController(controller).burnWPowerPerpAmount(
                data.vaultId,
                data.wPowerPerpAmountToBurn,
                data.collateralToWithdraw
            );

            // at this level, we have some ETH from burnWPowerPerpAmount() and maybe WETH from closing LP position
            // need to convert all to WETH to make sure we using all available balance for flashswap and flashloan repayment
            IWETH9(weth).deposit{value: address(this).balance}();

            IWETH9(weth).transfer(wPowerPerpPool, _amountToPay);
        }
    }

    function _closeShortWithAmountsFromLp(
        uint256 _vaultId,
        uint256 _wPowerPerpAmount,
        uint256 _wPowerPerpAmountToBurn,
        uint256 _collateralToWithdraw,
        uint256 _limitPriceEthPerPowerPerp
    ) private {
        if (_wPowerPerpAmount < _wPowerPerpAmountToBurn) {
            // swap needed wPowerPerp amount to close short position
            _exactOutFlashSwap(
                weth,
                wPowerPerp,
                IUniswapV3Pool(wPowerPerpPool).fee(),
                _wPowerPerpAmountToBurn.sub(_wPowerPerpAmount),
                _limitPriceEthPerPowerPerp.mul(_wPowerPerpAmountToBurn.sub(_wPowerPerpAmount)).div(1e18),
                uint8(ControllerHelperDataType.CALLBACK_SOURCE.SWAP_EXACTOUT_ETH_WPOWERPERP_BURN),
                abi.encodePacked(_vaultId, _wPowerPerpAmountToBurn, _collateralToWithdraw)
            );
        } else {
            // if LP have more wPowerPerp amount that amount to burn in vault, sell remaining amount for WETH
            IController(controller).burnWPowerPerpAmount(_vaultId, _wPowerPerpAmountToBurn, _collateralToWithdraw);

            uint256 wPowerPerpExcess = _wPowerPerpAmount.sub(_wPowerPerpAmountToBurn);
            if (wPowerPerpExcess > 0) {
                _exactInFlashSwap(
                    wPowerPerp,
                    weth,
                    IUniswapV3Pool(wPowerPerpPool).fee(),
                    wPowerPerpExcess,
                    _limitPriceEthPerPowerPerp.mul(wPowerPerpExcess).div(1e18),
                    uint8(ControllerHelperDataType.CALLBACK_SOURCE.SWAP_EXACTIN_WPOWERPERP_ETH),
                    ""
                );
            }
        }
    }
}
