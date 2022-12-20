// SPDX-License-Identifier: GPL-3.0-only
pragma solidity =0.7.6;

// interface
import { IController } from "squeeth-monorepo/interfaces/IController.sol";
import { IWETH9 } from "squeeth-monorepo/interfaces/IWETH9.sol";
import { IERC20 } from "openzeppelin/token/ERC20/IERC20.sol";
import { IEulerMarkets } from "./interface/IEulerMarkets.sol";
import { IEulerEToken } from "./interface/IEulerEToken.sol";
import { IEulerDToken } from "./interface/IEulerDToken.sol";
// contract
import { Ownable } from "openzeppelin/access/Ownable.sol";
// lib
import { StrategyMath } from "squeeth-monorepo/strategy/base/StrategyMath.sol";
import { UniOracle } from "./UniOracle.sol";

/**
 * Error codes
 * LB0: ETH sent is not at least ETH to deposit in Euler
 * LB1: caller is not auction address
 * LB2: auction can not be set to 0 address
 */

/**
 * @notice LeverageZen contract
 * @dev contract that interacts with leverage component (borrow and collateral on Euler)
 * @author opyn team
 */
contract LeverageZen is Ownable {
    using StrategyMath for uint256;

    /// @dev TWAP period
    uint32 internal constant TWAP = 420;
    /// @dev 1e18
    uint256 internal constant ONE = 1e18;
    /// @dev WETH decimals - USDC decimals
    uint256 internal constant WETH_DECIMALS_DIFF = 1e12;
    /// @dev target CR for our ETH collateral
    uint256 public constant TARGET_CR = 2e18; // 2 collat ratio

    /// @dev ETH:wPowerPerp Uniswap pool
    address internal immutable ethWPowerPerpPool;
    /// @dev ETH:USDC Uniswap pool
    address internal immutable ethUSDCPool;
    /// @dev wPowerPerp address
    address internal immutable wPowerPerp;
    /// @dev USDC address
    address internal immutable usdc;
    /// @dev WETH address
    address internal immutable weth;
    /// @dev euler markets module
    address internal immutable eulerMarkets;
    /// @dev euler eToken that represent the collateral asset (WETH)
    address internal immutable eToken;
    /// @dev euler dToken that represent the borrowed asset (USDC)
    address internal immutable dToken;
    /// @dev auction contract address
    address public auction;

    event AuctionRepayAndWithdrawFromLeverage(
        address indexed from, uint256 usdcToRepay, uint256 wethToWithdraw
    );
    event SetAuction(address oldAuction, address newAuction);

    event DepositAndRepayFromLeverage(
        address indexed from, uint256 wethDeposited, uint256 usdcRepaid
    );

    /**
     * @dev constructor
     * @param _euler euler address
     * @param _eulerMarkets euler markets module address
     * @param _powerTokenController wPowerPerp controller address
     */
    constructor(address _euler, address _eulerMarkets, address _powerTokenController) Ownable() {
        eulerMarkets = _eulerMarkets;
        eToken = IEulerMarkets(_eulerMarkets).underlyingToEToken(
            IController(_powerTokenController).weth()
        );
        dToken = IEulerMarkets(_eulerMarkets).underlyingToDToken(
            IController(_powerTokenController).quoteCurrency()
        );
        weth = IController(_powerTokenController).weth();
        usdc = IController(_powerTokenController).quoteCurrency();
        wPowerPerp = IController(_powerTokenController).wPowerPerp();
        ethWPowerPerpPool = IController(_powerTokenController).wPowerPerpPool();
        ethUSDCPool = IController(_powerTokenController).ethQuoteCurrencyPool();

        IERC20(IController(_powerTokenController).weth()).approve(_euler, type(uint256).max);
        IERC20(IController(_powerTokenController).quoteCurrency()).approve(
            _euler, type(uint256).max
        );

        IEulerMarkets(_eulerMarkets).enterMarket(0, IController(_powerTokenController).weth());
    }

    /**
     * @notice sets the auction implementation contract that is able to call functions to adjust debt and collateral in an auction
     * @param _auction new auction address
     */
    function setAuction(address _auction) external onlyOwner {
        require(_auction != address(0), "LB2");

        emit SetAuction(auction, _auction);

        auction = _auction;
    }

    /**
     * @notice called by the auction address to repay USDC debt and withdraw weth from Euler
     * @param _usdcToRepay amount of USDC to repay
     * @param _wethToWithdraw amount of WETH to withdraw
     */
    function auctionRepayAndWithdrawFromLeverage(uint256 _usdcToRepay, uint256 _wethToWithdraw)
        external
    {
        require(msg.sender == auction, "LB1");

        if (_usdcToRepay > 0) {
            IERC20(usdc).transferFrom(msg.sender, address(this), _usdcToRepay);
            IEulerDToken(dToken).repay(0, _usdcToRepay);
        }
        if (_wethToWithdraw > 0) {
            IEulerEToken(eToken).withdraw(0, _wethToWithdraw);
            IERC20(weth).transfer(msg.sender, _wethToWithdraw);
        }

        emit AuctionRepayAndWithdrawFromLeverage(msg.sender, _usdcToRepay, _wethToWithdraw);
    }

    /**
     * @notice called by the auction address to depost WETH in Euler or borrow USDC debt
     * @param _wethToDeposit amount of WETH to deposit
     * @param _usdcToBorrow amount of USDC to borrow
     */
    function depositAndBorrowFromLeverage(uint256 _wethToDeposit, uint256 _usdcToBorrow) external {
        require(msg.sender == auction, "LB1");

        if (_wethToDeposit > 0) {
            IERC20(weth).transferFrom(msg.sender, address(this), _wethToDeposit);
            IEulerEToken(eToken).deposit(0, _wethToDeposit);
        }
        if (_usdcToBorrow > 0) {
            IEulerDToken(dToken).borrow(0, _usdcToBorrow);
            IERC20(usdc).transfer(msg.sender, _usdcToBorrow);
        }
    }

    /**
     * @notice called by the auction address to deposit more WETH into Euler or repay USDC debt
     * @param _wethToDeposit WETH amount to deposit
     * @param _usdcToRepay USDC amount to repay
     */
    function auctionDepositAndRepayFromLeverage(uint256 _wethToDeposit, uint256 _usdcToRepay)
        external
    {
        require(msg.sender == auction, "LB1");

        if (_wethToDeposit > 0) {
            IERC20(weth).transferFrom(msg.sender, address(this), _wethToDeposit);
            IEulerEToken(eToken).deposit(0, _wethToDeposit);
        }
        if (_usdcToRepay > 0) {
            IERC20(usdc).transferFrom(msg.sender, address(this), _usdcToRepay);
            IEulerDToken(dToken).repay(0, _usdcToRepay);
        }

        emit DepositAndRepayFromLeverage(msg.sender, _wethToDeposit, _usdcToRepay);
    }

    /**
     * @notice calculate target amounts of weth collateral and usdc debt based on crab and bull state
     * @param _crabAmount amount of crab
     * @param _bullShare share of bull contract scaled to 1e18
     * @param _ethInCrab ETH collateral held through crab's vault
     * @param _wPowerPerpInCrab wPowerPerp debt owed through crab's vault
     * @param _totalCrabSupply total supply of crab token
     * @return weth to lend in Euler, usdc to borrow in Euler
     */
    function calcLeverageEthUsdc(
        uint256 _crabAmount,
        uint256 _bullShare,
        uint256 _ethInCrab,
        uint256 _wPowerPerpInCrab,
        uint256 _totalCrabSupply
    ) external view returns (uint256, uint256) {
        return _calcLeverageWethUsdc(
            _crabAmount, _bullShare, _ethInCrab, _wPowerPerpInCrab, _totalCrabSupply
        );
    }

    /**
     * @notice calculate amount of USDC debt to to repay to Euler based on amount of share of bull token
     * @param _bullShare bull share amount
     * @return USDC to repay
     */
    function calcUsdcToRepay(uint256 _bullShare) external view returns (uint256) {
        return _calcUsdcToRepay(_bullShare);
    }

    /**
     * @notice calculate amount of ETH collateral to withdraw to Euler based on amount of share of bull token
     * @param _bullShare bull share amount
     * @return WETH to withdraw
     */
    function calcWethToWithdraw(uint256 _bullShare) external view returns (uint256) {
        return _calcWethToWithdraw(_bullShare);
    }

    /**
     * @notice deposit ETH into leverage component and borrow USDC
     * @dev this function handles only the leverage component part
     * @param _crabAmount amount of crab token deposited
     * @param _bullShare amount of bull share minted
     * @param _ethInCrab eth in crab strategy
     * @param _wPowerPerpInCrab wPowerPerp debt of crab strategy
     * @param _crabTotalSupply total supply of crab tokens
     * @return ETH deposited as collateral in Euler and borrowed amount of USDC, and total ETH deposited as collateral in Euler
     */
    function _leverageDeposit(
        uint256 _crabAmount,
        uint256 _bullShare,
        uint256 _ethInCrab,
        uint256 _wPowerPerpInCrab,
        uint256 _crabTotalSupply
    ) internal returns (uint256, uint256, uint256) {
        (uint256 wethToLend, uint256 usdcToBorrow) = _calcLeverageWethUsdc(
            _crabAmount, _bullShare, _ethInCrab, _wPowerPerpInCrab, _crabTotalSupply
        );

        require(wethToLend <= msg.value, "LB0");

        _depositWethInEuler(wethToLend);
        _borrowUsdcFromEuler(usdcToBorrow);

        return (wethToLend, usdcToBorrow, IEulerEToken(eToken).balanceOfUnderlying(address(this)));
    }

    /**
     * @notice deposit weth as collateral in Euler market
     * @param _ethToDeposit amount of ETH to deposit
     */
    function _depositWethInEuler(uint256 _ethToDeposit) internal {
        IWETH9(weth).deposit{value: _ethToDeposit}();
        IEulerEToken(eToken).deposit(0, _ethToDeposit);
    }

    /**
     * @notice borrow USDC from Euler against deposited collateral
     * @param _usdcToBorrow amount of USDC to borrow
     */
    function _borrowUsdcFromEuler(uint256 _usdcToBorrow) internal {
        IEulerDToken(dToken).borrow(0, _usdcToBorrow);
    }

    /**
     * @notice repay USDC debt to euler and withdraw collateral based on the bull share amount to burn
     * @param _bullShare amount of bull share to burn
     */
    function _repayAndWithdrawFromLeverage(uint256 _bullShare)
        internal
        returns (uint256, uint256)
    {
        uint256 usdcToRepay = _calcUsdcToRepay(_bullShare);
        uint256 wethToWithdraw = _calcWethToWithdraw(_bullShare);

        IERC20(usdc).transferFrom(msg.sender, address(this), usdcToRepay);
        IEulerDToken(dToken).repay(0, usdcToRepay);
        IEulerEToken(eToken).withdraw(0, wethToWithdraw);

        IWETH9(weth).withdraw(wethToWithdraw);

        return (usdcToRepay, wethToWithdraw);
    }

    /**
     * @notice calculate target amounts of weth collateral and usdc debt based on crab and bull state
     * @param _crabAmount amount of crab
     * @param _bullShare share of bull contract scaled to 1e18
     * @param _ethInCrab ETH collateral held through crab's vault
     * @param _wPowerPerpInCrab wPowerPerp debt owed through crab's vault
     * @param _totalCrabSupply total supply of crab token
     * @return weth to lend in Euler, usdc to borrow in Euler
     */
    function _calcLeverageWethUsdc(
        uint256 _crabAmount,
        uint256 _bullShare,
        uint256 _ethInCrab,
        uint256 _wPowerPerpInCrab,
        uint256 _totalCrabSupply
    ) internal view returns (uint256, uint256) {
        uint256 wethToLend;
        {
            if (_bullShare == ONE) {
                uint256 ethUsdPrice = UniOracle._getTwap(ethUSDCPool, weth, usdc, TWAP, false);
                uint256 wPowerPerpEthPrice =
                    UniOracle._getTwap(ethWPowerPerpPool, wPowerPerp, weth, TWAP, false);
                uint256 crabUsdPrice = (
                    _ethInCrab.wmul(ethUsdPrice).sub(
                        _wPowerPerpInCrab.wmul(wPowerPerpEthPrice).wmul(ethUsdPrice)
                    )
                ).wdiv(_totalCrabSupply);
                wethToLend = TARGET_CR.wmul(_crabAmount).wmul(crabUsdPrice).wdiv(ethUsdPrice);
                uint256 usdcToBorrow =
                    wethToLend.wmul(ethUsdPrice).wdiv(TARGET_CR).div(WETH_DECIMALS_DIFF);
                return (wethToLend, usdcToBorrow);
            }
        }
        wethToLend = IEulerEToken(eToken).balanceOfUnderlying(address(this)).wmul(_bullShare).wdiv(
            ONE.sub(_bullShare)
        );
        uint256 usdcToBorrow =
            IEulerDToken(dToken).balanceOf(address(this)).wmul(_bullShare).wdiv(ONE.sub(_bullShare));
        return (wethToLend, usdcToBorrow);
    }

    /**
     * @notice calculate amount of WETH to withdraw from Euler based on share of bull token
     * @param _bullShare bull share amount
     * @return WETH to withdraw
     */
    function _calcWethToWithdraw(uint256 _bullShare) internal view returns (uint256) {
        return _bullShare.wmul(IEulerEToken(eToken).balanceOfUnderlying(address(this)));
    }

    /**
     * @notice calculate amount of USDC debt to to repay to Euler based on share of bull token
     * @param _bullShare bull share amount
     * @return USDC to repay
     */
    function _calcUsdcToRepay(uint256 _bullShare) internal view returns (uint256) {
        return _bullShare.wmul(IEulerDToken(dToken).balanceOf(address(this)));
    }
}
