// SPDX-License-Identifier: MIT

pragma solidity >=0.8.0 <0.9.0;
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

interface IVaultManagerNFT is IERC721 {
    function mintNFT(address recipient) external returns (uint256 _newId);

    function burnNFT(uint256 _vaultId) external;
}
