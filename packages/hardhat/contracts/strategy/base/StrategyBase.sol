// SPDX-License-Identifier: GPL-2.0-or-later

pragma solidity =0.7.6;

pragma abicoder v2;

// interface
import {IController} from "../../interfaces/IController.sol";
import {IWPowerPerp} from "../../interfaces/IWPowerPerp.sol";

// contract
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// lib
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {StrategyMath} from "./StrategyMath.sol";
import {VaultLib} from "../../libs/VaultLib.sol";

/**
 * @dev StrategyBase contract
 * @notice base contract for PowerToken strategy
 * @author opyn team
 */
contract StrategyBase is ERC20 {
    using StrategyMath for uint256;
    using Address for address payable;

    /// @dev power token controller
    IController public powerTokenController;

    /// @dev WETH token
    address public immutable weth;
    address public immutable wPowerPerp;

    /// @dev power token strategy vault ID
    uint256 public immutable vaultId;

    /**
     * @notice constructor for StrategyBase
     * @dev this will open a vault in the power token contract and store the vault ID
     * @param _powerTokenController power token controller address
     * @param _weth weth token address
     * @param _name token name for strategy ERC20 token
     * @param _symbol token symbol for strategy ERC20 token
     */
    constructor(address _powerTokenController, address _weth, string memory _name, string memory _symbol) ERC20(_name, _symbol) {
        require(_powerTokenController != address(0), "invalid power token controller address");
        require(_weth != address(0), "invalid weth address");

        weth = _weth;
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
     * @param _to receiver address
     * @param _wAmount amount of WPowerPerp to mint
     * @param _collateral amount of collateral to deposit
     * @param _keepWsqueeth keep minted wSqueeth in this contract if it is set to true
     */
    function _mintWPowerPerp(
        address _to,
        uint256 _wAmount,
        uint256 _collateral,
        bool _keepWsqueeth
    ) internal {
        powerTokenController.mintWPowerPerpAmount{value: _collateral}(vaultId, _wAmount, 0);

        if (!_keepWsqueeth) {
            IWPowerPerp(wPowerPerp).transfer(_to, _wAmount);
        }
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
     * @notice mint strategy token
     * @param _to recepient address
     * @param _amount token amount
     */
    function _mintStrategyToken(address _to, uint256 _amount) internal {
        _mint(_to, _amount);
    }

    /**
     * @notice get strategy debt amount for a specific strategy token amount
     * @param _strategyAmount strategy amount
     * @return debt amount
     */
    function _getDebtFromStrategyAmount(uint256 _strategyAmount) internal view returns (uint256) {
        (, , ,uint256 strategyDebt) = _getVaultDetails();
        return strategyDebt.wmul(_strategyAmount).wdiv(totalSupply());
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

