// SPDX-License-Identifier: MIT
pragma solidity =0.7.6;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/Initializable.sol";
import {IWPowerPerp} from "../interfaces/IWPowerPerp.sol";

/// @notice this is the ERC20 contract for long position of Squeeth
/// @dev this contract implements IWPowerPerp interface, makes it controllable by Controller.
/// @dev decimals of squeeth is chosen as 14.
contract WSqueeth is ERC20, Initializable, IWPowerPerp {
    address public controller;

    constructor() ERC20("Wrapped Squeeth", "WSQTH") {}

    modifier onlyController() {
        require(msg.sender == controller, "not controller");
        _;
    }

    function init(address _controller) external initializer {
        controller = _controller;
    }

    function mint(address _account, uint256 _amount) external override onlyController {
        _mint(_account, _amount);
    }

    function burn(address _account, uint256 _amount) external override onlyController {
        _burn(_account, _amount);
    }
}
