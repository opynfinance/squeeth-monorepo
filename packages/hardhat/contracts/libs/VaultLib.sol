//SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;

//interface
import {INonfungiblePositionManager} from "@uniswap/v3-periphery/contracts/interfaces/INonfungiblePositionManager.sol";

//lib
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {TickMathExternal} from "./TickMathExternal.sol";
import {SqrtPriceMathPartial} from "./SqrtPriceMathPartial.sol";
import {Uint256Casting} from "./Uint256Casting.sol";

/**
 * Error code:
 * V1: Vault already had nft
 * V2: Vault has no NFT
 */
library VaultLib {
    using SafeMath for uint256;
    using Uint256Casting for uint256;

    uint256 constant ONE_ONE = 1e36;

    // the collateralization ratio (CR) is checked with the numerator and denominator separately
    // a user is safe if - collateral value >= (COLLAT_RATIO_NUMER/COLLAT_RATIO_DENOM)* debt value
    uint256 public constant CR_NUMERATOR = 3;
    uint256 public constant CR_DENOMINATOR = 2;

    struct Vault {
        // the address that can update the vault
        address operator;
        // uniswap position token id deposited into the vault as collateral
        // 2^32 is 4,294,967,296, which means the vault structure will work with up to 4 billion positions
        uint32 NftCollateralId;
        // amount of eth (wei) used in the vault as collateral
        // 2^96 / 1e18 = 79,228,162,514, which means a vault can store up to 79 billion eth
        // when we need to do calculations, we always cast this number to uint256 to avoid overflow
        uint96 collateralAmount;
        // amount of wPowerPerp minted from the vault
        uint128 shortAmount;
    }

    /**
     * @notice add eth collateral to a vault
     * @param _vault in-memory vault
     * @param _amount amount of eth to add
     */
    function addEthCollateral(Vault memory _vault, uint256 _amount) internal pure {
        _vault.collateralAmount = uint256(_vault.collateralAmount).add(_amount).toUint96();
    }

    /**
     * @notice add uniswap position token collateral to a vault
     * @param _vault in-memory vault
     * @param _tokenId uniswap position token id
     */
    function addUniNftCollateral(Vault memory _vault, uint256 _tokenId) internal pure {
        require(_vault.NftCollateralId == 0, "V1");
        require(_tokenId != 0, "C23");
        _vault.NftCollateralId = _tokenId.toUint32();
    }

    /**
     * @notice remove eth collateral from a vault
     * @param _vault in-memory vault
     * @param _amount amount of eth to remove
     */
    function removeEthCollateral(Vault memory _vault, uint256 _amount) internal pure {
        _vault.collateralAmount = uint256(_vault.collateralAmount).sub(_amount).toUint96();
    }

    /**
     * @notice remove uniswap position token collateral from a vault
     * @param _vault in-memory vault
     */
    function removeUniNftCollateral(Vault memory _vault) internal pure {
        require(_vault.NftCollateralId != 0, "V2");
        _vault.NftCollateralId = 0;
    }

    /**
     * @notice add debt to vault
     * @param _vault in-memory vault
     * @param _amount amount of debt to add
     */
    function addShort(Vault memory _vault, uint256 _amount) internal pure {
        _vault.shortAmount = uint256(_vault.shortAmount).add(_amount).toUint128();
    }

    /**
     * @notice remove debt from vault
     * @param _vault in-memory vault
     * @param _amount amount of debt to remove
     */
    function removeShort(Vault memory _vault, uint256 _amount) internal pure {
        _vault.shortAmount = uint256(_vault.shortAmount).sub(_amount).toUint128();
    }

    /**
     * @notice check if a vault is properly collateralized
     * @param _vault the vault we want to check
     * @param _positionManager address of the uniswap position manager
     * @param _normalizationFactor current _normalizationFactor
     * @param _ethQuoteCurrencyPrice current eth price scaled by 1e18
     * @param _minCollateral minimum collateral that needs to be in a vault
     * @param _wsqueethPoolTick current price tick for wsqueeth pool
     * @param _isWethToken0 whether weth is token0 in the wsqueeth pool
     * @return true if the vault is sufficiently collateralized
     * @return true if the vault is considered as a dust vault
     */
    function getVaultStatus(
        Vault memory _vault,
        address _positionManager,
        uint256 _normalizationFactor,
        uint256 _ethQuoteCurrencyPrice,
        uint256 _minCollateral,
        int24 _wsqueethPoolTick,
        bool _isWethToken0
    ) internal view returns (bool, bool) {
        if (_vault.shortAmount == 0) return (true, false);

        uint256 debtValueInETH = uint256(_vault.shortAmount).mul(_normalizationFactor).mul(_ethQuoteCurrencyPrice).div(
            ONE_ONE
        );
        uint256 totalCollateral = _getEffectiveCollateral(
            _vault,
            _positionManager,
            _normalizationFactor,
            _ethQuoteCurrencyPrice,
            _wsqueethPoolTick,
            _isWethToken0
        );

        bool isDust = totalCollateral < _minCollateral;
        bool isAboveWater = totalCollateral.mul(CR_DENOMINATOR) >= debtValueInETH.mul(CR_NUMERATOR);
        return (isAboveWater, isDust);
    }

    /**
     * @notice get the total effective collateral of a vault, which is:
     *         collateral amount + uniswap position token equivelent amount in eth
     * @param _vault the vault we want to check
     * @param _positionManager address of the uniswap position manager
     * @param _normalizationFactor current _normalizationFactor
     * @param _ethQuoteCurrencyPrice current eth price scaled by 1e18
     * @param _wsqueethPoolTick current price tick for wsqueeth pool
     * @param _isWethToken0 whether weth is token0 in the wsqueeth pool
     * @return the total worth of collateral in the vault
     */
    function _getEffectiveCollateral(
        Vault memory _vault,
        address _positionManager,
        uint256 _normalizationFactor,
        uint256 _ethQuoteCurrencyPrice,
        int24 _wsqueethPoolTick,
        bool _isWethToken0
    ) internal view returns (uint256) {
        if (_vault.NftCollateralId == 0) return _vault.collateralAmount;

        // the user has deposited uniswap position token as collateral, see how much eth / wSqueeth the uniswap position token has
        (uint256 nftEthAmount, uint256 nftWsqueethAmount) = _getUniPositionBalances(
            _positionManager,
            _vault.NftCollateralId,
            _wsqueethPoolTick,
            _isWethToken0
        );
        // convert squeeth amount from uniswap position token as equivalent amount of collateral
        uint256 wSqueethIndexValueInEth = nftWsqueethAmount.mul(_normalizationFactor).mul(_ethQuoteCurrencyPrice).div(
            ONE_ONE
        );
        // add eth value from uniswap position token as collateral
        return nftEthAmount.add(wSqueethIndexValueInEth).add(_vault.collateralAmount);
    }

    /**
     * @notice determine how much eth / wPowerPerp the uniswap position contains
     * @param _positionManager address of the uniswap position manager
     * @param _tokenId uniswap position token id
     * @param _wPowerPerpPoolTick current price tick
     * @param _isWethToken0 whether weth is token0 in the pool
     * @return ethAmount the eth amount this LP token contains
     * @return wPowerPerpAmount the wPowerPerp amount this LP token contains
     */
    function _getUniPositionBalances(
        address _positionManager,
        uint256 _tokenId,
        int24 _wPowerPerpPoolTick,
        bool _isWethToken0
    ) internal view returns (uint256 ethAmount, uint256 wPowerPerpAmount) {
        (
            int24 tickLower,
            int24 tickUpper,
            uint128 liquidity,
            uint128 tokensOwed0,
            uint128 tokensOwed1
        ) = _getUniswapPositionInfo(_positionManager, _tokenId);
        (uint256 amount0, uint256 amount1) = _getToken0Token1Balances(
            tickLower,
            tickUpper,
            _wPowerPerpPoolTick,
            liquidity
        );

        return
            _isWethToken0
                ? (amount0 + tokensOwed0, amount1 + tokensOwed1)
                : (amount1 + tokensOwed1, amount0 + tokensOwed0);
    }

    /**
     * @notice get uniswap position token info
     * @param _positionManager address of the uniswap position position manager
     * @param _tokenId uniswap position token id
     * @return tickLower lower tick of the position
     * @return tickUpper upper tick of the position
     * @return liquidity raw liquidity amount of the position
     * @return tokensOwed0 amount of token 0 can be collected as fee
     * @return tokensOwed1 amount of token 1 can be collected as fee
     */
    function _getUniswapPositionInfo(address _positionManager, uint256 _tokenId)
        internal
        view
        returns (
            int24,
            int24,
            uint128,
            uint128,
            uint128
        )
    {
        INonfungiblePositionManager positionManager = INonfungiblePositionManager(_positionManager);
        (
            ,
            ,
            ,
            ,
            ,
            int24 tickLower,
            int24 tickUpper,
            uint128 liquidity,
            ,
            ,
            uint128 tokensOwed0,
            uint128 tokensOwed1
        ) = positionManager.positions(_tokenId);
        return (tickLower, tickUpper, liquidity, tokensOwed0, tokensOwed1);
    }

    /**
     * @notice get balances of token0 / token1 in a uniswap position
     * @dev knowing liquidity, tick range, and current tick gives balances
     * @param _tickLower address of the uniswap position manager
     * @param _tickUpper uniswap position token id
     * @param _tick current price tick used for calculation
     * @return amount0 the amount of token0 in the uniswap position token
     * @return amount1 the amount of token1 in the uniswap position token
     */
    function _getToken0Token1Balances(
        int24 _tickLower,
        int24 _tickUpper,
        int24 _tick,
        uint128 _liquidity
    ) internal pure returns (uint256 amount0, uint256 amount1) {
        // get the current price and tick from wPowerPerp pool
        uint160 sqrtPriceX96 = TickMathExternal.getSqrtRatioAtTick(_tick);

        if (_tick < _tickLower) {
            amount0 = SqrtPriceMathPartial.getAmount0Delta(
                TickMathExternal.getSqrtRatioAtTick(_tickLower),
                TickMathExternal.getSqrtRatioAtTick(_tickUpper),
                _liquidity,
                true
            );
        } else if (_tick < _tickUpper) {
            amount0 = SqrtPriceMathPartial.getAmount0Delta(
                sqrtPriceX96,
                TickMathExternal.getSqrtRatioAtTick(_tickUpper),
                _liquidity,
                true
            );
            amount1 = SqrtPriceMathPartial.getAmount1Delta(
                TickMathExternal.getSqrtRatioAtTick(_tickLower),
                sqrtPriceX96,
                _liquidity,
                true
            );
        } else {
            amount1 = SqrtPriceMathPartial.getAmount1Delta(
                TickMathExternal.getSqrtRatioAtTick(_tickLower),
                TickMathExternal.getSqrtRatioAtTick(_tickUpper),
                _liquidity,
                true
            );
        }
    }
}
