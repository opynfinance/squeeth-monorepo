// SPDX-License-Identifier: GPL-3.0-only
pragma solidity =0.7.6;

// contract
import {UniBull} from "./UniBull.sol";

// interface
import {IController} from "squeeth-monorepo/interfaces/IController.sol";
import {IWETH9} from "squeeth-monorepo/interfaces/IWETH9.sol";
import {IERC20} from "openzeppelin/token/ERC20/IERC20.sol";
import {IEulerMarkets} from "./interface/IEulerMarkets.sol";
import {IEulerEToken} from "./interface/IEulerEToken.sol";
import {IEulerDToken} from "./interface/IEulerDToken.sol";
// lib
import {StrategyMath} from "squeeth-monorepo/strategy/base/StrategyMath.sol"; // StrategyMath licensed under AGPL-3.0-only
import {UniOracle} from "./UniOracle.sol";

/**
 * @notice LeverageBull contract
 * @dev contract that interact mainly with leverage component
 * @author opyn team
 */
abstract contract LeverageBull is UniBull {
    using StrategyMath for uint256;

    uint256 public constant TARGET_CR = 15e17; // 1.5 collat ratio

    /// @dev ETH:wSqueeth Uniswap pool
    address private immutable ethWSqueethPool;
    /// @dev ETH:USDC Uniswap pool
    address private immutable ethUSDCPool;
    /// @dev wPowerPerp address
    address private immutable wPowerPerp;
    /// @dev USDC address
    address internal immutable usdc;
    /// @dev WETH address
    address internal weth;

    /// @dev euler markets module
    address internal immutable eulerMarkets;
    /// @dev euler eToken that represent the collateral asset
    address internal immutable eToken;
    /// @dev euler dToken that represent the borrowed asset
    address internal dToken;
    /// @dev ETH:wSqueeth Uniswap pool
    address private immutable ethWSqueethPool;
    /// @dev ETH:USDC Uniswap pool
    address private immutable ethUSDCPool;
    /// @dev TWAP period
    uint32 private constant TWAP = 420;
    /// @dev wPowerPerp address
    address private immutable wPowerPerp;

    event RepayAndWithdrawFromLeverage(address from, uint256 usdcToRepay, uint256 wethToWithdraw);

    /**
     * @dev constructor
     * @param _euler euler address
     * @param _eulerMarkets euler markets module address
     * @param _powerTokenController wPowerPerp controller address
     */
    constructor(address _euler, address _eulerMarkets, address _powerTokenController) {
        eulerMarkets = _eulerMarkets;
        eToken = IEulerMarkets(_eulerMarkets).underlyingToEToken(IController(_powerTokenController).weth());
        dToken = IEulerMarkets(eulerMarkets).underlyingToDToken(IController(_powerTokenController).quoteCurrency());
        weth = IController(_powerTokenController).weth();
        usdc = IController(_powerTokenController).quoteCurrency();
        wPowerPerp = IController(_powerTokenController).wPowerPerp();
        ethWSqueethPool = IController(_powerTokenController).wPowerPerpPool();
        ethUSDCPool = IController(_powerTokenController).ethQuoteCurrencyPool();

        IERC20(IController(_powerTokenController).weth()).approve(_euler, type(uint256).max);
        IERC20(IController(_powerTokenController).quoteCurrency()).approve(_euler, type(uint256).max);
    }

    function calcLeverageEthUsdc(uint256 _crabAmount, uint256 _bullShare, uint256 _ethInCrab, uint256 _squeethInCrab, uint256 _totalCrabSupply)
        external
        view
        returns (uint256, uint256)
    {
        return _calcLeverageEthUsdc(_crabAmount, _bullShare, _ethInCrab, _squeethInCrab, _totalCrabSupply);
    }

    /**
     * @dev calculate amount of USDC debt to to repay to Euler based on amount of share of bull token
     * @param _bullShare bull share amount
     * @return USDC to repay
     */
    function calcUsdcToRepay(uint256 _bullShare) external view returns (uint256) {
        return _calcUsdcToRepay(_bullShare);
    }

    function calcLeverageEthUsdc(uint256 _crabAmount, uint256 _bullShare, uint256 _crabPrice, uint256 _ethUsdPrice)
        external
        view
        returns (uint256, uint256)
    {
        return _calcLeverageEthUsdc(_crabAmount, _bullShare, _crabPrice, _ethUsdPrice);
    }

    function calcLeverageEthUsdc(uint256 _crabAmount, uint256 _bullShare, uint256 _ethInCrab, uint256 _squeethInCrab, uint256 _totalCrabSupply)
        external
        view
        returns (uint256, uint256)
    {
        return _calcLeverageEthUsdc(_crabAmount, _bullShare, _ethInCrab, _squeethInCrab, _totalCrabSupply);
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
     * @notice deposit ETH into leverage component and borrow USDC
     * @dev this function handle only the leverage component part
     * @param _crabAmount amount of crab token deposited
     * @param _bullShare amount of bull share minted
     * @param _ethInCrab eth in crab strategy
     * @param _squeethInCrab oSQTH debt of crab strategy
     * @param _crabTotalSupply total supply of crab tokens
     * @return ETH deposited as collateral in Euler and borrowed amount of USDC
     */
    function _leverageDeposit(uint256 _crabAmount, uint256 _bullShare, uint256 _ethInCrab, uint256 _squeethInCrab, uint256 _crabTotalSupply)
        internal
        returns (uint256, uint256)
    {
        (uint256 ethToLend, uint256 usdcToBorrow) = _calcLeverageEthUsdc(_crabAmount, _bullShare, _ethInCrab, _squeethInCrab, _crabTotalSupply);

        _depositEthInEuler(ethToLend, true);
        _borrowUsdcFromEuler(usdcToBorrow);

        return (ethToLend, usdcToBorrow);
    }

    /**
     * @dev deposit weth as collateral in Euler market
     * @param _ethToDeposit amount of ETH to deposit
     * @param _wrapEth wrap ETH to WETH if true
     */
    function depositEthInEuler(uint256 _ethToDeposit, bool _wrapEth) external {
        _depositEthInEuler(_ethToDeposit, _wrapEth);
    }

    /**
     * @dev borrow USDC from Euler against deposited collateral
     * @param _usdcToBorrow amount of USDC to borrow
     */
    function borrowUsdcFromEuler(uint256 _usdcToBorrow) external {
        _borrowUsdcFromEuler(_usdcToBorrow);
    }

    /**
     * @dev withdraw eth from collateral in Euler market
     * @param _ethToWithdraw amount of ETH to withdraw
     * @param _unwrapWeth unwrap WETH to ETH if true
     */
    function withdrawEthFromEuler(uint256 _ethToWithdraw, bool _unwrapWeth) external {
        _withdrawEthFromEuler(_ethToWithdraw, _unwrapWeth);
    }

    /**
     * @dev repay USDC to Euler
     * @param _usdcToRepay amount of USDC to repay
     */
    function repayUsdcToEuler(uint256 _usdcToRepay) external {
        _repayUsdcToEuler(_usdcToRepay);
    }

    /**
     * @dev deposit weth as collateral in Euler market
     * @param _ethToDeposit amount of ETH to deposit
     * @param _wrapEth wrap ETH to WETH if true
     */
    function _depositEthInEuler(uint256 _ethToDeposit, bool _wrapEth) internal {
        if (_wrapEth) IWETH9(weth).deposit{value: _ethToDeposit}();
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
     * @dev withdraw eth from collateral in Euler market
     * @param _ethToDeposit amount of ETH to deposit
     * @param _wrapEth wrap ETH to WETH if true
     */
    function _withdrawEthFromEuler(uint256 _ethToWithdraw, bool _unwrapWeth) internal {
        IEulerEToken(eToken).withdraw(0, wethToWithdraw);
        if (_unwrapWeth) IWETH9(weth).withdraw(_ethToWithdraw);
    }

    /**
     * @dev borrow USDC from Euler against deposited collateral
     * @param _usdcToBorrow amount of USDC to borrow
     */
    function _repayUsdcToEuler(uint256 _usdcToRepay) internal {
        IEulerDToken(dToken).repay(0, _usdcToRepay);
    }

    /**
     * @dev repay USDC debt to euler and withdrae collateral based on the bull share amount to burn
     * @param _bullShare amount of bull share to burn
     */
    function _repayAndWithdrawFromLeverage(uint256 _bullShare) internal {
        uint256 usdcToRepay = _calcUsdcToRepay(_bullShare);
        uint256 wethToWithdraw = _calcWethToWithdraw(_bullShare);

        IERC20(usdc).transferFrom(msg.sender, address(this), usdcToRepay);
        _repayUsdcToEuler(usdcToRepay);
        _withdrawEthFromEuler(wethToWithdraw, true);

        emit RepayAndWithdrawFromLeverage(msg.sender, usdcToRepay, wethToWithdraw);
    }

    function _calcLeverageEthUsdc(uint256 _crabAmount, uint256 _bullShare, uint256 _ethInCrab, uint256 _squeethInCrab, uint256 _totalCrabSupply)
        internal
        view
        returns (uint256, uint256)
    {
        {
            if (_bullShare == ONE) {
                uint256 ethUsdPrice = _getTwap(ethUSDCPool, weth, usdc, TWAP, false);
                uint256 squeethEthPrice = _getTwap(ethWSqueethPool, wPowerPerp, weth, TWAP, false);
                uint256 crabUsdPrice = (_ethInCrab.wmul(ethUsdPrice).sub(_squeethInCrab.wmul(squeethEthPrice).wmul(ethUsdPrice)))
                .wdiv(_totalCrabSupply);
                uint256 ethToLend = TARGET_CR.wmul(_crabAmount).wmul(crabUsdPrice).wdiv(ethUsdPrice);
                uint256 usdcToBorrow = ethToLend.wmul(ethUsdPrice).wdiv(TARGET_CR).div(1e12);
                return (ethToLend, usdcToBorrow);
            }
        }
        return (IEulerEToken(eToken).balanceOfUnderlying(address(this)).wmul(_bullShare).wdiv(ONE.sub(_bullShare)),
               IEulerDToken(dToken).balanceOf(address(this)).wmul(_bullShare).wdiv(ONE.sub(_bullShare)).div(1e12));
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
