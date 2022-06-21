//SPDX-License-Identifier: GPL-2.0-or-later

pragma solidity =0.7.6;

import "@std/Test.sol";

import {Uint256Casting} from "../../contracts/libs/Uint256Casting.sol";

contract CastingTest is Test {    
    using Uint256Casting for uint256;

    function testRevertToUint128() external {
        vm.expectRevert("OF128");
        Uint256Casting.toUint128(type(uint256).max);
    }

    function testRevertToUint96() external {
        vm.expectRevert(bytes("OF96"));
        Uint256Casting.toUint96(type(uint256).max);
    }

    function testRevertToUint32() external {
        vm.expectRevert(bytes("OF32"));
        Uint256Casting.toUint32(type(uint256).max);
    }

    // property based testing with fuzzer
    function testToUint128(uint256 y) external {
        vm.assume(y <= type(uint128).max);

        y.toUint128();
    }

    // property based testing with fuzzer
    function testToUint96(uint256 y) external {
        vm.assume(y <= type(uint96).max);

        y.toUint96();
    }

    // property based testing with fuzzer
    function testToUint32(uint256 y) external {
        vm.assume(y <= type(uint32).max);

        y.toUint32();
    }
}