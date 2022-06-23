// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;
pragma abicoder v2;

import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract StrategySwap {
    ISwapRouter public immutable swapRouter;

    constructor(address _swapRouter) {
        require(_swapRouter != address(0), "invalid swap router address");
        swapRouter = ISwapRouter(_swapRouter);
    }

    /**
     * @notice swapExactInputSingle swaps a given amount of tokenIn for a maximum possible amount of tokenOut
     * @dev The calling address must approve this contract to spend at least `amountIn` worth of its tokenIn for this function to succeed.
     * @param _tokenIn token address to sell
     * @param _tokenOut token address to receive
     * @param _from from which user we are selling
     * @param _to Recipient to get the tokens
     * @param _amountIn Exact amount to sell
     * @param _minAmountOut Minimum amount to be paid
     * @param _fee pool fee
     * @return amountOut The amount of WETH9 received.
     */
    function _swapExactInputSingle(
        address _tokenIn,
        address _tokenOut,
        address _from,
        address _to,
        uint256 _amountIn,
        uint256 _minAmountOut,
        uint24 _fee
    ) internal returns (uint256 amountOut) {
        // _from must approve this contract

        // Transfer the specified amount of tokenIn to this contract.
        IERC20(_tokenIn).transferFrom(_from, address(this), _amountIn);

        // Approve the router to spend tokenIn.
        IERC20(_tokenIn).approve(address(swapRouter), _amountIn);

        // We also set the sqrtPriceLimitx96 to be 0 to ensure we swap our exact input amount.
        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
            tokenIn: _tokenIn,
            tokenOut: _tokenOut,
            fee: _fee,
            recipient: _to,
            deadline: block.timestamp,
            amountIn: _amountIn,
            amountOutMinimum: _minAmountOut,
            sqrtPriceLimitX96: 0
        });

        // The call to `exactInputSingle` executes the swap.
        amountOut = swapRouter.exactInputSingle(params);
    }
}
