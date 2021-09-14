// SPDX-License-Identifier: MIT
pragma solidity =0.7.6;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract MockUniPositionManager is ERC721 {
    int24 public tickLower;
    int24 public tickUpper;
    uint128 public liquidity;
    address public token0;
    address public token1;

    constructor() ERC721("Uniswap Position", "UNIP") {}

    function mint(address account, uint256 tokenId) external {
        _mint(account, tokenId);
    }

    function setMockedProperties(
        address _token0,
        address _token1,
        int24 _tickLower,
        int24 _tickUpper,
        uint128 _liquidity
    ) external {
        token0 = _token0;
        token1 = _token1;
        tickLower = _tickLower;
        tickUpper = _tickUpper;
        liquidity = _liquidity;
    }

    function positions(uint256)
        public
        view
        returns (
            uint96, //nonce,
            address, //operator,
            address, //token0,
            address, //token1,
            uint24, // fee,
            int24, // tickLower,
            int24, // tickUpper,
            uint128, // liquidity,
            uint256, //feeGrowthInside0LastX128,
            uint256, //feeGrowthInside1LastX128,
            uint128, //tokensOwed0,
            uint128 //tokensOwed1
        )
    {
        // return 0 for everything
        return (
            0, //nonce,
            address(0), //operator,
            token0, //token0,
            token1, //token1,
            3000, // fee,
            tickLower, // tickLower,
            tickUpper, // tickUpper,
            liquidity, // liquidity,
            0, //feeGrowthInside0LastX128,
            0, //feeGrowthInside1LastX128,
            0, //tokensOwed0,
            0 //tokensOwed1
        );
    }
}
