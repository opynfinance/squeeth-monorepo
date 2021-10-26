// SPDX-License-Identifier: MIT
pragma solidity =0.7.6;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/Initializable.sol";
import {IWPowerPerp} from "../interfaces/IWPowerPerp.sol";

/**
 * @notice ERC20 Token representing wrapped long squeeth position.
 * @dev value of wPowerPerp is expected to go down in time
 */
contract WPowerPerp is ERC20, Initializable, IWPowerPerp {
    address public controller;

    constructor(string memory _name, string memory _symbol) ERC20(_name, _symbol) {}

    modifier onlyController() {
        require(msg.sender == controller, "Not controller");
        _;
    }

    function init(address _controller) external initializer {
        require(_controller != address(0), "Invalid controller address");
        controller = _controller;
    }

    function mint(address _account, uint256 _amount) external override onlyController {
        _mint(_account, _amount);
    }

    function burn(address _account, uint256 _amount) external override onlyController {
        _burn(_account, _amount);
    }
}
