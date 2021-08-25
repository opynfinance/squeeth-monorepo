// SPDX-License-Identifier: MIT

pragma solidity =0.7.6;

contract MockUniswapV3Pool {
    address public token0;
    address public token1;

    function setPoolTokens(address _token0, address _token1) external {
        token0 = _token0;
        token1 = _token1;
    }
}
