// SPDX-License-Identifier: MIT

pragma solidity =0.7.6;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract MockErc20 is ERC20, Ownable {
    /// @dev mapping to track whitelisted minters
    mapping(address => bool) internal whitelistedMinters;

    /// @notice emits an event when a minter is whitelisted
    event MinterWhitelisted(address indexed account);

    /// @notice emits an event when a minter is blacklisted
    event MinterBlacklisted(address indexed account);

    /**
     * @notice check if the sender is whitelistd
     */
    modifier onlyWhitelisted() {
        require(whitelistedMinters[msg.sender] || msg.sender == owner(), "Address not a whitelisted minter");
        _;
    }

    constructor(
        string memory _name,
        string memory _symbol,
        uint8 _decimals
    ) ERC20(_name, _symbol) {
        _setupDecimals(_decimals);
    }

    function mint(address _account, uint256 _amount) external onlyWhitelisted {
        _mint(_account, _amount);
    }

    function burn(address _account, uint256 _amount) external onlyWhitelisted {
        _burn(_account, _amount);
    }

    /**
     * @notice check if a minter is whitelisted
     * @param _account address of minter
     * @return boolean, True if address is a whitelisted minter
     */
    function isWhitelistedMinter(address _account) external view returns (bool) {
        return whitelistedMinters[_account];
    }

    /**
     * @notice allows the minter to whitelist other minters
     * @param _account address of minter to be whitelisted
     */
    function whitelistMinter(address _account) external onlyWhitelisted {
        whitelistedMinters[_account] = true;

        emit MinterWhitelisted(_account);
    }

    /**
     * @notice allow the minter to blacklist other minters
     * @param _account address of minter to be blacklisted
     */
    function blacklistMinter(address _account) external onlyWhitelisted {
        whitelistedMinters[_account] = false;

        emit MinterBlacklisted(_account);
    }
}
