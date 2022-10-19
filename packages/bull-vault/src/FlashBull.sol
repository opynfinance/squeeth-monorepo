// SPDX-License-Identifier: GPL-3.0-only
pragma solidity =0.7.6;

// contract
import {BullStrategy} from "./BullStrategy.sol";
// lib
import {StrategyMath} from "squeeth-monorepo/strategy/base/StrategyMath.sol"; // StrategyMath licensed under AGPL-3.0-only

/**
 * @notice FlashBull contract
 * @dev handle the flashswap interactions
 * @author opyn team
 */
contract FlashBull {
    using StrategyMath for uint256;

    BullStrategy private bullStrategy;

    /// @dev enum to differentiate between Uniswap swap callback function source
    enum FLASH_SOURCE {
        GENERAL_SWAP,
        FLASH_DEPOSIT,
        FLASH_WITHDRAW
    }

    // struct FlashDepositData {}
    // // TODO

    // struct FlashWithdrawData {}
    // // TODO

    constructor(address _bull) {
        bullStrategy = BullStrategy(_bull);
    }

    /**
     * @notice payable deposit
     */
    function flashDeposit() external payable {}
}
