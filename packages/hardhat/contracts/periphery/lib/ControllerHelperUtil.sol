pragma solidity =0.7.6;
pragma abicoder v2;

//SPDX-License-Identifier: BUSL-1.1

// interface
import {INonfungiblePositionManager} from "@uniswap/v3-periphery/contracts/interfaces/INonfungiblePositionManager.sol";
import {IUniswapV3Pool} from "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import {IController} from "../../interfaces/IController.sol";
import {IWPowerPerp} from "../../interfaces/IWPowerPerp.sol";
import {IWETH9} from "../../interfaces/IWETH9.sol";
import {IWPowerPerp} from "../../interfaces/IWPowerPerp.sol";

// lib
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {ControllerHelperDataType} from "./ControllerHelperDataType.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";

library ControllerHelperUtil {
    using SafeMath for uint256;
    using Address for address payable;

    /**
     * @notice fully or partially close Uni v3 LP
     * @param _nonfungiblePositionManager Uni NonFungiblePositionManager address
     * @param _params ControllerHelperDataType.closeUniLpParams struct 
     * @param _isWethToken0 bool variable indicate if Weth token is token0 in Uniswap v3 weth/wPowerPerp pool
     * @return withdraw wPowerPerp and WETH amounts
     */
    function closeUniLp(address _nonfungiblePositionManager, ControllerHelperDataType.closeUniLpParams memory _params, bool _isWethToken0) public returns (uint256, uint256) {
        INonfungiblePositionManager.DecreaseLiquidityParams memory decreaseParams = INonfungiblePositionManager
            .DecreaseLiquidityParams({
                tokenId: _params.tokenId,
                liquidity: uint128(_params.liquidity.mul(_params.liquidityPercentage).div(1e18)),
                amount0Min: _params.amount0Min,
                amount1Min: _params.amount1Min,
                deadline: block.timestamp
            });
        INonfungiblePositionManager(_nonfungiblePositionManager).decreaseLiquidity(decreaseParams);

        uint256 wethAmount;
        uint256 _wPowerPerpAmount;
        (_isWethToken0)
            ? (wethAmount, _wPowerPerpAmount) = INonfungiblePositionManager(_nonfungiblePositionManager).collect(
                INonfungiblePositionManager.CollectParams({
                    tokenId: _params.tokenId,
                    recipient: address(this),
                    amount0Max: type(uint128).max,
                    amount1Max: type(uint128).max
                })
            )
            : (_wPowerPerpAmount, wethAmount) = INonfungiblePositionManager(_nonfungiblePositionManager).collect(
            INonfungiblePositionManager.CollectParams({
                tokenId: _params.tokenId,
                recipient: address(this),
                amount0Max: type(uint128).max,
                amount1Max: type(uint128).max
            })
        );

        return (_wPowerPerpAmount, wethAmount);
    }

    /**
     * @notice minth amount of wPowerPerp and LP in weth/wPowerPerp pool
     * @param _controller wPowerPerp controller address
     * @param _nonfungiblePositionManager Uni NonFungiblePositionManager address
     * @param _wPowerPerp wPowerPerp contract address
     * @param _wPowerPerpPool wPowerPerp Uni v3 pool
     * @param _mintAndLpParams ControllerHelperDataType.MintAndLpParams struct
     * @param _isWethToken0 bool variable indicate if Weth token is token0 in Uniswap v3 weth/wPowerPerp pool
     * @return _vaultId and tokenId
     */
    function mintAndLp(address _controller, address _nonfungiblePositionManager, address _wPowerPerp, address _wPowerPerpPool, address _weth, ControllerHelperDataType.MintAndLpParams calldata _mintAndLpParams, bool _isWethToken0) public returns (uint256, uint256) {
        IWETH9(_weth).withdraw(_mintAndLpParams.collateralToDeposit);
        
        uint256 _vaultId = IController(_controller).mintWPowerPerpAmount{value: _mintAndLpParams.collateralToDeposit}(
            _mintAndLpParams.vaultId,
            _mintAndLpParams.wPowerPerpAmount,
            0
        );

        // LP _mintAndLpParams._wPowerPerpAmount & _mintAndLpParams.collateralToLp in Uni v3
        uint256 uniTokenId = lpWPowerPerpPool(
            _controller,
            _nonfungiblePositionManager,
            _wPowerPerpPool,
            _wPowerPerp,
            _vaultId,
            ControllerHelperDataType.LpWPowerPerpPool({
                recipient: _mintAndLpParams.recipient,
                ethAmount: _mintAndLpParams.collateralToLp,
                amount0Desired: _isWethToken0 ? _mintAndLpParams.collateralToLp : _mintAndLpParams.wPowerPerpAmount,
                amount1Desired: _isWethToken0 ? _mintAndLpParams.wPowerPerpAmount : _mintAndLpParams.collateralToLp,
                amount0Min: _mintAndLpParams.amount0Min,
                amount1Min: _mintAndLpParams.amount1Min,
                lowerTick: _mintAndLpParams.lowerTick,
                upperTick: _mintAndLpParams.upperTick
            })
        );

        return (_vaultId, uniTokenId);
    }

    /**
     * @notice increase liquidityin Uni v3 position
     * @param _controller controller address
     * @param _nonfungiblePositionManager Uni NonFungiblePositionManager address
     * @param _vaultId vault Id
     * @param _increaseLiquidityParam ControllerHelperDataType.IncreaseLpLiquidityParam struct
     * @param _isWethToken0 bool variable indicate if Weth token is token0 in Uniswap v3 weth/wPowerPerp pool
     */
    function increaseLpLiquidity(address _controller, address _nonfungiblePositionManager, address _wPowerPerp, uint256 _vaultId, ControllerHelperDataType.IncreaseLpLiquidityParam memory _increaseLiquidityParam, bool _isWethToken0) public {
        if (_increaseLiquidityParam.wPowerPerpAmountToMint > 0) {
            IController(_controller).mintWPowerPerpAmount{value: _increaseLiquidityParam.collateralToDeposit}(
                _vaultId,
                _increaseLiquidityParam.wPowerPerpAmountToMint,
                0
            );
        }

        INonfungiblePositionManager.IncreaseLiquidityParams memory uniIncreaseParams = INonfungiblePositionManager.IncreaseLiquidityParams({
            tokenId: _increaseLiquidityParam.tokenId,
            amount0Desired: (_isWethToken0) ? _increaseLiquidityParam.wethAmountToLp : _increaseLiquidityParam.wPowerPerpAmountToMint,
            amount1Desired: (_isWethToken0) ? _increaseLiquidityParam.wPowerPerpAmountToMint : _increaseLiquidityParam.wethAmountToLp,
            amount0Min: _increaseLiquidityParam.amount0Min,
            amount1Min: _increaseLiquidityParam.amount1Min,
            deadline: block.timestamp
        });

        INonfungiblePositionManager(_nonfungiblePositionManager).increaseLiquidity(uniIncreaseParams);

        checkExcess(_controller, _nonfungiblePositionManager, _wPowerPerp, _vaultId);
    }

    /**
     * @notice mint wPowerPerp in vault
     * @param _controller controller address
     * @param _vaultId vault Id
     * @param __wPowerPerpToMint amount of wPowerPerp to mint
     * @param _collateralToDeposit amount of collateral to deposit
     */
    function mintIntoVault(address _controller, uint256 _vaultId, uint256 __wPowerPerpToMint, uint256 _collateralToDeposit) public returns (uint256) {
        return (IController(_controller).mintWPowerPerpAmount{value: _collateralToDeposit}(
            _vaultId,
            __wPowerPerpToMint,
            0
        ));
    }

    /**
     * @notice burn wPowerPerp or just withdraw collateral from vault (or both)
     * @param _controller controller address
     * @param _vaultId vault Id
     * @param _wPowerPerpToBurn amount of wPowerPerp to burn
     * @param _collateralToWithdraw amount of collateral to withdraw
     */
    function withdrawFromVault(address _controller, uint256 _vaultId, uint256 _wPowerPerpToBurn, uint256 _collateralToWithdraw) public {
        IController(_controller).burnWPowerPerpAmount(
            _vaultId,
            _wPowerPerpToBurn,
            _collateralToWithdraw
        );
    }

    /**
     * @notice LP into Uniswap V3 pool
     * @param _controller controller address
     * @param _nonfungiblePositionManager Uni NonFungiblePositionManager address
     * @param _wPowerPerpPool wPowerpPerp pool address in Uni v3
     * @param _wPowerPerp wPowerPerp address
     * @param _vaultId vault ID
     * @param _params ControllerHelperDataType.LpWPowerPerpPool struct
     */
    function lpWPowerPerpPool(
        address _controller, 
        address _nonfungiblePositionManager,
        address _wPowerPerpPool,
        address _wPowerPerp,
        uint256 _vaultId,
        ControllerHelperDataType.LpWPowerPerpPool memory _params
    ) public returns (uint256) {
        INonfungiblePositionManager.MintParams memory mintParams = INonfungiblePositionManager.MintParams({
            token0: IUniswapV3Pool(_wPowerPerpPool).token0(),
            token1: IUniswapV3Pool(_wPowerPerpPool).token1(),
            fee: IUniswapV3Pool(_wPowerPerpPool).fee(),
            tickLower: int24(_params.lowerTick),
            tickUpper: int24(_params.upperTick),
            amount0Desired: _params.amount0Desired,
            amount1Desired: _params.amount1Desired,
            amount0Min: _params.amount0Min,
            amount1Min: _params.amount1Min,
            recipient: _params.recipient,
            deadline: block.timestamp
        });

        // (uint256 tokenId, , , ) = INonfungiblePositionManager(_nonfungiblePositionManager).mint{value: _params.ethAmount}(
        //     mintParams
        // );

        (uint256 tokenId, , , ) = INonfungiblePositionManager(_nonfungiblePositionManager).mint(
            mintParams
        );

        checkExcess(_controller, _nonfungiblePositionManager, _wPowerPerp, _vaultId);

        return tokenId;
    }

    /**
     * @notice transfer back LP NFT to user if remaining liquidity == 0 and no vault used, or deposit back into vault if still have liquidity
     * @param _user user address
     * @param _controller controller address
     * @param _nonfungiblePositionManager Uni NonFungiblePositionManager address
     * @param _vaultId vault ID
     * @param _tokenId Uni LP NFT id
     * @param _liquidityPercentage percentage of liquidity that was closed from total amount
     */
    function checkClosedLp(
        address _user,
        address _controller,
        address _nonfungiblePositionManager,
        uint256 _vaultId,
        uint256 _tokenId,
        uint256 _liquidityPercentage
    ) public {
        if ((_vaultId == 0) || (_liquidityPercentage == 1e18)) {
            INonfungiblePositionManager(_nonfungiblePositionManager).safeTransferFrom(
                address(this),
                _user,
                _tokenId
            );
        } else {
            IController(_controller).depositUniPositionToken(_vaultId, _tokenId);
        }
    }

    /**
     * @notice check if excess ETH or _wPowerPerp was sent for minting LP position, if so burn _wPowerPerp from vault and withdraw ETH from Uni pool
     * @param _controller controller address
     * @param _nonfungiblePositionManager Uni NonFungiblePositionManager address
     * @param _wPowerPerp wPowerPerp address 
     * @param _vaultId vault ID to burn _wPowerPerp from
     */
    function checkExcess(address _controller, address _nonfungiblePositionManager, address _wPowerPerp, uint256 _vaultId) public {
        uint256 remainingWPowerPerp = IWPowerPerp(_wPowerPerp).balanceOf(address(this));
        if (remainingWPowerPerp > 0) {
            if (_vaultId > 0) {
                IController(_controller).burnWPowerPerpAmount(_vaultId, remainingWPowerPerp, 0);
            } else {
                IWPowerPerp(_wPowerPerp).transfer(msg.sender, remainingWPowerPerp);
            }
        }
        // in case _collateralToLP > amount needed to LP, withdraw excess ETH
        INonfungiblePositionManager(_nonfungiblePositionManager).refundETH();
    }

    /**
     * @notice send ETH and wPowerPerp
     */
    function sendBack(address _weth, address _wPowerPerp) public {
        IWETH9(_weth).withdraw(IWETH9(_weth).balanceOf(address(this)));
        payable(msg.sender).sendValue(address(this).balance);

        uint256 wPowerPerpBalance = IWPowerPerp(_wPowerPerp).balanceOf(address(this));
        if (wPowerPerpBalance > 0) {
            IWPowerPerp(_wPowerPerp).transfer(msg.sender, wPowerPerpBalance);
        }
    }
}