pragma solidity =0.7.6;

pragma abicoder v2;

// test dependency
import "forge-std/Test.sol";
//interface
import { IERC20 } from "openzeppelin/token/ERC20/IERC20.sol";
import { IController } from "squeeth-monorepo/interfaces/IController.sol";
import { IEulerMarkets } from "../../src/interface/IEulerMarkets.sol";
import { IEulerEToken } from "../../src/interface/IEulerEToken.sol";
import { IEulerDToken } from "../../src/interface/IEulerDToken.sol";
// contract
import { ZenBullStrategy } from "../../src/ZenBullStrategy.sol";
import { CrabStrategyV2 } from "squeeth-monorepo/strategy/CrabStrategyV2.sol";
import { Controller } from "squeeth-monorepo/core/Controller.sol";
// lib
import { VaultLib } from "squeeth-monorepo/libs/VaultLib.sol";
import { StrategyMath } from "squeeth-monorepo/strategy/base/StrategyMath.sol"; // StrategyMath licensed under AGPL-3.0-only
import { UniOracle } from "../../src/UniOracle.sol";
import { StrategyMath } from "squeeth-monorepo/strategy/base/StrategyMath.sol"; // StrategyMath licensed under AGPL-3.0-only

contract TestUtil is Test {
    using StrategyMath for uint256;

    uint128 internal constant ONE = 1e18;
    uint32 internal constant TWAP = 420;
    uint256 internal constant INDEX_SCALE = 10000;
    uint256 internal constant WETH_DECIMALS_DIFF = 1e12;

    address internal eToken;
    address internal dToken;

    ZenBullStrategy internal zenBullStrategy;
    Controller internal controller;
    CrabStrategyV2 internal crabV2;

    constructor(
        address payable _zenBullStrategy,
        address payable _controller,
        address _eToken,
        address _dToken,
        address payable _crabV2
    ) {
        zenBullStrategy = ZenBullStrategy(_zenBullStrategy);
        controller = Controller(_controller);
        eToken = _eToken;
        dToken = _dToken;
        crabV2 = CrabStrategyV2(_crabV2);
    }

    function testToAvoidCoverage() public pure {
        return;
    }

    function getCrabVaultDetails() public view returns (uint256, uint256) {
        VaultLib.Vault memory strategyVault =
            IController(address(controller)).vaults(crabV2.vaultId());
        return (strategyVault.collateralAmount, strategyVault.shortAmount);
    }

    function calcCollateralAndBorrowAmount(uint256 _crabToDeposit)
        external
        view
        returns (uint256, uint256)
    {
        uint256 wethToLend;
        uint256 usdcToBorrow;
        if (IERC20(zenBullStrategy).totalSupply() == 0) {
            {
                uint256 ethUsdPrice = UniOracle._getTwap(
                    controller.ethQuoteCurrencyPool(),
                    controller.weth(),
                    controller.quoteCurrency(),
                    TWAP,
                    false
                );
                uint256 squeethEthPrice = UniOracle._getTwap(
                    controller.wPowerPerpPool(),
                    controller.wPowerPerp(),
                    controller.weth(),
                    TWAP,
                    false
                );
                (uint256 ethInCrab, uint256 squeethInCrab) = getCrabVaultDetails();
                uint256 crabUsdPrice = (
                    ethInCrab.wmul(ethUsdPrice).sub(
                        squeethInCrab.wmul(squeethEthPrice).wmul(ethUsdPrice)
                    )
                ).wdiv(crabV2.totalSupply());
                wethToLend = zenBullStrategy.TARGET_CR().wmul(_crabToDeposit).wmul(crabUsdPrice)
                    .wdiv(ethUsdPrice);
                usdcToBorrow = wethToLend.wmul(ethUsdPrice).wdiv(zenBullStrategy.TARGET_CR()).div(
                    WETH_DECIMALS_DIFF
                );
            }
        } else {
            uint256 share =
                _crabToDeposit.wdiv(zenBullStrategy.getCrabBalance().add(_crabToDeposit));
            wethToLend = IEulerEToken(eToken).balanceOfUnderlying(address(zenBullStrategy)).wmul(
                share
            ).wdiv(uint256(1e18).sub(share));
            usdcToBorrow = IEulerDToken(dToken).balanceOf(address(zenBullStrategy)).wmul(share).wdiv(
                uint256(1e18).sub(share)
            );
        }

        return (wethToLend, usdcToBorrow);
    }

    function getCrabPrice() external view returns (uint256) {
        uint256 ethUsdPrice = UniOracle._getTwap(
            controller.ethQuoteCurrencyPool(),
            controller.weth(),
            controller.quoteCurrency(),
            TWAP,
            false
        );
        uint256 squeethEthPrice = UniOracle._getTwap(
            controller.wPowerPerpPool(), controller.wPowerPerp(), controller.weth(), TWAP, false
        );
        (uint256 ethInCrab, uint256 squeethInCrab) = getCrabVaultDetails();
        uint256 crabUsdPrice = (
            ethInCrab.wmul(ethUsdPrice).sub(squeethInCrab.wmul(squeethEthPrice).wmul(ethUsdPrice))
        ).wdiv(crabV2.totalSupply());
        return crabUsdPrice;
    }

    function calcTotalEthDelta(uint256 _crabToDeposit) external view returns (uint256) {
        uint256 ethUsdPrice = UniOracle._getTwap(
            controller.ethQuoteCurrencyPool(),
            controller.weth(),
            controller.quoteCurrency(),
            TWAP,
            false
        );
        uint256 squeethEthPrice = UniOracle._getTwap(
            controller.wPowerPerpPool(), controller.wPowerPerp(), controller.weth(), TWAP, false
        );
        (uint256 ethInCrab, uint256 squeethInCrab) = getCrabVaultDetails();
        uint256 crabUsdPrice = (
            ethInCrab.wmul(ethUsdPrice).sub(squeethInCrab.wmul(squeethEthPrice).wmul(ethUsdPrice))
        ).wdiv(crabV2.totalSupply());
        uint256 totalEthDelta = (
            IEulerEToken(eToken).balanceOfUnderlying(address(zenBullStrategy)).wmul(ethUsdPrice)
        ).wdiv(
            _crabToDeposit.wmul(crabUsdPrice).add(
                IEulerEToken(eToken).balanceOfUnderlying(address(zenBullStrategy)).wmul(ethUsdPrice)
            ).sub(IEulerDToken(dToken).balanceOf(address(zenBullStrategy)).mul(WETH_DECIMALS_DIFF))
        );

        return totalEthDelta;
    }

    function calcWethToWithdraw(uint256 _bullAmount) external view returns (uint256) {
        return (_bullAmount.wdiv(zenBullStrategy.totalSupply())).wmul(
            IEulerEToken(eToken).balanceOfUnderlying(address(zenBullStrategy))
        );
    }

    function calcBullToMint(uint256 _crabToDeposit) external view returns (uint256) {
        if (IERC20(zenBullStrategy).totalSupply() == 0) {
            return _crabToDeposit;
        } else {
            uint256 share =
                _crabToDeposit.wdiv(zenBullStrategy.getCrabBalance().add(_crabToDeposit));
            return share.wmul(zenBullStrategy.totalSupply()).wdiv(uint256(1e18).sub(share));
        }
    }

    function calculateCrabRedemption(
        uint256 crabShares,
        uint256 ethUsdPrice,
        uint256 crabCollateral,
        uint256 crabDebt
    ) external view returns (uint256) {
        uint256 ethInCrabAfterShutdown;
        //this check is not strictly true, but for our tests it works. hasRedeemedInShutdown is a private variable that would be the correct one to check
        if (controller.isShutDown()) {
            ethInCrabAfterShutdown = address(crabV2).balance;
        } else {
            ethInCrabAfterShutdown = crabCollateral.sub(
                crabDebt.wmul(controller.normalizationFactor()).wmul(ethUsdPrice.div(INDEX_SCALE))
            );
        }

        uint256 ethFromCrabRedemption =
            crabShares.wdiv(crabV2.totalSupply()).wmul(ethInCrabAfterShutdown);

        // note the below doesnt work as it has wrong order of operations - make sure our order of operations is correct for rounding reasons
        //uint256 ethFromCrabRedemption = crabShares.wmul(ethInCrabAfterShutdown).wdiv(crabV2.totalSupply())

        return ethFromCrabRedemption;
    }

    function calcWsqueethToMintAndFee(
        uint256 _depositedAmount,
        uint256 _strategyDebtAmount,
        uint256 _strategyCollateralAmount
    ) external view returns (uint256, uint256) {
        uint256 wSqueethToMint;
        uint256 wSqueethEthPrice = UniOracle._getTwap(
            controller.wPowerPerpPool(), controller.wPowerPerp(), controller.weth(), TWAP, false
        );

        uint256 feeRate = IController(zenBullStrategy.powerTokenController()).feeRate();
        uint256 feeAdjustment = wSqueethEthPrice.mul(feeRate).div(10000);

        wSqueethToMint = _depositedAmount.wmul(_strategyDebtAmount).wdiv(
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
    function calcSharesToMint(
        uint256 _amount,
        uint256 _strategyCollateralAmount,
        uint256 _crabTotalSupply
    ) external pure returns (uint256) {
        uint256 depositorShare = _amount.wdiv(_strategyCollateralAmount.add(_amount));

        if (_crabTotalSupply != 0) {
            return _crabTotalSupply.wmul(depositorShare).wdiv(uint256(ONE).sub(depositorShare));
        }

        return _amount;
    }

    function calcTotalEthToBull(
        uint256 wethToLend,
        uint256 ethToCrab,
        uint256 usdcToBorrow,
        uint256 wSqueethToMint
    ) external view returns (uint256) {
        uint256 ethUsdPrice = UniOracle._getTwap(
            controller.ethQuoteCurrencyPool(),
            controller.weth(),
            controller.quoteCurrency(),
            TWAP,
            false
        );
        uint256 squeethEthPrice = UniOracle._getTwap(
            controller.wPowerPerpPool(), controller.wPowerPerp(), controller.weth(), TWAP, false
        );

        uint256 totalEthToBull = wethToLend.add(ethToCrab).sub(usdcToBorrow.wdiv(ethUsdPrice)).sub(
            wSqueethToMint.wmul(squeethEthPrice)
        ).add(1e16);
        return totalEthToBull;
    }
}
