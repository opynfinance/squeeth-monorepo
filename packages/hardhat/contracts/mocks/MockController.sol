// SPDX-License-Identifier: MIT

pragma solidity =0.7.6;

import {IVaultManagerNFT} from "../interfaces/IVaultManagerNFT.sol";

import {VaultLib} from "../libs/VaultLib.sol";

contract MockController {
    uint256 internal constant secInDay = 86400;

    /// @dev The token ID vault data
    mapping(uint256 => VaultLib.Vault) public vaults;

    IVaultManagerNFT public vaultNFT;

    function init(address _vaultNFT) public {
        require(_vaultNFT != address(0), "Invalid vaultNFT address");

        vaultNFT = IVaultManagerNFT(_vaultNFT);
    }

    function mint(
        uint256 _vaultId,
        uint128 _mintAmount,
        uint256 _nftTokenId
    ) external payable returns (uint256, uint256) {
        if (_vaultId == 0) _vaultId = _openVault(msg.sender);

        return (_vaultId, 0);
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
}
