//SPDX-License-Identifier: MIT
pragma solidity =0.7.6;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {INonfungiblePositionManager} from "@uniswap/v3-periphery/contracts/interfaces/INonfungiblePositionManager.sol";
import {IUniswapV3Pool} from "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";

import "@uniswap/v3-core/contracts/libraries/TickMath.sol";
import "@uniswap/v3-core/contracts/libraries/SqrtPriceMath.sol";

library VaultLib {
    using SafeMath for uint256;

    struct Vault {
        // the address who can update the vault.
        address operator;
        // uniswap v3 position token id deposited into the vault to increase collateral ratio
        // 2^32 is 4,294,967,296. If Uniswap has more than 4 billion positions, our vault structure might stop working.
        uint32 NftCollateralId;
        // amount of eth (wei) used in the vault as collateral
        // uint96 is safe enough cuz 2^96 / 1e18 = 79,228,162,514, which means a vault can store up to 79 billion eth.
        // when we need to do calculations, we always cast this number to uint256 to avoid overflow.
        uint96 collateralAmount;
        // amount of wPowerPerp minted from the vault
        uint128 shortAmount;
    }

    function addEthCollateral(Vault memory _vault, uint256 _amount) internal pure {
        _vault.collateralAmount = uint96(uint256(_vault.collateralAmount).add(_amount));
    }

    function addUniNftCollateral(Vault memory _vault, uint256 _tokenId) internal pure {
        require(_vault.NftCollateralId == 0, "Vault already had nft");
        require(_tokenId != 0, "Invalid token id");
        _vault.NftCollateralId = uint32(_tokenId);
    }

    function removeEthCollateral(Vault memory _vault, uint256 _amount) internal pure {
        _vault.collateralAmount = uint96(uint256(_vault.collateralAmount).sub(_amount));
    }

    function removeUniNftCollateral(Vault memory _vault) internal pure {
        require(_vault.NftCollateralId != 0, "Vault has no NFT");
        _vault.NftCollateralId = 0;
    }

    function addShort(Vault memory _vault, uint256 _amount) internal pure {
        _vault.shortAmount = uint128(uint256(_vault.shortAmount).add(_amount));
    }

    function removeShort(Vault memory _vault, uint256 _amount) internal pure {
        _vault.shortAmount = uint128(uint256(_vault.shortAmount).sub(_amount));
    }

    /**
     * @dev see if a vault is properly collateralized
     * @param _vault the vault we want to check
     * @param _positionManager address of the uni v3 position manager
     * @param _normalizationFactor current _normalizationFactor
     * @param _ethDaiPrice current eth price scaled by 1e18
     * @param _minCollateral min collateral need to be in a vault
     * @param _wsqueethPoolTick current price tick for wsqueeth pool
     * @param _isWethToken0 whether weth is token0 in the wsqueeth pool
     * @return true if the vault is above water.
     * @return true if the vault is considered as a dust vault.
     */
    function getVaultStatus(
        Vault memory _vault,
        address _positionManager,
        uint256 _normalizationFactor,
        uint256 _ethDaiPrice,
        uint256 _minCollateral,
        int24 _wsqueethPoolTick,
        bool _isWethToken0
    ) internal view returns (bool, bool) {
        if (_vault.shortAmount == 0) return (true, false);
        return
            _getVaultStatus(
                _vault,
                _positionManager,
                _normalizationFactor,
                _ethDaiPrice,
                _minCollateral,
                _wsqueethPoolTick,
                _isWethToken0
            );
    }

    /**
     * @dev see if a vault is properly collateralized
     * @param _vault the vault we want to check
     * @param _positionManager address of the uni v3 position manager
     * @param _normalizationFactor current _normalizationFactor
     * @param _ethDaiPrice current eth price scaled by 1e18
     * @param _minCollateral min collateral need to be in a vault
     * @param _wsqueethPoolTick current price tick for wsqueeth pool
     * @param _isWethToken0 whether weth is token0 in the wsqueeth pool
     * @return true if the vault is above water.
     * @return true if the vault is considered as a dust vault.
     */
    function _getVaultStatus(
        Vault memory _vault,
        address _positionManager,
        uint256 _normalizationFactor,
        uint256 _ethDaiPrice,
        uint256 _minCollateral,
        int24 _wsqueethPoolTick,
        bool _isWethToken0
    ) internal view returns (bool, bool) {
        uint256 debtValueInETH = uint256(_vault.shortAmount).mul(_normalizationFactor).mul(_ethDaiPrice).div(1e36);
        uint256 totalCollateral = _getEffectiveCollateral(
            _vault,
            _positionManager,
            _normalizationFactor,
            _ethDaiPrice,
            _wsqueethPoolTick,
            _isWethToken0
        );
        bool isDust = totalCollateral < _minCollateral;
        bool isAboveWater = totalCollateral.mul(2) >= debtValueInETH.mul(3);
        return (isAboveWater, isDust);
    }

    /**
     * @notice get the total effective collateral of a vault, which is:
     *         collateral amount + uni position token equivelent amount of eth.
     * @param _vault the vault we want to check
     * @param _positionManager address of the uni v3 position manager
     * @param _normalizationFactor current _normalizationFactor
     * @param _ethDaiPrice current eth price scaled by 1e18
     * @param _wsqueethPoolTick current price tick for wsqueeth pool
     * @param _isWethToken0 whether weth is token0 in the wsqueeth pool
     * @return the total worth of collateral in the vault
     */
    function _getEffectiveCollateral(
        Vault memory _vault,
        address _positionManager,
        uint256 _normalizationFactor,
        uint256 _ethDaiPrice,
        int24 _wsqueethPoolTick,
        bool _isWethToken0
    ) internal view returns (uint256) {
        if (_vault.NftCollateralId == 0) return _vault.collateralAmount;

        // the user has deposit univ3 position token as collateral, see how much eth / squeeth the LP token has.
        (uint256 nftEthAmount, uint256 nftWsqueethAmount) = _getUniPositionBalances(
            _positionManager,
            _vault.NftCollateralId,
            _wsqueethPoolTick,
            _isWethToken0
        );
        // convert squeeth amount from NFT as equivalent amount of collateral.
        uint256 equivalentCollateral = nftWsqueethAmount.mul(_normalizationFactor).mul(_ethDaiPrice).div(1e36);
        // add ETH value from NFT as collateral.
        return nftEthAmount.add(equivalentCollateral).add(_vault.collateralAmount);
    }

    /**
     * @notice get how much eth / squeeth the LP position is worth.
     * @param _positionManager address of the uni v3 position manager
     * @param _tokenId lp token id
     * @param _wsqueethPoolTick current price tick
     * @param _isWethToken0 whether weth is token0 in the pool
     * @return ethAmount the eth amount thie LP token is worth
     * @return squeethAmount the squeeth amount this LP token is worth
     */
    function _getUniPositionBalances(
        address _positionManager,
        uint256 _tokenId,
        int24 _wsqueethPoolTick,
        bool _isWethToken0
    ) internal view returns (uint256 ethAmount, uint256 squeethAmount) {
        (int24 tickLower, int24 tickUpper, uint128 liquidity) = _getUniswapPositionInfo(_positionManager, _tokenId);
        (uint256 amount0, uint256 amount1) = _getToken0Token1Balances(
            tickLower,
            tickUpper,
            _wsqueethPoolTick,
            liquidity
        );
        return (_isWethToken0 ? amount0 : amount1, _isWethToken0 ? amount1 : amount0);
    }

    /**
     * @notice get the LP info and tick bond of the LP position.
     * @param _positionManager address of the uni v3 position manager
     * @param _tokenId LP token id
     * @return tickLower lower tick of the position
     * @return tickUpper upper tick of the position
     * @return liquidity raw liquidity amount of the position
     */
    function _getUniswapPositionInfo(address _positionManager, uint256 _tokenId)
        internal
        view
        returns (
            int24,
            int24,
            uint128
        )
    {
        INonfungiblePositionManager positionManager = INonfungiblePositionManager(_positionManager);
        (, , , , , int24 tickLower, int24 tickUpper, uint128 liquidity, , , , ) = positionManager.positions(_tokenId);
        return (tickLower, tickUpper, liquidity);
    }

    /**
     * @notice get how much token0 / token1 a LP position is worth.
     * @param _tickLower address of the uni v3 position manager
     * @param _tickUpper LP token id
     * @param _tick current price tick used for calculation
     * @return amount0 the amount of token0 this LP token is worth
     * @return amount1 the amount of token1 this LP token is worth
     */
    function _getToken0Token1Balances(
        int24 _tickLower,
        int24 _tickUpper,
        int24 _tick,
        uint128 _liquidity
    ) internal pure returns (uint256 amount0, uint256 amount1) {
        // get the current price and tick from squeethPool
        uint160 sqrtPriceX96 = TickMath.getSqrtRatioAtTick(_tick);

        // the following line is copied from the _modifyPosition function implemented by Uniswap core.
        // we use the same logic to determine how much token0, token1 equals to given "liquidity"
        // https://github.com/Uniswap/uniswap-v3-core/blob/b2c5555d696428c40c4b236069b3528b2317f3c1/contracts/UniswapV3Pool.sol#L306

        // use these 2 functions directly, cuz liquidity is always positive
        // getAmount0Delta: https://github.com/Uniswap/uniswap-v3-core/blob/b2c5555d696428c40c4b236069b3528b2317f3c1/contracts/libraries/SqrtPriceMath.sol#L209
        // getAmount1Delta: https://github.com/Uniswap/uniswap-v3-core/blob/b2c5555d696428c40c4b236069b3528b2317f3c1/contracts/libraries/SqrtPriceMath.sol#L225

        if (_tick < _tickLower) {
            amount0 = SqrtPriceMath.getAmount0Delta(
                TickMath.getSqrtRatioAtTick(_tickLower),
                TickMath.getSqrtRatioAtTick(_tickUpper),
                _liquidity,
                true
            );
        } else if (_tick < _tickUpper) {
            amount0 = SqrtPriceMath.getAmount0Delta(
                sqrtPriceX96,
                TickMath.getSqrtRatioAtTick(_tickUpper),
                _liquidity,
                true
            );
            amount1 = SqrtPriceMath.getAmount1Delta(
                TickMath.getSqrtRatioAtTick(_tickLower),
                sqrtPriceX96,
                _liquidity,
                true
            );
        } else {
            amount1 = SqrtPriceMath.getAmount1Delta(
                TickMath.getSqrtRatioAtTick(_tickLower),
                TickMath.getSqrtRatioAtTick(_tickUpper),
                _liquidity,
                true
            );
        }
    }
}
