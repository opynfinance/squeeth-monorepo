//SPDX-License-Identifier: GPL-2.0-or-later

pragma solidity =0.7.6;
pragma abicoder v2;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";

import {IUniswapV3Pool} from "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import {IController} from "../interfaces/IController.sol";

import {IWETH9} from "../interfaces/IWETH9.sol";
import {IWPowerPerp} from "../interfaces/IWPowerPerp.sol";
import {IShortPowerPerp} from "../interfaces/IShortPowerPerp.sol";
import {IOracle} from "../interfaces/IOracle.sol";

import {VaultLib} from "../libs/VaultLib.sol";
import {Uint256Casting} from "../libs/Uint256Casting.sol";
import {Power2Base} from "../libs/Power2Base.sol";

contract LiquidationHelper  {

    using SafeMath for uint256;
    using Uint256Casting for uint256;
    using VaultLib for VaultLib.Vault;

    // constatns
    uint256 public constant MIN_COLLATERAL = 0.5 ether;
    uint32 public constant TWAP_PERIOD = 420 seconds;

    address immutable public controller;
    address immutable public oracle;
    address immutable public wPowerPerp;
    address immutable public weth;
    address immutable public quoteCurrency;
    address immutable public ethQuoteCurrencyPool;
    address immutable public wPowerPerpPool;
    address immutable public uniswapPositionManager;

    bool immutable isWethToken0;
    
    constructor(
        address _controller,
        address _oracle,
        address _wPowerPerp,
        address _weth,
        address _quoteCurrency,
        address _ethQuoteCurrencyPool,
        address _wPowerPerpPool,
        address _uniPositionManager
    ) {
        controller = _controller;
        oracle = _oracle;
        wPowerPerp = _wPowerPerp;
        weth = _weth;
        quoteCurrency = _quoteCurrency;
        ethQuoteCurrencyPool = _ethQuoteCurrencyPool;
        wPowerPerpPool = _wPowerPerpPool;
        uniswapPositionManager = _uniPositionManager;
        isWethToken0 = _weth < _wPowerPerp;
    }
    
    /**
     * @notice check the result of a call to liquidate
     * @dev can be used before sending a transaction to determine if the vault is unsafe, if vault can be saved
     * @dev the minimum wPowerPerp to repay, the maximum wPowerPerp to repay and the proceeds at max wPowerPerp to repay
     * @param _vaultId vault to liquidate
     * @return isUnsafe
     * @return isLiquidatable after reducing debt
     * @return max wPowerPerp to repay, this is only non-zero if saving a vault is not possible
     * @return proceeds at max wPowerPerp to repay, if isLiquidatable after reducing debt is false, this is the bounty for saving a vault
     */
    function checkLiquidation(uint256 _vaultId)
        external
        view
        returns (
            bool,
            bool,
            uint256,
            uint256
        )
    {
        uint256 _newNormalizationFactor = IController(controller).getExpectedNormalizationFactor();
        return _checkLiquidation(_vaultId, _newNormalizationFactor);
    }

    /**
     * @notice check that the vault has enough collateral
     * @param _vault in-memory vault
     * @param _normalizationFactor normalization factor
     * @return true if the vault is properly collateralized
     */
    function _isVaultSafe(VaultLib.Vault memory _vault, uint256 _normalizationFactor) internal view returns (bool) {
        (bool isSafe, ) = _getVaultStatus(_vault, _normalizationFactor);
        return isSafe;
    }

    /**
     * @notice return if the vault is properly collateralized and if it is a dust vault
     * @param _vault the Vault memory to update
     * @param _normalizationFactor normalization factor
     * @return true if the vault is safe
     * @return true if the vault is a dust vault
     */
    function _getVaultStatus(VaultLib.Vault memory _vault, uint256 _normalizationFactor)
        internal
        view
        returns (bool, bool)
    {
        uint256 scaledEthPrice = Power2Base._getScaledTwap(
            oracle,
            ethQuoteCurrencyPool,
            weth,
            quoteCurrency,
            TWAP_PERIOD,
            true // do not call more than maximum period so it does not revert
        );
        return
            VaultLib.getVaultStatus(
                _vault,
                uniswapPositionManager,
                _normalizationFactor,
                scaledEthPrice,
                MIN_COLLATERAL,
                IOracle(oracle).getTimeWeightedAverageTickSafe(wPowerPerpPool, TWAP_PERIOD),
                isWethToken0
            );
    }

    /**
     * @notice check the result of a call to liquidate
     * @dev can be used before sending a transaction to determine if the vault is unsafe, if vault can be saved
     * @dev the minimum wPowerPerp to repay, the maximum wPowerPerp to repay and the proceeds at max wPowerPerp to repay
     * @param _vaultId vault to liquidate
     * @return isUnsafe
     * @return isLiquidatable after reducing debt
     * @return max wPowerPerp to repay, this is only non-zero if saving a vault is not possible
     * @return proceeds at max wPowerPerp to repay, if isLiquidatable after reducing debt is false, this is the bounty for saving a vault
     */
    function _checkLiquidation(uint256 _vaultId, uint256 _normalizationFactor)
        internal
        view
        returns (
            bool,
            bool,
            uint256,
            uint256
        )
    {
        VaultLib.Vault memory cachedVault = IController(controller).vaults(_vaultId);

        if (_isVaultSafe(cachedVault, _normalizationFactor)) {
            return (false, false, 0, 0);
        }

        // if there's a Uniswap Position token in the vault, stimulate reducing debt first
        if (cachedVault.NftCollateralId != 0) {
            // using current tick to check how much nft is worth
            (, int24 spotTick, , , , , ) = IUniswapV3Pool(wPowerPerpPool).slot0();

            // simulate vault state after removing nft
            (uint256 nftEthAmount, uint256 nftWPowerperpAmount) = VaultLib._getUniPositionBalances(
                uniswapPositionManager,
                cachedVault.NftCollateralId,
                spotTick,
                isWethToken0
            );

            (, , uint256 bounty) = _getReduceDebtResultInVault(
                cachedVault,
                nftEthAmount,
                nftWPowerperpAmount,
                true
            );

            if (_isVaultSafe(cachedVault, _normalizationFactor)) {
                return (true, false, 0, bounty);
            }
            //re-add bounty if not safe after reducing debt
            cachedVault.addEthCollateral(bounty);
        }

        // assuming the max the liquidator is willing to pay full debt, this should give us the max one can liquidate
        (uint256 wMaxAmountToLiquidate, uint256 collateralToPay) = _getLiquidationResult(
            cachedVault.shortAmount,
            cachedVault.shortAmount,
            cachedVault.collateralAmount
        );

        return (true, true, wMaxAmountToLiquidate, collateralToPay);
    }

    /**
     * @notice get the expected excess, burnAmount and bounty if Uniswap position token got burned
     * @dev this function will update the vault memory in-place
     * @return burnAmount amount of wSqueeth that should be burned
     * @return wPowerPerpExcess amount of wSqueeth that should be send to the vault owner
     * @return bounty amount of bounty should be paid out to caller
     */
    function _getReduceDebtResultInVault(
        VaultLib.Vault memory _vault,
        uint256 nftEthAmount,
        uint256 nftWPowerperpAmount,
        bool _payBounty
    )
        internal
        view
        returns (
            uint256,
            uint256,
            uint256
        )
    {
        uint256 bounty;
        if (_payBounty) bounty = _getReduceDebtBounty(nftEthAmount, nftWPowerperpAmount);

        uint256 burnAmount = nftWPowerperpAmount;
        uint256 wPowerPerpExcess;

        if (nftWPowerperpAmount > _vault.shortAmount) {
            wPowerPerpExcess = nftWPowerperpAmount.sub(_vault.shortAmount);
            burnAmount = _vault.shortAmount;
        }

        _vault.removeShort(burnAmount);
        _vault.removeUniNftCollateral();
        _vault.addEthCollateral(nftEthAmount);
        _vault.removeEthCollateral(bounty);

        return (burnAmount, wPowerPerpExcess, bounty);
    }

    /**
     * @notice get how much bounty you can get by helping a vault reducing the debt.
     * @dev bounty is 2% of the total value of the position token
     * @param _ethWithdrawn amount of eth withdrawn from uniswap by redeeming the position token
     * @param _wPowerPerpReduced amount of wPowerPerp withdrawn from uniswap by redeeming the position token
     */
    function _getReduceDebtBounty(
        uint256 _ethWithdrawn,
        uint256 _wPowerPerpReduced
    ) internal view returns (uint256) {
        return
            Power2Base
                ._getDebtValueInEth(
                    _wPowerPerpReduced,
                    oracle,
                    wPowerPerpPool,
                    wPowerPerp,
                    weth
                )
                .add(_ethWithdrawn)
                .mul(2)
                .div(100);
    }

    /**
     * @notice get the expected wPowerPerp needed to liquidate a vault.
     * @dev a liquidator cannot liquidate more than half of a vault, unless only liquidating half of the debt will make the vault a "dust vault"
     * @dev a liquidator cannot take out more collateral than the vault holds
     * @param _maxWPowerPerpAmount the max amount of wPowerPerp willing to pay
     * @param _vaultShortAmount the amount of short in the vault
     * @param _maxWPowerPerpAmount the amount of collateral in the vault
     * @return finalLiquidateAmount the amount that should be liquidated. This amount can be higher than _maxWPowerPerpAmount, which should be checked
     * @return collateralToPay final amount of collateral paying out to the liquidator
     */
    function _getLiquidationResult(
        uint256 _maxWPowerPerpAmount,
        uint256 _vaultShortAmount,
        uint256 _vaultCollateralAmount
    ) internal view returns (uint256, uint256) {
        // try limiting liquidation amount to half of the vault debt
        (uint256 finalLiquidateAmount, uint256 collateralToPay) = _getSingleLiquidationAmount(
            _maxWPowerPerpAmount,
            _vaultShortAmount.div(2)
        );

        if (_vaultCollateralAmount > collateralToPay) {
            if (_vaultCollateralAmount.sub(collateralToPay) < MIN_COLLATERAL) {
                // the vault is left with dust after liquidation, allow liquidating full vault
                // calculate the new liquidation amount and collateral again based on the new limit
                (finalLiquidateAmount, collateralToPay) = _getSingleLiquidationAmount(
                    _maxWPowerPerpAmount,
                    _vaultShortAmount
                );
            }
        }

        // check if final collateral to pay is greater than vault amount.
        // if so the system only pays out the amount the vault has, which may not be profitable
        if (collateralToPay > _vaultCollateralAmount) {
            // force liquidator to pay full debt amount
            finalLiquidateAmount = _vaultShortAmount;
            collateralToPay = _vaultCollateralAmount;
        }

        return (finalLiquidateAmount, collateralToPay);
    }

    /**
     * @notice determine how much wPowerPerp to liquidate, and how much collateral to return
     * @param _maxInputWAmount maximum wPowerPerp amount liquidator is willing to repay
     * @param _maxLiquidatableWAmount maximum wPowerPerp amount a liquidator is allowed to repay
     * @return finalWAmountToLiquidate amount of wPowerPerp the liquidator will burn
     * @return collateralToPay total collateral the liquidator will get
     */
    function _getSingleLiquidationAmount(
        uint256 _maxInputWAmount,
        uint256 _maxLiquidatableWAmount
    ) internal view returns (uint256, uint256) {
        uint256 finalWAmountToLiquidate = _maxInputWAmount > _maxLiquidatableWAmount
            ? _maxLiquidatableWAmount
            : _maxInputWAmount;

        uint256 collateralToPay = Power2Base._getDebtValueInEth(
            finalWAmountToLiquidate,
            oracle,
            wPowerPerpPool,
            wPowerPerp,
            weth
        );

        // add 10% bonus for liquidators
        collateralToPay = collateralToPay.add(collateralToPay.div(10));

        return (finalWAmountToLiquidate, collateralToPay);
    }
}
