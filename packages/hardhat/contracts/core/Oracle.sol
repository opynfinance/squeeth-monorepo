// SPDX-License-Identifier: MIT

// uniswap Library only works under 0.7.6
pragma solidity =0.7.6;

import {OracleLibrary} from "@uniswap/v3-periphery/contracts/libraries/OracleLibrary.sol";

contract Oracle {
    using OracleLibrary for address;

    address public ethUSDPool;
    address public squeethETHPool;

    constructor(address _ethUSDPool, address _squeethETHPool) {
        // todo: non address(0) checks
        // confirm it is a uniswap pool and that the assets match
        // the expected squeeth + eth + usdc token addresses?

        address ethUsdPool = _ethUSDPool;
        address squeethETHPool = _squeethETHPool;
    }

    function getETHTwapSince(uint32 period) external returns (int24) {
        int24 tick = ethUSDPool.consult(period);
        // todo: convert it to price
        return tick;
    }

    function getSqueethTwapSince(uint32 period) external returns (int24) {
        int24 tick = squeethETHPool.consult(period);
        // todo: convert it to price
        return tick;
    }
}
