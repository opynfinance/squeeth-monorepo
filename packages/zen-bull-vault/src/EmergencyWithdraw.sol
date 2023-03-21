// SPDX-License-Identifier: GPL-3.0-only
pragma solidity =0.7.6;
pragma abicoder v2;

import { console } from "forge-std/console.sol";

// interface
import { IERC20 } from "openzeppelin/token/ERC20/IERC20.sol";
import { IZenBullStrategy } from "./interface/IZenBullStrategy.sol";
import { IWETH9 } from "squeeth-monorepo/interfaces/IWETH9.sol";
import { IEulerEToken } from "./interface/IEulerEToken.sol";
import { IEulerDToken } from "./interface/IEulerDToken.sol";
// contract
import { ERC20 } from "openzeppelin/token/ERC20/ERC20.sol";
import { UniFlash } from "./UniFlash.sol";
import { UniOracle } from "./UniOracle.sol";
// lib
import { StrategyMath } from "squeeth-monorepo/strategy/base/StrategyMath.sol";
import { Address } from "openzeppelin/utils/Address.sol";

contract EmergencyWithdraw is ERC20, UniFlash {
    using StrategyMath for uint256;
    using Address for address payable;

    uint256 internal constant ONE = 1e18;
    /// @dev WETH decimals - USDC decimals
    uint256 internal constant WETH_DECIMALS_DIFF = 1e12;
    uint256 public constant MAX_WETH_PER_DEBT_REPAY = 100 ether;
    uint256 public constant LIMIT_PRICE_TOLERANCE = 1e16; // 1%

    /// @dev crab strategy address
    address internal immutable crab;
    /// @dev ZenBull strategy address
    address internal immutable zenBull;
    /// @dev WETH address
    address internal immutable weth;
    /// @dev USDC address
    address internal immutable usdc;
    /// @dev wPowerPerp address
    address internal immutable wPowerPerp;
    /// @dev eth/usdc uniswap pool address
    address internal immutable ethUSDCPool;
    address internal immutable eToken;
    address internal immutable dToken;

    /// @dev ZenBull total supply amount at the time of this contract deployment, used for Crab withdrawal calc
    uint256 public zenBullTotalSupplyForCrabWithdrawal;
    /// @dev ZenBull total supply amount at the time of this contract deployment, used for Euler withdrawal calc
    uint256 public zenBullTotalSupplyForEulerWithdrawal;
    /// @dev if true, enable ETH withdrawal from this contract
    bool public ethWithdrawalActivated;

    enum FLASH_SOURCE {
        EMERGENCY_WITHDRAW_ETH_FROM_CRAB,
        EMERGENCY_REPAY_EULER_DEBT
    }

    event Withdraw(
        address indexed recepient,
        uint256 zenBullAmountRedeemed,
        uint256 crabAmountRedeemed,
        uint256 wPowerPerpRedeemed,
        uint256 ethReceived,
        uint256 eulerRecoveryTokenAmount
    );
    event EmergencyRepayEulerDebt(
        address indexed sender,
        uint256 ratio,
        uint256 usdcToRepay,
        uint256 wethToWithdraw,
        uint256 maxEthForUsdc,
        bool isEthWithdrawalActivated
    );
    event WithdrawEth(address indexed recepient, uint256 ethAmount);

    /**
     * @dev constructor
     * @param _crab crab address
     * @param _zenBull ZenBull address
     * @param _weth WETH address
     * @param _wPowerPerp WPowerPerp address
     * @param _factory Uni V3 factory contract
     */
    constructor(
        address _crab,
        address _zenBull,
        address _weth,
        address _usdc,
        address _wPowerPerp,
        address _ethUSDCPool,
        address _eToken,
        address _dToken,
        address _factory
    ) ERC20("ZenBullEulerRecovery", "ZBER") UniFlash(_factory) {
        crab = _crab;
        zenBull = _zenBull;
        weth = _weth;
        usdc = _usdc;
        wPowerPerp = _wPowerPerp;
        ethUSDCPool = _ethUSDCPool;
        eToken = _eToken;
        dToken = _dToken;

        zenBullTotalSupplyForCrabWithdrawal = IERC20(_zenBull).totalSupply();
        zenBullTotalSupplyForEulerWithdrawal = IERC20(_zenBull).totalSupply();

        IERC20(_wPowerPerp).approve(_zenBull, type(uint256).max);
        IERC20(_usdc).approve(_zenBull, type(uint256).max);
    }

    /**
     * @dev receive ETH
     */
    receive() external payable {
        require(msg.sender == weth, "Can't receive ETH from this sender");
    }

    /**
     * @notice withdraw ETH deposited into crab
     * @dev this will give the sender ZBEPR token as ownership for the ETH deposited in Euler pool
     * @param _zenBullAmount ZenBull amount to redeem
     * @param _maxEthForWPowerPerp max ETH to pay for flashswapped oSQTH amount
     */
    function emergencyWithdrawEthFromCrab(uint256 _zenBullAmount, uint256 _maxEthForWPowerPerp)
        external
    {
        uint256 crabToRedeem = _zenBullAmount.wdiv(zenBullTotalSupplyForCrabWithdrawal).wmul(
            IZenBullStrategy(zenBull).getCrabBalance()
        );
        (, uint256 wPowerPerpInCrab) = IZenBullStrategy(zenBull).getCrabVaultDetails();
        uint256 wPowerPerpToRedeem =
            crabToRedeem.wmul(wPowerPerpInCrab).wdiv(IERC20(crab).totalSupply());

        zenBullTotalSupplyForCrabWithdrawal =
            zenBullTotalSupplyForCrabWithdrawal.sub(_zenBullAmount);

        IERC20(zenBull).transferFrom(msg.sender, address(this), _zenBullAmount);
        _mint(msg.sender, _zenBullAmount);

        _exactOutFlashSwap(
            weth,
            wPowerPerp,
            3000,
            wPowerPerpToRedeem,
            _maxEthForWPowerPerp,
            uint8(FLASH_SOURCE.EMERGENCY_WITHDRAW_ETH_FROM_CRAB),
            abi.encodePacked(crabToRedeem, wPowerPerpToRedeem)
        );

        uint256 payout = IERC20(weth).balanceOf(address(this));
        IWETH9(weth).withdraw(payout);
        payable(msg.sender).sendValue(payout);

        emit Withdraw(
            msg.sender, _zenBullAmount, crabToRedeem, wPowerPerpToRedeem, payout, _zenBullAmount
        );
    }

    /**
     * @notice repay a portion of Euler debt and withdraw WETH collateral to this contract based on ZenBullEulerRecovery amount
     * @dev this will revert of WETH to withdraw from Euler is greater than max, or limit price breach the tolerance %
     * @dev if all ZenBullEulerRecovery are burnt, the ETH withdrawl will be activated
     * @param _ratio ratio of WETH to withdraw from total WETH in Euler in 18 decimals (e.g 2e17 => 0.2 => 20%)
     * @param _maxEthForUsdc max ETH to pay for 1 USDC
     * @param _poolFee ETH/USDC Uni v3 pool fee
     */
    function emergencyRepayEulerDebt(uint256 _ratio, uint256 _maxEthForUsdc, uint24 _poolFee)
        external
    {
        uint256 usdcToRepay = _ratio.wmul(IEulerDToken(dToken).balanceOf(zenBull));
        uint256 wethToWithdraw = _ratio.wmul(IEulerEToken(eToken).balanceOfUnderlying(zenBull));

        require(
            wethToWithdraw <= MAX_WETH_PER_DEBT_REPAY,
            "WETH to withdraw is greater than max per repay"
        );

        uint256 ethUsdPrice = UniOracle._getTwap(ethUSDCPool, weth, usdc, 420, false);

        require(
            _maxEthForUsdc <= ethUsdPrice.wmul((ONE.add(LIMIT_PRICE_TOLERANCE))),
            "Max ETH for USDC greater than max price tolerance"
        );

        _exactOutFlashSwap(
            weth,
            usdc,
            _poolFee,
            usdcToRepay,
            usdcToRepay.mul(WETH_DECIMALS_DIFF).wmul(_maxEthForUsdc),
            uint8(FLASH_SOURCE.EMERGENCY_REPAY_EULER_DEBT),
            abi.encodePacked(usdcToRepay, wethToWithdraw)
        );

        IWETH9(weth).withdraw(IERC20(weth).balanceOf(address(this)));

        if (
            (IEulerEToken(eToken).balanceOfUnderlying(zenBull) == 0)
                && (IEulerDToken(dToken).balanceOf(zenBull) == 0)
        ) {
            ethWithdrawalActivated = true;
        }

        emit EmergencyRepayEulerDebt(
            msg.sender, _ratio, usdcToRepay, wethToWithdraw, _maxEthForUsdc, ethWithdrawalActivated
        );
    }

    /**
     * @notice withdraw ETH from this contract, will revert if ZenBull still have some debt not repaid
     */
    function withdrawEth(uint256 _recoveryTokenAmount) external {
        require(ethWithdrawalActivated, "ETH withdrawal not activated yet");

        uint256 payout = _recoveryTokenAmount.wmul(address(this).balance).wdiv(
            zenBullTotalSupplyForEulerWithdrawal
        );
        zenBullTotalSupplyForEulerWithdrawal =
            zenBullTotalSupplyForEulerWithdrawal.sub(_recoveryTokenAmount);

        _burn(msg.sender, _recoveryTokenAmount);
        payable(msg.sender).sendValue(payout);

        emit WithdrawEth(msg.sender, payout);
    }

    /**
     * @dev function to handle Uni v3 FlashSwapCallBack
     * @param _uniFlashSwapData data struct
     */
    function _uniFlashSwap(UniFlashswapCallbackData memory _uniFlashSwapData) internal override {
        if (
            FLASH_SOURCE(_uniFlashSwapData.callSource)
                == FLASH_SOURCE.EMERGENCY_WITHDRAW_ETH_FROM_CRAB
        ) {
            (uint256 crabToRedeem, uint256 wPowerPerpToRedeem) =
                abi.decode(_uniFlashSwapData.callData, (uint256, uint256));

            IZenBullStrategy(zenBull).redeemCrabAndWithdrawWEth(crabToRedeem, wPowerPerpToRedeem);

            IERC20(weth).transfer(_uniFlashSwapData.pool, _uniFlashSwapData.amountToPay);
        } else if (
            FLASH_SOURCE(_uniFlashSwapData.callSource) == FLASH_SOURCE.EMERGENCY_REPAY_EULER_DEBT
        ) {
            (uint256 usdcToRepay, uint256 wethToWithdraw) =
                abi.decode(_uniFlashSwapData.callData, (uint256, uint256));

            IZenBullStrategy(zenBull).auctionRepayAndWithdrawFromLeverage(
                usdcToRepay, wethToWithdraw
            );

            IERC20(weth).transfer(_uniFlashSwapData.pool, _uniFlashSwapData.amountToPay);
        }
    }
}
