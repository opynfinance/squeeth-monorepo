// SPDX-License-Identifier: BSD-4-Clause
/*
 * ABDK Math 64.64 Smart Contract Library.  Copyright © 2019 by ABDK Consulting.
 * Author: Mikhail Vladimirov <mikhail.vladimirov@gmail.com>
 * Copyright (c) 2019, ABDK Consulting
 *
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
 *
 * Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
 * Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
 * All advertising materials mentioning features or use of this software must display the following acknowledgement: This product includes software developed by ABDK Consulting.
 * Neither the name of ABDK Consulting nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
 * THIS SOFTWARE IS PROVIDED BY ABDK CONSULTING ''AS IS'' AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED.
 * IN NO EVENT SHALL ABDK CONSULTING BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
 
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