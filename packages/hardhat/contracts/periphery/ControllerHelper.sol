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
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// contract
import {UniswapControllerHelper} from "./UniswapControllerHelper.sol";
import {EulerControllerHelper} from "./EulerControllerHelper.sol";

// lib
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {ControllerHelperDataType} from "./lib/ControllerHelperDataType.sol";
import {ControllerHelperUtil} from "./lib/ControllerHelperUtil.sol";
import {ControllerHelperDiamondStorage} from "./lib/ControllerHelperDiamondStorage.sol";

contract ControllerHelper is UniswapControllerHelper, EulerControllerHelper, IERC721Receiver {
    using SafeMath for uint256;
    using Address for address payable;

    uint24 public immutable poolFee;
    bool public immutable isWethToken0;

    constructor(
        address _controller,
        address _nonfungiblePositionManager,
        address _uniswapFactory,
        address _exec,
        address _euler,
        address _dToken
    )
        UniswapControllerHelper(_uniswapFactory)
        EulerControllerHelper(_exec, _euler, IController(_controller).weth(), _dToken)
    {
        ControllerHelperDiamondStorage.setStorageVariables(
            _controller,
            IController(_controller).oracle(),
            IController(_controller).shortPowerPerp(),
            IController(_controller).wPowerPerpPool(),
            IController(_controller).wPowerPerp(),
            IController(_controller).weth(),
            _nonfungiblePositionManager
        );

        isWethToken0 = IController(_controller).weth() < IController(_controller).wPowerPerp();
        poolFee = IUniswapV3Pool(IController(_controller).wPowerPerpPool()).fee();

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
        require(
            IShortPowerPerp(ControllerHelperDiamondStorage.getAddressAtSlot(2)).ownerOf(_params.vaultId) == msg.sender
        );
        require(_params.maxToPay <= _params.collateralToWithdraw.add(msg.value));
        _exactOutFlashSwap(
            ControllerHelperDiamondStorage.getAddressAtSlot(5),
            ControllerHelperDiamondStorage.getAddressAtSlot(4),
            poolFee,
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
        if (_params.vaultId != 0)
            require(
                IShortPowerPerp(ControllerHelperDiamondStorage.getAddressAtSlot(2)).ownerOf(_params.vaultId) ==
                    msg.sender
            );
        IWPowerPerp(ControllerHelperDiamondStorage.getAddressAtSlot(4)).transferFrom(
            msg.sender,
            address(this),
            _params.wPowerPerpAmountToSell
        );
        // flashswap and mint short position
        _exactInFlashSwap(
            ControllerHelperDiamondStorage.getAddressAtSlot(4),
            ControllerHelperDiamondStorage.getAddressAtSlot(5),
            poolFee,
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
        require(
            IShortPowerPerp(ControllerHelperDiamondStorage.getAddressAtSlot(2)).ownerOf(_params.vaultId) == msg.sender
        );

        INonfungiblePositionManager(ControllerHelperDiamondStorage.getAddressAtSlot(6)).safeTransferFrom(
            msg.sender,
            address(this),
            _params.tokenId
        );

        // close LP position
        (uint256 wPowerPerpAmountInLp, ) = ControllerHelperUtil.closeUniLp(
            ControllerHelperDiamondStorage.getAddressAtSlot(6),
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
        ControllerHelperUtil.checkClosedLp(
            msg.sender,
            ControllerHelperDiamondStorage.getAddressAtSlot(0),
            ControllerHelperDiamondStorage.getAddressAtSlot(6),
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

        ControllerHelperUtil.sendBack(
            ControllerHelperDiamondStorage.getAddressAtSlot(5),
            ControllerHelperDiamondStorage.getAddressAtSlot(4)
        );
    }

    function flashloanCloseVaultLpNft(ControllerHelperDataType.FlashloanCloseVaultLpNftParam calldata _params)
        external
        payable
    {
        require(
            IShortPowerPerp(ControllerHelperDiamondStorage.getAddressAtSlot(2)).ownerOf(_params.vaultId) == msg.sender
        );

        _flashLoan(
            ControllerHelperDiamondStorage.getAddressAtSlot(5),
            _params.collateralToFlashloan,
            uint8(ControllerHelperDataType.CALLBACK_SOURCE.FLASHLOAN_CLOSE_VAULT_LP_NFT),
            abi.encode(_params)
        );

        ControllerHelperUtil.sendBack(
            ControllerHelperDiamondStorage.getAddressAtSlot(5),
            ControllerHelperDiamondStorage.getAddressAtSlot(4)
        );
    }

    /**
     * @notice mint WPowerPerp and LP into Uniswap v3 pool
     * @param _params ControllerHelperDataType.MintAndLpParams struct
     */
    function batchMintLp(ControllerHelperDataType.MintAndLpParams calldata _params) external payable {
        if (_params.vaultId != 0)
            require(
                IShortPowerPerp(ControllerHelperDiamondStorage.getAddressAtSlot(2)).ownerOf(_params.vaultId) ==
                    msg.sender
            );
        require(msg.value == _params.collateralToDeposit.add(_params.collateralToLp));

        (uint256 vaultId, ) = ControllerHelperUtil.mintAndLp(
            ControllerHelperDiamondStorage.getAddressAtSlot(0),
            ControllerHelperDiamondStorage.getAddressAtSlot(6),
            ControllerHelperDiamondStorage.getAddressAtSlot(4),
            ControllerHelperDiamondStorage.getAddressAtSlot(3),
            _params,
            isWethToken0
        );

        // if openeded new vault, transfer vault NFT to user
        if (_params.vaultId == 0)
            IShortPowerPerp(ControllerHelperDiamondStorage.getAddressAtSlot(2)).safeTransferFrom(
                address(this),
                msg.sender,
                vaultId
            );

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
        if (_params.vaultId != 0)
            require(
                IShortPowerPerp(ControllerHelperDiamondStorage.getAddressAtSlot(2)).ownerOf(_params.vaultId) ==
                    msg.sender
            );
        _flashLoan(
            ControllerHelperDiamondStorage.getAddressAtSlot(5),
            _params.collateralToFlashloan,
            uint8(ControllerHelperDataType.CALLBACK_SOURCE.FLASHLOAN_W_MINT_DEPOSIT_NFT),
            abi.encode(_params)
        );
    }

    /**
     * @notice sell all LP wPowerPerp amounts to WETH and send back to user
     * @param _params ControllerHelperDataType.ReduceLiquidityAndSell struct
     */
    function reduceLiquidityAndSell(ControllerHelperDataType.ReduceLiquidityAndSell calldata _params) external {
        INonfungiblePositionManager(ControllerHelperDiamondStorage.getAddressAtSlot(6)).safeTransferFrom(
            msg.sender,
            address(this),
            _params.tokenId
        );

        // close LP NFT and get Weth and WPowerPerp amounts
        (uint256 wPowerPerpAmountInLp, ) = ControllerHelperUtil.closeUniLp(
            ControllerHelperDiamondStorage.getAddressAtSlot(6),
            ControllerHelperDataType.closeUniLpParams({
                tokenId: _params.tokenId,
                liquidity: _params.liquidity,
                liquidityPercentage: _params.liquidityPercentage,
                amount0Min: uint128(_params.amount0Min),
                amount1Min: uint128(_params.amount1Min)
            }),
            isWethToken0
        );

        ControllerHelperUtil.checkClosedLp(
            msg.sender,
            ControllerHelperDiamondStorage.getAddressAtSlot(0),
            ControllerHelperDiamondStorage.getAddressAtSlot(6),
            0,
            _params.tokenId,
            _params.liquidityPercentage
        );

        if (wPowerPerpAmountInLp > 0) {
            _exactInFlashSwap(
                ControllerHelperDiamondStorage.getAddressAtSlot(4),
                ControllerHelperDiamondStorage.getAddressAtSlot(5),
                poolFee,
                wPowerPerpAmountInLp,
                _params.limitPriceEthPerPowerPerp.mul(wPowerPerpAmountInLp).div(1e18),
                uint8(ControllerHelperDataType.CALLBACK_SOURCE.SWAP_EXACTIN_WPOWERPERP_ETH),
                ""
            );
        }

        ControllerHelperUtil.sendBack(
            ControllerHelperDiamondStorage.getAddressAtSlot(5),
            ControllerHelperDiamondStorage.getAddressAtSlot(4)
        );
    }

    /**
     * @notice Rebalance LP nft through trading
     * @param _params ControllerHelperDataType.RebalanceWithoutVault struct
     */
    function rebalanceWithoutVault(ControllerHelperDataType.RebalanceWithoutVault calldata _params) external payable {
        // if user need to send ETH to change LP composition, wrap to WETH
        if (msg.value > 0) IWETH9(ControllerHelperDiamondStorage.getAddressAtSlot(5)).deposit{value: msg.value}();

        INonfungiblePositionManager(ControllerHelperDiamondStorage.getAddressAtSlot(6)).safeTransferFrom(
            msg.sender,
            address(this),
            _params.tokenId
        );

        // close LP NFT and get Weth and WPowerPerp amounts
        (uint256 wPowerPerpAmountInLp, ) = ControllerHelperUtil.closeUniLp(
            ControllerHelperDiamondStorage.getAddressAtSlot(6),
            ControllerHelperDataType.closeUniLpParams({
                tokenId: _params.tokenId,
                liquidity: _params.liquidity,
                liquidityPercentage: 1e18,
                amount0Min: uint128(_params.amount0Min),
                amount1Min: uint128(_params.amount1Min)
            }),
            isWethToken0
        );

        ControllerHelperUtil.checkClosedLp(
            msg.sender,
            ControllerHelperDiamondStorage.getAddressAtSlot(0),
            ControllerHelperDiamondStorage.getAddressAtSlot(6),
            0,
            _params.tokenId,
            1e18
        );

        if (_params.wPowerPerpAmountDesired > wPowerPerpAmountInLp) {
            // if the new position target a higher wPowerPerp amount, swap WETH to reach the desired amount (WETH new position is lower than current WETH in LP)
            _exactOutFlashSwap(
                ControllerHelperDiamondStorage.getAddressAtSlot(5),
                ControllerHelperDiamondStorage.getAddressAtSlot(4),
                poolFee,
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
                ControllerHelperDiamondStorage.getAddressAtSlot(4),
                ControllerHelperDiamondStorage.getAddressAtSlot(5),
                poolFee,
                wPowerPerpExcess,
                _params.limitPriceEthPerPowerPerp.mul(wPowerPerpExcess).div(1e18),
                uint8(ControllerHelperDataType.CALLBACK_SOURCE.SWAP_EXACTIN_WPOWERPERP_ETH),
                ""
            );
        }

        // mint new position
        ControllerHelperUtil.lpWPowerPerpPool(
            ControllerHelperDiamondStorage.getAddressAtSlot(0),
            ControllerHelperDiamondStorage.getAddressAtSlot(6),
            ControllerHelperDiamondStorage.getAddressAtSlot(3),
            ControllerHelperDiamondStorage.getAddressAtSlot(4),
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

        ControllerHelperUtil.sendBack(
            ControllerHelperDiamondStorage.getAddressAtSlot(5),
            ControllerHelperDiamondStorage.getAddressAtSlot(4)
        );
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
        // check ownership
        require(IShortPowerPerp(ControllerHelperDiamondStorage.getAddressAtSlot(2)).ownerOf(_vaultId) == msg.sender);

        _flashLoan(
            ControllerHelperDiamondStorage.getAddressAtSlot(5),
            _collateralToFlashloan,
            uint8(ControllerHelperDataType.CALLBACK_SOURCE.FLASHLOAN_REBALANCE_VAULT_NFT),
            abi.encode(_vaultId, _params)
        );

        ControllerHelperUtil.sendBack(
            ControllerHelperDiamondStorage.getAddressAtSlot(5),
            ControllerHelperDiamondStorage.getAddressAtSlot(4)
        );
    }

    function _flashCallback(
        address _initiator,
        address, /*_asset*/
        uint256 _amount,
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

            console.log("withdraw");
            console.log(IWETH9(ControllerHelperDiamondStorage.getAddressAtSlot(5)).balanceOf(address(this)));
            console.log(IWETH9(ControllerHelperDiamondStorage.getAddressAtSlot(5)).balanceOf(_initiator));
            console.log("_amount", _amount);

            // convert flashloaned WETH to ETH
            IWETH9(ControllerHelperDiamondStorage.getAddressAtSlot(5)).withdraw(_amount);

            (uint256 vaultId, uint256 uniTokenId) = ControllerHelperUtil.mintAndLp(
                ControllerHelperDiamondStorage.getAddressAtSlot(0),
                ControllerHelperDiamondStorage.getAddressAtSlot(6),
                ControllerHelperDiamondStorage.getAddressAtSlot(4),
                ControllerHelperDiamondStorage.getAddressAtSlot(3),
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
            INonfungiblePositionManager(ControllerHelperDiamondStorage.getAddressAtSlot(6)).approve(
                ControllerHelperDiamondStorage.getAddressAtSlot(0),
                uniTokenId
            );
            IController(ControllerHelperDiamondStorage.getAddressAtSlot(0)).depositUniPositionToken(
                vaultId,
                uniTokenId
            );

            // remove flashloan amount in ETH from vault + any amount of collateral user want to withdraw (sum <= vault.collateralAmount)
            IController(ControllerHelperDiamondStorage.getAddressAtSlot(0)).withdraw(
                vaultId,
                _amount.add(data.collateralToWithdraw)
            );

            // convert flashloaned amount + fee from ETH to WETH to prepare for payback
            IWETH9(ControllerHelperDiamondStorage.getAddressAtSlot(5)).deposit{value: _amount}();

            // if openeded new vault, transfer vault NFT to user
            if (data.vaultId == 0)
                IShortPowerPerp(ControllerHelperDiamondStorage.getAddressAtSlot(2)).safeTransferFrom(
                    address(this),
                    _initiator,
                    vaultId
                );
        } else if (
            ControllerHelperDataType.CALLBACK_SOURCE(_callSource) ==
            ControllerHelperDataType.CALLBACK_SOURCE.FLASHLOAN_CLOSE_VAULT_LP_NFT
        ) {
            ControllerHelperDataType.FlashloanCloseVaultLpNftParam memory data = abi.decode(
                _calldata,
                (ControllerHelperDataType.FlashloanCloseVaultLpNftParam)
            );

            // convert flashloaned WETH to ETH
            IWETH9(ControllerHelperDiamondStorage.getAddressAtSlot(5)).withdraw(_amount);

            IController(ControllerHelperDiamondStorage.getAddressAtSlot(0)).deposit{value: _amount}(data.vaultId);

            IController(ControllerHelperDiamondStorage.getAddressAtSlot(0)).withdrawUniPositionToken(data.vaultId);

            (uint256 wPowerPerpAmountInLp, ) = ControllerHelperUtil.closeUniLp(
                ControllerHelperDiamondStorage.getAddressAtSlot(6),
                ControllerHelperDataType.closeUniLpParams({
                    tokenId: data.tokenId,
                    liquidity: data.liquidity,
                    liquidityPercentage: data.liquidityPercentage,
                    amount0Min: data.amount0Min,
                    amount1Min: data.amount1Min
                }),
                isWethToken0
            );

            ControllerHelperUtil.checkClosedLp(
                _initiator,
                ControllerHelperDiamondStorage.getAddressAtSlot(0),
                ControllerHelperDiamondStorage.getAddressAtSlot(6),
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

            if (address(this).balance > 0) {
                // convert flashloaned amount + fee from ETH to WETH to prepare for payback
                IWETH9(ControllerHelperDiamondStorage.getAddressAtSlot(5)).deposit{value: address(this).balance}();
            }
        } else if (
            ControllerHelperDataType.CALLBACK_SOURCE(_callSource) ==
            ControllerHelperDataType.CALLBACK_SOURCE.FLASHLOAN_REBALANCE_VAULT_NFT
        ) {
            // convert flashloaned WETH to ETH
            IWETH9(ControllerHelperDiamondStorage.getAddressAtSlot(5)).withdraw(_amount);

            (uint256 vaultId, ControllerHelperDataType.RebalanceVaultNftParams[] memory data) = abi.decode(
                _calldata,
                (uint256, ControllerHelperDataType.RebalanceVaultNftParams[])
            );

            // deposit collateral into vault and withdraw LP NFT
            IController(ControllerHelperDiamondStorage.getAddressAtSlot(0)).deposit{value: _amount}(vaultId);
            IController(ControllerHelperDiamondStorage.getAddressAtSlot(0)).withdrawUniPositionToken(vaultId);

            for (uint256 i; i < data.length; i++) {
                if (
                    data[i].rebalanceVaultNftType == ControllerHelperDataType.RebalanceVaultNftType.IncreaseLpLiquidity
                ) {
                    if (address(this).balance > 0)
                        IWETH9(ControllerHelperDiamondStorage.getAddressAtSlot(5)).deposit{
                            value: address(this).balance
                        }();

                    // increase liquidity in LP position, this can mint wPowerPerp and increase
                    ControllerHelperDataType.IncreaseLpLiquidityParam memory increaseLiquidityParam = abi.decode(
                        data[i].data,
                        (ControllerHelperDataType.IncreaseLpLiquidityParam)
                    );

                    ControllerHelperUtil.increaseLpLiquidity(
                        ControllerHelperDiamondStorage.getAddressAtSlot(0),
                        ControllerHelperDiamondStorage.getAddressAtSlot(6),
                        ControllerHelperDiamondStorage.getAddressAtSlot(4),
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
                        ControllerHelperDiamondStorage.getAddressAtSlot(6),
                        ControllerHelperDataType.closeUniLpParams({
                            tokenId: decreaseLiquidityParam.tokenId,
                            liquidity: decreaseLiquidityParam.liquidity,
                            liquidityPercentage: decreaseLiquidityParam.liquidityPercentage,
                            amount0Min: decreaseLiquidityParam.amount0Min,
                            amount1Min: decreaseLiquidityParam.amount1Min
                        }),
                        isWethToken0
                    );

                    // if LP position is not fully closed, redeposit into vault or send back to user
                    ControllerHelperUtil.checkClosedLp(
                        _initiator,
                        ControllerHelperDiamondStorage.getAddressAtSlot(0),
                        ControllerHelperDiamondStorage.getAddressAtSlot(6),
                        vaultId,
                        decreaseLiquidityParam.tokenId,
                        decreaseLiquidityParam.liquidityPercentage
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
                        ControllerHelperDiamondStorage.getAddressAtSlot(0),
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
                        ControllerHelperDiamondStorage.getAddressAtSlot(0),
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
                        ControllerHelperDiamondStorage.getAddressAtSlot(0),
                        ControllerHelperDiamondStorage.getAddressAtSlot(6),
                        ControllerHelperDiamondStorage.getAddressAtSlot(3),
                        ControllerHelperDiamondStorage.getAddressAtSlot(4),
                        vaultId,
                        mintNewLpParams
                    );

                    // deposit Uni NFT token in vault
                    INonfungiblePositionManager(ControllerHelperDiamondStorage.getAddressAtSlot(6)).approve(
                        ControllerHelperDiamondStorage.getAddressAtSlot(0),
                        tokenId
                    );
                    IController(ControllerHelperDiamondStorage.getAddressAtSlot(0)).depositUniPositionToken(
                        vaultId,
                        tokenId
                    );
                } else if (
                    data[i].rebalanceVaultNftType == ControllerHelperDataType.RebalanceVaultNftType.generalSwap
                ) {
                    ControllerHelperDataType.GeneralSwap memory swapParams = abi.decode(
                        data[i].data,
                        (ControllerHelperDataType.GeneralSwap)
                    );

                    _exactInFlashSwap(
                        swapParams.tokenIn,
                        swapParams.tokenOut,
                        poolFee,
                        swapParams.amountIn,
                        swapParams.limitPriceEthPerPowerPerp.mul(swapParams.amountIn).div(1e18),
                        uint8(ControllerHelperDataType.CALLBACK_SOURCE.GENERAL_SWAP),
                        ""
                    );
                }
            }

            // remove flashloan amount in ETH from vault + any amount of collateral user want to withdraw (sum <= vault.collateralAmount)
            IController(ControllerHelperDiamondStorage.getAddressAtSlot(0)).withdraw(vaultId, _amount);

            // convert flashloaned amount + fee from ETH to WETH to prepare for payback
            IWETH9(ControllerHelperDiamondStorage.getAddressAtSlot(5)).deposit{value: _amount}();
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
        address _tokenIn,
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
            IController(ControllerHelperDiamondStorage.getAddressAtSlot(0)).burnWPowerPerpAmount(
                data.vaultId,
                data.wPowerPerpAmountToBurn,
                data.collateralToWithdraw
            );
            IWETH9(ControllerHelperDiamondStorage.getAddressAtSlot(5)).deposit{value: _amountToPay}();
            IWETH9(ControllerHelperDiamondStorage.getAddressAtSlot(5)).transfer(
                ControllerHelperDiamondStorage.getAddressAtSlot(3),
                _amountToPay
            );
            IWPowerPerp(ControllerHelperDiamondStorage.getAddressAtSlot(4)).transfer(
                _caller,
                data.wPowerPerpAmountToBuy
            );
        } else if (
            ControllerHelperDataType.CALLBACK_SOURCE(_callSource) ==
            ControllerHelperDataType.CALLBACK_SOURCE.FLASH_SELL_LONG_W_MINT
        ) {
            ControllerHelperDataType.FlashSellLongWMintParams memory data = abi.decode(
                _callData,
                (ControllerHelperDataType.FlashSellLongWMintParams)
            );

            // convert WETH to ETH as Uniswap uses WETH
            IWETH9(ControllerHelperDiamondStorage.getAddressAtSlot(5)).withdraw(
                IWETH9(ControllerHelperDiamondStorage.getAddressAtSlot(5)).balanceOf(address(this))
            );

            uint256 vaultId = IController(ControllerHelperDiamondStorage.getAddressAtSlot(0)).mintWPowerPerpAmount{
                value: data.collateralAmount
            }(data.vaultId, data.wPowerPerpAmountToMint, 0);

            IWPowerPerp(ControllerHelperDiamondStorage.getAddressAtSlot(4)).transfer(
                ControllerHelperDiamondStorage.getAddressAtSlot(3),
                _amountToPay
            );

            // this is a newly open vault, transfer to the user
            if (data.vaultId == 0)
                IShortPowerPerp(ControllerHelperDiamondStorage.getAddressAtSlot(2)).safeTransferFrom(
                    address(this),
                    _caller,
                    vaultId
                );
        } else if (
            ControllerHelperDataType.CALLBACK_SOURCE(_callSource) ==
            ControllerHelperDataType.CALLBACK_SOURCE.SWAP_EXACTIN_WPOWERPERP_ETH
        ) {
            IWPowerPerp(ControllerHelperDiamondStorage.getAddressAtSlot(4)).transfer(
                ControllerHelperDiamondStorage.getAddressAtSlot(3),
                _amountToPay
            );

            IWETH9(ControllerHelperDiamondStorage.getAddressAtSlot(5)).deposit{value: address(this).balance}();
        } else if (
            ControllerHelperDataType.CALLBACK_SOURCE(_callSource) ==
            ControllerHelperDataType.CALLBACK_SOURCE.SWAP_EXACTOUT_ETH_WPOWERPERP
        ) {
            IWETH9(ControllerHelperDiamondStorage.getAddressAtSlot(5)).transfer(
                ControllerHelperDiamondStorage.getAddressAtSlot(3),
                _amountToPay
            );
        } else if (
            ControllerHelperDataType.CALLBACK_SOURCE(_callSource) ==
            ControllerHelperDataType.CALLBACK_SOURCE.SWAP_EXACTOUT_ETH_WPOWERPERP_BURN
        ) {
            ControllerHelperDataType.SwapExactoutEthWPowerPerpData memory data = abi.decode(
                _callData,
                (ControllerHelperDataType.SwapExactoutEthWPowerPerpData)
            );

            IController(ControllerHelperDiamondStorage.getAddressAtSlot(0)).burnWPowerPerpAmount(
                data.vaultId,
                data.wPowerPerpAmountToBurn,
                data.collateralToWithdraw
            );

            // at this level, we have some ETH from burnWPowerPerpAmount() and maybe WETH from closing LP position
            // need to convert all to WETH to make sure we using all available balance for flashswap and flashloan repayment
            IWETH9(ControllerHelperDiamondStorage.getAddressAtSlot(5)).deposit{value: address(this).balance}();

            IWETH9(ControllerHelperDiamondStorage.getAddressAtSlot(5)).transfer(
                ControllerHelperDiamondStorage.getAddressAtSlot(3),
                _amountToPay
            );
        } else if (
            ControllerHelperDataType.CALLBACK_SOURCE(_callSource) ==
            ControllerHelperDataType.CALLBACK_SOURCE.GENERAL_SWAP
        ) {
            IWETH9(ControllerHelperDiamondStorage.getAddressAtSlot(5)).deposit{value: address(this).balance}();
            IERC20(_tokenIn).transfer(ControllerHelperDiamondStorage.getAddressAtSlot(3), _amountToPay);
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
                ControllerHelperDiamondStorage.getAddressAtSlot(5),
                ControllerHelperDiamondStorage.getAddressAtSlot(4),
                poolFee,
                _wPowerPerpAmountToBurn.sub(_wPowerPerpAmount),
                _limitPriceEthPerPowerPerp.mul(_wPowerPerpAmountToBurn.sub(_wPowerPerpAmount)).div(1e18),
                uint8(ControllerHelperDataType.CALLBACK_SOURCE.SWAP_EXACTOUT_ETH_WPOWERPERP_BURN),
                abi.encodePacked(_vaultId, _wPowerPerpAmountToBurn, _collateralToWithdraw)
            );
        } else {
            // if LP have more wPowerPerp amount that amount to burn in vault, sell remaining amount for WETH
            IController(ControllerHelperDiamondStorage.getAddressAtSlot(0)).burnWPowerPerpAmount(
                _vaultId,
                _wPowerPerpAmountToBurn,
                _collateralToWithdraw
            );

            uint256 wPowerPerpExcess = _wPowerPerpAmount.sub(_wPowerPerpAmountToBurn);
            if (wPowerPerpExcess > 0) {
                _exactInFlashSwap(
                    ControllerHelperDiamondStorage.getAddressAtSlot(4),
                    ControllerHelperDiamondStorage.getAddressAtSlot(5),
                    poolFee,
                    wPowerPerpExcess,
                    _limitPriceEthPerPowerPerp.mul(wPowerPerpExcess).div(1e18),
                    uint8(ControllerHelperDataType.CALLBACK_SOURCE.SWAP_EXACTIN_WPOWERPERP_ETH),
                    ""
                );
            }
        }
    }
}
