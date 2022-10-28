// SPDX-License-Identifier: GPL-3.0-only
pragma solidity =0.7.6;

// contract
import {UniBull} from "./UniBull.sol";

// interface
import {IController} from "squeeth-monorepo/interfaces/IController.sol";
import {IBullStrategy} from "./interface/IBullStrategy.sol";

// lib
import {StrategyMath} from "squeeth-monorepo/strategy/base/StrategyMath.sol"; // StrategyMath licensed under AGPL-3.0-only

/**
 * @notice AuctionBull contract
 * @author opyn team
 */
contract AuctionBull is UniBull {
    using StrategyMath for uint256;

    BullStrategy private bullStrategy;
    /// @dev USDC address
    address internal usdc;
    /// @dev WETH address
    address internal weth;


    constructor(address payable _bull, address _euler, address _eulerMarkets) {
        bullStrategy = BullStrategy(_bull);
        weth = IController(IBullStrategy(bullStrategy).powerTokenController()).weth();
        usdc = IController(IBullStrategy(bullStrategy).powerTokenController()).quoteCurrency();
    }

    /**
     * @dev changes the leverage component composition by buying or selling eth
     */
    function leverageRebalance(uint256 _amountIn, bool _isSellingEth, uint256 _minAmountOut, uint24 _poolFee) external payable {
        if (_isSellingEth) {
            // Withdraw ETH from collateral
            bullStrategy.withdrawEthFromEuler(_amountIn, false); 
            // ETH to USDC
            _swapExactInputSingle(weth, usdc, address(bullStrategy), address(bullStrategy), _amountIn, _minAmountOut, _poolFee);
            // Repay some USDC debt
            bullStrategy.repayUsdcToEuler(IERC20(usdc).balanceOf(address(bullStrategy)));
        } else {
            // Borrow more USDC debt
            bullStrategy.borrowUsdcFromEuler(_amountIn);
            // USDC to ETH 
            _swapExactInputSingle(usdc, weth, address(this), address(bullStrategy), _amountIn, _minAmountOut, _poolFee);
            // Deposit ETH in collateral
            bullStrategy.depositEthInEuler(_amountIn, false);
        }
    }

    /**
     * @dev moves funds between crab component and leverage component
     */
    function fullRebalance(uint256 _crabAmount, bool _isSellingCrab) external payable {
    }
}
