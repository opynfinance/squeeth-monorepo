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

    constructor(string memory _name, string memory _symbol) ERC721(_name, _symbol) {}

    function init(address _controller) public initializer {
        require(_controller != address(0), "Invalid controller address");
        controller = _controller;
    }

    /**
     * mint new NFT, create a new vault struct
     */
    function mintNFT(address _recipient) external onlyController returns (uint256 tokenId) {
        // mint NFT
        _mint(_recipient, (tokenId = nextId++));
    }
}
