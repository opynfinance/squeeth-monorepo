// SPDX-License-Identifier: GPL-3.0-only
pragma solidity =0.7.6;

// contract
import {UniBull} from "../../src/UniBull.sol";

/**
 * @dev Helper contract to expose some function for testing
 */
contract UniBullHelper is UniBull {
    constructor(address _factory) UniBull(_factory) {}

    function getTwap(address _pool, address _base, address _quote, uint32 _period, bool _checkPeriod)
        external
        view
        returns (uint256)
    {
        return _getTwap(_pool, _base, _quote, _period, _checkPeriod);
    }
}
