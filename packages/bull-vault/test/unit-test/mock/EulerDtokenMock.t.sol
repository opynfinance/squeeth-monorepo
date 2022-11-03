// SPDX-License-Identifier: MIT
pragma solidity =0.7.6;

import "forge-std/Test.sol";
import {ERC20} from "openzeppelin/token/ERC20/ERC20.sol";

contract EulerDtokenMock is ERC20, Test {

    // asset to borrow/repay
    address underlying;

    constructor(address _underlying, string memory _name, string memory _symbol, uint8 _decimals) ERC20(_name, _symbol) {
        underlying = _underlying;
        _setupDecimals(_decimals);
    }

    function borrow(uint256 subAccountId, uint256 amount) external {
        _mint(msg.sender, amount);
        ERC20(underlying).transfer(msg.sender, amount);
    }

    function repay(uint256 subAccountId, uint256 amount) external {
        ERC20(underlying).transferFrom(msg.sender, address(this), amount);
        _burn(msg.sender, amount);
    }
}
