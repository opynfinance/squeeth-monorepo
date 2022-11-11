// SPDX-License-Identifier: GPL-3.0-only
pragma solidity =0.7.6;

pragma abicoder v2;

// interface
import { IController } from "squeeth-monorepo/interfaces/IController.sol";
import { IERC20 } from "openzeppelin/token/ERC20/IERC20.sol";
import { IWETH9 } from "squeeth-monorepo/interfaces/IWETH9.sol";
import { IUniswapV3Pool } from "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import { ICrabStrategyV2 } from "./interface/ICrabStrategyV2.sol";
import { IBullStrategy } from "./interface/IBullStrategy.sol";
// contract
import { UniFlash } from "./UniFlash.sol";
// lib
import { StrategyMath } from "squeeth-monorepo/strategy/base/StrategyMath.sol"; // StrategyMath licensed under AGPL-3.0-only
import { Address } from "openzeppelin/utils/Address.sol";
import { UniOracle } from "./UniOracle.sol";

/**
 * @notice FlashBull contract
 * @dev handle the flashswap interactions
 * @author opyn team
 */
contract FlashBull is UniFlash {
    using StrategyMath for uint256;
    using Address for address payable;

    uint256 private constant ONE = 1e18;
    uint32 private constant TWAP = 420;

    /// @dev enum to differentiate between Uniswap swap callback function source
    enum FLASH_SOURCE {
        GENERAL_SWAP,
        FLASH_DEPOSIT_CRAB,
        FLASH_DEPOSIT_LENDING_COLLATERAL,
        FLASH_SWAP_WPOWERPERP,
        FLASH_WITHDRAW_BULL
    }

    /// @dev wPowerPerp address
    address private immutable wPowerPerp;
    /// @dev weth address
    address private immutable weth;
    /// @dev usdc address
    address private immutable usdc;
    /// @dev Crab V2 address
    address private immutable crab;
    /// @dev ETH:wSqueeth Uniswap pool
    address private immutable ethWSqueethPool;
    /// @dev ETH:USDC Uniswap pool
    address private immutable ethUSDCPool;
    /// @dev bull stratgey address
    address public immutable bullStrategy;

    /// @dev data structs from Uni v3 callback
    struct FlashDepositCrabData {
        uint256 ethToDepositInCrab;
    }

    struct FlashDepositCollateralData {
        uint256 crabToDeposit;
        uint256 wethToLend;
    }

    struct FlashWithdrawBullData {
        uint256 bullToRedeem;
        uint256 usdcToRepay;
    }

    struct FlashSwapWPowerPerpData {
        uint256 bullToRedeem;
        uint256 crabToRedeem;
        uint256 wPowerPerpToRedeem;
        uint256 usdcToRepay;
        uint256 maxEthForUsdc;
        uint256 usdcPoolFee;
    }

    /// @dev flashDeposit params structs

    /// @dev flashWithdraw params structs
    struct FlashWithdrawParams {
        uint256 bullAmount;
        uint256 maxEthForSqueeth;
        uint256 maxEthForUsdc;
        uint24 wPowerPerpPoolFee;
        uint24 usdcPoolFee;
    }

    event FlashWithdraw(uint256 bullAmount);

    constructor(address _bull, address _factory) UniFlash(_factory) {
        bullStrategy = _bull;
        crab = IBullStrategy(_bull).crab();
        wPowerPerp = IController(IBullStrategy(_bull).powerTokenController()).wPowerPerp();
        weth = IController(IBullStrategy(_bull).powerTokenController()).weth();
        usdc = IController(IBullStrategy(_bull).powerTokenController()).quoteCurrency();
        ethWSqueethPool = IController(IBullStrategy(_bull).powerTokenController()).wPowerPerpPool();
        ethUSDCPool =
            IController(IBullStrategy(_bull).powerTokenController()).ethQuoteCurrencyPool();
    }

    /**
     * @notice receive function to allow ETH transfer to this contract
     */
    receive() external payable {
        require(msg.sender == weth || msg.sender == bullStrategy);
    }

    struct FlashDepositParams {
        uint256 ethToCrab;
        uint256 minEthFromSqth;
        uint256 minEthFromUsdc;
        uint24 wPowerPerpPoolFee;
        uint24 usdcPoolFee;
    }

    /**
     * @notice flash deposit into strategy, providing ETH, selling wSqueeth and dollars, and receiving strategy tokens
     * @dev this function will execute a flash swap where it receives ETH, deposits, mints, and collateralizes the loan using flash swap proceeds and msg.value, and then repays the flash swap with wSqueeth and USDC
     * @param _params FlashDepositParams params
     */
    function flashDeposit(
        FlashDepositParams calldata _params
    ) external payable {
        uint256 crabAmount;
        uint256 wSqueethToMint;
        uint256 ethInCrab;
        uint256 squeethInCrab;
        {
            (ethInCrab, squeethInCrab) = IBullStrategy(bullStrategy).getCrabVaultDetails();

            uint256 ethFee;
            uint256 squeethEthPrice =
                UniOracle._getTwap(ethWSqueethPool, wPowerPerp, weth, TWAP, false);
            (wSqueethToMint, ethFee) =
                _calcWsqueethToMintAndFee(_params.ethToCrab, squeethInCrab, ethInCrab, squeethEthPrice);
            crabAmount =
                _calcSharesToMint(_params.ethToCrab.sub(ethFee), ethInCrab, IERC20(crab).totalSupply());
        }

        // oSQTH-ETH swap
        _exactInFlashSwap(
            wPowerPerp,
            weth,
            _params.wPowerPerpPoolFee,
            wSqueethToMint,
            _params.minEthFromSqth,
            uint8(FLASH_SOURCE.FLASH_DEPOSIT_CRAB),
            abi.encodePacked(_params.ethToCrab)
        );

        (ethInCrab, squeethInCrab) = IBullStrategy(bullStrategy).getCrabVaultDetails();
        uint256 share;
        if (IERC20(bullStrategy).totalSupply() == 0) {
            share = ONE;
        } else {
            share = crabAmount.wdiv(IBullStrategy(bullStrategy).getCrabBalance().add(crabAmount));
        }
        (uint256 wethToLend, uint256 usdcToBorrow) = IBullStrategy(bullStrategy).calcLeverageEthUsdc(
            crabAmount, share, ethInCrab, squeethInCrab, IERC20(crab).totalSupply()
        );

        // ETH-USDC swap
        _exactInFlashSwap(
            usdc,
            weth,
            _params.usdcPoolFee,
            usdcToBorrow,
            _params.minEthFromUsdc,
            uint8(FLASH_SOURCE.FLASH_DEPOSIT_LENDING_COLLATERAL),
            abi.encodePacked(crabAmount, wethToLend)
        );

        // return excess eth to the user that was not needed for slippage
        if (address(this).balance > 0) {
            payable(msg.sender).sendValue(address(this).balance);
        }

        IERC20(bullStrategy).transfer(msg.sender, IERC20(bullStrategy).balanceOf(address(this)));
    }

    function flashWithdraw(FlashWithdrawParams calldata _params) external {
        IERC20(bullStrategy).transferFrom(msg.sender, address(this), _params.bullAmount);

        uint256 usdcToRepay;
        uint256 crabToRedeem;
        uint256 wPowerPerpToRedeem;

        {
            uint256 bullShare = _params.bullAmount.wdiv(IERC20(bullStrategy).totalSupply());
            crabToRedeem = bullShare.wmul(IBullStrategy(bullStrategy).getCrabBalance());
            (, uint256 squeethInCrab) = IBullStrategy(bullStrategy).getCrabVaultDetails();
            uint256 crabTotalSupply = IERC20(crab).totalSupply();
            wPowerPerpToRedeem = crabToRedeem.wmul(squeethInCrab).wdiv(crabTotalSupply);
            usdcToRepay = IBullStrategy(bullStrategy).calcUsdcToRepay(bullShare);
        }

        // oSQTH-ETH swap
        _exactOutFlashSwap(
            weth,
            wPowerPerp,
            _params.wPowerPerpPoolFee,
            wPowerPerpToRedeem,
            _params.maxEthForSqueeth,
            uint8(FLASH_SOURCE.FLASH_SWAP_WPOWERPERP),
            abi.encodePacked(
                _params.bullAmount,
                crabToRedeem,
                wPowerPerpToRedeem,
                usdcToRepay,
                _params.maxEthForUsdc,
                uint256(_params.usdcPoolFee)
            )
        );

        payable(msg.sender).sendValue(address(this).balance);

        emit FlashWithdraw(_params.bullAmount);
    }

    /**
     * @notice uniswap flash swap callback function
     * @dev this function will be called by flashswap callback function uniswapV3SwapCallback()
     */
    function _uniFlashSwap(UniFlashswapCallbackData memory _uniFlashSwapData) internal override {
        if (FLASH_SOURCE(_uniFlashSwapData.callSource) == FLASH_SOURCE.FLASH_DEPOSIT_CRAB) {
            FlashDepositCrabData memory data =
                abi.decode(_uniFlashSwapData.callData, (FlashDepositCrabData));

            // convert WETH to ETH as Uniswap uses WETH
            IWETH9(weth).withdraw(IWETH9(weth).balanceOf(address(this)));
            ICrabStrategyV2(crab).deposit{value: data.ethToDepositInCrab}();

            // repay the squeeth flash swap
            IERC20(wPowerPerp).transfer(_uniFlashSwapData.pool, _uniFlashSwapData.amountToPay);
        } else if (
            FLASH_SOURCE(_uniFlashSwapData.callSource)
                == FLASH_SOURCE.FLASH_DEPOSIT_LENDING_COLLATERAL
        ) {
            FlashDepositCollateralData memory data =
                abi.decode(_uniFlashSwapData.callData, (FlashDepositCollateralData));

            IWETH9(weth).withdraw(IWETH9(weth).balanceOf(address(this)));

            ICrabStrategyV2(crab).approve(bullStrategy, data.crabToDeposit);
            IBullStrategy(bullStrategy).deposit{value: data.wethToLend}(data.crabToDeposit);

            // repay the dollars flash swap
            IERC20(usdc).transfer(_uniFlashSwapData.pool, _uniFlashSwapData.amountToPay);
        } else if (FLASH_SOURCE(_uniFlashSwapData.callSource) == FLASH_SOURCE.FLASH_SWAP_WPOWERPERP)
        {
            FlashSwapWPowerPerpData memory data =
                abi.decode(_uniFlashSwapData.callData, (FlashSwapWPowerPerpData));

            IERC20(wPowerPerp).approve(bullStrategy, data.wPowerPerpToRedeem);

            // ETH-USDC swap
            _exactOutFlashSwap(
                weth,
                usdc,
                uint24(data.usdcPoolFee),
                data.usdcToRepay,
                data.maxEthForUsdc,
                uint8(FLASH_SOURCE.FLASH_WITHDRAW_BULL),
                abi.encodePacked(data.bullToRedeem, data.usdcToRepay)
            );

            IWETH9(weth).deposit{value: _uniFlashSwapData.amountToPay}();
            IERC20(weth).transfer(_uniFlashSwapData.pool, _uniFlashSwapData.amountToPay);
        } else if (FLASH_SOURCE(_uniFlashSwapData.callSource) == FLASH_SOURCE.FLASH_WITHDRAW_BULL) {
            FlashWithdrawBullData memory data =
                abi.decode(_uniFlashSwapData.callData, (FlashWithdrawBullData));

            IERC20(usdc).approve(bullStrategy, data.usdcToRepay);
            IBullStrategy(bullStrategy).withdraw(data.bullToRedeem);

            IWETH9(weth).deposit{value: _uniFlashSwapData.amountToPay}();
            IERC20(weth).transfer(_uniFlashSwapData.pool, _uniFlashSwapData.amountToPay);
        }
    }

    /**
     * @dev calculate amount of wSqueeth to mint and fee based on ETH to deposit into crab
     */
    function _calcWsqueethToMintAndFee(
        uint256 _depositedEthAmount,
        uint256 _strategyDebtAmount,
        uint256 _strategyCollateralAmount,
        uint256 _squeethEthPrice
    ) internal view returns (uint256, uint256) {
        uint256 feeRate = IController(IBullStrategy(bullStrategy).powerTokenController()).feeRate();
        uint256 feeAdjustment = _squeethEthPrice.mul(feeRate).div(10000);
        uint256 wSqueethToMint = _depositedEthAmount.wmul(_strategyDebtAmount).wdiv(
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
    function _calcSharesToMint(
        uint256 _amount,
        uint256 _strategyCollateralAmount,
        uint256 _crabTotalSupply
    ) internal pure returns (uint256) {
        uint256 depositorShare = _amount.wdiv(_strategyCollateralAmount.add(_amount));

        if (_crabTotalSupply != 0) {
            return _crabTotalSupply.wmul(depositorShare).wdiv(uint256(ONE).sub(depositorShare));
        }

        return _amount;
    }
}
