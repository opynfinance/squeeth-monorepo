//SPDX-License-Identifier: MIT
pragma solidity =0.7.6;

// interface
import {IController} from "../../interfaces/IController.sol";
import {IWETH9} from "../../interfaces/IWETH9.sol";

// contract
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// lib
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";

/**
 * @dev StrategyBase contract
 * @notice Base contract for PowerToken strategy
 * @author Opyn team
 */
contract StrategyBase is ERC20 {
    using SafeMath for uint256;
    using Address for address payable;

    /// @dev WETH token
    IWETH9 public weth;
    /// @dev Power token controller
    IController public powerTokenController;

    /// @dev Strategy vault ID
    uint256 internal _vaultId;

    /// @dev emit when strategy open short position
    event OpenVault(uint256 vaultId);

    /**
     * @notice Strategy base constructor
     * @dev this will open a vault in the power token contract and store vault ID
     * @param _powerTokenController power token controller address
     * @param _weth weth token address
     */
    constructor(address _powerTokenController, address _weth, string memory _name, string memory _symbol) ERC20(_name, _symbol) {
        require(_powerTokenController != address(0), "invalid power token controller address");
        require(_weth != address(0), "invalid weth address");

        weth = IWETH9(_weth);
        powerTokenController = IController(_powerTokenController);

        _openVault();
    }

    /**
     * @notice Get strategy vault ID in Squeeth contract
     * @return vauld ID
     */
    function getStrategyVaultId() external view returns (uint256) {
        return _vaultId;
    }
    
    /**
     * @notice Open a short vault
     * @dev Should only be called at constructor
     */
    function _openVault() internal {
        uint256 shortVaultId = powerTokenController.mintWPowerPerpAmount(0, 0, 0);

        _vaultId = shortVaultId;

        emit OpenVault(shortVaultId);
    }
}

