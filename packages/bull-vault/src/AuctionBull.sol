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
    /// @dev highest delta the auction manager can rebalance to
    uint256 internal constant DELTA_UPPER = 1.1e18;
    /// @dev lowest delta the auction manager can rebalance to
    uint256 internal constant DELTA_LOWER = 0.9e18;
    /// @dev highest CR the auction manager can rebalance to
    uint256 internal constant CR_UPPER = 3e18;
    /// @dev lowest CR the auction manager can rebalance to
    uint256 internal constant CR_LOWER = 1.5e18;

    /// @dev USDC address
    address private immutable usdc;
    /// @dev WETH address
    address private immutable weth;
    address private immutable bullStrategy;
    /// @dev auction manager
    address public auctionManager;

    /// @dev enum to differentiate between Uniswap swap callback function source
    enum FLASH_SOURCE {
        SELLING_USDC,
        BUYING_USDC
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
    function leverageRebalance(bool _isBuyingUsdc, uint256 _usdcAmount, uint256 _ethThresholdAmount, uint24 _poolFee) external {
        require(msg.sender == auctionManager);
        _checkValidRebalance(_isBuyingUsdc, _usdcAmount);
        
        if (_isBuyingUsdc) {
            // swap ETH to USDC
            _exactOutFlashSwap(
                weth,
                usdc,
                _poolFee,
                _usdcAmount,
                _ethThresholdAmount,
                uint8(FLASH_SOURCE.BUYING_USDC),
                abi.encodePacked(_usdcAmount)
            );
        } else {
            // Borrow more USDC debt
            IBullStrategy(bullStrategy).borrowUsdcFromEuler(_usdcAmount);
            // swap USDC to ETH 
            _exactInFlashSwap(
                usdc,
                weth,
                _poolFee,
                _usdcAmount,
                _ethThresholdAmount,
                uint8(FLASH_SOURCE.SELLING_USDC),
                ""
            );
            // Deposit ETH in collateral
            uint256 ethToDeposit = IERC20(weth).balanceOf(address(this));
            IERC20(weth).transfer(address(bullStrategy), ethToDeposit);
            IBullStrategy(bullStrategy).depositWethInEuler(ethToDeposit, false);
        }
    }

    function _uniFlashSwap(UniFlashswapCallbackData memory _uniFlashSwapData) internal override {
        if (FLASH_SOURCE(_uniFlashSwapData.callSource) == FLASH_SOURCE.SELLING_USDC) {
            IERC20(_uniFlashSwapData.tokenIn).transfer(_uniFlashSwapData.pool, _uniFlashSwapData.amountToPay);
        } else if (FLASH_SOURCE(_uniFlashSwapData.callSource) == FLASH_SOURCE.BUYING_USDC) {
            uint256 usdcAmount = abi.decode(_uniFlashSwapData.callData, (uint256));
            // Repay some USDC debt
            IERC20(usdc).transfer(address(bullStrategy), usdcAmount);
            IBullStrategy(bullStrategy).repayUsdcToEuler(usdcAmount);
            // Withdraw ETH from collateral
            uint256 ethToWithdraw = _uniFlashSwapData.amountToPay;
            IBullStrategy(bullStrategy).withdrawWethFromEuler(_uniFlashSwapData.amountToPay); 
            IERC20(weth).transfer(_uniFlashSwapData.pool, _uniFlashSwapData.amountToPay);
        }
    }

    function _checkValidRebalance(bool _isBuyingUsdc, uint256 _usdcAmount) internal view {
        (uint256 delta, uint256 cr) = IBullStrategy(bullStrategy).calcDeltaAndCR(_isBuyingUsdc, _usdcAmount);
        require(delta <= DELTA_UPPER && delta >= DELTA_LOWER, "Invalid delta after rebalance");
        require(cr <= CR_UPPER && cr >= CR_LOWER, "Invalid CR after rebalance");
    }
}