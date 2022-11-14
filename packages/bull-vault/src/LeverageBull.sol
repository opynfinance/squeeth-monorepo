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
import { StrategyMath } from "squeeth-monorepo/strategy/base/StrategyMath.sol"; // StrategyMath licensed under AGPL-3.0-only
import { UniOracle } from "./UniOracle.sol";

/**
 * Error codes
 * LB0: ETH sent is not equal to ETH to deposit in Euler
 * LB1: caller is not auction address
 * LB2: auction can not be set to 0 address
 */

/**
 * @notice LeverageBull contract
 * @dev contract that interact mainly with leverage component
 * @author opyn team
 */
contract LeverageBull is Ownable {
    using StrategyMath for uint256;

    /// @dev TWAP period
    uint32 internal constant TWAP = 420;
    uint256 internal constant ONE = 1e18;
    /// @dev WETH decimals - USDC decimals
    uint256 internal constant WETH_DECIMALS_DIFF = 1e12;
    /// @dev target CR for our ETH collateral
    uint256 public constant TARGET_CR = 2e18; // 2 collat ratio

    /// @dev ETH:wSqueeth Uniswap pool
    address internal immutable ethWSqueethPool;
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
    /// @dev euler eToken that represent the collateral asset
    address internal immutable eToken;
    /// @dev euler dToken that represent the borrowed asset
    address internal immutable dToken;
    /// @dev auction contract address
    address public auction;

    event RepayAndWithdrawFromLeverage(address from, uint256 usdcToRepay, uint256 wethToWithdraw);
    event SetAuction(address oldAuction, address newAuction);

    /**
     * @dev constructor
     * @param _owner owner address
     * @param _euler euler address
     * @param _eulerMarkets euler markets module address
     * @param _powerTokenController wPowerPerp controller address
     */
    constructor(
        address _owner,
        address _euler,
        address _eulerMarkets,
        address _powerTokenController
    ) Ownable() {
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
        ethWSqueethPool = IController(_powerTokenController).wPowerPerpPool();
        ethUSDCPool = IController(_powerTokenController).ethQuoteCurrencyPool();

        IERC20(IController(_powerTokenController).weth()).approve(_euler, type(uint256).max);
        IERC20(IController(_powerTokenController).quoteCurrency()).approve(
            _euler, type(uint256).max
        );

        transferOwnership(_owner);
    }

    function setAuction(address _auction) external onlyOwner {
        require(_auction != address(0), "LB2");

        emit SetAuction(auction, _auction);

        auction = _auction;
    }

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

        emit RepayAndWithdrawFromLeverage(msg.sender, _usdcToRepay, _wethToWithdraw);
    }

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

    function calcLeverageEthUsdc(
        uint256 _crabAmount,
        uint256 _bullShare,
        uint256 _ethInCrab,
        uint256 _squeethInCrab,
        uint256 _totalCrabSupply
    ) external view returns (uint256, uint256) {
        return _calcLeverageWethUsdc(
            _crabAmount, _bullShare, _ethInCrab, _squeethInCrab, _totalCrabSupply
        );
    }

    /**
     * @dev calculate amount of USDC debt to to repay to Euler based on amount of share of bull token
     * @param _bullShare bull share amount
     * @return USDC to repay
     */
    function calcUsdcToRepay(uint256 _bullShare) external view returns (uint256) {
        return _calcUsdcToRepay(_bullShare);
    }

    /**
     * @dev calculate amount of ETH collateral to withdraw to Euler based on amount of share of bull token
     * @param _bullShare bull share amount
     * @return WETH to withdraw
     */
    function calcWethToWithdraw(uint256 _bullShare) external view returns (uint256) {
        return _calcWethToWithdraw(_bullShare);
    }

    /**
     * @notice deposit ETH into leverage component and borrow USDC
     * @dev this function handle only the leverage component part
     * @param _ethAmount amount of ETH deposited from user
     * @param _crabAmount amount of crab token deposited
     * @param _bullShare amount of bull share minted
     * @param _ethInCrab eth in crab strategy
     * @param _squeethInCrab oSQTH debt of crab strategy
     * @param _crabTotalSupply total supply of crab tokens
     * @return ETH deposited as collateral in Euler and borrowed amount of USDC, and total ETH deposited as collateral in Euler
     */
    function _leverageDeposit(
        uint256 _ethAmount,
        uint256 _crabAmount,
        uint256 _bullShare,
        uint256 _ethInCrab,
        uint256 _squeethInCrab,
        uint256 _crabTotalSupply
    ) internal returns (uint256, uint256, uint256) {
        (uint256 wethToLend, uint256 usdcToBorrow) = _calcLeverageWethUsdc(
            _crabAmount, _bullShare, _ethInCrab, _squeethInCrab, _crabTotalSupply
        );

        require(wethToLend == _ethAmount, "LB0");

        _depositWethInEuler(wethToLend);
        _borrowUsdcFromEuler(usdcToBorrow);

        return (wethToLend, usdcToBorrow, IEulerEToken(eToken).balanceOfUnderlying(address(this)));
    }

    /**
     * @dev deposit weth as collateral in Euler market
     * @param _ethToDeposit amount of ETH to deposit
     */
    function _depositWethInEuler(uint256 _ethToDeposit) internal {
        IWETH9(weth).deposit{value: _ethToDeposit}();
        IEulerEToken(eToken).deposit(0, _ethToDeposit);
        IEulerMarkets(eulerMarkets).enterMarket(0, weth);
    }

    /**
     * @dev borrow USDC from Euler against deposited collateral
     * @param _usdcToBorrow amount of USDC to borrow
     */
    function _borrowUsdcFromEuler(uint256 _usdcToBorrow) internal {
        IEulerDToken(dToken).borrow(0, _usdcToBorrow);
    }

    /**
     * @dev repay USDC debt to euler and withdraw collateral based on the bull share amount to burn
     * @param _bullShare amount of bull share to burn
     */
    function _repayAndWithdrawFromLeverage(uint256 _bullShare) internal {
        uint256 usdcToRepay = _calcUsdcToRepay(_bullShare);
        uint256 wethToWithdraw = _calcWethToWithdraw(_bullShare);

        IERC20(usdc).transferFrom(msg.sender, address(this), usdcToRepay);
        IEulerDToken(dToken).repay(0, usdcToRepay);
        IEulerEToken(eToken).withdraw(0, wethToWithdraw);

        IWETH9(weth).withdraw(wethToWithdraw);

        emit RepayAndWithdrawFromLeverage(msg.sender, usdcToRepay, wethToWithdraw);
    }

    function _calcLeverageWethUsdc(
        uint256 _crabAmount,
        uint256 _bullShare,
        uint256 _ethInCrab,
        uint256 _squeethInCrab,
        uint256 _totalCrabSupply
    ) internal view returns (uint256, uint256) {
        {
            if (_bullShare == ONE) {
                uint256 ethUsdPrice = UniOracle._getTwap(ethUSDCPool, weth, usdc, TWAP, false);
                uint256 squeethEthPrice =
                    UniOracle._getTwap(ethWSqueethPool, wPowerPerp, weth, TWAP, false);
                uint256 crabUsdPrice = (
                    _ethInCrab.wmul(ethUsdPrice).sub(
                        _squeethInCrab.wmul(squeethEthPrice).wmul(ethUsdPrice)
                    )
                ).wdiv(_totalCrabSupply);
                uint256 wethToLend =
                    TARGET_CR.wmul(_crabAmount).wmul(crabUsdPrice).wdiv(ethUsdPrice);
                uint256 usdcToBorrow =
                    wethToLend.wmul(ethUsdPrice).wdiv(TARGET_CR).div(WETH_DECIMALS_DIFF);
                return (wethToLend, usdcToBorrow);
            }
        }
        uint256 wethToLend = IEulerEToken(eToken).balanceOfUnderlying(address(this)).wmul(
            _bullShare
        ).wdiv(ONE.sub(_bullShare));
        uint256 usdcToBorrow =
            IEulerDToken(dToken).balanceOf(address(this)).wmul(_bullShare).wdiv(ONE.sub(_bullShare));
        return (wethToLend, usdcToBorrow);
    }

    /**
     * @dev calculate amount of WETH to withdraw from Euler based on amount of share of bull token
     * @param _bullShare bull share amount
     * @return WETH to withdraw
     */
    function _calcWethToWithdraw(uint256 _bullShare) internal view returns (uint256) {
        return _bullShare.wmul(IEulerEToken(eToken).balanceOfUnderlying(address(this)));
    }

    /**
     * @dev calculate amount of USDC debt to to repay to Euler based on amount of share of bull token
     * @param _bullShare bull share amount
     * @return USDC to repay
     */
    function _calcUsdcToRepay(uint256 _bullShare) internal view returns (uint256) {
        return _bullShare.wmul(IEulerDToken(dToken).balanceOf(address(this)));
    }
}
