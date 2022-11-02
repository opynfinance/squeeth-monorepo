// SPDX-License-Identifier: GPL-3.0-only
pragma solidity =0.7.6;

// interface
import {IController} from "squeeth-monorepo/interfaces/IController.sol";
import {IWETH9} from "squeeth-monorepo/interfaces/IWETH9.sol";
import {IERC20} from "openzeppelin/token/ERC20/IERC20.sol";
import {IEulerMarkets} from "./interface/IEulerMarkets.sol";
import {IEulerEToken} from "./interface/IEulerEToken.sol";
import {IEulerDToken} from "./interface/IEulerDToken.sol";
// contract
import {Ownable} from "openzeppelin/access/Ownable.sol";
// lib
import {StrategyMath} from "squeeth-monorepo/strategy/base/StrategyMath.sol"; // StrategyMath licensed under AGPL-3.0-only
import {UniOracle} from "./UniOracle.sol";

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
    /// @dev target CR for our ETH collateral
    uint256 public constant TARGET_CR = 15e17; // 1.5 collat ratio

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

    /**
     * @dev constructor
     * @param _euler euler address
     * @param _eulerMarkets euler markets module address
     * @param _powerTokenController wPowerPerp controller address
     */
    constructor(address _owner, address _euler, address _eulerMarkets, address _powerTokenController) Ownable() {
        eulerMarkets = _eulerMarkets;
        eToken = IEulerMarkets(_eulerMarkets).underlyingToEToken(IController(_powerTokenController).weth());
        dToken = IEulerMarkets(_eulerMarkets).underlyingToDToken(IController(_powerTokenController).quoteCurrency());
        weth = IController(_powerTokenController).weth();
        usdc = IController(_powerTokenController).quoteCurrency();
        wPowerPerp = IController(_powerTokenController).wPowerPerp();
        ethWSqueethPool = IController(_powerTokenController).wPowerPerpPool();
        ethUSDCPool = IController(_powerTokenController).ethQuoteCurrencyPool();

        IERC20(IController(_powerTokenController).weth()).approve(_euler, type(uint256).max);
        IERC20(IController(_powerTokenController).quoteCurrency()).approve(_euler, type(uint256).max);

        transferOwnership(_owner);
    }

    function setAuction(address _newAuction) external {
        require(msg.sender == owner(), "Only owner can set auction");
        require(_newAuction != address(0));

        auction = _newAuction;
    }

    /**
     * @dev deposit weth as collateral in Euler market
     * @param _ethToDeposit amount of ETH to deposit
     * @param _wrapEth wrap ETH to WETH if true
     */
    function depositWethInEuler(uint256 _ethToDeposit, bool _wrapEth) external {
        require(_isAuction());
        _depositEthInEuler(_ethToDeposit, _wrapEth);
    }

    /**
     * @dev borrow USDC from Euler against deposited collateral
     * @param _usdcToBorrow amount of USDC to borrow
     */
    function borrowUsdcFromEuler(uint256 _usdcToBorrow) external {
        require(_isAuction());
        _borrowUsdcFromEuler(_usdcToBorrow);
        IERC20(usdc).transfer(auction, _usdcToBorrow);
    }

    /**
     * @dev withdraw eth from collateral in Euler market
     * @param _ethToWithdraw amount of ETH to withdraw
     */
    function withdrawWethFromEuler(uint256 _ethToWithdraw) external {
        require(_isAuction());
        _withdrawEthFromEuler(_ethToWithdraw);
        IERC20(weth).transferFrom(address(this), auction, _ethToWithdraw);
    }

    /**
     * @dev repay USDC to Euler
     * @param _usdcToRepay amount of USDC to repay
     */
    function repayUsdcToEuler(uint256 _usdcToRepay) external {
        require(_isAuction());
        _repayUsdcToEuler(_usdcToRepay);
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
     * @dev repay USDC debt to euler and withdrae collateral based on the bull share amount to burn
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

    function _withdrawEthFromEuler(uint256 _wethToWithdraw) internal {
        IEulerEToken(eToken).withdraw(0, _wethToWithdraw);
    }

    /**
     * @dev borrow USDC from Euler against deposited collateral
     */
    function _repayUsdcToEuler(uint256 _usdcToRepay) internal {
        IEulerDToken(dToken).repay(0, _usdcToRepay);
    }
    
    function _calcLeverageEthUsdc(uint256 _crabAmount, uint256 _bullShare, uint256 _ethInCrab, uint256 _squeethInCrab, uint256 _totalCrabSupply)
        internal
        view
        returns (uint256, uint256)
    {
        {
            if (_bullShare == ONE) {
                uint256 ethUsdPrice = UniOracle._getTwap(ethUSDCPool, weth, usdc, TWAP, false);
                uint256 squeethEthPrice = UniOracle._getTwap(ethWSqueethPool, wPowerPerp, weth, TWAP, false);
                uint256 crabUsdPrice = (_ethInCrab.wmul(ethUsdPrice).sub(_squeethInCrab.wmul(squeethEthPrice).wmul(ethUsdPrice)))
                .wdiv(_totalCrabSupply);
                uint256 ethToLend = TARGET_CR.wmul(_crabAmount).wmul(crabUsdPrice).wdiv(ethUsdPrice);
                uint256 usdcToBorrow = ethToLend.wmul(ethUsdPrice).wdiv(TARGET_CR).div(1e12);
                return (ethToLend, usdcToBorrow);
            }
        }
        return (IEulerEToken(eToken).balanceOfUnderlying(address(this)).wmul(_bullShare).wdiv(ONE.sub(_bullShare)),
               IEulerDToken(dToken).balanceOf(address(this)).wmul(_bullShare).wdiv(ONE.sub(_bullShare)));
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

    function _isAuction() internal view returns (bool) {
        return msg.sender == auction;
    }
}