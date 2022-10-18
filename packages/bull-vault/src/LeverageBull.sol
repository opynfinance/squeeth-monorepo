// SPDX-License-Identifier: GPL-3.0-only
pragma solidity =0.7.6;

// lib
import {StrategyMath} from "squeeth-monorepo/strategy/base/StrategyMath.sol"; // StrategyMath licensed under AGPL-3.0-only

/**
 * @notice LeverageBull contract
 * @dev contract that interact mainly with leverage component
 * @author opyn team
 */
contract LeverageBull {
    using StrategyMath for uint256;

    uint256 private constant ONE = 1e18;
    uint256 public constant TARGET_CR = 15e17; // 1.5 collat ratio

    // TODO: keep those here or read directly from leverage component?
    uint256 public ethCollateralInLeverage;
    uint256 public usdcBorrowed;

    /**
     * @notice deposit ETH into leverage component and borrow USDC
     * @dev this function handle only the leverage component part
     */
    function _leverageDeposit(uint256 _crabAmount, uint256 _bullShare, uint256 _crabPrice, uint256 _ethUsdPrice)
        internal
    {
        uint256 ethToLend;
        uint256 usdcToBorrow;

        if (_bullShare == ONE) {
            ethToLend = TARGET_CR.wmul(_crabAmount).wmul(_crabPrice).wdiv(_ethUsdPrice);
            usdcToBorrow = ethToLend.wmul(_ethUsdPrice).wdiv(TARGET_CR);
        } else {
            ethToLend = ethCollateralInLeverage.wmul(_bullShare).wdiv(ONE.sub(_bullShare));
            usdcToBorrow = usdcToBorrow.wmul(_bullShare).wdiv(ONE.sub(_bullShare));
        }

        ethCollateralInLeverage = ethCollateralInLeverage.add(ethToLend);
        usdcToBorrow = usdcBorrowed.add(usdcToBorrow);

        // TODO: call leverage component
    }
}
