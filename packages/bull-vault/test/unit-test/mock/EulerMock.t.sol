// SPDX-License-Identifier: MIT
pragma solidity =0.7.6;

import "forge-std/Test.sol";
import { ERC20 } from "openzeppelin/token/ERC20/ERC20.sol";

contract EulerMock is Test {
    function executeTransfer(address _asset, address _from, address _to, uint256 _amount)
        external
    {
        ERC20(_asset).transferFrom(_from, _to, _amount);
    }

    function testToAvoidCoverage() public pure {
        return;
    }
}
