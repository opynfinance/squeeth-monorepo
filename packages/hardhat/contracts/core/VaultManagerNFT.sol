//SPDX-License-Identifier: MIT

pragma solidity >=0.8.0 <0.9.0;

import {ERC721Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract VaultNFTManager is ERC721Upgradeable, OwnableUpgradeable {
    /// @dev tokenId for the next vault opened
    uint256 _nextId = 1;

    function init(address _controller) public initializer {
        // init nft
        __ERC721_init("Short Opyn Squeeth Position", "sSqueeth");
        transferOwnership(_controller);
    }

    /**
     * mint new NFT, create a new vault struct
     */
    function mintNFT(address _recipient) external onlyOwner returns (uint256 tokenId) {
        // mint NFT
        _mint(_recipient, (tokenId = _nextId++));
    }

    /**
     * burn the nft
     */
    function burnNFT(uint256 _tokenId) external onlyOwner {
        _burn(_tokenId);
    }
}
