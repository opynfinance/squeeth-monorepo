pragma solidity =0.7.6;
pragma abicoder v2;

//SPDX-License-Identifier: BUSL-1.1

// interface
import {INonfungiblePositionManager} from "@uniswap/v3-periphery/contracts/interfaces/INonfungiblePositionManager.sol";
import {IUniswapV3Pool} from "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import {IController} from "../../interfaces/IController.sol";

// lib
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";

library ControllerHelperDataType {
    using SafeMath for uint256;

    /// @dev enum to differentiate between uniswap swap callback function source
    enum CALLBACK_SOURCE {
        FLASH_W_MINT,
        FLASH_W_BURN,
        FLASH_SELL_LONG_W_MINT,
        SWAP_EXACTIN_WPOWERPERP_ETH,
        SWAP_EXACTOUT_ETH_WPOWERPERP,
        SWAP_EXACTOUT_ETH_WPOWERPERP_BURN,
        FLASHLOAN_W_MINT_DEPOSIT_NFT,
        FLASHLOAN_CLOSE_VAULT_LP_NFT,
        FLASHLOAN_REBALANCE_VAULT_NFT,
        GENERAL_SWAP
    }

    /// @dev enum to differentiate between rebalanceVaultNft() actions
    enum RebalanceVaultNftType {
        IncreaseLpLiquidity,
        DecreaseLpLiquidity,
        DepositIntoVault,
        WithdrawFromVault,
        MintNewLp,
        generalSwap,
        CollectFees, 
        DepositExistingNft
    }
    
    /// @dev params for flashswapWBurnBuyLong()
    struct FlashswapWBurnBuyLongParams {
        uint256 vaultId;    // vault ID
        uint256 wPowerPerpAmountToBurn; // wPowerPerp amount to burn    
        uint256 wPowerPerpAmountToBuy;  // wPowerPerp amount to buy
        uint256 collateralToWithdraw;   // collateral to withdraw from vault
        uint256 maxToPay;   // max to pay for flashswapping WETH to wPowerPerp
        uint24 poolFee;
    }

    /// @dev params for flashswapSellLongWMint()
    struct FlashSellLongWMintParams {
        uint256 vaultId;    // vault ID
        uint256 wPowerPerpAmountToMint; // wPowerPerp amount to mint
        uint256 collateralAmount;   // collateral amount to deposit into vault
        uint256 wPowerPerpAmountToSell; // wPowerPerp amount to sell
        uint256 minToReceive;   // minimum to receive for selling wPowerPerp
        uint24 poolFee;
    }

    /// @dev data struct for callback initiated in _closeShortWithAmountsFromLp()
    struct SwapExactoutEthWPowerPerpData {
        uint256 vaultId; // vault ID
        uint256 wPowerPerpAmountToBurn; // amount of wPowerPerp to burn in vault
        uint256 collateralToWithdraw; // ETH amount to withdraw from vault
    }

    /// @dev params for CloseShortWithUserNft()
    struct CloseShortWithUserNftParams {
        uint256 vaultId; // vault ID
        uint256 tokenId; // Uni NFT token ID
        uint256 liquidity;  // liquidity amount in LP 
        uint256 liquidityPercentage; // percentage of liquidity to burn in LP position in decimals with 18 precision(e.g 60% = 0.6 = 6e17)
        uint256 wPowerPerpAmountToBurn; // amount of wPowerPerp to burn in vault
        uint256 collateralToWithdraw; // amount of ETH collateral to withdraw from vault
        uint256 limitPriceEthPerPowerPerp; // price limit for swapping between wPowerPerp and ETH (ETH per 1 wPowerPerp)
        uint128 amount0Min; // minimum amount of token0 to get from closing Uni LP
        uint128 amount1Min; // minimum amount of token1 to get from closing Uni LP
        uint24 poolFee;
    }

    /// @dev params for batchMintLp()
    struct MintAndLpParams {
        address recipient;  // recipient address
        address wPowerPerpPool; // Uni v3 ETH/WPowerPerp pool
        uint256 vaultId;    // vault ID
        uint256 wPowerPerpAmount;   // wPowerPerp amount to mint
        uint256 collateralToDeposit;    // collateral to deposit into vault
        uint256 collateralToLp; // collateral amount to LP
        uint256 amount0Min; // minimum amount to LP of asset0
        uint256 amount1Min; // minimum amount to LP of asset1
        int24 lowerTick;    // LP lower tick
        int24 upperTick;    // LP upper tick
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
        uint24 poolFee;
    }

    /// @dev params for _closeUniLp() 
    struct closeUniLpParams {
        uint256 tokenId;    // Uni NFT id
        uint256 liquidity;  // LP liquidity amount
        uint256 liquidityPercentage; // percentage of liquidity to burn in LP position in decimals with 18 precision(e.g 60% = 0.6 = 6e17)
        uint128 amount0Min; // amount min to get for asset0
        uint128 amount1Min; // amount min to get for asset1
    }

    /// @dev params for sellAll()
    struct ReduceLiquidityAndSell {
        uint256 tokenId;    // Uni token ID
        uint256 liquidity;  // LP liquidity amount
        uint256 liquidityPercentage; // percentage of liquidity to burn in LP position in decimals with 18 precision(e.g 60% = 0.6 = 6e17)
        uint128 amount0Min; // minimum amount of token0 to get from closing Uni LP
        uint128 amount1Min; // minimum amount of token1 to get from closing Uni LP
        uint256 limitPriceEthPerPowerPerp; // price limit for selling wPowerPerp
        uint24 poolFee;
    }

    /// @dev params for rebalanceWithoutVault()
    struct RebalanceWithoutVault {
        address wPowerPerpPool; // Uni v3 ETH/WPowerPerp pool
        uint256 tokenId;    // Uni token ID
        uint256 liquidity;  // LP liquidity amount
        uint256 wPowerPerpAmountDesired;    // wPowerPerp amount to LP
        uint256 wethAmountDesired;  // WETH amount to LP
        uint256 amount0DesiredMin;  // amount min to get when LPing for asset0
        uint256 amount1DesiredMin;  // amount min to get when LPing for asset1
        uint256 limitPriceEthPerPowerPerp;  // price limit for swapping between wPowerPerp and ETH (ETH per 1 wPowerPerp)
        uint256 amount0Min; // amount min to get when closing LP for asset0
        uint256 amount1Min; // amount min to get when closing LP for asset1
        int24 lowerTick;    // LP lower tick
        int24 upperTick;    // LP upper tick
        uint24 poolFee;
    }

    /// @dev params for ControllerHelperUtil.lpWPowerPerpPool()
    struct LpWPowerPerpPool {
        address recipient;  // recipient address
        uint256 amount0Desired; // amount to LP for asset0
        uint256 amount1Desired; // amount to LP for asset1
        uint256 amount0Min; // amount min to LP for asset0
        uint256 amount1Min; // amount min to LP for asset1
        int24 lowerTick;    // LP lower tick
        int24 upperTick;    // LP upper tick
    }

    /// @dev params for rebalanceVaultNft()
    struct RebalanceVaultNftParams {
        RebalanceVaultNftType rebalanceVaultNftType;
        bytes data;
    }

    /// @dev struct for minting more wPowerPerp and add in LP, or increasing more WETH in LP, or both
    struct IncreaseLpLiquidityParam {
        uint256 tokenId;    // Uni v3 NFT token id
        uint256 wPowerPerpAmountToMint; // wPowerPerp amount to mint
        uint256 collateralToDeposit;    // collateral to deposit into vault
        uint256 wethAmountToLp; // WETH amount to LP
        uint256 amount0Min; // amount min to get for LPing of asset0
        uint256 amount1Min; // amount min to get for LPing of asset1
    }

    /// @dev struct for decrease liquidity in LP position
    struct DecreaseLpLiquidityParams {  
        uint256 tokenId;    // Uni v3 NFT token id
        uint256 liquidity;  // LP liquidity amount
        uint256 liquidityPercentage; // percentage of liquidity to burn in LP position in decimals with 18 precision(e.g 60% = 0.6 = 6e17)
        uint128 amount0Min; // amount min to get for LPing of asset0
        uint128 amount1Min; // amount min to get for LPing of asset1
    }

    /// @dev struct for minting into vault
    struct DepositIntoVault {
        uint256 wPowerPerpToMint;   // wPowerPerp amount to mint
        uint256 collateralToDeposit;    // collateral amount to deposit
    }

    /// @dev struct for withdrawing from vault
    struct withdrawFromVault {  
        uint256 wPowerPerpToBurn;   // wPowerPerp amount to burn
        uint256 collateralToWithdraw;   // collateral to withdraw
    }

    /// @dev struct for swapping from tokenIn to tokenOut
    struct GeneralSwap {
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint256 limitPriceEthPerPowerPerp;
        uint24 poolFee;
    }

    /// @dev struct for collecting fees owed from a uniswap NFT
    struct CollectFeesParams {
        uint256 tokenId;
        uint128 amount0Max;
        uint128 amount1Max;
    }
    /// @dev struct for re-depositing and existing uniswap NFT to a vault
    struct DepositExistingNftParams {
        uint256 tokenId;
    }
}