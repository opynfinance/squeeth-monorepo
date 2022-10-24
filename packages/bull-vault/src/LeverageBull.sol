// SPDX-License-Identifier: GPL-3.0-only
pragma solidity =0.7.6;

//interface
import {IController} from "squeeth-monorepo/interfaces/IController.sol";
import {IWETH9} from "squeeth-monorepo/interfaces/IWETH9.sol";
import {IERC20} from "openzeppelin/token/ERC20/IERC20.sol";
import {IEulerMarkets} from "./interface/IEulerMarkets.sol";
import {IEulerEToken} from "./interface/IEulerEToken.sol";
import {IEulerDToken} from "./interface/IEulerDToken.sol";
// lib
import {StrategyMath} from "squeeth-monorepo/strategy/base/StrategyMath.sol"; // StrategyMath licensed under AGPL-3.0-only

/**
 * @notice LeverageBull contract
 * @dev contract that interact mainly with leverage component
 * @author opyn team
 */
contract LeverageBull {
    using StrategyMath for uint256;

    uint256 private constant ONE = 1e18;
    uint256 public constant TARGET_CR = 15e17; // 1.5 collat ratio

    /// @dev USDC address
    address internal usdc;
    /// @dev WETH address
    address internal weth;
    /// @dev euler markets module
    address internal eulerMarkets;
    /// @dev euler eToken that represent the collateral asset
    address internal eToken;
    /// @dev euler dToken that represent the borrowed asset
    address internal dToken;

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

        IERC20(weth).approve(_euler, type(uint256).max);
        IERC20(usdc).approve(_euler, type(uint256).max);
    }

    /**
     * @notice deposit ETH into leverage component and borrow USDC
     * @dev this function handle only the leverage component part
     * @param _crabAmount amount of crab token deposited
     * @param _bullShare amount of bull share minted
     * @param _crabPrice crab token price in ETH
     * @param _ethUsdPrice ETH price in USDC
     * @return ETH deposited as collateral in Euler and borrowed amount of USDC
     */
    function _leverageDeposit(uint256 _crabAmount, uint256 _bullShare, uint256 _crabPrice, uint256 _ethUsdPrice)
        internal
        returns (uint256, uint256)
    {
        uint256 ethToLend;
        uint256 usdcToBorrow;

        if (_bullShare == ONE) {
            ethToLend = TARGET_CR.wmul(_crabAmount).wmul(_crabPrice).wdiv(_ethUsdPrice);
            usdcToBorrow = ethToLend.wmul(_ethUsdPrice).wdiv(TARGET_CR).div(1e12);
        } else {
            ethToLend = IEulerEToken(eToken).balanceOfUnderlying(address(this)).wmul(_bullShare).wdiv(ONE.sub(_bullShare));
            usdcToBorrow =
                IEulerDToken(dToken).balanceOf(address(this)).wmul(_bullShare).wdiv(ONE.sub(_bullShare)).div(1e12);
        }

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
}
