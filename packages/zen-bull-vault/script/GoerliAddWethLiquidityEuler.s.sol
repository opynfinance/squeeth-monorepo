// SPDX-License-Identifier: MIT
pragma solidity =0.7.6;

import { AddLiquidityEuler } from "./AddLiquidityEuler.s.sol";

contract GoerliAddWethLiquidityEuler is AddLiquidityEuler {
    address public constant euler = 0x931172BB95549d0f29e10ae2D079ABA3C63318B3;
    address public constant eulerMarkets = 0x3EbC39b84B1F856fAFE9803A9e1Eae7Da016Da36;
    address public constant weth = 0x083fd3D47eC8DC56b572321bc4dA8b26f7E82103;
    address public constant eWeth = 0xEf5e087D827194732Bc1843351ccA80982E154eB;

    constructor() AddLiquidityEuler(euler, eulerMarkets, weth, eWeth) { }
}
