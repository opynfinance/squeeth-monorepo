// SPDX-License-Identifier: MIT
pragma solidity =0.7.6;

import "forge-std/Test.sol";

contract EulerMarketsMock is Test {
    mapping(address => address) internal underlyingToEtoken;
    mapping(address => address) internal underlyingToDtoken;

    function testToAvoidCoverage() public pure {
        return;
    }

    function setUnderlyingToEtoken(address _underlying, address _eToken) external {
        underlyingToEtoken[_underlying] = _eToken;
    }

    function setUnderlyingToDtoken(address _underlying, address _dToken) external {
        underlyingToDtoken[_underlying] = _dToken;
    }

    function enterMarket(uint256, /*_subAccountId*/ address /*_newMarket*/ ) external pure {
        return;
    }

    function underlyingToEToken(address _underlying) external view returns (address) {
        return underlyingToEtoken[_underlying];
    }

    function underlyingToDToken(address _underlying) external view returns (address) {
        return underlyingToDtoken[_underlying];
    }
}
