// SPDX-License-Identifier: GPL-3.0-only
pragma solidity =0.7.6;

// contract
import {BullStrategy} from "./BullStrategy.sol";
// lib
import {StrategyMath} from "squeeth-monorepo/strategy/base/StrategyMath.sol"; // StrategyMath licensed under AGPL-3.0-only

/**
 * @notice PayableBull contract
 * @author opyn team
 */
contract PayableBull {
    using StrategyMath for uint256;

    BullStrategy private bullStrategy;

    /// @dev ETH deposited into Crab strategy
    uint256 public totalCrabETH;

    constructor(address _bull) {
        bullStrategy = BullStrategy(_bull);
    }

    /**
     * @notice payable deposit
     * @dev deposit ETH into crab vault, deposit crab and ETH collateral into bull and leverage component
     */
    function deposit(uint256 _crabETH) external payable {
        // deposit ETH into crab
        // approve bullStrategy to transfer Crab
        // call bullStrategy.deposit()
    }
}
