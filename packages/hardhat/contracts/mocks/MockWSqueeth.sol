// SPDX-License-Identifier: MIT

pragma solidity =0.7.6;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockWPowerPerp is ERC20 {
    address public controller;

    constructor() ERC20("Wrapped Power Perp", "WPowerPerp") {}

    function mint(address _account, uint256 _amount) external {
        _mint(_account, _amount);
    }

    function burn(address _account, uint256 _amount) external {
        _burn(_account, _amount);
    }
}
