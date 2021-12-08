//SPDX-License-Identifier: MIT

pragma solidity =0.7.6;

import {ABDKMath64x64} from "../libs/ABDKMath64x64.sol";

contract ABDKTester{    
    using ABDKMath64x64 for int128;
    using ABDKMath64x64 for uint256;

    function testMul(int128 x, int128 y) external pure returns (int128 z) {
        return x.mul(y);
    }
    
    function testNegMul(int128 x, int128 y) external pure returns (int128 z) {
        return -x.mul(y);
    }

    function testMulu(int128 x, uint256 y) external pure returns (uint256 z) {
        return x.mulu(y);
    }
    function testDivu(uint256 x, uint256 y) external pure returns (int128 z) {
        return x.divu(y);
    }
    function testLog_2(int128 x) external pure returns (int128 z) {
        return x.log_2();
    }
    function testExp_2(int128 x) external pure returns (int128 z) {
        return x.exp_2();
    }
}