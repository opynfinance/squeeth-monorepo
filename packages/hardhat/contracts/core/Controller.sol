//SPDX-License-Identifier: MIT

pragma solidity >=0.8.0 <0.9.0;

import {ERC721Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import {VaultLib} from "../libs/VaultLib.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IVaultManagerNFT} from "../interfaces/IVaultManagerNFT.sol";

contract Controller is Initializable {
    using VaultLib for VaultLib.Vault;
    using Address for address payable;

    /// @dev The token ID vault data
    mapping(uint256 => VaultLib.Vault) public vaults;

    IVaultManagerNFT vaultNFT;
    IERC20 squeeth;

    uint256 public normalizedFactor;
    uint256 public lastUpdateTimestamp;

    /// Events
    event DepositCollateral(address indexed collateral, uint128 amount, uint128 vaultId, uint128 collateralId);
    event WithdrawCollateral(address indexed collateral, uint128 amount, uint128 vaultId, uint128 collateralId);

    /**
     * init controller with squeeth and short NFT address.
     */
    function init(address _vaultNFT, address _squeeth) public initializer {
        squeeth = IERC20(_squeeth);
        vaultNFT = IVaultManagerNFT(_vaultNFT);
    }

    /**
     * mint new NFT, create a new vault struct
     */
    function openVault(address recipient) external returns (uint256 tokenId) {
        _applyFunding();

        // mint NFT
        tokenId = vaultNFT.mintNFT(recipient);

        vaults[tokenId] = VaultLib.Vault({NFTCollateralId: 0, collateralAmount: 0, shortAmount: 0});
    }

    /**
     * Operations with ETH
     */

    function addETHCollateral(uint128 _vaultId) external payable {
        _applyFunding();
        vaults[_vaultId].collateralAmount += uint128(msg.value);
        emit DepositCollateral(address(0), uint128(msg.value), _vaultId, 0);
    }

    function withdrawETHCollateral(uint128 _id, uint128 _amount) external {
        require(vaultNFT.ownerOf(_id) == msg.sender, "not allowed");
        _applyFunding();
        vaults[_id].collateralAmount -= uint128(_amount);
        payable(msg.sender).sendValue(_amount);
        _checkVault(_id);
        emit DepositCollateral(address(0), uint128(_amount), _id, 0);
    }

    /**
     * Operations with Squeeth
     */

    /**
     * gloabl checks and state modifying functions
     */
    function _applyFunding() internal {
        if (block.timestamp == lastUpdateTimestamp) return;
        // todo: apply funding by updating normalizedFactor
        lastUpdateTimestamp = block.timestamp;
    }

    function _checkVault(uint128 _vaultId) internal view {
        VaultLib.Vault memory _vault = vaults[_vaultId];
        // todo: read eth price and squeeth from oracle
        uint128 _ethPrice = 1000;
        uint128 _squeethPriceInEth = 1100;
        require(_vault.isProperlyCollateralized(_ethPrice, _squeethPriceInEth), "Invalid state");
    }
}
