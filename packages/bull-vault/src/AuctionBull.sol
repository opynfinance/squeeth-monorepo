// SPDX-License-Identifier: GPL-3.0-only
pragma solidity =0.7.6;

// interface
import {IController} from "squeeth-monorepo/interfaces/IController.sol";
import {IBullStrategy} from "./interface/IBullStrategy.sol";
import {IERC20} from "openzeppelin/token/ERC20/IERC20.sol";
// contract
import {Ownable} from "openzeppelin/access/Ownable.sol";
import {UniFlash} from "./UniFlash.sol";

/**
 * @notice AuctionBull contract
 * @author opyn team
 */
contract AuctionBull is UniFlash, Ownable {
    /// @dev the highest delta we can have without rebalancing
    uint256 public deltaUpper;
    /// @dev the lowest delta we can have without rebalancing
    uint256 public deltaLower;
    /// @dev the highest CR we can have before rebalancing
    uint256 public crUpper;
    /// @dev the lowest CR we can have in leverage component before rebalancing
    uint256 public leverageCrLower;

    /// @dev USDC address
    address private immutable usdc;
    /// @dev WETH address
    address private immutable weth;
    address private immutable bullStrategy;
    /// @dev auction manager
    address public auctionManager;

    /// @dev enum to differentiate between Uniswap swap callback function source
    enum FLASH_SOURCE {
        GENERAL_SWAP
    }

    constructor(address _auctionOwner, address _auctionManager, address _bull, address _factory) UniFlash(_factory) Ownable() {
        bullStrategy = _bull;
        weth = IController(IBullStrategy(_bull).powerTokenController()).weth();
        usdc = IController(IBullStrategy(_bull).powerTokenController()).quoteCurrency();
        auctionManager = _auctionManager;

        transferOwnership(_auctionOwner);
    }

    /**
     * @dev changes the leverage component composition by buying or selling eth
     */
    function leverageRebalance(bool _isSellingEth, uint256 _amountIn, uint256 _minAmountOut, uint24 _poolFee) external {
        if (_isSellingEth) {
            // Withdraw ETH from collateral
            IBullStrategy(bullStrategy).withdrawWethFromEuler(_amountIn, false); 
            // swap ETH to USDC
            _exactInFlashSwap(
                weth,
                usdc,
                _poolFee,
                _amountIn,
                _minAmountOut,
                uint8(FLASH_SOURCE.GENERAL_SWAP),
                ""
            );
            // Repay some USDC debt
            IBullStrategy(bullStrategy).repayUsdcToEuler(IERC20(usdc).balanceOf(address(bullStrategy)));
        } else {
            // Borrow more USDC debt
            IBullStrategy(bullStrategy).borrowUsdcFromEuler(_amountIn);
            // swap USDC to ETH 
            _exactInFlashSwap(
                usdc,
                weth,
                _poolFee,
                _amountIn,
                _minAmountOut,
                uint8(FLASH_SOURCE.GENERAL_SWAP),
                ""
            );
            // Deposit ETH in collateral
            IBullStrategy(bullStrategy).depositWethInEuler(_amountIn, false);
        }
    }

    function _uniFlashSwap(UniFlashswapCallbackData memory _uniFlashSwapData) internal override {
        if (FLASH_SOURCE(_uniFlashSwapData.callSource) == FLASH_SOURCE.GENERAL_SWAP) {
            IERC20(_uniFlashSwapData.tokenIn).transfer(_uniFlashSwapData.pool, _uniFlashSwapData.amountToPay);
        }
    }
}
