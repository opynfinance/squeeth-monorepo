//SPDX-License-Identifier: MIT

pragma solidity =0.7.6;

import {ERC721Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";

contract VaultNFTManager is ERC721Upgradeable {
    /// @dev tokenId for the next vault opened
    uint256 public nextId = 1;

    address public controller;

    modifier onlyController() {
        require(msg.sender == controller, "not controller");
        _;
    }

    function init(address _controller) public initializer {
        // init nft
        __ERC721_init("Short Opyn Squeeth Position", "sSqueeth");
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
