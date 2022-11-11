// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import "forge-std/Test.sol";
import { SafeMath } from "openzeppelin/math/SafeMath.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { SafeMath } from "openzeppelin/math/SafeMath.sol";
import { Address } from "openzeppelin/utils/Address.sol";

contract WETH9Mock is ERC20, Test {
    using SafeMath for uint256;
    using Address for address payable;

    mapping(address => uint256) public balances;

    constructor() ERC20("WETH9", "wETH9") { }

    function testToAvoidCoverage() public pure {
        return;
    }

    function deposit() external payable {
        balances[msg.sender] = balances[msg.sender].add(msg.value);
        _mint(msg.sender, msg.value);
    }

    function withdraw(uint256 wad) external {
        balances[msg.sender] = balances[msg.sender].sub(wad);
        _burn(msg.sender, wad);
        payable(msg.sender).sendValue(wad);
    }
}
