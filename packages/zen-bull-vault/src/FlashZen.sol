// SPDX-License-Identifier: GPL-3.0-only
pragma solidity =0.7.6;

pragma abicoder v2;

// interface
import { IController } from "squeeth-monorepo/interfaces/IController.sol";
import { IERC20 } from "openzeppelin/token/ERC20/IERC20.sol";
import { IWETH9 } from "squeeth-monorepo/interfaces/IWETH9.sol";
import { ICrabStrategyV2 } from "./interface/ICrabStrategyV2.sol";
import { IZenBullStrategy } from "./interface/IZenBullStrategy.sol";
// contract
import { UniFlash } from "./UniFlash.sol";
// lib
import { StrategyMath } from "squeeth-monorepo/strategy/base/StrategyMath.sol";
import { Address } from "openzeppelin/utils/Address.sol";
import { UniOracle } from "./UniOracle.sol";
import { VaultLib } from "squeeth-monorepo/libs/VaultLib.sol";

/**
 * Error code
 * FB0: can only receive eth from weth contract or bull strategy
 */

/**
 * @notice FlashZen contract
 * @dev handle the flashswap interactions
 * @author opyn team
 */
contract FlashZen is UniFlash {
    using StrategyMath for uint256;
    using Address for address payable;

    /// @dev 1e18
    uint256 private constant ONE = 1e18;
    /// @dev TWAP period
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
    /// @dev ETH:wPowerPerp Uniswap pool
    address private immutable ethWPowerPerpPool;
    /// @dev ETH:USDC Uniswap pool
    address private immutable ethUSDCPool;
    /// @dev bull stratgey address
    address public immutable bullStrategy;
    /// @dev power perp controller address
    address private immutable powerTokenController;

    /// @dev data structs from Uni v3 callback
    struct FlashDepositCrabData {
        uint256 ethToDepositInCrab;
    }

    /// @dev struct for data encoding
    struct FlashDepositCollateralData {
        uint256 crabToDeposit;
        uint256 wethToLend;
    }

    /// @dev struct for data encoding
    struct FlashWithdrawBullData {
        uint256 bullToRedeem;
        uint256 usdcToRepay;
    }

    /// @dev struct for data encoding
    struct FlashSwapWPowerPerpData {
        uint256 bullToRedeem;
        uint256 crabToRedeem;
        uint256 wPowerPerpToRedeem;
        uint256 usdcToRepay;
        uint256 maxEthForUsdc;
        uint256 usdcPoolFee;
    }

    /// @dev flashDeposit params structs
    struct FlashDepositParams {
        uint256 ethToCrab;
        uint256 minEthFromSqth;
        uint256 minEthFromUsdc;
        uint24 wPowerPerpPoolFee;
        uint24 usdcPoolFee;
    }

    /// @dev flashWithdraw params structs
    struct FlashWithdrawParams {
        uint256 bullAmount;
        uint256 maxEthForWPowerPerp;
        uint256 maxEthForUsdc;
        uint24 wPowerPerpPoolFee;
        uint24 usdcPoolFee;
    }

    event FlashWithdraw(address indexed to, uint256 bullAmount, uint256 ethReturned);
    event FlashDeposit(
        address indexed from,
        uint256 crabAmount,
        uint256 ethDeposited,
        uint256 wPowerPerpToMint,
        uint256 usdcToBorrow,
        uint256 wethToLend
    );

    /**
     * @notice constructor
     * @param _bull bull address
     * @param _factory factory address
     */
    constructor(address _bull, address _factory) UniFlash(_factory) {
        bullStrategy = _bull;
        crab = IZenBullStrategy(_bull).crab();
        powerTokenController = IZenBullStrategy(_bull).powerTokenController();
        wPowerPerp = IController(IZenBullStrategy(_bull).powerTokenController()).wPowerPerp();
        weth = IController(IZenBullStrategy(_bull).powerTokenController()).weth();
        usdc = IController(IZenBullStrategy(_bull).powerTokenController()).quoteCurrency();
        ethWPowerPerpPool =
            IController(IZenBullStrategy(_bull).powerTokenController()).wPowerPerpPool();
        ethUSDCPool =
            IController(IZenBullStrategy(_bull).powerTokenController()).ethQuoteCurrencyPool();

        ICrabStrategyV2(IZenBullStrategy(_bull).crab()).approve(_bull, type(uint256).max);
        IERC20(IController(IZenBullStrategy(_bull).powerTokenController()).wPowerPerp()).approve(
            _bull, type(uint256).max
        );
        IERC20(IController(IZenBullStrategy(_bull).powerTokenController()).quoteCurrency()).approve(
            _bull, type(uint256).max
        );
    }

    /**
     * @notice receive function to allow ETH transfer to this contract
     */
    receive() external payable {
        require(msg.sender == weth || msg.sender == bullStrategy, "FB1");
    }

    /**
     * @notice flash deposit into strategy, providing ETH, selling wPowerPerp and USDC, and receiving strategy tokens
     * @dev this function will execute a flash swap where it receives ETH from selling wPowerPerp and deposits into crab,
     * @dev and buys ETH for USDC and repays the flashswap by depositing ETH into Euler and borrowing USDC and by minted wPowerPerp from depositing
     * @param _params FlashDepositParams params
     */
    function flashDeposit(FlashDepositParams calldata _params) external payable {
        uint256 crabAmount;
        uint256 wPowerPerpToMint;
        uint256 ethInCrab;
        uint256 wPowerPerpInCrab;
        {
            (ethInCrab, wPowerPerpInCrab) = _getCrabVaultDetails();

            uint256 ethFee;
            (wPowerPerpToMint, ethFee) =
                _calcwPowerPerpToMintAndFee(_params.ethToCrab, wPowerPerpInCrab, ethInCrab);
            crabAmount = _calcSharesToMint(
                _params.ethToCrab.sub(ethFee), ethInCrab, IERC20(crab).totalSupply()
            );
        }

        // oSQTH-ETH swap
        _exactInFlashSwap(
            wPowerPerp,
            weth,
            _params.wPowerPerpPoolFee,
            wPowerPerpToMint,
            _params.minEthFromSqth,
            uint8(FLASH_SOURCE.FLASH_DEPOSIT_CRAB),
            abi.encodePacked(_params.ethToCrab)
        );

        (ethInCrab, wPowerPerpInCrab) = _getCrabVaultDetails();
        uint256 share;
        if (IERC20(bullStrategy).totalSupply() == 0) {
            share = ONE;
        } else {
            share = crabAmount.wdiv(IZenBullStrategy(bullStrategy).getCrabBalance().add(crabAmount));
        }
        (uint256 wethToLend, uint256 usdcToBorrow) = IZenBullStrategy(bullStrategy)
            .calcLeverageEthUsdc(
            crabAmount, share, ethInCrab, wPowerPerpInCrab, IERC20(crab).totalSupply()
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

        emit FlashDeposit(
            msg.sender, crabAmount, msg.value, wPowerPerpToMint, usdcToBorrow, wethToLend
            );
    }

    /**
     * @notice flash withdraw from strategy, receiving ETH and providing strategy tokens
     * @dev buys wPowerPerp via flashswap for ETH to withdraw from crab and sells ETH for USDC to repay Euler debt and withdraw Euler collateral
     * @dev proceeds from crab withdrawal and euler collateral are used to repay the flashswaps
     * @param _params FlashWithdrawParams struct
     */
    function flashWithdraw(FlashWithdrawParams calldata _params) external {
        IERC20(bullStrategy).transferFrom(msg.sender, address(this), _params.bullAmount);

        uint256 usdcToRepay;
        uint256 crabToRedeem;
        uint256 wPowerPerpToRedeem;

        {
            uint256 bullShare = _params.bullAmount.wdiv(IERC20(bullStrategy).totalSupply());
            crabToRedeem = bullShare.wmul(IZenBullStrategy(bullStrategy).getCrabBalance());
            (, uint256 wPowerPerpInCrab) = _getCrabVaultDetails();
            wPowerPerpToRedeem =
                crabToRedeem.wmul(wPowerPerpInCrab).wdiv(IERC20(crab).totalSupply());
            usdcToRepay = IZenBullStrategy(bullStrategy).calcUsdcToRepay(bullShare);
        }

        // oSQTH-ETH swap
        _exactOutFlashSwap(
            weth,
            wPowerPerp,
            _params.wPowerPerpPoolFee,
            wPowerPerpToRedeem,
            _params.maxEthForWPowerPerp,
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

        uint256 ethToReturn = address(this).balance;
        payable(msg.sender).sendValue(ethToReturn);

        emit FlashWithdraw(msg.sender, _params.bullAmount, ethToReturn);
    }

    /**
     * @notice uniswap flash swap callback function to handle different types of flashswaps
     * @dev this function will be called by flashswap callback function uniswapV3SwapCallback()
     * @param _uniFlashSwapData UniFlashswapCallbackData struct
     */
    function _uniFlashSwap(UniFlashswapCallbackData memory _uniFlashSwapData) internal override {
        if (FLASH_SOURCE(_uniFlashSwapData.callSource) == FLASH_SOURCE.FLASH_DEPOSIT_CRAB) {
            FlashDepositCrabData memory data =
                abi.decode(_uniFlashSwapData.callData, (FlashDepositCrabData));

            // convert WETH to ETH as Uniswap uses WETH
            IWETH9(weth).withdraw(IWETH9(weth).balanceOf(address(this)));
            ICrabStrategyV2(crab).deposit{value: data.ethToDepositInCrab}();

            // repay the wPowerPerp flash swap
            IERC20(wPowerPerp).transfer(_uniFlashSwapData.pool, _uniFlashSwapData.amountToPay);
        } else if (
            FLASH_SOURCE(_uniFlashSwapData.callSource)
                == FLASH_SOURCE.FLASH_DEPOSIT_LENDING_COLLATERAL
        ) {
            FlashDepositCollateralData memory data =
                abi.decode(_uniFlashSwapData.callData, (FlashDepositCollateralData));
            IWETH9(weth).withdraw(IWETH9(weth).balanceOf(address(this)));

            IZenBullStrategy(bullStrategy).deposit{value: data.wethToLend}(data.crabToDeposit);

            // repay the dollars flash swap
            IERC20(usdc).transfer(_uniFlashSwapData.pool, _uniFlashSwapData.amountToPay);
        } else if (FLASH_SOURCE(_uniFlashSwapData.callSource) == FLASH_SOURCE.FLASH_SWAP_WPOWERPERP)
        {
            FlashSwapWPowerPerpData memory data =
                abi.decode(_uniFlashSwapData.callData, (FlashSwapWPowerPerpData));

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

            IZenBullStrategy(bullStrategy).withdraw(data.bullToRedeem);

            IWETH9(weth).deposit{value: _uniFlashSwapData.amountToPay}();
            IERC20(weth).transfer(_uniFlashSwapData.pool, _uniFlashSwapData.amountToPay);
        }
    }

    /**
     * @dev calculate amount of wPowerPerp to mint and fee based on ETH to deposit into crab
     * @param _depositedEthAmount ETH amount deposited
     * @param _strategyDebtAmount amount of wPowerPerp debt in vault
     * @param _strategyCollateralAmount amount of ETH collateral in vault
     * @return wPowerPerp to mint, mint fee amount
     */
    function _calcwPowerPerpToMintAndFee(
        uint256 _depositedEthAmount,
        uint256 _strategyDebtAmount,
        uint256 _strategyCollateralAmount
    ) internal view returns (uint256, uint256) {
        uint256 wPowerPerpToMint;
        uint256 feeRate = IController(powerTokenController).feeRate();
        if (feeRate != 0) {
            uint256 wPowerPerpEthPrice =
                UniOracle._getTwap(ethWPowerPerpPool, wPowerPerp, weth, TWAP, false);
            uint256 feeAdjustment = wPowerPerpEthPrice.mul(feeRate).div(10000);
            wPowerPerpToMint = _depositedEthAmount.wmul(_strategyDebtAmount).wdiv(
                _strategyCollateralAmount.add(_strategyDebtAmount.wmul(feeAdjustment))
            );
            uint256 fee = wPowerPerpToMint.wmul(feeAdjustment);
            return (wPowerPerpToMint, fee);
        }
        wPowerPerpToMint =
            _depositedEthAmount.wmul(_strategyDebtAmount).wdiv(_strategyCollateralAmount);
        return (wPowerPerpToMint, 0);
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

    /**
     * @notice get crab vault debt and collateral details
     * @return vault eth collateral, vault wPowerPerp debt
     */

    function _getCrabVaultDetails() internal view returns (uint256, uint256) {
        VaultLib.Vault memory strategyVault =
            IController(powerTokenController).vaults(ICrabStrategyV2(crab).vaultId());

        return (strategyVault.collateralAmount, strategyVault.shortAmount);
    }
}
