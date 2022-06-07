//SPDX-License-Identifier: BUSL-1.1

pragma solidity =0.7.6;
pragma abicoder v2;

// interface
import {IWETH9} from "../interfaces/IWETH9.sol";
import {IWPowerPerp} from "../interfaces/IWPowerPerp.sol";
import {IShortPowerPerp} from "../interfaces/IShortPowerPerp.sol";
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
import {VaultLib} from "../libs/VaultLib.sol";

contract ControllerHelper is UniswapControllerHelper, EulerControllerHelper, IERC721Receiver {
    using SafeMath for uint256;
    using Address for address payable;

    bool private immutable isWethToken0;
    address private immutable controller;
    address private immutable shortPowerPerp;
    address private immutable wPowerPerp;
    address private immutable weth;
    address private immutable nonfungiblePositionManager;

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
        controller = _controller;
        shortPowerPerp = IController(_controller).shortPowerPerp();
        wPowerPerp = IController(_controller).wPowerPerp();
        weth = IController(_controller).weth();
        nonfungiblePositionManager = _nonfungiblePositionManager;

        isWethToken0 = IController(_controller).weth() < IController(_controller).wPowerPerp();

        IWPowerPerp(IController(_controller).wPowerPerp()).approve(_nonfungiblePositionManager, type(uint256).max);
        IWETH9(IController(_controller).weth()).approve(_nonfungiblePositionManager, type(uint256).max);

        INonfungiblePositionManager(_nonfungiblePositionManager).setApprovalForAll(_controller, true);
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
        _checkAccess(_params.vaultId);

        require(_params.maxToPay <= _params.collateralToWithdraw.add(msg.value));

        wrapInternal(msg.value);

        _exactOutFlashSwap(
            weth,
            wPowerPerp,
            _params.poolFee,
            _params.wPowerPerpAmountToBurn.add(_params.wPowerPerpAmountToBuy),
            _params.maxToPay,
            uint8(ControllerHelperDataType.CALLBACK_SOURCE.FLASH_W_BURN),
            abi.encode(_params)
        );

        ControllerHelperUtil.sendBack(weth, wPowerPerp);
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
        if (_params.vaultId != 0) {
            _checkAccess(_params.vaultId);
        }

        wrapInternal(msg.value);
        IWPowerPerp(wPowerPerp).transferFrom(msg.sender, address(this), _params.wPowerPerpAmountToSell);
        // flashswap and mint short position
        uint256 totalAmountIn = _params.wPowerPerpAmountToMint.add(_params.wPowerPerpAmountToSell);
        _exactInFlashSwap(
            wPowerPerp,
            weth,
            _params.poolFee,
            totalAmountIn,
            _params.minToReceive,
            uint8(ControllerHelperDataType.CALLBACK_SOURCE.FLASH_SELL_LONG_W_MINT),
            abi.encode(_params)
        );
        ControllerHelperUtil.sendBack(weth, wPowerPerp);
    }

    /**
     * @notice close short position with user Uniswap v3 LP NFT
     * @dev user should approve this contract for Uni NFT transfer
     * @param _params ControllerHelperDataType.CloseShortWithUserNftParams struct
     */
    function closeShortWithUserNft(ControllerHelperDataType.CloseShortWithUserNftParams calldata _params)
        external
        payable
    {
        _checkAccess(_params.vaultId);

        INonfungiblePositionManager(nonfungiblePositionManager).safeTransferFrom(
            msg.sender,
            address(this),
            _params.tokenId
        );

        wrapInternal(msg.value);

        // close LP position
        (uint256 wPowerPerpAmountInLp, ) = ControllerHelperUtil.closeUniLp(
            nonfungiblePositionManager,
            ControllerHelperDataType.CloseUniLpParams({
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
            _params.limitPriceEthPerPowerPerp,
            _params.poolFee,
            _params.burnExactRemoved
        );

        ControllerHelperUtil.sendBack(weth, wPowerPerp);
    }

    function flashloanCloseVaultLpNft(ControllerHelperDataType.FlashloanCloseVaultLpNftParam calldata _params)
        external
        payable
    {
        _checkAccess(_params.vaultId);

        wrapInternal(msg.value);
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
    function wMintLp(ControllerHelperDataType.MintAndLpParams calldata _params) external payable {
        if (_params.vaultId != 0) {
            _checkAccess(_params.vaultId);
        }
        require(msg.value == _params.collateralToDeposit.add(_params.collateralToLp));

        wrapInternal(msg.value);

        (uint256 vaultId, ) = ControllerHelperUtil.mintAndLp(
            controller,
            nonfungiblePositionManager,
            wPowerPerp,
            weth,
            _params,
            isWethToken0
        );

        // if openeded new vault, transfer vault NFT to user
        if (_params.vaultId == 0) IShortPowerPerp(shortPowerPerp).safeTransferFrom(address(this), msg.sender, vaultId);

        ControllerHelperUtil.sendBack(weth, wPowerPerp);
    }

    /**
     * @notice FLash mint short position, LP in Uni v3, use LP NFT as collateral and withdraw ETH collateral to repay flashloan
     * @dev sender can specify the amount of ETH collateral to withdraw in case vault.collateralAmount > ETH to repay for loan
     * @param _params ControllerHelperDataType.FlashloanWMintLpDepositNftParams struct
     */
    function flashloanWMintLpDepositNft(ControllerHelperDataType.FlashloanWMintLpDepositNftParams calldata _params)
        external
        payable
    {
        if (_params.vaultId != 0) {
            _checkAccess(_params.vaultId);
        }

        wrapInternal(msg.value);
        _flashLoan(
            weth,
            _params.collateralToFlashloan,
            uint8(ControllerHelperDataType.CALLBACK_SOURCE.FLASHLOAN_W_MINT_LP_DEPOSIT_NFT),
            abi.encode(_params)
        );

        ControllerHelperUtil.sendBack(weth, wPowerPerp);
    }

    /**
     * @notice sell all LP wPowerPerp amounts to WETH and send back to user
     * @param _params ControllerHelperDataType.ReduceLiquidityAndSellParams struct
     */
    function reduceLiquidityAndSell(ControllerHelperDataType.ReduceLiquidityAndSellParams calldata _params) external {
        INonfungiblePositionManager(nonfungiblePositionManager).safeTransferFrom(
            msg.sender,
            address(this),
            _params.tokenId
        );

        // close LP NFT and get Weth and WPowerPerp amounts
        (uint256 wPowerPerpAmountInLp, ) = ControllerHelperUtil.closeUniLp(
            nonfungiblePositionManager,
            ControllerHelperDataType.CloseUniLpParams({
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
            controller,
            nonfungiblePositionManager,
            0,
            _params.tokenId,
            _params.liquidityPercentage
        );

        if (wPowerPerpAmountInLp > 0) {
            _exactInFlashSwap(
                wPowerPerp,
                weth,
                _params.poolFee,
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
     * @param _params ControllerHelperDataType.RebalanceLpWithoutVaultParams struct
     */
    function rebalanceLpWithoutVault(ControllerHelperDataType.RebalanceLpWithoutVaultParams calldata _params)
        external
        payable
    {
        wrapInternal(msg.value);
        INonfungiblePositionManager(nonfungiblePositionManager).safeTransferFrom(
            msg.sender,
            address(this),
            _params.tokenId
        );
        // close LP NFT and get Weth and WPowerPerp amounts
        (uint256 wPowerPerpAmountInLp, ) = ControllerHelperUtil.closeUniLp(
            nonfungiblePositionManager,
            ControllerHelperDataType.CloseUniLpParams({
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
            controller,
            nonfungiblePositionManager,
            0,
            _params.tokenId,
            1e18
        );

        uint256 wethAmountDesired;
        uint256 wPowerPerpAmountDesired;

        if (isWethToken0) {
            (wethAmountDesired, wPowerPerpAmountDesired) = ControllerHelperUtil.getAmountsToLp(
                _params.wPowerPerpPool,
                _params.wethAmountDesired,
                _params.wPowerPerpAmountDesired,
                _params.lowerTick,
                _params.upperTick,
                isWethToken0
            );
        } else {
            (wPowerPerpAmountDesired, wethAmountDesired) = ControllerHelperUtil.getAmountsToLp(
                _params.wPowerPerpPool,
                _params.wethAmountDesired,
                _params.wPowerPerpAmountDesired,
                _params.lowerTick,
                _params.upperTick,
                isWethToken0
            );
        }

        if (wPowerPerpAmountDesired > wPowerPerpAmountInLp) {
            // if the new position target a higher wPowerPerp amount, swap WETH to reach the desired amount (WETH new position is lower than current WETH in LP)
            _exactOutFlashSwap(
                weth,
                wPowerPerp,
                _params.poolFee,
                wPowerPerpAmountDesired.sub(wPowerPerpAmountInLp),
                _params.limitPriceEthPerPowerPerp.mul(wPowerPerpAmountDesired.sub(wPowerPerpAmountInLp)).div(1e18),
                uint8(ControllerHelperDataType.CALLBACK_SOURCE.SWAP_EXACTOUT_ETH_WPOWERPERP),
                ""
            );
        } else if (wPowerPerpAmountDesired < wPowerPerpAmountInLp) {
            // if the new position target lower wPowerPerp amount, swap excess to WETH (position target higher WETH amount)
            uint256 wPowerPerpExcess = wPowerPerpAmountInLp.sub(wPowerPerpAmountDesired);
            _exactInFlashSwap(
                wPowerPerp,
                weth,
                _params.poolFee,
                wPowerPerpExcess,
                _params.limitPriceEthPerPowerPerp.mul(wPowerPerpExcess).div(1e18),
                uint8(ControllerHelperDataType.CALLBACK_SOURCE.SWAP_EXACTIN_WPOWERPERP_ETH),
                ""
            );
        }

        // mint new position
        ControllerHelperUtil.lpWPowerPerpPool(
            nonfungiblePositionManager,
            _params.wPowerPerpPool,
            ControllerHelperDataType.LpWPowerPerpPoolParams({
                recipient: msg.sender,
                amount0Desired: (isWethToken0) ? wethAmountDesired : wPowerPerpAmountDesired,
                amount1Desired: (isWethToken0) ? wPowerPerpAmountDesired : wethAmountDesired,
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
     * @param _params array of ControllerHelperDataType.RebalanceLpInVaultParams structs
     */
    function rebalanceLpInVault(
        uint256 _vaultId,
        uint256 _collateralToFlashloan,
        ControllerHelperDataType.RebalanceLpInVaultParams[] calldata _params
    ) external payable {
        // check ownership
        _checkAccess(_vaultId);

        wrapInternal(msg.value);
        _flashLoan(
            weth,
            _collateralToFlashloan,
            uint8(ControllerHelperDataType.CALLBACK_SOURCE.FLASHLOAN_REBALANCE_LP_IN_VAULT),
            abi.encode(_vaultId, _params)
        );

        require(INonfungiblePositionManager(nonfungiblePositionManager).balanceOf(address(this)) == 0);

        ControllerHelperUtil.sendBack(weth, wPowerPerp);
    }

    /**
     * @notice checks if the msg.sender is the owener of the vault
     * @param _vaultId vault ID
     */
    function _checkAccess(uint256 _vaultId) internal view {
        require(IShortPowerPerp(shortPowerPerp).ownerOf(_vaultId) == msg.sender);
    }

    /**
     * @notice gets the shortAmount that has been minted from a vault
     * @param _vaultId vault ID
     * @return short amount from vault
     */

    function _getVaultShortAmount(uint256 _vaultId) internal view returns (uint256) {
        VaultLib.Vault memory vault = IController(controller).vaults(_vaultId);

        return vault.shortAmount;
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
            ControllerHelperDataType.CALLBACK_SOURCE.FLASHLOAN_W_MINT_LP_DEPOSIT_NFT
        ) {
            ControllerHelperDataType.FlashloanWMintLpDepositNftParams memory data = abi.decode(
                _calldata,
                (ControllerHelperDataType.FlashloanWMintLpDepositNftParams)
            );

            (uint256 vaultId, uint256 uniTokenId) = ControllerHelperUtil.mintAndLp(
                controller,
                nonfungiblePositionManager,
                wPowerPerp,
                weth,
                ControllerHelperDataType.MintAndLpParams({
                    recipient: address(this),
                    wPowerPerpPool: data.wPowerPerpPool,
                    vaultId: data.vaultId,
                    wPowerPerpAmount: data.wPowerPerpAmount,
                    collateralToDeposit: data.collateralToDeposit,
                    collateralToLp: data.collateralToLp,
                    amount0Min: data.amount0Min,
                    amount1Min: data.amount1Min,
                    lowerTick: data.lowerTick,
                    upperTick: data.upperTick
                }),
                isWethToken0
            );

            // deposit Uni NFT token in vault
            IController(controller).depositUniPositionToken(vaultId, uniTokenId);

            ControllerHelperUtil.burnWithdrawFromVault(
                controller,
                weth,
                vaultId,
                0,
                _amount.add(data.collateralToWithdraw)
            );

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

            IWETH9(weth).withdraw(_amount);
            IController(controller).deposit{value: _amount}(data.vaultId);

            IController(controller).withdrawUniPositionToken(data.vaultId);

            (uint256 wPowerPerpAmountInLp, ) = ControllerHelperUtil.closeUniLp(
                nonfungiblePositionManager,
                ControllerHelperDataType.CloseUniLpParams({
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
                data.limitPriceEthPerPowerPerp,
                data.poolFee,
                data.burnExactRemoved
            );
        } else if (
            ControllerHelperDataType.CALLBACK_SOURCE(_callSource) ==
            ControllerHelperDataType.CALLBACK_SOURCE.FLASHLOAN_REBALANCE_LP_IN_VAULT
        ) {
            (uint256 vaultId, ControllerHelperDataType.RebalanceLpInVaultParams[] memory data) = abi.decode(
                _calldata,
                (uint256, ControllerHelperDataType.RebalanceLpInVaultParams[])
            );

            // deposit collateral into vault and withdraw LP NFT
            IWETH9(weth).withdraw(_amount);
            IController(controller).deposit{value: _amount}(vaultId);
            IController(controller).withdrawUniPositionToken(vaultId);
            for (uint256 i; i < data.length; i++) {
                if (
                    data[i].rebalanceLpInVaultType == ControllerHelperDataType.RebalanceVaultNftType.IncreaseLpLiquidity
                ) {
                    // increase liquidity in LP position, this can mint wPowerPerp and increase
                    ControllerHelperDataType.IncreaseLpLiquidityParams memory increaseLiquidityParam = abi.decode(
                        data[i].data,
                        (ControllerHelperDataType.IncreaseLpLiquidityParams)
                    );

                    ControllerHelperUtil.increaseLpLiquidity(
                        controller,
                        nonfungiblePositionManager,
                        wPowerPerp,
                        increaseLiquidityParam.wPowerPerpPool,
                        vaultId,
                        increaseLiquidityParam,
                        isWethToken0
                    );

                    IController(controller).depositUniPositionToken(vaultId, increaseLiquidityParam.tokenId);
                } else if (
                    data[i].rebalanceLpInVaultType == ControllerHelperDataType.RebalanceVaultNftType.DecreaseLpLiquidity
                ) {
                    // decrease liquidity in LP
                    ControllerHelperDataType.DecreaseLpLiquidityParams memory decreaseLiquidityParam = abi.decode(
                        data[i].data,
                        (ControllerHelperDataType.DecreaseLpLiquidityParams)
                    );

                    ControllerHelperUtil.closeUniLp(
                        nonfungiblePositionManager,
                        ControllerHelperDataType.CloseUniLpParams({
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
                        controller,
                        nonfungiblePositionManager,
                        vaultId,
                        decreaseLiquidityParam.tokenId,
                        decreaseLiquidityParam.liquidityPercentage
                    );
                } else if (
                    data[i].rebalanceLpInVaultType == ControllerHelperDataType.RebalanceVaultNftType.DepositIntoVault
                ) {
                    ControllerHelperDataType.DepositIntoVaultParams memory depositIntoVaultParams = abi.decode(
                        data[i].data,
                        (ControllerHelperDataType.DepositIntoVaultParams)
                    );

                    // make sure not to fail
                    // a user can ensure that the entire weth balance is deposited by using a sufficiently large depositIntoVaultParams.collateralToDeposit
                    uint256 currentBalance = IWETH9(weth).balanceOf(address(this));
                    if (currentBalance < depositIntoVaultParams.collateralToDeposit)
                        depositIntoVaultParams.collateralToDeposit = currentBalance;

                    ControllerHelperUtil.mintDepositInVault(
                        controller,
                        weth,
                        vaultId,
                        depositIntoVaultParams.wPowerPerpToMint,
                        depositIntoVaultParams.collateralToDeposit
                    );
                } else if (
                    // this will execute if the use case is to burn wPowerPerp, withdraw collateral or burn + withdraw
                    data[i].rebalanceLpInVaultType == ControllerHelperDataType.RebalanceVaultNftType.WithdrawFromVault
                ) {
                    ControllerHelperDataType.withdrawFromVaultParams memory withdrawFromVaultParams = abi.decode(
                        data[i].data,
                        (ControllerHelperDataType.withdrawFromVaultParams)
                    );

                    uint256 currentBalance = IWPowerPerp(wPowerPerp).balanceOf(address(this));

                    if (withdrawFromVaultParams.burnExactRemoved) {
                        uint256 shortAmount = _getVaultShortAmount(vaultId);
                        if (shortAmount < currentBalance) currentBalance = shortAmount;
                        ControllerHelperUtil.burnWithdrawFromVault(
                            controller,
                            weth,
                            vaultId,
                            currentBalance,
                            withdrawFromVaultParams.collateralToWithdraw
                        );
                    } else {
                        if (currentBalance < withdrawFromVaultParams.wPowerPerpToBurn)
                            withdrawFromVaultParams.wPowerPerpToBurn = currentBalance;
                        ControllerHelperUtil.burnWithdrawFromVault(
                            controller,
                            weth,
                            vaultId,
                            withdrawFromVaultParams.wPowerPerpToBurn,
                            withdrawFromVaultParams.collateralToWithdraw
                        );
                    }
                } else if (data[i].rebalanceLpInVaultType == ControllerHelperDataType.RebalanceVaultNftType.MintNewLp) {
                    // this will execute in the use case of fully closing old LP position, and creating new one
                    ControllerHelperDataType.MintAndLpParams memory mintAndLpParams = abi.decode(
                        data[i].data,
                        (ControllerHelperDataType.MintAndLpParams)
                    );

                    uint256 tokenId;
                    (vaultId, tokenId) = ControllerHelperUtil.mintAndLp(
                        controller,
                        nonfungiblePositionManager,
                        wPowerPerp,
                        weth,
                        mintAndLpParams,
                        isWethToken0
                    );
                    // deposit Uni NFT token in vault
                    IController(controller).depositUniPositionToken(vaultId, tokenId);
                } else if (
                    data[i].rebalanceLpInVaultType == ControllerHelperDataType.RebalanceVaultNftType.generalSwap
                ) {
                    ControllerHelperDataType.GeneralSwapParams memory swapParams = abi.decode(
                        data[i].data,
                        (ControllerHelperDataType.GeneralSwapParams)
                    );

                    require(
                        (swapParams.tokenIn == weth && swapParams.tokenOut == wPowerPerp) ||
                            (swapParams.tokenIn == wPowerPerp && swapParams.tokenOut == weth)
                    );

                    _exactInFlashSwap(
                        swapParams.tokenIn,
                        swapParams.tokenOut,
                        swapParams.poolFee,
                        swapParams.amountIn,
                        swapParams.limitPrice.mul(swapParams.amountIn).div(1e18),
                        uint8(ControllerHelperDataType.CALLBACK_SOURCE.GENERAL_SWAP),
                        ""
                    );
                } else if (
                    data[i].rebalanceLpInVaultType == ControllerHelperDataType.RebalanceVaultNftType.CollectFees
                ) {
                    ControllerHelperDataType.CollectFeesParams memory collectFeesParams = abi.decode(
                        data[i].data,
                        (ControllerHelperDataType.CollectFeesParams)
                    );

                    INonfungiblePositionManager.CollectParams memory collectParams = INonfungiblePositionManager
                        .CollectParams({
                            tokenId: collectFeesParams.tokenId,
                            recipient: address(this),
                            amount0Max: collectFeesParams.amount0Max,
                            amount1Max: collectFeesParams.amount0Max
                        });

                    INonfungiblePositionManager(nonfungiblePositionManager).collect(collectParams);
                } else if (
                    data[i].rebalanceLpInVaultType == ControllerHelperDataType.RebalanceVaultNftType.DepositExistingNft
                ) {
                    ControllerHelperDataType.DepositExistingNftParams memory depositExistingNftParams = abi.decode(
                        data[i].data,
                        (ControllerHelperDataType.DepositExistingNftParams)
                    );

                    IController(controller).depositUniPositionToken(vaultId, depositExistingNftParams.tokenId);
                }
            }

            // remove flashloan amount in ETH from vault + any amount of collateral user want to withdraw (sum <= vault.collateralAmount)
            ControllerHelperUtil.burnWithdrawFromVault(controller, weth, vaultId, 0, _amount);
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
        address _pool,
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

            ControllerHelperUtil.burnWithdrawFromVault(
                controller,
                weth,
                data.vaultId,
                data.wPowerPerpAmountToBurn,
                data.collateralToWithdraw
            );

            IWETH9(weth).transfer(_pool, _amountToPay);
        } else if (
            ControllerHelperDataType.CALLBACK_SOURCE(_callSource) ==
            ControllerHelperDataType.CALLBACK_SOURCE.FLASH_SELL_LONG_W_MINT
        ) {
            ControllerHelperDataType.FlashSellLongWMintParams memory data = abi.decode(
                _callData,
                (ControllerHelperDataType.FlashSellLongWMintParams)
            );

            if (data.wPowerPerpAmountToMint > 0 || data.collateralToDeposit > 0) {
                uint256 vaultId = ControllerHelperUtil.mintDepositInVault(
                    controller,
                    weth,
                    data.vaultId,
                    data.wPowerPerpAmountToMint,
                    data.collateralToDeposit
                );

                // this is a newly open vault, transfer to the user
                if (data.vaultId == 0)
                    IShortPowerPerp(shortPowerPerp).safeTransferFrom(address(this), _caller, vaultId);
            }

            IWPowerPerp(wPowerPerp).transfer(_pool, _amountToPay);
        } else if (
            ControllerHelperDataType.CALLBACK_SOURCE(_callSource) ==
            ControllerHelperDataType.CALLBACK_SOURCE.SWAP_EXACTIN_WPOWERPERP_ETH
        ) {
            IWPowerPerp(wPowerPerp).transfer(_pool, _amountToPay);
        } else if (
            ControllerHelperDataType.CALLBACK_SOURCE(_callSource) ==
            ControllerHelperDataType.CALLBACK_SOURCE.SWAP_EXACTOUT_ETH_WPOWERPERP
        ) {
            IWETH9(weth).transfer(_pool, _amountToPay);
        } else if (
            ControllerHelperDataType.CALLBACK_SOURCE(_callSource) ==
            ControllerHelperDataType.CALLBACK_SOURCE.SWAP_EXACTOUT_ETH_WPOWERPERP_BURN
        ) {
            ControllerHelperDataType.SwapExactoutEthWPowerPerpData memory data = abi.decode(
                _callData,
                (ControllerHelperDataType.SwapExactoutEthWPowerPerpData)
            );

            ControllerHelperUtil.burnWithdrawFromVault(
                controller,
                weth,
                data.vaultId,
                data.wPowerPerpAmountToBurn,
                data.collateralToWithdraw
            );

            IWETH9(weth).transfer(_pool, _amountToPay);
        } else if (
            ControllerHelperDataType.CALLBACK_SOURCE(_callSource) ==
            ControllerHelperDataType.CALLBACK_SOURCE.GENERAL_SWAP
        ) {
            IERC20(_tokenIn).transfer(_pool, _amountToPay);
        }
    }

    /**
     * @notice wrap ETH to WETH
     * @param _amount amount to wrap
     */
    function wrapInternal(uint256 _amount) internal {
        if (_amount > 0) IWETH9(weth).deposit{value: _amount}();
    }

    function _closeShortWithAmountsFromLp(
        uint256 _vaultId,
        uint256 _wPowerPerpAmount,
        uint256 _wPowerPerpAmountToBurn,
        uint256 _collateralToWithdraw,
        uint256 _limitPriceEthPerPowerPerp,
        uint24 _poolFee,
        bool burnExactRemoved
    ) private {
        if (burnExactRemoved) {
            // remove exact _wPowerPerpAmount amount withdrawn from LP, unless amount is > short amount in vault
            uint256 shortAmount = _getVaultShortAmount(_vaultId);
            if (shortAmount < _wPowerPerpAmount) _wPowerPerpAmount = shortAmount;

            ControllerHelperUtil.burnWithdrawFromVault(
                controller,
                weth,
                _vaultId,
                _wPowerPerpAmount,
                _collateralToWithdraw
            );
        } else {
            if (_wPowerPerpAmount < _wPowerPerpAmountToBurn) {
                // swap needed wPowerPerp amount to close short position
                uint256 wPowerPerpDeficit = _wPowerPerpAmountToBurn.sub(_wPowerPerpAmount);

                _exactOutFlashSwap(
                    weth,
                    wPowerPerp,
                    _poolFee,
                    wPowerPerpDeficit,
                    _limitPriceEthPerPowerPerp.mul(wPowerPerpDeficit).div(1e18),
                    uint8(ControllerHelperDataType.CALLBACK_SOURCE.SWAP_EXACTOUT_ETH_WPOWERPERP_BURN),
                    abi.encodePacked(_vaultId, _wPowerPerpAmountToBurn, _collateralToWithdraw)
                );
            } else {
                // if LP have more wPowerPerp amount that amount to burn in vault, sell remaining amount for WETH
                ControllerHelperUtil.burnWithdrawFromVault(
                    controller,
                    weth,
                    _vaultId,
                    _wPowerPerpAmountToBurn,
                    _collateralToWithdraw
                );

                uint256 wPowerPerpExcess = _wPowerPerpAmount.sub(_wPowerPerpAmountToBurn);
                if (wPowerPerpExcess > 0) {
                    _exactInFlashSwap(
                        wPowerPerp,
                        weth,
                        _poolFee,
                        wPowerPerpExcess,
                        _limitPriceEthPerPowerPerp.mul(wPowerPerpExcess).div(1e18),
                        uint8(ControllerHelperDataType.CALLBACK_SOURCE.SWAP_EXACTIN_WPOWERPERP_ETH),
                        ""
                    );
                }
            }
        }

        // wrap ETH to WETH
        wrapInternal(address(this).balance);
    }
}
