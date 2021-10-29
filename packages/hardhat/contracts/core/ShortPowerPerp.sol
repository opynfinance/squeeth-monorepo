//SPDX-License-Identifier: MIT

pragma solidity =0.7.6;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/Initializable.sol";

/**
 * @notice ERC721 NFT representing ownership of a vault (short position)
 */
contract ShortPowerPerp is ERC721, Initializable {
    /// @dev tokenId for the next vault opened
    uint256 public nextId = 1;

    address public controller;

    modifier onlyController() {
        require(msg.sender == controller, "Not controller");
        _;
    }

    /**
     * @notice short power perpetual constructor
     * @param _name token name for ERC721
     * @param _symbol token symbol for ERC721
     */
    constructor(string memory _name, string memory _symbol) ERC721(_name, _symbol) {}

    /**
     * @notice initialize short contract
     * @param _controller controller address
     */
    function init(address _controller) public initializer {
        require(_controller != address(0), "Invalid controller address");
        controller = _controller;
    }

    /**
     * @notice mint new NFT
     * @dev autoincrement tokenId starts at 1
     * @param _recipient recipient address for NFT
     */
    function mintNFT(address _recipient) external onlyController returns (uint256 tokenId) {
        // mint NFT
        _mint(_recipient, (tokenId = nextId++));
    }
}
