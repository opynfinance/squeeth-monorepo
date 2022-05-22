//SPDX-License-Identifier: GPL-2.0-or-later

pragma solidity =0.7.6;

import "@std/Test.sol";

import {ABDKMath64x64} from "../../contracts/libs/ABDKMath64x64.sol";

contract ABDKMath64x64Test is Test {   
    using ABDKMath64x64 for int128;
    using ABDKMath64x64 for uint256;
 
    function testMulAboveMAX_64x64() external {
        vm.expectRevert("MUL-OVUF");
        ABDKMath64x64.mul(type(int128).max, type(int128).max);
    }
    
    function testMulBelowMIN_64x64() external {
        vm.expectRevert("MUL-OVUF");
        ABDKMath64x64.mul(type(int128).min, type(int128).max);
    }

    function testMuluWhereXBelowZero() external {
        vm.expectRevert("MULU-X0");
        ABDKMath64x64.mulu(int128(-1), 10);
    }

    // function testMuluOverflow2() external {
    //     vm.expectRevert("MULU-OF2");
    //     ABDKMath64x64.mulu(type(int128).max-1, type(uint256).max);
    // }

    function testMuluOverflow1() external {
        vm.expectRevert("MULU-OF1");
        ABDKMath64x64.mulu(type(int128).max, type(uint256).max);
    }

    function testDivuWhereYEqualZero() external {
        vm.expectRevert("DIVU-INF");
        ABDKMath64x64.divu(1, 0);
    }

    function testDivuRevertDIVUU_OF1() external {
        vm.expectRevert("DIVUU-OF1");
        ABDKMath64x64.divu(uint256(type(int128).max+1), 2);
    }

    function testDivuWhereResultGreaterThanMAX_64x64() external {
        vm.expectRevert("DIVU-OF");
        uint256 x = 2**127;
        uint256 y = 2**64;
        ABDKMath64x64.divu(x, y);
    }

    function testDivuRevertDIVUU_OF2() external {
        vm.expectRevert("DIVUU-OF2");
        uint256 x = 2**128;
        uint256 y = 2**64;
        ABDKMath64x64.divu(x, y);
    }

    function testLog_2WhereXIsNegative() external {
        vm.expectRevert("LOG_2-X0");
        ABDKMath64x64.log_2(-1);
    }

    function testExp_2RevertEXP_2_OF() external {
        vm.expectRevert("EXP_2-OF");
        ABDKMath64x64.exp_2(2**70+1);
    }

    function testExp_2WhereXUnderflow() external {
        int128 result = ABDKMath64x64.exp_2(-(2**70+1));
        assertEq(result, 0);
    }

    // property fuzzing, not sure it should be done this way in this case
    function testMuluFuzzing(int128 x, uint256 y) external {
        vm.assume(x >= 0);
        uint256 lo = (uint256(x) * (y & 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF)) >> 64;
        uint256 hi = uint256(x) * (y >> 128);
        vm.assume(hi <= 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF);
        hi <<= 64;
        vm.assume(hi <= 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF - lo);

        uint256 result = ABDKMath64x64.mulu(x, y); 
        assertEq(result, hi + lo);       
    }
}