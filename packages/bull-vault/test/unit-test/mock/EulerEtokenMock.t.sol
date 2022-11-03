// SPDX-License-Identifier: MIT
pragma solidity =0.7.6;

import "forge-std/Test.sol";
import {ERC20} from "openzeppelin/token/ERC20/ERC20.sol";
import {StrategyMath} from "squeeth-monorepo/strategy/base/StrategyMath.sol"; // StrategyMath licensed under AGPL-3.0-only

contract EulerEtokenMock is ERC20, Test {
    using StrategyMath for uint256;
    // asset to deposit as collateral
    address public underlying;

    mapping(address => uint256) internal underlyingBalance;

    constructor(address _underlying, string memory _name, string memory _symbol, uint8 _decimals) ERC20(_name, _symbol) {
        underlying = _underlying;
        _setupDecimals(_decimals);
    }

    function deposit(uint256 subAccountId, uint256 amount) external {
        ERC20(underlying).transferFrom(msg.sender, address(this), amount);
        underlyingBalance[msg.sender] = underlyingBalance[msg.sender].add(amount);
        _mint(msg.sender, amount);
    }
    function withdraw(uint256 subAccountId, uint256 amount) external {
        underlyingBalance[msg.sender] = underlyingBalance[msg.sender].sub(amount);
        _burn(msg.sender, amount);
        ERC20(underlying).transfer(msg.sender, amount);
    }
    function balanceOfUnderlying(address account) external view returns (uint256) {
        return underlyingBalance[account];
    }
}
