//SPDX-License-Identifier: BUSL-1.1

pragma solidity =0.7.6;
pragma abicoder v2;

import "hardhat/console.sol";

// interface
import {INonfungiblePositionManager} from "@uniswap/v3-periphery/contracts/interfaces/INonfungiblePositionManager.sol";
import {IUniswapV3Pool} from "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import {IController} from "../../interfaces/IController.sol";
import {IWPowerPerp} from "../../interfaces/IWPowerPerp.sol";
import {IWETH9} from "../../interfaces/IWETH9.sol";
import {IOracle} from "../../interfaces/IOracle.sol";

// lib
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {ControllerHelperDataType} from "./ControllerHelperDataType.sol";
import {LiquidityAmounts} from "./LiquidityAmounts.sol";
import {TickMathExternal} from "../../libs/TickMathExternal.sol";

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

    function getAmountsToLp(address _wPowerPerpPool, uint256 _collateralToLp, uint256 _wPowerPerpAmount, int24 _lowerTick, int24 _upperTick, bool _isWethToken0) public view returns (uint256, uint256) {
        uint256 amount0Desired; 
        uint256 amount1Desired;

        {
            (,int24 currentTick,,,,,) = IUniswapV3Pool(_wPowerPerpPool).slot0();
            uint160 sqrtRatioX96 = TickMathExternal.getSqrtRatioAtTick(currentTick);
            uint160 sqrtRatioAX96 = TickMathExternal.getSqrtRatioAtTick(_lowerTick);
            uint160 sqrtRatioBX96 = TickMathExternal.getSqrtRatioAtTick(_upperTick);
            (amount0Desired, amount1Desired) = _isWethToken0 ? (_collateralToLp, _wPowerPerpAmount) : (_wPowerPerpAmount, _collateralToLp);
            uint128 maxLiquidity = LiquidityAmounts.getLiquidityForAmounts(sqrtRatioX96, sqrtRatioAX96, sqrtRatioBX96, amount0Desired, amount1Desired);
            (amount0Desired, amount1Desired) = LiquidityAmounts.getAmountsFromLiquidity(sqrtRatioX96, currentTick, _lowerTick, _upperTick, maxLiquidity);
        }
        
        return (amount0Desired, amount1Desired);
    }

    /**
     * @notice minth amount of wPowerPerp and LP in weth/wPowerPerp pool
     * @param _controller wPowerPerp controller address
     * @param _nonfungiblePositionManager Uni NonFungiblePositionManager address
     * @param _mintAndLpParams ControllerHelperDataType.MintAndLpParams struct
     * @param _isWethToken0 bool variable indicate if Weth token is token0 in Uniswap v3 weth/wPowerPerp pool
     * @return _vaultId and tokenId
     */
    function mintAndLp(address _controller, address _nonfungiblePositionManager, address _wPowerPerp, address _weth, ControllerHelperDataType.MintAndLpParams calldata _mintAndLpParams, bool _isWethToken0) public returns (uint256, uint256) {
        IWETH9(_weth).withdraw(_mintAndLpParams.collateralToDeposit);

        (uint256 amount0Desired, uint256 amount1Desired) = getAmountsToLp(_mintAndLpParams.wPowerPerpPool, _mintAndLpParams.collateralToLp, _mintAndLpParams.wPowerPerpAmount, _mintAndLpParams.lowerTick, _mintAndLpParams.upperTick, _isWethToken0);
                
        uint256 _vaultId = _mintAndLpParams.vaultId;
        uint256 amountToMint = (_isWethToken0) ? amount1Desired : amount0Desired;
        if (IWPowerPerp(_wPowerPerp).balanceOf(address(this)) < amountToMint) {
            amountToMint = amountToMint.sub(IWPowerPerp(_wPowerPerp).balanceOf(address(this)));
            _vaultId = IController(_controller).mintWPowerPerpAmount{value: _mintAndLpParams.collateralToDeposit}(
                _mintAndLpParams.vaultId,
                amountToMint,
                0
            );
        }

        // LP amount0Desired and amount1Desired in Uni v3
        uint256 uniTokenId = lpWPowerPerpPool(
            _nonfungiblePositionManager,
            _mintAndLpParams.wPowerPerpPool,
            ControllerHelperDataType.LpWPowerPerpPool({
                recipient: _mintAndLpParams.recipient,
                amount0Desired: amount0Desired,
                amount1Desired: amount1Desired,
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
    function increaseLpLiquidity(address _controller, address _nonfungiblePositionManager, address _wPowerPerpPool, uint256 _vaultId, ControllerHelperDataType.IncreaseLpLiquidityParam memory _increaseLiquidityParam, bool _isWethToken0) public {
        if (_increaseLiquidityParam.wPowerPerpAmountToMint > 0) {
            (
                ,
                ,
                ,
                ,
                ,
                int24 tickLower,
                int24 tickUpper,
                ,
                ,
                ,
                ,
                
            ) = INonfungiblePositionManager(_nonfungiblePositionManager).positions(_increaseLiquidityParam.tokenId);
            (uint256 amount0Desired, uint256 amount1Desired) = getAmountsToLp(_wPowerPerpPool, _increaseLiquidityParam.collateralToDeposit, _increaseLiquidityParam.wPowerPerpAmountToMint, tickLower, tickUpper, _isWethToken0);

            (_increaseLiquidityParam.wPowerPerpAmountToMint, _increaseLiquidityParam.wethAmountToLp) = (_isWethToken0) ? (amount1Desired, amount0Desired) : (amount0Desired, amount1Desired);
            IController(_controller).mintWPowerPerpAmount{value: _increaseLiquidityParam.collateralToDeposit}(
                _vaultId,
                _isWethToken0 ? amount1Desired : amount0Desired,
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
    }

    /**
     * @notice mint wPowerPerp in vault
     * @param _controller controller address
     * @param _weth WETH address
     * @param _vaultId vault Id
     * @param _wPowerPerpToMint amount of wPowerPerp to mint
     * @param _collateralToDeposit amount of collateral to deposit
     */
    function mintIntoVault(address _controller, address _weth, uint256 _vaultId, uint256 _wPowerPerpToMint, uint256 _collateralToDeposit) public returns (uint256) {
        if (_collateralToDeposit > 0) IWETH9(_weth).withdraw(_collateralToDeposit);

        uint256 vaultId = _vaultId;
        if (_wPowerPerpToMint > 0) {
            vaultId = IController(_controller).mintWPowerPerpAmount{value: _collateralToDeposit}(
                _vaultId,
                _wPowerPerpToMint,
                0
            );
        } else {
            IController(_controller).deposit{value: _collateralToDeposit}(_vaultId);
        }
        return vaultId;
    }

    /**
     * @notice burn wPowerPerp or just withdraw collateral from vault (or both)
     * @param _controller controller address
     * @param _weth weth address
     * @param _vaultId vault Id
     * @param _wPowerPerpToBurn amount of wPowerPerp to burn
     * @param _collateralToWithdraw amount of collateral to withdraw
     */
    function withdrawFromVault(address _controller, address _weth, uint256 _vaultId, uint256 _wPowerPerpToBurn, uint256 _collateralToWithdraw) public {
        IController(_controller).burnWPowerPerpAmount(
            _vaultId,
            _wPowerPerpToBurn,
            _collateralToWithdraw
        );

        if (_collateralToWithdraw > 0) IWETH9(_weth).deposit{value: _collateralToWithdraw}();
    }

    /**
     * @notice LP into Uniswap V3 pool
     * @param _nonfungiblePositionManager Uni NonFungiblePositionManager address
     * @param _wPowerPerpPool wPowerpPerp pool address in Uni v3
     * @param _params ControllerHelperDataType.LpWPowerPerpPool struct
     */
    function lpWPowerPerpPool(
        address _nonfungiblePositionManager,
        address _wPowerPerpPool,
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

        (uint256 tokenId, , , ) = INonfungiblePositionManager(_nonfungiblePositionManager).mint(
            mintParams
        );

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
     * @notice send ETH and wPowerPerp
     * @param _weth WETH address
     * @param _wPowerPerp wPowerPerp address
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