pragma solidity =0.7.6;
pragma abicoder v2;

//SPDX-License-Identifier: BUSL-1.1

import {INonfungiblePositionManager} from "@uniswap/v3-periphery/contracts/interfaces/INonfungiblePositionManager.sol";
import {IUniswapV3Pool} from "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import {IController} from "../../interfaces/IController.sol";

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";

library ControllerHelperDataType {
    using SafeMath for uint256;

    /// @dev params for flashswapWMint()
    struct FlashswapWMintParams {
        uint256 vaultId;
        uint256 totalCollateralToDeposit;
        uint256 wPowerPerpAmount;
        uint256 minToReceive;
    }
    /// @dev params for flashswapWBurnBuyLong()
    struct FlashswapWBurnBuyLongParams {
        uint256 vaultId;
        uint256 wPowerPerpAmountToBurn;
        uint256 wPowerPerpAmountToBuy;
        uint256 collateralToWithdraw;
        uint256 maxToPay;
    }
    /// @dev params for flashswapSellLongWMint()
    struct FlashSellLongWMintParams {
        uint256 vaultId;
        uint256 wPowerPerpAmountToMint;
        uint256 collateralAmount;
        uint256 wPowerPerpAmountToSell;
        uint256 minToReceive;
    }
    /// @dev data struct for callback initiated in _closeUniLp()
    struct SwapExactoutEthWPowerPerpData {
        uint256 vaultId; // vault ID
        uint256 wPowerPerpAmountToBurn; // amount of wPowerPerp to burn in vault
        uint256 collateralToWithdraw; // ETH amount to withdraw from vault
    }

    /// @dev params for CloseShortWithUserNft()
    struct CloseShortWithUserNftParams {
        uint256 vaultId; // vault ID
        uint256 tokenId; // Uni NFT token ID
        uint256 liquidity;
        uint256 liquidityPercentage; // percentage of liquidity to burn in LP position in decimals with 18 precision(e.g 60% = 0.6 = 6e17)
        uint256 wPowerPerpAmountToBurn; // amount of wPowerPerp to burn in vault
        uint256 collateralToWithdraw; // amount of ETH collateral to withdraw from vault
        uint256 limitPriceEthPerPowerPerp; // price limit for swapping between wPowerPerp and ETH (ETH per 1 wPowerPerp)
        uint128 amount0Min; // minimum amount of token0 to get from closing Uni LP
        uint128 amount1Min; // minimum amount of token1 to get from closing Uni LP
    }
    struct MintAndLpParams {
        uint256 vaultId;
        uint256 wPowerPerpAmount;
        uint256 collateralToDeposit;
        uint256 collateralToLp;
        uint256 amount0Min;
        uint256 amount1Min;
        int24 lowerTick;
        int24 upperTick;
    }

    /// @dev params for flashloanWMintDepositNft()
    struct FlashloanWMintDepositNftParams {
        uint256 vaultId; // vault ID (could be zero)
        uint256 wPowerPerpAmount; // wPowerPerp amount to mint
        uint256 collateralToDeposit; // ETH collateral amount to deposit in vault (could be zero)
        uint256 collateralToFlashloan; // ETH amount to flashloan and use for deposit into vault
        uint256 collateralToLp; // ETH collateral amount to use for LPing (could be zero)
        uint256 collateralToWithdraw; // ETH amount to withdraw from vault (if collateralToLp>0, this should be = collateralToLp+fee or 50% of collateralToLP and sender include the rest in msg.value)
        uint256 lpAmount0Min; // amount0Min for Uni LPing
        uint256 lpAmount1Min; // amount1Min for Uni LPing
        int24 lpLowerTick; // Uni LP lower tick
        int24 lpUpperTick; // Uni LP upper tick
    }
    /// @dev params for flashloanCloseVaultLpNft()
    struct FlashloanCloseVaultLpNftParam {
        uint256 vaultId; // vault ID
        uint256 tokenId; // Uni NFT token ID
        uint256 liquidity; // amount of liquidity in LP position
        uint256 liquidityPercentage; // percentage of liquidity to burn in LP position in decimals with 18 precision(e.g 60% = 0.6 = 6e17)
        uint256 wPowerPerpAmountToBurn; // amount of wPowerPerp to burn in vault
        uint256 collateralToFlashloan; // amount of ETH collateral to flashloan and deposit into vault
        uint256 collateralToWithdraw; // amount of ETH to withdraw
        uint256 limitPriceEthPerPowerPerp; // price limit for swapping between wPowerPerp and ETH (ETH per 1 wPowerPerp)
        uint128 amount0Min; // minimum amount of token0 to get from closing Uni LP
        uint128 amount1Min; // minimum amount of token1 to get from closing Uni LP
    }
    /// @dev params for _closeUniLp() 
    struct closeUniLpParams {
        uint256 tokenId;
        uint256 liquidity;
        uint256 liquidityPercentage; // percentage of liquidity to burn in LP position in decimals with 18 precision(e.g 60% = 0.6 = 6e17)
        uint128 amount0Min;
        uint128 amount1Min;
    }
    /// @dev params for sellAll()
    struct SellAll {
        uint256 tokenId;
        uint256 liquidity;
        uint128 amount0Min; // minimum amount of token0 to get from closing Uni LP
        uint128 amount1Min; // minimum amount of token1 to get from closing Uni LP
        uint256 limitPriceEthPerPowerPerp; // price limit for selling wPowerPerp
    }

    /// @dev params for rebalanceWithoutVault()
    struct RebalanceWithoutVault {
        uint256 tokenId;
        uint256 ethAmountToLp;
        uint256 liquidity;
        uint256 wPowerPerpAmountDesired;
        uint256 wethAmountDesired;
        uint256 amount0DesiredMin;
        uint256 amount1DesiredMin;
        uint256 limitPriceEthPerPowerPerp;
        uint256 amount0Min;
        uint256 amount1Min;
        int24 lowerTick;
        int24 upperTick;
    }

    struct LpWPowerPerpPool {
        address recipient;
        uint256 ethAmount;
        uint256 amount0Desired;
        uint256 amount1Desired;
        uint256 amount0Min;
        uint256 amount1Min;
        int24 lowerTick;
        int24 upperTick;
    }

    enum RebalanceVaultNftType {
        IncreaseLiquidity,
        DecreaseLiquidity,
        RepayFlashloan
    }

    struct RebalanceVaultNftParams {
        RebalanceVaultNftType rebalanceVaultNftType;
        bytes data;
    }

    /// @dev struct for minting more wPowerPerp and add in LP, or increasing more WETH in LP, or both
    struct IncreaseLiquidityParam {
        uint256 tokenId;
        uint256 wPowerPerpAmountToMint;
        uint256 collateralToDeposit;
        uint256 wethAmountToLp;
        uint256 amount0Min;
        uint256 amount1Min;
    }

    struct DecreaseLiquidityParams {
        uint256 tokenId;
        uint256 liquidity;
        uint256 liquidityPercentage; // percentage of liquidity to burn in LP position in decimals with 18 precision(e.g 60% = 0.6 = 6e17)
        uint128 amount0Min;
        uint128 amount1Min;
    }

    struct withdrawFromVault {
        uint256 collateralToWithdraw;
    }

}