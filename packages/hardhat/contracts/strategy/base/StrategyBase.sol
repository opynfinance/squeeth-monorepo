//SPDX-License-Identifier: MIT
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
    uint256 public immutable _vaultId;
    /// @dev strategy debt amount
    uint256 internal _strategyDebt;
    /// @dev strategy collateral amount
    uint256 internal _strategyCollateral;

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
        _vaultId = powerTokenController.mintWPowerPerpAmount(0, 0, 0);
    }
    /**
     * @notice get power token strategy vault ID 
     * @return vault ID
     */
    function getStrategyVaultId() external view returns (uint256) {
        return _vaultId;
    }

    /**
     * @notice get strategy debt amount
     * @return debt amount
     */
    function getStrategyDebt() external view returns (uint256) {
        return _strategyDebt;
    }

    /**
     * @notice get strategy collateral amount
     * @return collateral amount
     */
    function getStrategyCollateral() external view returns (uint256) {
        return _strategyCollateral;
    }

    /**
     * @notice mint WPowerPerp
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
        _strategyCollateral = _strategyCollateral.add(_collateral);
        _strategyDebt = _strategyDebt.add(_wAmount);

        powerTokenController.mintWPowerPerpAmount{value: _collateral}(_vaultId, uint128(_wAmount), 0);

        if (!_keepWsqueeth) {
            IWPowerPerp(wPowerPerp).transfer(_to, _wAmount);
        }
    }

    /**
     * @notice burn WPowerPerp
     * @dev this function will not take WPowerPerp from msg.sender if _isOwnedWSqueeth == true
     * @param _from WPowerPerp holder address
     * @param _amount amount to burn
     * @param _collateralToWithdraw amount of collateral to unlock from WPowerPerp vault
     * @param _isOwnedWSqueeth transfer WPowerPerp from holder if it is set to false
     */
    function _burnWPowerPerp(
        address _from,
        uint256 _amount,
        uint256 _collateralToWithdraw,
        bool _isOwnedWSqueeth
    ) internal {
        _strategyDebt = _strategyDebt.sub(_amount);
        _strategyCollateral = _strategyCollateral.sub(_collateralToWithdraw);

        if (!_isOwnedWSqueeth) {
            IWPowerPerp(wPowerPerp).transferFrom(_from, address(this), _amount);
        }

        powerTokenController.burnWPowerPerpAmount(_vaultId, _amount, _collateralToWithdraw);
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
     * @notice get strategy debt amount from specific strategy token amount
     * @param _strategyAmount strategy amount
     * @return debt amount
     */
    function _getDebtFromStrategyAmount(uint256 _strategyAmount) internal view returns (uint256) {
        (, , ,uint256 strategyDebt) = _getVaultDetails();
        return strategyDebt.wmul(_strategyAmount).wdiv(totalSupply());
    }

    /**
     * @notice get strategy vault details
     * @return operator address, vault NFT id, short and collateral amounts
     */
    function _getVaultDetails() internal view returns (address, uint256, uint256, uint256) {
        VaultLib.Vault memory strategyVault = powerTokenController.vaults(_vaultId);

        return (strategyVault.operator, strategyVault.NftCollateralId, strategyVault.collateralAmount, strategyVault.shortAmount);
    }
}

