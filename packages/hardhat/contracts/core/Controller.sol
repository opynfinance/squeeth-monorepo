//SPDX-License-Identifier: MIT

pragma solidity >=0.8.0 <0.9.0;

import {ERC721Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import {VaultLib} from "../libs/VaultLib.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IWSqueeth} from "../interfaces/IWSqueeth.sol";
import {IVaultManagerNFT} from "../interfaces/IVaultManagerNFT.sol";

contract Controller is Initializable {
    using VaultLib for VaultLib.Vault;
    using Address for address payable;

    /// @dev The token ID vault data
    mapping(uint256 => VaultLib.Vault) public vaults;

    IVaultManagerNFT public vaultNFT;
    IWSqueeth public squeeth;

    uint256 public normalizedFactor;
    uint256 public lastUpdateTimestamp;

    /// Events
    event OpenVault(uint256 vaultId);
    event CloseVault(uint256 vaultId);
    event DepositCollateral(uint256 vaultId, uint128 amount, uint128 collateralId);
    event WithdrawCollateral(uint256 vaultId, uint128 amount, uint128 collateralId);
    event MintSqueeth(uint128 amount, uint256 vaultId);
    event BurnSqueeth(uint128 amount, uint256 vaultId);

    /**
     * init controller with squeeth and short NFT address.
     */
    function init(address _vaultNFT, address _squeeth) public initializer {
        squeeth = IWSqueeth(_squeeth);
        vaultNFT = IVaultManagerNFT(_vaultNFT);
    }

    /**
     * put down collateral and mint squeeth.
     */
    function mint(uint256 _vaultId, uint128 _mintAmount) external payable {
        _applyFunding();
        if (_vaultId == 0) _vaultId = _openVault(msg.sender);
        if (msg.value > 0) _depositETHCollateral(_vaultId, msg.value);
        if (_mintAmount > 0) _mintSqueeth(msg.sender, _vaultId, _mintAmount);
        _checkVault(_vaultId);
    }

    /**
     * Deposit collateral into a vault
     */
    function deposit(uint256 _vaultId) external payable {
        _applyFunding();
        _depositETHCollateral(_vaultId, msg.value);
    }

    /**
     * Withdraw collateral from a vault.
     */
    function withdraw(uint256 _vaultId, uint256 _amount) external payable {
        _applyFunding();
        _withdrawCollateral(_vaultId, _amount);
        _checkVault(_vaultId);
    }

    /**
     * burn squueth and remove collateral from a vault.
     */
    function burn(
        uint256 _vaultId,
        uint128 _amount,
        uint128 _withdrawAmount
    ) external {
        _applyFunding();
        if (_amount > 0) _burnSqueeth(msg.sender, _vaultId, _amount);
        if (_withdrawAmount > 0) _withdrawCollateral(_vaultId, _withdrawAmount);
        if (vaults[_vaultId].isEmpty()) _closeVault(_vaultId);
        _checkVault(_vaultId);
    }

    /**
     * Internal functions
     */

    /**
     * create a new vault and bind it with a new NFT id.
     */
    function _openVault(address _recipient) internal returns (uint256 vaultId) {
        vaultId = vaultNFT.mintNFT(_recipient);
        vaults[vaultId] = VaultLib.Vault({NFTCollateralId: 0, collateralAmount: 0, shortAmount: 0});
        emit OpenVault(vaultId);
    }

    /**
     * remove vault data and burn corresponding NFT
     */
    function _closeVault(uint256 _vaultId) internal {
        require(vaultNFT.ownerOf(_vaultId) == msg.sender, "not allowed");
        vaultNFT.burnNFT(_vaultId);
        delete vaults[_vaultId];
        emit CloseVault(_vaultId);
    }

    /**
     * add collateral to a vault
     */
    function _depositETHCollateral(uint256 _vaultId, uint256 _amount) internal {
        vaults[_vaultId].collateralAmount += uint128(_amount);
        emit DepositCollateral(_vaultId, uint128(_amount), 0);
    }

    /**
     * remove collateral from the vault
     */
    function _withdrawCollateral(uint256 _vaultId, uint256 _amount) internal {
        require(vaultNFT.ownerOf(_vaultId) == msg.sender, "not allowed");
        vaults[_vaultId].collateralAmount -= uint128(_amount);
        payable(msg.sender).sendValue(_amount);
        emit WithdrawCollateral(_vaultId, uint128(_amount), 0);
    }

    /**
     * mint squeeth (ERC20) to an account
     */
    function _mintSqueeth(
        address _account,
        uint256 _vaultId,
        uint128 _amount
    ) internal {
        require(vaultNFT.ownerOf(_vaultId) == _account, "not allowed");
        vaults[_vaultId].shortAmount += _amount;
        emit MintSqueeth(_amount, _vaultId);

        squeeth.mint(_account, _amount);
    }

    /**
     * burn squeeth (ERC20) from an account.
     */
    function _burnSqueeth(
        address _account,
        uint256 _vaultId,
        uint128 _amount
    ) internal {
        vaults[_vaultId].shortAmount -= _amount;
        emit BurnSqueeth(_amount, _vaultId);

        squeeth.burn(_account, _amount);
    }

    /**
     * Update the normalized factor as a way to pay funding.
     */
    function _applyFunding() internal {
        if (block.timestamp == lastUpdateTimestamp) return;
        // todo: apply funding by updating normalizedFactor
        lastUpdateTimestamp = block.timestamp;
    }

    /**
     * @dev check that the vault is solvent and have enough collateral.
     */
    function _checkVault(uint256 _vaultId) internal view {
        VaultLib.Vault memory _vault = vaults[_vaultId];
        // todo: read eth price and squeeth from oracle
        uint128 _ethPrice = 1000;
        uint128 _squeethPriceInEth = 1100;
        require(_vault.isProperlyCollateralized(_ethPrice, _squeethPriceInEth), "Invalid state");
    }
}
