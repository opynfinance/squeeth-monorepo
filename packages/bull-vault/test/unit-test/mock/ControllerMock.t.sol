// SPDX-License-Identifier: GPL-2.0-or-later

pragma solidity =0.7.6;

import "forge-std/Test.sol";
import {SafeMath} from "openzeppelin/math/SafeMath.sol";
import {VaultLib} from "squeeth-monorepo/libs/VaultLib.sol";
import {Address} from "openzeppelin/utils/Address.sol";

contract ControllerMock is Test {
    using SafeMath for uint256;
    using VaultLib for VaultLib.Vault;
    using Address for address payable;

    uint256 internal constant secInDay = 86400;

    address public weth;
    address public quoteCurrency;
    address public ethQuoteCurrencyPool;
    address public wPowerPerp;
    address public wPowerPerpPool;
    address public quoteCurrency;

    uint256 public normalizationFactor;
    uint256 public feeRate = 0;

    /// @dev The token ID vault data
    mapping(uint256 => VaultLib.Vault) public vaults;

    constructor(
        address _weth,
        address _quoteCurrency,
        address _ethQuoteCurrencyPool,
        address _wPowerPerp,
        address _wPowerPerpPool,
        address _quoteCurrency
    ) public {
        weth = _weth;
        quoteCurrency = _quoteCurrency;
        ethQuoteCurrencyPool = _ethQuoteCurrencyPool;
        wPowerPerp = _wPowerPerp;
        wPowerPerpPool = _wPowerPerpPool;
        quoteCurrency = _quoteCurrency;

        normalizationFactor = 1e18;
    }

    function mintWPowerPerpAmount(
        uint256 _vaultId,
        uint256 _mintAmount,
        uint256 /*_nftTokenId*/
    ) external payable returns (uint256, uint256) {
        uint256 wPowerPerpMinted;

        if (_vaultId == 0) _vaultId = _openVault(msg.sender);
        if (msg.value > 0) _addEthCollateral(_vaultId, msg.value);
        if (_mintAmount > 0) {
            wPowerPerpMinted = _addShort(msg.sender, _vaultId, _mintAmount);
        }

        return (_vaultId, wPowerPerpMinted);
    }

    function burnWPowerPerpAmount(
        uint256 _vaultId,
        uint256 _amount,
        uint256 _withdrawAmount
    ) external {
        require(_canModifyVault(_vaultId, msg.sender), "C3");

        if (_amount > 0) _removeShort(msg.sender, _vaultId, _amount);
        if (_withdrawAmount > 0) _withdrawCollateral(msg.sender, _vaultId, _withdrawAmount);
        if (_withdrawAmount > 0) payable(msg.sender).sendValue(_withdrawAmount);
    }

    function _openVault(address _recipient) internal returns (uint256) {
        uint256 vaultId = shortPowerPerp.mintNFT(_recipient);
        vaults[vaultId] = VaultLib.Vault({
            NftCollateralId: 0,
            collateralAmount: 0,
            shortAmount: 0,
            operator: address(0)
        });

        return vaultId;
    }

    function _addEthCollateral(uint256 _vaultId, uint256 _amount) internal {
        VaultLib.Vault memory cachedVault = vaults[_vaultId];
        cachedVault.addEthCollateral(uint128(_amount));
        vaults[_vaultId] = cachedVault;
    }

    function _withdrawCollateral(
        address, /*_account*/
        uint256 _vaultId,
        uint256 _amount
    ) internal {
        VaultLib.Vault memory cachedVault = vaults[_vaultId];
        cachedVault.removeEthCollateral(_amount);
        vaults[_vaultId] = cachedVault;
    }

    function _addShort(
        address _account,
        uint256 _vaultId,
        uint256 _wPowerPerpAmount
    ) internal returns (uint256 amountToMint) {
        require(_canModifyVault(_vaultId, _account), "C3");

        amountToMint = _wPowerPerpAmount.mul(1e18).div(normalizationFactor);

        VaultLib.Vault memory cachedVault = vaults[_vaultId];
        cachedVault.addShort(amountToMint);
        vaults[_vaultId] = cachedVault;

        wPowerPerp.mint(_account, amountToMint);
    }

    function _removeShort(
        address _account,
        uint256 _vaultId,
        uint256 _amount
    ) internal {
        VaultLib.Vault memory cachedVault = vaults[_vaultId];
        cachedVault.removeShort(_amount);
        vaults[_vaultId] = cachedVault;

        wPowerPerp.burn(_account, _amount);
    }

    function getExpectedNormalizationFactor() external view returns (uint256) {
        return normalizationFactor;
    }
}
