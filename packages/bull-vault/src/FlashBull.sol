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

/**
 * @notice FlashBull contract
 * @dev handle the flashswap interactions
 * @author opyn team
 */
contract FlashBull is UniBull {
    using StrategyMath for uint256;
    using Address for address payable;

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
    /// @dev Crab V2 address
    address private immutable crab;
    /// @dev Uniswap oracle address
    address public immutable oracle;

    address public bullStrategy;

    struct FlashDepositCrabData {
        uint256 ethToDepositInCrab;
    }

    struct FlashDepositCollateralData {
        uint256 crabToDeposit;
        uint256 ethToLend;
    }

    constructor(address _bull, address _factory, address _oracle) UniBull(_factory) {
        bullStrategy = _bull;
        oracle = _oracle;
        crab = IBullStrategy(_bull).crab();
        wPowerPerp = IController(IBullStrategy(bullStrategy).powerTokenController()).wPowerPerp();
        weth = IController(IBullStrategy(bullStrategy).powerTokenController()).weth();
        usdc = IController(IBullStrategy(bullStrategy).powerTokenController()).quoteCurrency();
        ethWSqueethPool = IController(IBullStrategy(bullStrategy).powerTokenController()).wPowerPerpPool();
        ethUSDCPool = IController(IBullStrategy(bullStrategy).powerTokenController()).ethQuoteCurrencyPool();
    }

    /**
     * @notice receive function to allow ETH transfer to this contract
     */
    receive() external payable {
        require(msg.sender == weth, "Message sender should be WETH");
    }

    /**
     * @notice flash deposit into strategy, providing ETH, selling wSqueeth and dollars, and receiving strategy tokens
     * @dev this function will execute a flash swap where it receives ETH, deposits, mints, and collateralizes the loan using flash swap proceeds and msg.value, and then repays the flash swap with wSqueeth and USDC
     * @param _ethToCrab ETH that will be deposited into the crab strategy
     * @param _poolFee Uniswap pool fee
     * @param _minEthFromSqth minimum ETH we will receive from the oSQTH-ETH trade for crab component
     * @param _minEthFromUsdc minimum ETH we will receive from the USDC-ETH trade for leverage component
     */
    function flashDeposit(uint256 _ethToCrab, uint24 _poolFee, uint256 _minEthFromSqth, uint256 _minEthFromUsdc) external payable {
        uint256 crabAmount;
        uint256 usdcToBorrow;
        uint256 ethToLend;
        uint256 wSqueethToMint;
        {
            (uint256 ethInCrab, uint256 squeethInCrab) = IBullStrategy(bullStrategy).getCrabVaultDetails();
            
            uint256 ethFee;
            uint256 squeethEthPrice = _getTwap(ethWSqueethPool, wPowerPerp, weth, TWAP, false);
            (wSqueethToMint, ethFee) = _calcWsqueethToMintAndFee(_ethToCrab, squeethInCrab, ethInCrab, squeethEthPrice);
            crabAmount = _calcSharesToMint(_ethToCrab.sub(ethFee), ethInCrab, IERC20(crab).totalSupply());

            uint256 share;
            if (IERC20(bullStrategy).totalSupply() == 0) {
                share = ONE;
            } else {
                share = crabAmount.wdiv(IERC20(crab).balanceOf(bullStrategy).add(crabAmount));
            }

            // USDC we pay to flashswap
            (ethToLend, usdcToBorrow) = IBullStrategy(bullStrategy).calcLeverageEthUsdc(crabAmount, share, ethInCrab, squeethInCrab, IERC20(crab).totalSupply());
        }

        // oSQTH-ETH swap
        _exactInFlashSwap(
            wPowerPerp,
            weth,
            _poolFee,
            wSqueethToMint,
            _minEthFromSqth,
            uint8(FLASH_SOURCE.FLASH_DEPOSIT_CRAB),
            abi.encodePacked(_ethToCrab)
        );

         // ETH-USDC swap
        _exactInFlashSwap(
            usdc,
            weth,
            _poolFee,
            usdcToBorrow,
            _minEthFromUsdc,
            uint8(FLASH_SOURCE.FLASH_DEPOSIT_COLLATERAL),
            abi.encodePacked(crabAmount, ethToLend)
        );

        // return excess eth to the user that was not needed for slippage
        if (address(this).balance > 0) {
            payable(msg.sender).sendValue(address(this).balance);
        }

        IERC20(bullStrategy).transfer(msg.sender, IERC20(bullStrategy).balanceOf(address(this)));
    }

    /**
     * @notice uniswap flash swap callback function
     * @dev this function will be called by flashswap callback function uniswapV3SwapCallback()
     */
    function _uniFlashSwap(UniFlashswapCallbackData memory _uniFlashSwapData) internal override {
        if (FLASH_SOURCE(_uniFlashSwapData.callSource) == FLASH_SOURCE.FLASH_DEPOSIT_CRAB) {
            FlashDepositCrabData memory data = abi.decode(_uniFlashSwapData.callData, (FlashDepositCrabData));

            // convert WETH to ETH as Uniswap uses WETH
            IWETH9(weth).withdraw(IWETH9(weth).balanceOf(address(this)));
            ICrabStrategyV2(crab).deposit{value: data.ethToDepositInCrab}();

            // repay the squeeth flash swap
            IERC20(wPowerPerp).transfer(_uniFlashSwapData.pool, _uniFlashSwapData.amountToPay);
        } else if (FLASH_SOURCE(_uniFlashSwapData.callSource) == FLASH_SOURCE.FLASH_DEPOSIT_COLLATERAL) {
            FlashDepositCollateralData memory data =
                abi.decode(_uniFlashSwapData.callData, (FlashDepositCollateralData));

            ICrabStrategyV2(crab).approve(bullStrategy, data.crabToDeposit);
            IBullStrategy(bullStrategy).deposit{value: data.ethToLend}(data.crabToDeposit);

            // repay the dollars flash swap
            IERC20(usdc).transfer(_uniFlashSwapData.pool, _uniFlashSwapData.amountToPay);
        }
    }

    function _calcWsqueethToMintAndFee(
        uint256 _depositedAmount,
        uint256 _strategyDebtAmount,
        uint256 _strategyCollateralAmount,
        uint256 _squeethEthPrice
    ) internal view returns (uint256, uint256) {
        uint256 feeRate = IController(IBullStrategy(bullStrategy).powerTokenController()).feeRate();
        uint256 feeAdjustment = _squeethEthPrice.mul(feeRate).div(10000);
        uint256 wSqueethToMint = _depositedAmount.wmul(_strategyDebtAmount).wdiv(
            _strategyCollateralAmount.add(_strategyDebtAmount.wmul(feeAdjustment))
        );
        uint256 fee = wSqueethToMint.wmul(feeAdjustment);

        return (wSqueethToMint, fee);
    }

    /**
     * @dev calculate amount of strategy token to mint for depositor
     * @param _amount amount of ETH deposited
     * @param _strategyCollateralAmount amount of strategy collateral
     * @param _crabTotalSupply total supply of strategy token
     * @return amount of strategy token to mint
     */
    function _calcSharesToMint(uint256 _amount, uint256 _strategyCollateralAmount, uint256 _crabTotalSupply)
        internal
        pure
        returns (uint256)
    {
        uint256 depositorShare = _amount.wdiv(_strategyCollateralAmount.add(_amount));

        if (_crabTotalSupply != 0) return _crabTotalSupply.wmul(depositorShare).wdiv(uint256(ONE).sub(depositorShare));

        return _amount;
    }
}
