// SPDX-License-Identifier: MIT

pragma solidity =0.7.6;

import {IVaultManagerNFT} from "../interfaces/IVaultManagerNFT.sol";
import {IWPowerPerp} from "../interfaces/IWPowerPerp.sol";

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {VaultLib} from "../libs/VaultLib.sol";

contract MockController {
    using SafeMath for uint256;
    using VaultLib for VaultLib.Vault;

    uint256 internal constant secInDay = 86400;

    uint256 public normalizationFactor;

    /// @dev The token ID vault data
    mapping(uint256 => VaultLib.Vault) public vaults;

    IWPowerPerp public wPowerPerp;
    IVaultManagerNFT public vaultNFT;

    function init(address _vaultNFT, address _wPowerPerp) public {
        require(_vaultNFT != address(0), "Invalid vaultNFT address");
        require(_wPowerPerp != address(0), "Invalid wPowerPerp address");

        vaultNFT = IVaultManagerNFT(_vaultNFT);
        wPowerPerp = IWPowerPerp(_wPowerPerp);

        normalizationFactor = 1e18;
    }

    function mintWPowerPerpAmount(
        uint256 _vaultId,
        uint128 _mintAmount,
        uint256 /*_nftTokenId*/
    ) external payable returns (uint256, uint256) {
        uint256 wSqueethMinted;

        if (_vaultId == 0) _vaultId = _openVault(msg.sender);
        if (msg.value > 0) _addEthCollateral(_vaultId, msg.value);
        if (_mintAmount > 0) {
            wSqueethMinted = _addShort(msg.sender, _vaultId, _mintAmount);
        }

        return (_vaultId, wSqueethMinted);
    }

    function _openVault(address _recipient) internal returns (uint256) {
        uint256 vaultId = vaultNFT.mintNFT(_recipient);
        vaults[vaultId] = VaultLib.Vault({
            NftCollateralId: 0,
            collateralAmount: 0,
            shortAmount: 0,
            operator: address(0)
        });

        return vaultId;
    }

    function _addEthCollateral(uint256 _vaultId, uint256 _amount) internal view {
        vaults[_vaultId].addEthCollateral(uint128(_amount));
    }

    function _addShort(
        address _account,
        uint256 _vaultId,
        uint256 _squeethAmount
    ) internal returns (uint256 amountToMint) {
        require(_canModifyVault(_vaultId, _account), "not allowed");

        amountToMint = _squeethAmount.mul(1e18).div(normalizationFactor);
        vaults[_vaultId].addShort(amountToMint);
        wPowerPerp.mint(_account, amountToMint);
    }

    function _canModifyVault(uint256 _vaultId, address _account) internal view returns (bool) {
        return vaultNFT.ownerOf(_vaultId) == _account || vaults[_vaultId].operator == _account;
    }
}
