// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;
pragma abicoder v2;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {INonfungiblePositionManager} from "@uniswap/v3-periphery/contracts/interfaces/INonfungiblePositionManager.sol";

contract MockUniPositionManager is ERC721 {
    int24 public tickLower;
    int24 public tickUpper;
    uint128 public liquidity;
    address public token0;
    address public token1;

    uint256 token0ToCollect;
    uint256 token1ToCollect;

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

    function setAmount0Amount1ToDecrease(uint256 amount0, uint256 amount1) external {
        token0ToCollect = amount0;
        token1ToCollect = amount1;
    }

    // SPDX-License-Identifier: GPL-2.0-or-later
    function decreaseLiquidity(
        INonfungiblePositionManager.DecreaseLiquidityParams memory /*params*/
    ) external view returns (uint256, uint256) {
        return (token0ToCollect, token1ToCollect);
    }

    function collect(INonfungiblePositionManager.CollectParams memory params) external returns (uint256, uint256) {
        uint256 cachedAmount0 = token0ToCollect;
        uint256 cachedAmount1 = token1ToCollect;
        uint256 token0Amount = cachedAmount0 > params.amount0Max ? params.amount0Max : cachedAmount0;
        uint256 token1Amount = cachedAmount1 > params.amount1Max ? params.amount1Max : cachedAmount1;
        IERC20(token0).transfer(params.recipient, token0Amount);
        IERC20(token1).transfer(params.recipient, token1Amount);
        token0ToCollect = 0;
        token1ToCollect = 0;
        return (token0Amount, token1Amount);
    }
}
