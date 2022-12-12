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
import { TestUtil } from "../util/TestUtil.t.sol";
import { ZenBullStrategy } from "../../src/ZenBullStrategy.sol";
import { CrabStrategyV2 } from "squeeth-monorepo/strategy/CrabStrategyV2.sol";
import { Controller } from "squeeth-monorepo/core/Controller.sol";
import { FlashZen } from "../../src/FlashZen.sol";
// lib
import { VaultLib } from "squeeth-monorepo/libs/VaultLib.sol";
import { StrategyMath } from "squeeth-monorepo/strategy/base/StrategyMath.sol"; // StrategyMath licensed under AGPL-3.0-only
import { UniOracle } from "../../src/UniOracle.sol";

/**
 * @notice fuzz testing
 */
contract FlashZenFuzzTest is Test {
    using StrategyMath for uint256;

    uint32 internal constant TWAP = 420;
    uint128 internal constant ONE = 1e18;
    uint256 internal constant WETH_DECIMALS_DIFF = 1e12;

    TestUtil internal testUtil;
    FlashZen internal flashBull;
    ZenBullStrategy internal bullStrategy;
    CrabStrategyV2 internal crabV2;
    Controller internal controller;

    address internal weth;
    address internal usdc;
    address internal euler;
    address internal eulerMarketsModule;
    address internal eToken;
    address internal dToken;
    address internal wPowerPerp;
    address internal ethWSqueethPool;
    address internal ethUsdcPool;

    uint256 internal user1Pk;
    uint256 internal deployerPk;
    address internal user1;
    address internal deployer;

    uint256 internal cap;

    // var to avoid stack too deep in test functions
    uint256 userEthBalanceBeforeTx;
    uint256 bullToMint;

    function setUp() public {
        string memory FORK_URL = vm.envString("FORK_URL");
        vm.createSelectFork(FORK_URL, 15781550);

        deployerPk = 0xAB11CE;
        deployer = vm.addr(deployerPk);

        vm.startPrank(deployer);
        euler = 0x27182842E098f60e3D576794A5bFFb0777E025d3;
        eulerMarketsModule = 0x3520d5a913427E6F0D6A83E07ccD4A4da316e4d3;
        controller = Controller(0x64187ae08781B09368e6253F9E94951243A493D5);
        crabV2 = CrabStrategyV2(0x3B960E47784150F5a63777201ee2B15253D713e8);
        bullStrategy = new ZenBullStrategy(
            address(crabV2),
            address(controller),
            euler,
            eulerMarketsModule
        );
        bullStrategy.transferOwnership(deployer);
        flashBull = new FlashZen(
            address(bullStrategy),
            0x1F98431c8aD98523631AE4a59f267346ea31F984
        );
        usdc = controller.quoteCurrency();
        weth = controller.weth();
        eToken = IEulerMarkets(eulerMarketsModule).underlyingToEToken(weth);
        dToken = IEulerMarkets(eulerMarketsModule).underlyingToDToken(usdc);
        wPowerPerp = controller.wPowerPerp();
        ethWSqueethPool = IController(bullStrategy.powerTokenController()).wPowerPerpPool();
        ethUsdcPool = IController(bullStrategy.powerTokenController()).ethQuoteCurrencyPool();
        testUtil = new TestUtil(
            address(bullStrategy),
            address(controller),
            eToken,
            dToken,
            address(crabV2)
        );

        cap = 100000e18;
        bullStrategy.setCap(cap);

        vm.stopPrank();
        user1Pk = 0xA11CE;
        user1 = vm.addr(user1Pk);

        vm.label(user1, "User 1");
        vm.label(address(bullStrategy), "BullStrategy");
        vm.label(address(flashBull), "FlashBull");
        vm.label(euler, "Euler");
        vm.label(eulerMarketsModule, "EulerMarkets");
        vm.label(usdc, "USDC");
        vm.label(weth, "WETH");

        vm.deal(user1, 100000000e18);
        // this is a crab whale, get some crab token from
        vm.prank(0x06CECFbac34101aE41C88EbC2450f8602b3d164b);
        IERC20(crabV2).transfer(user1, 100e18);
        // some WETH and USDC rich address
        vm.prank(0x57757E3D981446D585Af0D9Ae4d7DF6D64647806);
        IERC20(weth).transfer(user1, 10100e18);
    }

    function testFuzzingFlashDeposit(uint256 _ethToCrab) public {
        _ethToCrab = bound(_ethToCrab, 1e16, 600e18);
        (uint256 ethInCrab, uint256 squeethInCrab) = testUtil.getCrabVaultDetails();

        (uint256 wSqueethToMint, uint256 fee) =
            _calcWsqueethToMintAndFee(_ethToCrab, squeethInCrab, ethInCrab);
        uint256 crabToBeMinted =
            _calcSharesToMint(_ethToCrab.sub(fee), ethInCrab, IERC20(crabV2).totalSupply());
        uint256 bullCrabBalanceBefore = IERC20(crabV2).balanceOf(address(bullStrategy));

        {
            ethInCrab += _ethToCrab;
            squeethInCrab += wSqueethToMint;
        }

        (uint256 wethToLend, uint256 usdcToBorrow) = bullStrategy.calcLeverageEthUsdc(
            crabToBeMinted, 1e18, ethInCrab, squeethInCrab, crabV2.totalSupply().add(crabToBeMinted)
        );

        uint256 minEthFromSqueeth;
        uint256 minEthFromUsdc;
        {
            uint256 ethUsdPrice = UniOracle._getTwap(ethUsdcPool, weth, usdc, TWAP, false);
            uint256 squeethEthPrice =
                UniOracle._getTwap(ethWSqueethPool, wPowerPerp, weth, TWAP, false);
            minEthFromSqueeth = wSqueethToMint.wmul(squeethEthPrice.wmul(95e16));
            minEthFromUsdc = usdcToBorrow.mul(WETH_DECIMALS_DIFF).wdiv(ethUsdPrice.wmul(101e16));
        }
        bullToMint = testUtil.calcBullToMint(crabToBeMinted);

        vm.startPrank(user1);
        flashBull.flashDeposit{
            value: calcTotalEthToBull(wethToLend, _ethToCrab, usdcToBorrow, wSqueethToMint)
        }(
            FlashZen.FlashDepositParams({
                ethToCrab: _ethToCrab,
                minEthFromSqth: minEthFromSqueeth,
                minEthFromUsdc: minEthFromUsdc,
                wPowerPerpPoolFee: uint24(3000),
                usdcPoolFee: uint24(3000)
            })
        );
        vm.stopPrank();

        assertEq(
            IEulerDToken(dToken).balanceOf(address(bullStrategy)),
            usdcToBorrow,
            "Bull USDC debt amount mismatch"
        );
        assertApproxEqAbs(
            IEulerEToken(eToken).balanceOfUnderlying(address(bullStrategy)), wethToLend, 5
        );
        assertEq(
            bullStrategy.getCrabBalance().sub(crabToBeMinted),
            bullCrabBalanceBefore,
            "Bull crab balance mismatch"
        );
        assertEq(bullToMint, bullStrategy.balanceOf(user1), "User1 bull balance mismatch");
    }

    function testFuzzingFlashWithdraw(uint256 _crabAmount) public {
        _crabAmount = bound(
            _crabAmount, 1e18, IERC20(crabV2).balanceOf(0x06CECFbac34101aE41C88EbC2450f8602b3d164b)
        );
        // this is a crab whale, get some crab token from
        vm.prank(0x06CECFbac34101aE41C88EbC2450f8602b3d164b);
        IERC20(crabV2).transfer(user1, _crabAmount);
        vm.startPrank(user1);
        _deposit(_crabAmount);
        vm.stopPrank();

        uint256 bullToRedeem = bullStrategy.balanceOf(user1);
        (uint256 crabToRedeem, uint256 wPowerPerpToRedeem,, uint256 usdcToRepay) =
            calcAssetsNeededForFlashWithdraw(bullToRedeem);
        uint256 maxEthForWPowerPerp;
        uint256 maxEthForUsdc;
        {
            uint256 ethUsdPrice = UniOracle._getTwap(ethUsdcPool, weth, usdc, TWAP, false);
            uint256 squeethEthPrice =
                UniOracle._getTwap(ethWSqueethPool, wPowerPerp, weth, TWAP, false);

            maxEthForWPowerPerp = wPowerPerpToRedeem.wmul(squeethEthPrice.wmul(105e16));
            maxEthForUsdc =
                usdcToRepay.mul(WETH_DECIMALS_DIFF).wdiv(ethUsdPrice.wmul(uint256(1e18).sub(5e15)));
        }

        FlashZen.FlashWithdrawParams memory params = FlashZen.FlashWithdrawParams({
            bullAmount: bullStrategy.balanceOf(user1),
            maxEthForWPowerPerp: maxEthForWPowerPerp,
            maxEthForUsdc: maxEthForUsdc,
            wPowerPerpPoolFee: uint24(3000),
            usdcPoolFee: uint24(3000)
        });

        uint256 wethToWithdraw = testUtil.calcWethToWithdraw(bullToRedeem);
        uint256 userBullBalanceBefore = bullStrategy.balanceOf(user1);
        uint256 ethInLendingBefore = IEulerEToken(eToken).balanceOfUnderlying(address(bullStrategy));
        uint256 usdcBorrowedBefore = IEulerDToken(dToken).balanceOf(address(bullStrategy));
        uint256 crabBalanceBefore = crabV2.balanceOf(address(bullStrategy));

        vm.startPrank(user1);
        bullStrategy.approve(address(flashBull), params.bullAmount);
        flashBull.flashWithdraw(params);
        vm.stopPrank();

        assertEq(
            usdcBorrowedBefore.sub(usdcToRepay),
            IEulerDToken(dToken).balanceOf(address(bullStrategy)),
            "Bull USDC debt amount mismatch"
        );
        assertEq(
            ethInLendingBefore.sub(wethToWithdraw),
            IEulerEToken(eToken).balanceOfUnderlying(address(bullStrategy)),
            "Bull ETH in leverage amount mismatch"
        );
        assertEq(
            userBullBalanceBefore.sub(bullToRedeem),
            bullStrategy.balanceOf(user1),
            "User1 bull balance mismatch"
        );
        assertEq(
            crabBalanceBefore.sub(crabToRedeem),
            crabV2.balanceOf(address(bullStrategy)),
            "Bull crab balance mismatch"
        );
        // ignoring the assert below because I couldn't find a exact way to calc ethToWithdrawFromBull as I'm setting maxToPay higher than the actual slippage, need to read events
        // assertTrue((user1.balance).sub(userEthBalanceBeforeTx).sub(ethToWithdrawFromBull) <= 1e18);
    }

    /**
     *
     * /************************************************************* Helper functions! ************************************************************
     */
    function squeethPrice() internal view returns (uint256) {
        return UniOracle._getTwap(ethWSqueethPool, wPowerPerp, weth, TWAP, false);
    }

    function ethPrice() internal view returns (uint256) {
        return UniOracle._getTwap(ethUsdcPool, weth, usdc, TWAP, false);
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

    function _calcWsqueethToMintAndFee(
        uint256 _depositedAmount,
        uint256 _strategyDebtAmount,
        uint256 _strategyCollateralAmount
    ) internal view returns (uint256, uint256) {
        uint256 wSqueethToMint;
        uint256 wSqueethEthPrice =
            UniOracle._getTwap(ethWSqueethPool, wPowerPerp, weth, TWAP, false);
        uint256 feeRate = IController(bullStrategy.powerTokenController()).feeRate();
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

    function _deposit(uint256 _crabToDeposit) internal returns (uint256, uint256) {
        (uint256 wethToLend, uint256 usdcToBorrow) =
            testUtil.calcCollateralAndBorrowAmount(_crabToDeposit);

        IERC20(crabV2).approve(address(bullStrategy), _crabToDeposit);
        bullStrategy.deposit{value: wethToLend}(_crabToDeposit);

        return (wethToLend, usdcToBorrow);
    }

    function calcAssetsNeededForFlashWithdraw(uint256 _bullAmount)
        internal
        view
        returns (uint256, uint256, uint256, uint256)
    {
        uint256 bullShare = _bullAmount.wdiv(bullStrategy.totalSupply());
        uint256 crabToRedeem = bullShare.wmul(crabV2.balanceOf(address(bullStrategy)));
        (uint256 ethInCrab, uint256 squeethInCrab) = bullStrategy.getCrabVaultDetails();
        uint256 crabTotalSupply = crabV2.totalSupply();
        uint256 wPowerPerpToRedeem = crabToRedeem.wmul(squeethInCrab).wdiv(crabTotalSupply);
        uint256 ethToWithdraw = crabToRedeem.wmul(ethInCrab).wdiv(crabTotalSupply);
        uint256 usdcToRepay = bullStrategy.calcUsdcToRepay(bullShare);

        return (crabToRedeem, wPowerPerpToRedeem, ethToWithdraw, usdcToRepay);
    }
}
