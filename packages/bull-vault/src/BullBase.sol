// SPDX-License-Identifier: GPL-3.0-only
pragma solidity =0.7.6;

// contract
import {ERC20} from "openzeppelin/contracts/token/ERC20/ERC20.sol";
// lib
import {StrategyMath} from "squeeth-monorepo/strategy/base/StrategyMath.sol";    // StrategyMath licensed under AGPL-3.0-only

/**
 * @dev BullBase contract
 * @notice base contract for PowerToken strategy
 * @author opyn team
 */
contract BullBase is ERC20 {
    using StrategyMath for uint256;

    /**
     * @notice constructor for BullBase
     * @dev this will open a vault in the power token contract and store the vault ID
     * @param _powerTokenController power token controller address
     * @param _name token name for strategy ERC20 token
     * @param _symbol token symbol for strategy ERC20 token
     */
    constructor(address _powerTokenController, string memory _name, string memory _symbol) ERC20(_name, _symbol) {
    }

    /**
     * @notice mint strategy token
     * @param _to recepient address
     * @param _amount token amount
     */
    function _mintStrategyToken(address _to, uint256 _amount) internal {
        _mint(_to, _amount);
    }
}