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
import { BullStrategy } from "../../src/BullStrategy.sol";
import { CrabStrategyV2 } from "squeeth-monorepo/strategy/CrabStrategyV2.sol";
import { Controller } from "squeeth-monorepo/core/Controller.sol";
import { FlashBull } from "../../src/FlashBull.sol";
// lib
import { VaultLib } from "squeeth-monorepo/libs/VaultLib.sol";
import { StrategyMath } from "squeeth-monorepo/strategy/base/StrategyMath.sol"; // StrategyMath licensed under AGPL-3.0-only
import { UniOracle } from "../../src/UniOracle.sol";
import { StrategyMath } from "squeeth-monorepo/strategy/base/StrategyMath.sol"; // StrategyMath licensed under AGPL-3.0-only

contract TestUtil is Test {
    using StrategyMath for uint256;

    uint32 internal constant TWAP = 420;

    address internal eToken;
    address internal dToken;

    BullStrategy internal bullStrategy;
    Controller internal controller;
    CrabStrategyV2 internal crabV2;

    constructor(
        address payable _bullStrategy,
        address payable _controller,
        address _eToken,
        address _dToken,
        address payable _crabV2
    ) {
        bullStrategy = BullStrategy(_bullStrategy);
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
        if (IERC20(bullStrategy).totalSupply() == 0) {
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
                wethToLend = bullStrategy.TARGET_CR().wmul(_crabToDeposit).wmul(crabUsdPrice).wdiv(
                    ethUsdPrice
                );
                usdcToBorrow = wethToLend.wmul(ethUsdPrice).wdiv(bullStrategy.TARGET_CR()).div(1e12);
            }
        } else {
            uint256 share = _crabToDeposit.wdiv(bullStrategy.getCrabBalance().add(_crabToDeposit));
            wethToLend = IEulerEToken(eToken).balanceOfUnderlying(address(bullStrategy)).wmul(share)
                .wdiv(uint256(1e18).sub(share));
            usdcToBorrow = IEulerDToken(dToken).balanceOf(address(bullStrategy)).wmul(share).wdiv(
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
            IEulerEToken(eToken).balanceOfUnderlying(address(bullStrategy)).wmul(ethUsdPrice)
        ).wdiv(
            _crabToDeposit.wmul(crabUsdPrice).add(
                IEulerEToken(eToken).balanceOfUnderlying(address(bullStrategy)).wmul(ethUsdPrice)
            ).sub(IEulerDToken(dToken).balanceOf(address(bullStrategy)).mul(1e12))
        );

        return totalEthDelta;
    }

    function calcWethToWithdraw(uint256 _bullAmount) external view returns (uint256) {
        return (_bullAmount.wdiv(bullStrategy.totalSupply())).wmul(IEulerEToken(eToken).balanceOfUnderlying(address(bullStrategy)));
    }

    function calcBullToMint(uint256 _crabToDeposit) external view returns (uint256) {
        if (IERC20(bullStrategy).totalSupply() == 0) {
            return _crabToDeposit;
        } else {
            uint256 share = _crabToDeposit.wdiv(bullStrategy.getCrabBalance().add(_crabToDeposit));
            return share.wmul(bullStrategy.totalSupply()).wdiv(uint256(1e18).sub(share));
        }
    }
}
