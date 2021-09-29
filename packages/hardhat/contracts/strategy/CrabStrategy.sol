//SPDX-License-Identifier: MIT
pragma solidity =0.7.6;

// contract
import {StrategyBase} from "./base/StrategyBase.sol";

// lib
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";

/**
 * @dev CrabStrategy contract
 * @notice Contract for Crab strategy
 * @author Opyn team
 */
contract CrabStrategy is StrategyBase {
    using SafeMath for uint256;
    using Address for address payable;

    /// @dev latest rebalance timestamp
    uint256 internal latestRebalanceTimestamp;
    /// @dev trading slippage limit for Uni v3
    uint256 internal slippageLimit;

    /**
     * @notice Strategy base constructor
     * @dev this will open a vault in the power token contract and store vault ID
     * @param _powerTokenController power token controller address
     * @param _weth weth address
     */
    constructor(
        address _powerTokenController,
        address _weth,
        string memory _name,
        string memory _symbol
    ) StrategyBase(_powerTokenController, _weth, _name, _symbol) {}
}
