// SPDX-License-Identifier: GPL-3.0-only
pragma solidity =0.7.6;

// interface
import { IController } from "squeeth-monorepo/interfaces/IController.sol";
import { IBullStrategy } from "./interface/IBullStrategy.sol";
import { IERC20 } from "openzeppelin/token/ERC20/IERC20.sol";
import { IEulerEToken } from "./interface/IEulerEToken.sol";
import { IEulerDToken } from "./interface/IEulerDToken.sol";
// contract
import { Ownable } from "openzeppelin/access/Ownable.sol";
import { UniFlash } from "./UniFlash.sol";
import { UniOracle } from "./UniOracle.sol";
// lib
import { StrategyMath } from "squeeth-monorepo/strategy/base/StrategyMath.sol"; // StrategyMath licensed under AGPL-3.0-only

import { console } from "forge-std/console.sol";

/**
 * @notice AuctionBull contract
 * @author opyn team
 */
contract AuctionBull is UniFlash, Ownable {
    using StrategyMath for uint256;

    /// @dev TWAP period
    uint32 internal constant TWAP = 420;

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
    address private immutable ethWSqueethPool;
    address private immutable ethUSDCPool;
    address private immutable wPowerPerp;
    address private immutable crab;
    /// @dev euler eToken for WETH
    address private immutable eToken;
    /// @dev euler dToken for USDC
    address private immutable dToken;

    /// @dev auction manager
    address public auctionManager;

    /// @dev enum to differentiate between Uniswap swap callback function source
    enum FLASH_SOURCE {
        SELLING_USDC,
        BUYING_USDC
    }

    constructor(
        address _auctionOwner,
        address _auctionManager,
        address _bull,
        address _factory,
        address _crab,
        address _eToken,
        address _dToken
    ) UniFlash(_factory) Ownable() {
        auctionManager = _auctionManager;
        bullStrategy = _bull;
        weth = IController(IBullStrategy(_bull).powerTokenController()).weth();
        usdc = IController(IBullStrategy(_bull).powerTokenController()).quoteCurrency();
        ethWSqueethPool = IController(IBullStrategy(_bull).powerTokenController()).wPowerPerpPool();
        ethUSDCPool =
            IController(IBullStrategy(_bull).powerTokenController()).ethQuoteCurrencyPool();
        wPowerPerp = IController(IBullStrategy(_bull).powerTokenController()).wPowerPerp();
        crab = _crab;
        eToken = _eToken;
        dToken = _dToken;

        transferOwnership(_auctionOwner);
    }

    /**
     * @dev changes the leverage component composition by buying or selling eth
     */
    function leverageRebalance(
        bool _isBuyingUsdc,
        uint256 _usdcAmount,
        uint256 _ethThresholdAmount,
        uint24 _poolFee
    ) external {
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
            IERC20(_uniFlashSwapData.tokenIn).transfer(
                _uniFlashSwapData.pool, _uniFlashSwapData.amountToPay
            );
        } else if (FLASH_SOURCE(_uniFlashSwapData.callSource) == FLASH_SOURCE.BUYING_USDC) {
            uint256 usdcAmount = abi.decode(_uniFlashSwapData.callData, (uint256));
            // Repay some USDC debt
            IERC20(usdc).transfer(address(bullStrategy), usdcAmount);
            IBullStrategy(bullStrategy).repayUsdcToEuler(usdcAmount);
            // Withdraw ETH from collateral
            IBullStrategy(bullStrategy).withdrawWethFromEuler(_uniFlashSwapData.amountToPay);
            IERC20(weth).transfer(_uniFlashSwapData.pool, _uniFlashSwapData.amountToPay);
        }
    }

    function _checkValidRebalance(bool _isBuyingUsdc, uint256 _usdcAmount) internal view {
        (uint256 delta, uint256 cr) = _getDeltaAndCollatRatio(_isBuyingUsdc, _usdcAmount);
        require(delta <= DELTA_UPPER && delta >= DELTA_LOWER, "Invalid delta after rebalance");
        require(cr <= CR_UPPER && cr >= CR_LOWER, "Invalid CR after rebalance");
    }

    function getDeltaAndCollatRatio(bool _isBuyingUsdc, uint256 _usdcAmount)
        external
        view
        returns (uint256, uint256)
    {
        return _getDeltaAndCollatRatio(_isBuyingUsdc, _usdcAmount);
    }

    // TODO: Take in crab params when we add full rebalance
    function _getDeltaAndCollatRatio(bool _isBuyingUsdc, uint256 _usdcAmount)
        internal
        view
        returns (uint256, uint256)
    {
        (uint256 ethInCrab, uint256 squeethInCrab) =
            IBullStrategy(bullStrategy).getCrabVaultDetails();
        uint256 ethUsdPrice = UniOracle._getTwap(ethUSDCPool, weth, usdc, TWAP, false);
        uint256 squeethEthPrice = UniOracle._getTwap(ethWSqueethPool, wPowerPerp, weth, TWAP, false);
        uint256 crabUsdPrice = (
            ethInCrab.wmul(ethUsdPrice).sub(squeethInCrab.wmul(squeethEthPrice).wmul(ethUsdPrice))
        ).wdiv(IERC20(crab).totalSupply());

        uint256 usdcDebt;
        uint256 wethInCollateral;
        uint256 expectedWeth = _usdcAmount.wdiv(ethUsdPrice).mul(1e12);
        if (_isBuyingUsdc) {
            usdcDebt = IEulerDToken(dToken).balanceOf(address(this)).sub(_usdcAmount);
            wethInCollateral =
                IEulerEToken(eToken).balanceOfUnderlying(address(this)).sub(expectedWeth);
        } else {
            usdcDebt = IEulerDToken(dToken).balanceOf(address(this)).add(_usdcAmount);
            wethInCollateral =
                IEulerEToken(eToken).balanceOfUnderlying(address(this)).add(expectedWeth);
        }

        uint256 delta = (wethInCollateral.wmul(ethUsdPrice)).wdiv(
            (IBullStrategy(bullStrategy).getCrabBalance().wmul(crabUsdPrice)).add(
                wethInCollateral.wmul(ethUsdPrice)
            ).sub(usdcDebt.mul(1e12))
        );

        uint256 cr = wethInCollateral.wmul(ethUsdPrice).wdiv(usdcDebt).div(1e12);
        return (delta, cr);
    }
}
