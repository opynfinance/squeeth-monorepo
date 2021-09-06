// SPDX-License-Identifier: MIT
pragma solidity =0.7.6;

import {ERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";

contract WSqueeth is ERC20Upgradeable {
    address public controller;

    function init(address _controller) external {
        controller = _controller;

        __ERC20_init("Wrapped Squeeth", "WSqueeth");
    }

    modifier onlyController() {
        require(msg.sender == controller);
        _;
    }

    function mint(address _account, uint256 _amount) external onlyController {
        _mint(_account, _amount);
    }

    function burn(address _account, uint256 _amount) external onlyController {
        _burn(_account, _amount);
    }
}
