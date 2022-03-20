pragma solidity =0.8.0;
pragma abicoder v2;

//SPDX-License-Identifier: BUSL-1.1

// interface
import {INonfungiblePositionManager} from "@uniswap/v3-periphery/contracts/interfaces/INonfungiblePositionManager.sol";
import {IUniswapV3Pool} from "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import {IController} from "../../interfaces/IController.sol";
import {IWPowerPerp} from "../../interfaces/IWPowerPerp.sol";

// lib
// import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {ControllerHelperDataType} from "./ControllerHelperDataType.sol";

library ControllerHelperUtil {
    // using SafeMath for uint256;

    function closeUniLp(address nonfungiblePositionManager, ControllerHelperDataType.closeUniLpParams memory _params, bool isWethToken0) public returns (uint256, uint256) {
        INonfungiblePositionManager.DecreaseLiquidityParams memory decreaseParams = INonfungiblePositionManager
            .DecreaseLiquidityParams({
                tokenId: _params.tokenId,
                liquidity: uint128(_params.liquidity.mul(_params.liquidityPercentage).div(1e18)),
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

        return (wPowerPerpAmount, wethAmount);
    }

    function mintAndLp(address _recepient, address controller, address nonfungiblePositionManager, address wPowerPerp, address wPowerPerpPool, ControllerHelperDataType.MintAndLpParams calldata mintAndLpParams, bool isWethToken0) public returns (uint256, uint256) {
        uint256 vaultId = IController(controller).mintWPowerPerpAmount{value: mintAndLpParams.collateralToDeposit}(
            mintAndLpParams.vaultId,
            mintAndLpParams.wPowerPerpAmount,
            0
        );

        // LP mintAndLpParams.wPowerPerpAmount & mintAndLpParams.collateralToLp in Uni v3
        uint256 uniTokenId = lpWPowerPerpPool(
            nonfungiblePositionManager,
            wPowerPerpPool,
            ControllerHelperDataType.LpWPowerPerpPool({
                recipient: _recepient,
                ethAmount: mintAndLpParams.collateralToLp,
                amount0Desired: isWethToken0 ? mintAndLpParams.collateralToLp : mintAndLpParams.wPowerPerpAmount,
                amount1Desired: isWethToken0 ? mintAndLpParams.wPowerPerpAmount : mintAndLpParams.collateralToLp,
                amount0Min: mintAndLpParams.amount0Min,
                amount1Min: mintAndLpParams.amount1Min,
                lowerTick: mintAndLpParams.lowerTick,
                upperTick: mintAndLpParams.upperTick
            })
        );

        checkLpMintExcess(controller, wPowerPerp, nonfungiblePositionManager, vaultId);

        return (vaultId, uniTokenId);
    }

    function increaseLpLiquidity(address controller, address nonfungiblePositionManager, uint256 vaultId, ControllerHelperDataType.IncreaseLpLiquidityParam memory increaseLiquidityParam, bool isWethToken0) public {
        if (increaseLiquidityParam.wPowerPerpAmountToMint > 0) {
            IController(controller).mintWPowerPerpAmount{value: increaseLiquidityParam.collateralToDeposit}(
                vaultId,
                increaseLiquidityParam.wPowerPerpAmountToMint,
                0
            );
        }

        INonfungiblePositionManager.IncreaseLiquidityParams memory uniIncreaseParams = INonfungiblePositionManager.IncreaseLiquidityParams({
            tokenId: increaseLiquidityParam.tokenId,
            amount0Desired: (isWethToken0) ? increaseLiquidityParam.wethAmountToLp : increaseLiquidityParam.wPowerPerpAmountToMint,
            amount1Desired: (isWethToken0) ? increaseLiquidityParam.wPowerPerpAmountToMint : increaseLiquidityParam.wethAmountToLp,
            amount0Min: increaseLiquidityParam.amount0Min,
            amount1Min: increaseLiquidityParam.amount1Min,
            deadline: block.timestamp
        });

        INonfungiblePositionManager(nonfungiblePositionManager).increaseLiquidity(uniIncreaseParams);
    }

    function mintIntoVault(address _controller, uint256 _vaultId, uint256 _wPowerPerpToMint, uint256 _collateralToDeposit) public {
        IController(_controller).mintWPowerPerpAmount{value: _collateralToDeposit}(
            _vaultId,
            _wPowerPerpToMint,
            0
        );
    }

    function withdrawFromVault(address _controller, uint256 _vaultId, uint256 _wPowerPerpToBurn, uint256 _collateralToWithdraw) public {
        IController(_controller).burnWPowerPerpAmount(
            _vaultId,
            _wPowerPerpToBurn,
            _collateralToWithdraw
        );
    }

    /**
     * @notice LP into Uniswap V3 pool
     */
    function lpWPowerPerpPool(
        address nonfungiblePositionManager,
        address wPowerPerpPool,
        ControllerHelperDataType.LpWPowerPerpPool memory _params
    ) public returns (uint256) {
        INonfungiblePositionManager.MintParams memory mintParams = INonfungiblePositionManager.MintParams({
            token0: IUniswapV3Pool(wPowerPerpPool).token0(),
            token1: IUniswapV3Pool(wPowerPerpPool).token1(),
            fee: IUniswapV3Pool(wPowerPerpPool).fee(),
            tickLower: int24(_params.lowerTick),
            tickUpper: int24(_params.upperTick),
            amount0Desired: _params.amount0Desired,
            amount1Desired: _params.amount1Desired,
            amount0Min: _params.amount0Min,
            amount1Min: _params.amount1Min,
            recipient: _params.recipient,
            deadline: block.timestamp
        });

        (uint256 tokenId, , , ) = INonfungiblePositionManager(nonfungiblePositionManager).mint{value: _params.ethAmount}(
            mintParams
        );

        return tokenId;
    }

    function checkPartialLpClose(
        address nonfungiblePositionManager,
        address controller,
        uint256 _vaultId,
        uint256 _tokenId,
        uint256 _liquidityPercentage
    ) public {
        if (_liquidityPercentage < 1e18) {
            if (_vaultId == 0) {
                INonfungiblePositionManager(nonfungiblePositionManager).safeTransferFrom(
                    address(this),
                    msg.sender,
                    _tokenId
                );
            } else {
                IController(controller).depositUniPositionToken(_vaultId, _tokenId);
            }
        }
    }

    /**
     * @notice check if excess ETH or wPowerPerp was sent for minting LP position, if so burn wPowerPerp from vault and withdraw ETH from Uni pool
     * @dev _vaultId vault ID to burn wPowerPerp from
     */
    function checkLpMintExcess(address controller, address wPowerPerp, address nonfungiblePositionManager, uint256 _vaultId) public {
        uint256 remainingWPowerPerp = IWPowerPerp(wPowerPerp).balanceOf(address(this));
        if (remainingWPowerPerp > 0) {
            if (_vaultId > 0) {
                IController(controller).burnWPowerPerpAmount(_vaultId, remainingWPowerPerp, 0);
            } else {
                IWPowerPerp(wPowerPerp).transfer(msg.sender, remainingWPowerPerp);
            }
        }
        // in case _collateralToLP > amount needed to LP, withdraw excess ETH
        INonfungiblePositionManager(nonfungiblePositionManager).refundETH();
    }

}