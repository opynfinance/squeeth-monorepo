// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import {ERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";

contract WrappedSqueeth is ERC20Upgradeable {
    address public controller;

    function init(address _controller) external {
        controller = _controller;

        __ERC20_init("Wrapped Squeeth", "WSqueeth");
    }
}
