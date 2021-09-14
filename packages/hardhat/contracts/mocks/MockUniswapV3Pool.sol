// SPDX-License-Identifier: MIT

pragma solidity =0.7.6;

contract MockUniswapV3Pool {
    address public token0;
    address public token1;

    struct Slot0 {
        // the current price
        uint160 sqrtPriceX96;
        // the current tick
        int24 tick;
        // the most-recently updated index of the observations array
        uint16 observationIndex;
        // the current maximum number of observations that are being stored
        uint16 observationCardinality;
        // the next maximum number of observations to store, triggered in observations.write
        uint16 observationCardinalityNext;
        // the current protocol fee as a percentage of the swap fee taken on withdrawal
        // represented as an integer denominator (1/x)%
        uint8 feeProtocol;
        // whether the pool is locked
        bool unlocked;
    }

    Slot0 public slot0;

    function setPoolTokens(address _token0, address _token1) external {
        token0 = _token0;
        token1 = _token1;
    }

    function setSlot0Data(uint160 _sqrtPriceX96, int24 _tick) external {
        slot0.sqrtPriceX96 = _sqrtPriceX96;
        slot0.tick = _tick;
    }
}
