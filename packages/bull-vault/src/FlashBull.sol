// SPDX-License-Identifier: GPL-3.0-only
pragma solidity =0.7.6;

pragma abicoder v2;

// contract
import {UniBull} from "./UniBull.sol";
// lib
import {StrategyMath} from "squeeth-monorepo/strategy/base/StrategyMath.sol"; // StrategyMath licensed under AGPL-3.0-only
import {Address} from "openzeppelin/utils/Address.sol";
// interface
import {IController} from "squeeth-monorepo/interfaces/IController.sol";
import {IERC20} from "openzeppelin/token/ERC20/IERC20.sol";
import {IWETH9} from "squeeth-monorepo/interfaces/IWETH9.sol";
import {IUniswapV3Pool} from "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import {ICrabStrategyV2} from "./interface/ICrabStrategyV2.sol";
import {IBullStrategy} from "./interface/IBullStrategy.sol";
import {console} from "forge-std/console.sol";

/**
 * @notice FlashBull contract
 * @dev handle the flashswap interactions
 * @author opyn team
 */
contract FlashBull is UniBull {
    using StrategyMath for uint256;
    using Address for address payable;

    uint32 private constant TWAP = 420;
    uint256 private constant ONE = 1e18;

    /// @dev enum to differentiate between Uniswap swap callback function source
    enum FLASH_SOURCE {
        GENERAL_SWAP,
        FLASH_DEPOSIT,
        UNI_FLASHSWAP_FLASH_DEPOSIT,
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
    /// @dev Crab V2 address
    address private immutable crab;

    address public bullStrategy;

    struct FlashDepositData {
        uint256 usdcToBorrow;
        uint256 ethToDepositInCrab;
        uint256 crabToDeposit;
        uint256 ethToLend;
    }

    struct UniFlashswapFlashDepositData {
        uint256 ethToDepositInCrab;
        uint256 crabToDeposit;
        uint256 ethToLend;
    }

    constructor(address _bull, address _factory) UniBull(_factory) {
        bullStrategy = _bull;
        crab = IBullStrategy(_bull).crab();
        wPowerPerp = IController(IBullStrategy(bullStrategy).powerTokenController()).wPowerPerp();
        weth = IController(IBullStrategy(bullStrategy).powerTokenController()).weth();
        usdc = IController(IBullStrategy(bullStrategy).powerTokenController()).quoteCurrency();
        ethWSqueethPool = IController(IBullStrategy(bullStrategy).powerTokenController()).wPowerPerpPool();
        ethUSDCPool = IController(IBullStrategy(bullStrategy).powerTokenController()).ethQuoteCurrencyPool();
    }

    /**
     * @notice flash deposit into strategy, providing ETH, selling wSqueeth and dollars, and receiving strategy tokens
     * @dev this function will execute a flash swap where it receives ETH, deposits, mints, and collateralizes the loan using flash swap proceeds and msg.value, and then repays the flash swap with wSqueeth and USDC
     * @dev _totalEthToBull must be less than msg.value plus the proceeds from the flash swap
     * @param _totalEthToBull total ETH that will be deposited in to the strategy which is a combination of msg.value and flash swap proceeds
     * @param _ethToCrab ETH that will be deposited into the crab strategy
     * @param _poolFee Uniswap pool fee
     */
    function flashDeposit(uint256 _totalEthToBull, uint256 _ethToCrab, uint24 _poolFee) external payable {
        uint256 squeethEthPrice = _getTwap(ethWSqueethPool, wPowerPerp, weth, TWAP, false);
        uint256 crabAmount;
        uint256 usdcToBorrow;
        uint256 ethToLend;
        uint256 wPowerPerpToMint;
        {
            uint256 ethUsdPrice = _getTwap(ethUSDCPool, weth, usdc, TWAP, false);
            (uint256 ethInCrab, uint256 squeethInCrab) = IBullStrategy(bullStrategy).getCrabVaultDetails();
            uint256 crabUsdPrice = (
                ethInCrab.wmul(ethUsdPrice).sub(squeethInCrab.wmul(squeethEthPrice).wmul(ethUsdPrice))
            ).wdiv(IERC20(crab).totalSupply());
            crabAmount = _ethToCrab.wmul(ethUsdPrice).wdiv(crabUsdPrice);
            uint256 share;
            if (IERC20(bullStrategy).balanceOf(bullStrategy) == 0) {
                share = ONE;
            } else {
                share = crabAmount.wdiv(IERC20(crab).balanceOf(bullStrategy));
            }
            // wSqueeth we pay to flashswap
            wPowerPerpToMint = _ethToCrab.wmul(squeethInCrab).wdiv(ethInCrab);
            // USDC we pay to flashswap
            (ethToLend, usdcToBorrow) =
                IBullStrategy(bullStrategy).calcLeverageEthUsdc(crabAmount, share, crabUsdPrice, ethUsdPrice);
        }

        // oSQTH-ETH swap
        _exactInFlashSwap(
            wPowerPerp,
            weth,
            _poolFee,
            wPowerPerpToMint,
            0,
            uint8(FLASH_SOURCE.FLASH_DEPOSIT),
            abi.encodePacked(usdcToBorrow, _ethToCrab, crabAmount, ethToLend)
        );
    }

    /**
     * @notice receive function to allow ETH transfer to this contract
     */
    receive() external payable {
        require(msg.sender == weth, "Message sender should be WETH");
    }

    /**
     * @notice uniswap flash swap callback function
     * @dev this function will be called by flashswap callback function uniswapV3SwapCallback()
     */
    function _uniFlashSwap(UniFlashswapCallbackData memory _uniFlashSwapData) internal override {
        if (FLASH_SOURCE(_uniFlashSwapData.callSource) == FLASH_SOURCE.FLASH_DEPOSIT) {
            FlashDepositData memory data = abi.decode(_uniFlashSwapData.callData, (FlashDepositData));

            // ETH-USDC swap
            _exactInFlashSwap(
                usdc,
                weth,
                _uniFlashSwapData.fee,
                data.usdcToBorrow,
                0,
                uint8(FLASH_SOURCE.UNI_FLASHSWAP_FLASH_DEPOSIT),
                abi.encodePacked(data.ethToDepositInCrab, data.crabToDeposit, data.ethToLend)
            );

            // repay the squeeth flash swap
            IERC20(wPowerPerp).transfer(_uniFlashSwapData.pool, _uniFlashSwapData.amountToPay);

            // return excess eth to the user that was not needed for slippage
            if (address(this).balance > 0) {
                payable(_uniFlashSwapData.caller).sendValue(address(this).balance);
            }
        } else if (FLASH_SOURCE(_uniFlashSwapData.callSource) == FLASH_SOURCE.UNI_FLASHSWAP_FLASH_DEPOSIT) {
            UniFlashswapFlashDepositData memory data =
                abi.decode(_uniFlashSwapData.callData, (UniFlashswapFlashDepositData));

            // convert WETH to ETH as Uniswap uses WETH
            IWETH9(weth).withdraw(IWETH9(weth).balanceOf(address(this)));

            ICrabStrategyV2(crab).deposit{value: data.ethToDepositInCrab}();
            console.log("Crab balance: ", IERC20(crab).balanceOf(address(this)));

            ICrabStrategyV2(crab).approve(bullStrategy, data.crabToDeposit);
            IBullStrategy(bullStrategy).deposit{value: data.ethToLend}(data.crabToDeposit);

            // repay the dollars flash swap
            IERC20(usdc).transfer(_uniFlashSwapData.pool, _uniFlashSwapData.amountToPay);
        }
    }
}
