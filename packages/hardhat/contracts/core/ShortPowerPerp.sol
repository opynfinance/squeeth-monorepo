//SPDX-License-Identifier: BUSL-1.1

pragma solidity =0.7.6;

//contract
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/Initializable.sol";
import {IController} from "../interfaces/IController.sol";

/**
 * @notice ERC721 NFT representing ownership of a vault (short position)
 */
contract ShortPowerPerp is ERC721, Initializable {
    /// @dev tokenId for the next vault opened
    uint256 public nextId = 1;

    address public controller;
    address private immutable deployer;

    modifier onlyController() {
        require(msg.sender == controller, "Not controller");
        _;
    }

    /**
     * @notice short power perpetual constructor
     * @param _name token name for ERC721
     * @param _symbol token symbol for ERC721
     */
    constructor(string memory _name, string memory _symbol) ERC721(_name, _symbol) {
        deployer = msg.sender;
    }

    /**
     * @notice initialize short contract
     * @param _controller controller address
     */
    function init(address _controller) public initializer {
        require(msg.sender == deployer, "Invalid caller of init");
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
        _safeMint(_recipient, (tokenId = nextId++));
    }

    function _beforeTokenTransfer(
        address, /* from */
        address, /* to */
        uint256 tokenId
    ) internal override {
        IController(controller).updateOperator(tokenId, address(0));
    }
}
