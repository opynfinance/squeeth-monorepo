// SPDX-License-Identifier: GPL-3.0-only
pragma solidity =0.7.6;

// contract
import {BullStrategy} from "./BullStrategy.sol";
import {UniBull} from "./UniBull.sol";
// lib
import {StrategyMath} from "squeeth-monorepo/strategy/base/StrategyMath.sol"; // StrategyMath licensed under AGPL-3.0-only
// interface
import {IController} from "squeeth-monorepo/interfaces/IController.sol";
import {IERC20} from "openzeppelin/token/ERC20/IERC20.sol";
import {IWETH9} from "squeeth-monorepo/interfaces/IWETH9.sol";
import {IWPowerPerp} from "squeeth-monorepo/interfaces/IWPowerPerp.sol";
import {IUniswapV3Pool} from "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";

/**
 * @notice FlashBull contract
 * @dev handle the flashswap interactions
 * @author opyn team
 */
contract FlashBull is UniBull {
    using StrategyMath for uint256;

    BullStrategy private bullStrategy;

    uint256 private constant ONE = 1e18;
    uint32 private constant TWAP = 420;

    /// @dev enum to differentiate between Uniswap swap callback function source
    enum FLASH_SOURCE {
        GENERAL_SWAP,
        FLASH_DEPOSIT_CRAB,
        FLASH_DEPOSIT_COLLATERAL,
        FLASH_WITHDRAW
    }

    /// @dev wPowerPerp address
    address private immutable wPowerPerp;
    
    /// @dev weth address
    address private immutable weth;

    /// @dev usdc address
    address private immutable usdc;

    /// @dev ETH:wSqueeth Uniswap pool
    address private immutable ethWSqueethPool;

    /// @dev ETH:USDC Uniswap pool
    address private immutable ethUSDCPool;
    

    struct FlashDepositCrabData {
        uint256 usdcAmount;
        uint256 crabAmount;
    }

    struct FlashDepositCollateralData {
        uint256 crabAmount;
        uint256 squeethAmount;
    }

    // struct FlashWithdrawData {}
    // // TODO

    constructor(address payable _bull) {
        bullStrategy = BullStrategy(_bull);
        wPowerPerp = IController(bullStrategy.powerTokenController).wPowerPerp();
        weth = IController(bullStrategy.powerTokenController).weth();
        usdc = IController(bullStrategy.powerTokenController).quoteCurrency();
        ethWSqueethPool = IController(bullStrategy.powerTokenController).wPowerPerpPool();
        ethUSDCPool = IController(bullStrategy.powerTokenController).ethQuoteCurrencyPool();
    }

    /**
     * @notice flash deposit into strategy, providing ETH, selling wSqueeth and dollars, and receiving strategy tokens
     * @dev this function will execute a flash swap where it receives ETH, deposits, mints, and collateralizes the loan using flash swap proceeds and msg.value, and then repays the flash swap with wSqueeth and USDC
     * @dev _ethToDeposit must be less than msg.value plus the proceeds from the flash swap
     * @param _ethToDeposit total ETH that will be deposited in to the strategy which is a combination of msg.value and flash swap proceeds
     * @param _ethToCrab ETH that will be deposited into the crab component
     * @param _poolFee Uniswap pool fee
     */
    function flashDeposit(uint256 _ethToCrab, uint256 _ethToDeposit, uint24 _poolFee) external payable {
        uint256 ethUsdPrice = _getTwap(ethUSDCPool, weth, usdc, TWAP, false);
        uint256 squeethEthPrice = _getTwap(ethWSqueethPool, wPowerPerp, weth, TWAP, false);
        
        (uint256 ethInCrab, uint256 squeethInCrab) = bullStrategy.getCrabVaultDetails();

        // TODO: Helper function for Crab-USD price in BullStrategy.sol
        uint256 crabUsdPrice = (ethInCrab.wmul(ethUsdPrice).sub(squeethInCrab.wmul(squeethEthPrice).wmul(ethUsdPrice)))
            .wdiv(IERC20(bullStrategy.crab).totalSupply());
        uint256 crabAmount = _ethToCrab.wmul(ethUsdPrice).wdiv(crabUsdPrice);
        uint256 share = crabAmount.wdiv(IERC20(bullStrategy.crab).balanceOf(bullStrategy));

        // wSqueeth we pay to flashswap
        uint256 wSqueethToSell = _ethToCrab.wmul(squeethInCrab).wdiv(ethInCrab);

        // USDC we pay to flashswap
        (uint256 usdcToSell, ) = bullStrategy.calcLeverageEthUsdc(crabAmount, share, crabUsdPrice, ethUsdPrice);

        // oSQTH-ETH swap
        _exactInFlashSwap(
            wPowerPerp,
            weth,
            _poolFee,
            wSqueethToSell,
            _ethToDeposit.sub(msg.value),
            uint8(FLASH_SOURCE.FLASH_DEPOSIT_CRAB),
            abi.encodePacked(usdcToSell, crabAmount)
        );
    }

    /**
     * @notice uniswap flash swap callback function
     * @dev this function will be called by flashswap callback function uniswapV3SwapCallback()
     * @param _caller address of original function caller
     * @param _amountToPay amount to pay back for flashswap
     * @param _callData arbitrary data attached to callback
     * @param _callSource identifier for which function triggered callback
     */
    function _strategyFlash(
        address _caller,
        address _tokenIn,
        address _tokenOut,
        uint24 _fee,
        uint256 _amountToPay,
        bytes memory _callData,
        uint8 _callSource
    ) internal override {
        if (FLASH_SOURCE(_callSource) == FLASH_SOURCE.FLASH_DEPOSIT_CRAB) {
            FlashDepositCrabData memory data = abi.decode(_callData, (FlashDepositCrabData));

            // ETH-USDC swap
            _exactInFlashSwap(
                usdc,
                weth,
                _fee,
                data.usdcAmount,
                data.totalAmount.sub(msg.value),
                uint8(FLASH_SOURCE.FLASH_DEPOSIT_COLLATERAL),
                abi.encodePacked(data.crabAmount, _amountToPay)
            );
        } else if (FLASH_SOURCE(_callSource) == FLASH_SOURCE.FLASH_DEPOSIT_COLLATERAL) {
            FlashDepositCollateralData memory data = abi.decode(_callData, (FlashDepositCollateralData));

            // convert WETH to ETH as Uniswap uses WETH
            IWETH9(weth).withdraw(IWETH9(weth).balanceOf(address(this)));

            // use user msg.value and unwrapped WETH from uniswap flash swap proceeds to deposit into strategy
            bullStrategy.deposit(_caller, data.crabAmount);

            // repay the squeeth flash swap
            IWPowerPerp(wPowerPerp).transfer(ethWSqueethPool, data.squeethAmount);

            // repay the dollars flash swap
            IERC20(usdc).transfer(ethUSDCPool, _amountToPay);

            // return excess eth to the user that was not needed for slippage
            if (address(this).balance > 0) {
                payable(_caller).sendValue(address(this).balance);
            }
        }
    }

}
