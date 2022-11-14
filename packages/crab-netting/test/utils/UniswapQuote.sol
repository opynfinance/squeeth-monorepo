// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.17;

import {IQuoter} from "@uniswap/v3-periphery/contracts/interfaces/IQuoter.sol";

contract UniswapQuote {
    address usdc = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    address sqth = 0xf1B99e3E573A1a9C5E6B2Ce818b617F0E664E86B;
    address weth = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    IQuoter public immutable quoter = IQuoter(0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6);

    function convertUSDToETH(uint256 _usdc) external returns (uint256) {
        // get the uniswap quoter contract code and address and initiate it
        return quoter.quoteExactInputSingle(
            (usdc),
            (weth),
            500, //3000 is 0.3
            _usdc,
            0
        );
    }

    function convertWETHToUSDC(uint256 _weth) external returns (uint256) {
        // get the uniswap quoter contract code and address and initiate it
        return quoter.quoteExactInputSingle(
            (weth),
            (usdc),
            500, //3000 is 0.3
            _weth,
            0
        );
    }

    function getSqthPrice(uint256 _quantity) external returns (uint256) {
        return quoter.quoteExactInputSingle((sqth), (weth), 3000, _quantity, 0);
    }
}
