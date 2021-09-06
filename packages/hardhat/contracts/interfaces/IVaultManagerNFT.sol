// SPDX-License-Identifier: MIT

pragma solidity =0.7.6;
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

interface IVaultManagerNFT is IERC721 {
    function mintNFT(address recipient) external returns (uint256 _newId);
}
