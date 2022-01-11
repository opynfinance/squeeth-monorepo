// SPDX-License-Identifier: BUSL-1.1

pragma solidity =0.7.6;

//interface
import {IWPowerPerp} from "../interfaces/IWPowerPerp.sol";

//contract
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/Initializable.sol";

/**
 * @notice ERC20 Token representing wrapped long power perpetual position
 * @dev value of power perpetual is expected to go down over time through the impact of funding
 */
contract WPowerPerp is ERC20, Initializable, IWPowerPerp {
    address public controller;
    address private immutable deployer;

    /**
     * @notice long power perpetual constructor
     * @param _name token name for ERC20
     * @param _symbol token symbol for ERC20
     */
    constructor(string memory _name, string memory _symbol) ERC20(_name, _symbol) {
        deployer = msg.sender;
    }

    modifier onlyController() {
        require(msg.sender == controller, "Not controller");
        _;
    }

    /**
     * @notice init wPowerPerp contract
     * @param _controller controller address
     */
    function init(address _controller) external initializer {
        require(msg.sender == deployer, "Invalid caller of init");
        require(_controller != address(0), "Invalid controller address");
        controller = _controller;
    }

    /**
     * @notice mint wPowerPerp
     * @param _account account to mint to
     * @param _amount amount to mint
     */
    function mint(address _account, uint256 _amount) external override onlyController {
        _mint(_account, _amount);
    }

    /**
     * @notice burn wPowerPerp
     * @param _account account to burn from
     * @param _amount amount to burn
     */
    function burn(address _account, uint256 _amount) external override onlyController {
        _burn(_account, _amount);
    }
}
