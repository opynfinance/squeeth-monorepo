// SPDX-License-Identifier: MIT
pragma solidity =0.7.6;

import { AddLiquidityEuler } from "./AddLiquidityEuler.s.sol";

contract GoerliAddUsdcLiquidityEuler is AddLiquidityEuler {
    address public constant euler = 0x931172BB95549d0f29e10ae2D079ABA3C63318B3;
    address public constant eulerMarkets = 0x3EbC39b84B1F856fAFE9803A9e1Eae7Da016Da36;
    address public constant usdc = 0x306bf03b689f7d7e5e9D3aAC87a068F16AFF9482;
    address public constant eUsdc = 0x19EB4AC774bB84Fe725cffB9F71D79ab2fB4E12a;

    constructor() AddLiquidityEuler(euler, eulerMarkets, usdc, eUsdc) { }
}
