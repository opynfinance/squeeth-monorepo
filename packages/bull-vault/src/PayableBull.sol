// SPDX-License-Identifier: GPL-3.0-only
pragma solidity =0.7.6;

// contract
import {BullBase} from "./BullBase.sol";
import {LeverageBull} from "./LeverageBull.sol";
import {UniBull} from "./UniBull.sol";
// lib
import {StrategyMath} from "squeeth-monorepo/strategy/base/StrategyMath.sol"; // StrategyMath licensed under AGPL-3.0-only

/**
 * @notice BullStrategy contract
 * @author opyn team
 */
contract PayableBull is BullBase, LeverageBull, UniBull {
    using StrategyMath for uint256;

    constructor(address _crab, address _factory) BullBase(_crab, "Bull Vault", "BullVault") UniBull(_factory) {}
}
