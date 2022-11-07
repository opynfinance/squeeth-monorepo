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

        IERC20(IController(IBullStrategy(_bull).powerTokenController()).weth()).approve(_bull, type(uint256).max);
        IERC20(IController(IBullStrategy(_bull).powerTokenController()).quoteCurrency()).approve(
            _bull, type(uint256).max
        );

        transferOwnership(_auctionOwner);
    }

    /**
     * @dev changes the leverage component composition by buying or selling eth
     */
    function leverageRebalance(
        bool _isBuyingUsdc,
        uint256 _usdcAmount,
        uint256 _wethThresholdAmount,
        uint24 _poolFee
    ) external {
        require(msg.sender == auctionManager);

        if (_isBuyingUsdc) {
            // swap ETH to USDC
            _exactOutFlashSwap(
                weth,
                usdc,
                _poolFee,
                _usdcAmount,
                _wethThresholdAmount,
                uint8(FLASH_SOURCE.BUYING_USDC),
                abi.encodePacked(_usdcAmount)
            );
        } else {
            // swap USDC to ETH
            _exactInFlashSwap(
                usdc,
                weth,
                _poolFee,
                _usdcAmount,
                _wethThresholdAmount,
                uint8(FLASH_SOURCE.SELLING_USDC),
                ""
            );
        }

        _isValidLeverageRebalance();
    }

    function _uniFlashSwap(UniFlashswapCallbackData memory _uniFlashSwapData) internal override {
        if (FLASH_SOURCE(_uniFlashSwapData.callSource) == FLASH_SOURCE.SELLING_USDC) {
            IBullStrategy(bullStrategy).depositAndBorrowFromLeverage(IERC20(weth).balanceOf(address(this)), _uniFlashSwapData.amountToPay);

            IERC20(_uniFlashSwapData.tokenIn).transfer(
                _uniFlashSwapData.pool, _uniFlashSwapData.amountToPay
            );

            IERC20(usdc).transfer(_uniFlashSwapData.pool, _uniFlashSwapData.amountToPay);

        } else if (FLASH_SOURCE(_uniFlashSwapData.callSource) == FLASH_SOURCE.BUYING_USDC) {
            uint256 usdcToRepay = abi.decode(_uniFlashSwapData.callData, (uint256));
            // Repay some USDC debt
            IERC20(usdc).approve(address(bullStrategy), usdcToRepay);
            IBullStrategy(bullStrategy).repayAndWithdrawFromLeverage(usdcToRepay, _uniFlashSwapData.amountToPay);

            IERC20(weth).transfer(_uniFlashSwapData.pool, _uniFlashSwapData.amountToPay);
        }
    }

    function _isValidLeverageRebalance() internal view {
        (uint256 delta, uint256 cr) = _getCurrentDeltaAndCollatRatio();
        require(delta <= DELTA_UPPER && delta >= DELTA_LOWER, "Invalid delta after rebalance");
        require(cr <= CR_UPPER && cr >= CR_LOWER, "Invalid CR after rebalance");
    }

    function getCurrentDeltaAndCollatRatio()
        external
        view
        returns (uint256, uint256)
    {
        return _getCurrentDeltaAndCollatRatio();
    }

    /**
     * @notice get expected bull startegy delta and leverage collat ratio after leverage rebalance
     */
    function _getCurrentDeltaAndCollatRatio()
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

        uint256 usdcDebt = IEulerDToken(dToken).balanceOf(address(bullStrategy));
        uint256 wethInCollateral = IEulerEToken(eToken).balanceOfUnderlying(address(bullStrategy));

        console.log("here");
        uint256 delta = (wethInCollateral.wmul(ethUsdPrice)).wdiv(
            (IBullStrategy(bullStrategy).getCrabBalance().wmul(crabUsdPrice)).add(
                wethInCollateral.wmul(ethUsdPrice)
            ).sub(usdcDebt.mul(1e12))
        );
        console.log("here2");
        console.log("delta", delta);
        console.log("wethInCollateral", wethInCollateral);
        console.log("ethUsdPrice", ethUsdPrice);
        console.log("usdcDebt", usdcDebt);

        uint256 cr = wethInCollateral.wmul(ethUsdPrice).wdiv(usdcDebt.mul(1e12));

        return (delta, cr);
    }
}
