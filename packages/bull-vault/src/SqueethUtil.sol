// SPDX-License-Identifier: GPL-3.0-only
pragma solidity =0.7.6;

pragma abicoder v2;

// interface
import {IController} from "squeeth-monorepo/interfaces/IController.sol";
import {IWPowerPerp} from "squeeth-monorepo/interfaces/IWPowerPerp.sol";
// lib
import {VaultLib} from "squeeth-monorepo/libs/VaultLib.sol";

/**
 * @dev SqueethUtil contract
 * @notice implementation of function to interact with Squeeth contract
 * @author opyn team
 */
contract SqueethUtil {
    /// @dev power token controller
    IController public powerTokenController;

    address public immutable wPowerPerp;

    /// @dev power token strategy vault ID
    uint256 public immutable vaultId;

    /**
     * @notice constructor for SqueethUtil
     * @dev this will open a vault in squeeth contract and store the vault ID
     * @param _powerTokenController power token controller address
     */
    constructor(address _powerTokenController) {
        require(_powerTokenController != address(0), "invalid controller address");

        powerTokenController = IController(_powerTokenController);
        wPowerPerp = address(powerTokenController.wPowerPerp());
        vaultId = powerTokenController.mintWPowerPerpAmount(0, 0, 0);
    }
    /**
     * @notice get power token strategy vault ID 
     * @return vault ID
     */
    function getStrategyVaultId() external view returns (uint256) {
        return vaultId;
    }

    /**
     * @notice get the vault composition of the strategy 
     * @return operator
     * @return nft collateral id
     * @return collateral amount
     * @return short amount
    */
    function getVaultDetails() external view returns (address, uint256, uint256, uint256) {
        return _getVaultDetails();
    }

    /**
     * @notice mint WPowerPerp and deposit collateral
     * @dev this function will not send WPowerPerp to msg.sender if _keepWSqueeth == true
     * @param _wAmount amount of WPowerPerp to mint
     * @param _collateral amount of collateral to deposit
     */
    function _mintWPowerPerp(
        uint256 _wAmount,
        uint256 _collateral
    ) internal {
        powerTokenController.mintWPowerPerpAmount{value: _collateral}(vaultId, _wAmount, 0);
    }

    /**
     * @notice burn WPowerPerp and withdraw collateral
     * @dev this function will not take WPowerPerp from msg.sender if _isOwnedWSqueeth == true
     * @param _from WPowerPerp holder address
     * @param _amount amount of wPowerPerp to burn
     * @param _collateralToWithdraw amount of collateral to withdraw
     * @param _isOwnedWSqueeth transfer WPowerPerp from holder if it is set to false
     */
    function _burnWPowerPerp(
        address _from,
        uint256 _amount,
        uint256 _collateralToWithdraw,
        bool _isOwnedWSqueeth
    ) internal {
        if (!_isOwnedWSqueeth) {
            IWPowerPerp(wPowerPerp).transferFrom(_from, address(this), _amount);
        }

        powerTokenController.burnWPowerPerpAmount(vaultId, _amount, _collateralToWithdraw);
    }

    /**
     * @notice get the vault composition of the strategy 
     * @return operator
     * @return nft collateral id
     * @return collateral amount
     * @return short amount
     */
    function _getVaultDetails() internal view returns (address, uint256, uint256, uint256) {
        VaultLib.Vault memory strategyVault = powerTokenController.vaults(vaultId);

        return (strategyVault.operator, strategyVault.NftCollateralId, strategyVault.collateralAmount, strategyVault.shortAmount);
    }
}