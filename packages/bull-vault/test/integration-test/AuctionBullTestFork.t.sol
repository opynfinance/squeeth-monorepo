pragma solidity =0.7.6;

pragma abicoder v2;

// test dependency
import "forge-std/Test.sol";
import { console } from "forge-std/console.sol";
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
import { AuctionBull } from "../../src/AuctionBull.sol";
import { FlashBull } from "../../src/FlashBull.sol";
// lib
import { VaultLib } from "squeeth-monorepo/libs/VaultLib.sol";
import { StrategyMath } from "squeeth-monorepo/strategy/base/StrategyMath.sol"; // StrategyMath licensed under AGPL-3.0-only
import { UniOracle } from "../../src/UniOracle.sol";

/**
 * @notice Ropsten fork testing
 */
contract AuctionBullTestFork is Test {
    using StrategyMath for uint256;

    uint32 internal constant TWAP = 420;
    uint128 internal constant ONE = 1e18;

    BullStrategy internal bullStrategy;
    FlashBull internal flashBull;
    AuctionBull internal auctionBull;
    CrabStrategyV2 internal crabV2;
    Controller internal controller;

    uint256 internal user1Pk;
    uint256 internal ownerPk;
    uint256 internal deployerPk;
    uint256 internal auctionManagerPk;

    address internal user1;
    address internal owner;
    address internal deployer;
    address internal auctionManager;

    address internal weth;
    address internal usdc;
    address internal euler;
    address internal factory;
    address internal ethWSqueethPool;
    address internal ethUsdcPool;
    address internal eulerMarketsModule;
    address internal eToken;
    address internal dToken;
    address internal wPowerPerp;

    uint256 internal cap;

    function setUp() public {
        string memory FORK_URL = vm.envString("FORK_URL");
        vm.createSelectFork(FORK_URL, 15781550);

        ownerPk = 0xA1CCE;
        owner = vm.addr(ownerPk);
        auctionManagerPk = 0xA1DCE;
        auctionManager = vm.addr(auctionManagerPk);
        deployerPk = 0xA11CE;
        deployer = vm.addr(deployerPk);
        user1Pk = 0xA11DE;
        user1 = vm.addr(user1Pk);

        vm.startPrank(deployer);
        factory = 0x1F98431c8aD98523631AE4a59f267346ea31F984;
        euler = 0x27182842E098f60e3D576794A5bFFb0777E025d3;
        eulerMarketsModule = 0x3520d5a913427E6F0D6A83E07ccD4A4da316e4d3;
        controller = Controller(0x64187ae08781B09368e6253F9E94951243A493D5);
        crabV2 = CrabStrategyV2(0x3B960E47784150F5a63777201ee2B15253D713e8);
        bullStrategy = new BullStrategy(
            owner,
            address(crabV2),
            address(controller),
            euler,
            eulerMarketsModule
        );
        flashBull = new FlashBull(address(bullStrategy), factory);
        usdc = controller.quoteCurrency();
        weth = controller.weth();
        eToken = IEulerMarkets(eulerMarketsModule).underlyingToEToken(weth);
        dToken = IEulerMarkets(eulerMarketsModule).underlyingToDToken(usdc);
        wPowerPerp = controller.wPowerPerp();
        ethWSqueethPool = controller.wPowerPerpPool();
        ethUsdcPool = controller.ethQuoteCurrencyPool();
        auctionBull = new AuctionBull(
            owner,
            auctionManager,
            address(bullStrategy),
            factory,
            address(crabV2),
            eToken,
            dToken
        );
        vm.stopPrank();

        cap = 100000e18;
        vm.prank(owner);
        bullStrategy.setCap(cap);

        vm.startPrank(owner);
        bullStrategy.setAuction(address(auctionBull));
        vm.stopPrank();

        vm.label(user1, "User 1");
        vm.label(address(bullStrategy), "BullStrategy");
        vm.label(euler, "Euler");
        vm.label(eulerMarketsModule, "EulerMarkets");
        vm.label(usdc, "USDC");
        vm.label(weth, "WETH");
        vm.label(wPowerPerp, "oSQTH");
        vm.label(address(crabV2), "crabV2");

        vm.deal(user1, 100000000e18);
        // this is a crab whale, get some crab token from
        vm.prank(0x06CECFbac34101aE41C88EbC2450f8602b3d164b);
        IERC20(crabV2).transfer(user1, 100e18);
        // some WETH and USDC rich address
        vm.prank(0x57757E3D981446D585Af0D9Ae4d7DF6D64647806);
        IERC20(weth).transfer(user1, 10000e18);

        _initateDepositInBull();
    }

    function testLeverageRebalanceRepayUsdc() public {
        (uint256 deltaBefore,) = auctionBull.getCurrentDeltaAndCollatRatio();
        uint256 bullCrabBalanceBefore = bullStrategy.getCrabBalance();
        uint256 usdcDebtBefore = IEulerDToken(dToken).balanceOf(address(bullStrategy));
        uint256 ethBalanceBefore = IEulerEToken(eToken).balanceOfUnderlying(address(bullStrategy));

        uint256 ethSlippageTolerance = 1e14;

        uint256 ethUsdPrice = UniOracle._getTwap(
            controller.ethQuoteCurrencyPool(),
            controller.weth(),
            controller.quoteCurrency(),
            TWAP,
            false
        );

        uint256 usdcToBuy = 10e6;
        uint256 maxEthForUsdc = usdcToBuy.mul(1e12).wdiv(ethUsdPrice.wmul(uint256(1e18).sub(5e15)));
        uint256 ethToSell = usdcToBuy.wdiv(ethUsdPrice).mul(1e12);
        vm.startPrank(owner);
        auctionBull.leverageRebalance(true, usdcToBuy, maxEthForUsdc, 3000);
        vm.stopPrank();

        uint256 bullCrabBalanceAfter = bullStrategy.getCrabBalance();
        uint256 usdcDebtAfter = IEulerDToken(dToken).balanceOf(address(bullStrategy));
        uint256 ethBalanceAfter = IEulerEToken(eToken).balanceOfUnderlying(address(bullStrategy));

        (uint256 deltaAfter,) = auctionBull.getCurrentDeltaAndCollatRatio();

        // The auction contract should hold no remaining funds
        assertEq(
            IERC20(usdc).balanceOf(address(auctionBull)),
            0,
            "USDC balance of auction contract should be 0"
        );
        assertEq(
            IERC20(weth).balanceOf(address(auctionBull)),
            0,
            "WETH balance of auction contract should be 0"
        );

        assertEq(
            bullCrabBalanceBefore,
            bullCrabBalanceAfter,
            "Bull's crab balance should not change on leverage rebalance"
        );

        assertApproxEqAbs(
            ethBalanceBefore.sub(ethToSell),
            ethBalanceAfter,
            ethSlippageTolerance,
            "Bull ETH in collateral mismatch"
        );

        assertEq(usdcDebtBefore.sub(usdcToBuy), usdcDebtAfter, "Bull USDC debt mismatch");
        // Delta should decrease when we sell some ETH
        assertGt(deltaBefore, deltaAfter);
    }

    function testLeverageRebalanceBorrowUsdc() public {
        (uint256 deltaBefore,) = auctionBull.getCurrentDeltaAndCollatRatio();

        uint256 bullCrabBalanceBefore = bullStrategy.getCrabBalance();
        uint256 usdcDebtBefore = IEulerDToken(dToken).balanceOf(address(bullStrategy));
        uint256 ethBalanceBefore = IEulerEToken(eToken).balanceOfUnderlying(address(bullStrategy));

        uint256 ethSlippageTolerance = 1e14;

        uint256 usdcToSell = 10e6;
        uint256 ethUsdPrice = UniOracle._getTwap(
            controller.ethQuoteCurrencyPool(),
            controller.weth(),
            controller.quoteCurrency(),
            TWAP,
            false
        );
        uint256 ethToBuy = usdcToSell.wdiv(ethUsdPrice).mul(1e12);
        vm.startPrank(owner);
        auctionBull.leverageRebalance(false, usdcToSell, 0, 3000);
        vm.stopPrank();

        uint256 bullCrabBalanceAfter = bullStrategy.getCrabBalance();
        uint256 usdcDebtAfter = IEulerDToken(dToken).balanceOf(address(bullStrategy));
        uint256 ethBalanceAfter = IEulerEToken(eToken).balanceOfUnderlying(address(bullStrategy));

        (uint256 deltaAfter,) = auctionBull.getCurrentDeltaAndCollatRatio();

        // The auction contract should hold no remaining funds
        assertEq(
            IERC20(usdc).balanceOf(address(auctionBull)),
            0,
            "USDC balance of auction contract should be 0"
        );
        assertEq(
            IERC20(weth).balanceOf(address(auctionBull)),
            0,
            "WETH balance of auction contract should be 0"
        );

        assertEq(
            bullCrabBalanceBefore,
            bullCrabBalanceAfter,
            "Bull's crab balance should not change on leverage rebalance"
        );

        assertApproxEqAbs(
            ethBalanceBefore.add(ethToBuy),
            ethBalanceAfter,
            ethSlippageTolerance,
            "Bull ETH in collateral mismatch"
        );

        assertEq(usdcDebtBefore.add(usdcToSell), usdcDebtAfter, "Bull USDC debt mismatch");
        // Delta should increase when we buy more ETH
        assertLt(deltaBefore, deltaAfter);
    }

    function testFailLeverageRebalanceBorrowUsdc() public {
        uint256 usdcToSell = 1000000e6;
        vm.startPrank(owner);
        auctionBull.leverageRebalance(false, usdcToSell, 0, 3000);
        vm.stopPrank();
    }

    function testFailLeverageRebalanceRepayUsdc() public {
        uint256 usdcToBuy = 1000000e6;
        vm.startPrank(owner);
        auctionBull.leverageRebalance(false, usdcToBuy, 0, 3000);
        vm.stopPrank();
    }

    function testLeverageRebalanceBuy() public {
        (uint256 deltaBefore,) = auctionBull.getCurrentDeltaAndCollatRatio();

        uint256 bullCrabBalanceBefore = bullStrategy.getCrabBalance();
        uint256 usdcDebtBefore = IEulerDToken(dToken).balanceOf(address(bullStrategy));
        uint256 ethBalanceBefore = IEulerEToken(eToken).balanceOfUnderlying(address(bullStrategy));

        uint256 ethSlippageTolerance = 1e14;

        uint256 usdcToSell = 10e6;
        uint256 ethUsdPrice = UniOracle._getTwap(
            controller.ethQuoteCurrencyPool(),
            controller.weth(),
            controller.quoteCurrency(),
            TWAP,
            false
        );
        uint256 ethToBuy = usdcToSell.wdiv(ethUsdPrice).mul(1e12);
        auctionBull.leverageRebalance(false, usdcToSell, 0, 3000);

        (uint256 deltaAfter,) = auctionBull.getCurrentDeltaAndCollatRatio();

        uint256 bullCrabBalanceAfter = bullStrategy.getCrabBalance();
        uint256 usdcDebtAfter = IEulerDToken(dToken).balanceOf(address(bullStrategy));
        uint256 ethBalanceAfter = IEulerEToken(eToken).balanceOfUnderlying(address(bullStrategy));

        // The auction contract should hold no remaining funds
        assertEq(
            IERC20(usdc).balanceOf(address(auctionBull)),
            0,
            "USDC balance of auction contract should be 0"
        );
        assertEq(
            IERC20(weth).balanceOf(address(auctionBull)),
            0,
            "WETH balance of auction contract should be 0"
        );

        assertEq(
            bullCrabBalanceBefore,
            bullCrabBalanceAfter,
            "Bull's crab balance should not change on leverage rebalance"
        );

        assertApproxEqAbs(
            ethBalanceBefore.add(ethToBuy),
            ethBalanceAfter,
            ethSlippageTolerance,
            "Bull ETH in collateral mismatch"
        );

        assertEq(usdcDebtBefore.add(usdcToSell), usdcDebtAfter, "Bull USDC debt mismatch");
        // Delta should increase when we buy more ETH
        assertLt(deltaBefore, deltaAfter);
    }

    // Helper functions
    function _calcWethToWithdraw(uint256 _bullAmount) internal view returns (uint256) {
        return _bullAmount.wmul(IEulerEToken(eToken).balanceOfUnderlying(address(bullStrategy)))
            .wdiv(bullStrategy.totalSupply());
    }

    function _deposit(uint256 _crabToDeposit) internal returns (uint256, uint256) {
        (uint256 wethToLend, uint256 usdcToBorrow) = _calcCollateralAndBorrowAmount(_crabToDeposit);

        IERC20(crabV2).approve(address(bullStrategy), _crabToDeposit);
        bullStrategy.deposit{value: wethToLend}(_crabToDeposit);

        return (wethToLend, usdcToBorrow);
    }

    function _calcCollateralAndBorrowAmount(uint256 _crabToDeposit)
        internal
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
                (uint256 ethInCrab, uint256 squeethInCrab) = _getCrabVaultDetails();
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

    function _getCrabVaultDetails() internal view returns (uint256, uint256) {
        VaultLib.Vault memory strategyVault =
            IController(address(controller)).vaults(crabV2.vaultId());

        return (strategyVault.collateralAmount, strategyVault.shortAmount);
    }

    function calcTotalEthToBull(
        uint256 wethToLend,
        uint256 ethToCrab,
        uint256 usdcToBorrow,
        uint256 wSqueethToMint
    ) internal view returns (uint256) {
        uint256 totalEthToBull = wethToLend.add(ethToCrab).sub(usdcToBorrow.wdiv(ethPrice())).sub(
            wSqueethToMint.wmul(squeethPrice())
        ).add(1e16);
        return totalEthToBull;
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

    function _calcWsqueethToMintAndFee(
        uint256 _depositedAmount,
        uint256 _strategyDebtAmount,
        uint256 _strategyCollateralAmount
    ) internal view returns (uint256, uint256) {
        uint256 wSqueethToMint;
        uint256 wSqueethEthPrice = squeethPrice();
        uint256 feeRate = IController(bullStrategy.powerTokenController()).feeRate();
        uint256 feeAdjustment = wSqueethEthPrice.mul(feeRate).div(10000);

        wSqueethToMint = _depositedAmount.wmul(_strategyDebtAmount).wdiv(
            _strategyCollateralAmount.add(_strategyDebtAmount.wmul(feeAdjustment))
        );

        uint256 fee = wSqueethToMint.wmul(feeAdjustment);

        return (wSqueethToMint, fee);
    }

    function squeethPrice() internal view returns (uint256) {
        return UniOracle._getTwap(ethWSqueethPool, wPowerPerp, weth, TWAP, false);
    }

    function ethPrice() internal view returns (uint256) {
        return UniOracle._getTwap(ethUsdcPool, weth, usdc, TWAP, false);
    }

    function _initateDepositInBull() internal {
        // Put some money in bull to start with
        uint256 ethToCrab = 5e18;
        (uint256 ethInCrab, uint256 squeethInCrab) = _getCrabVaultDetails();
        (uint256 wSqueethToMint, uint256 fee) =
            _calcWsqueethToMintAndFee(ethToCrab, squeethInCrab, ethInCrab);
        uint256 crabToBeMinted =
            _calcSharesToMint(ethToCrab.sub(fee), ethInCrab, IERC20(crabV2).totalSupply());
        uint256 bullCrabBalanceBefore = IERC20(crabV2).balanceOf(address(bullStrategy));

        uint256 bullShare = 1e18;
        (uint256 wethToLend, uint256 usdcToBorrow) = bullStrategy.calcLeverageEthUsdc(
            crabToBeMinted, bullShare, ethInCrab, squeethInCrab, crabV2.totalSupply()
        );

        uint256 totalEthToBull =
            calcTotalEthToBull(wethToLend, ethToCrab, usdcToBorrow, wSqueethToMint);

        FlashBull.FlashDepositParams memory params = FlashBull.FlashDepositParams({
            ethToCrab: ethToCrab,
            minEthFromSqth: 0,
            minEthFromUsdc: 0,
            wPowerPerpPoolFee: uint24(3000),
            usdcPoolFee: uint24(3000)
        });

        vm.startPrank(user1);
        flashBull.flashDeposit{value: totalEthToBull}(params);
        vm.stopPrank();

        assertEq(IEulerDToken(dToken).balanceOf(address(bullStrategy)), usdcToBorrow);
        assertApproxEqAbs(
            IEulerEToken(eToken).balanceOfUnderlying(address(bullStrategy)), wethToLend, 1
        );
        assertEq(bullStrategy.getCrabBalance().sub(crabToBeMinted), bullCrabBalanceBefore);
    }
}
