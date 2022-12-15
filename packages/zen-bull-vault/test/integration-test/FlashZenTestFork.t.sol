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
import { SwapRouter } from "v3-periphery/SwapRouter.sol";
import { Quoter } from "v3-periphery/lens/Quoter.sol";
import { TestUtil } from "../util/TestUtil.t.sol";
import { ZenBullStrategy } from "../../src/ZenBullStrategy.sol";
import { CrabStrategyV2 } from "squeeth-monorepo/strategy/CrabStrategyV2.sol";
import { Controller } from "squeeth-monorepo/core/Controller.sol";
import { FlashZen } from "../../src/FlashZen.sol";
// lib
import { VaultLib } from "squeeth-monorepo/libs/VaultLib.sol";
import { StrategyMath } from "squeeth-monorepo/strategy/base/StrategyMath.sol"; // StrategyMath licensed under AGPL-3.0-only
import { UniOracle } from "../../src/UniOracle.sol";
import { console } from "forge-std/console.sol";

/**
 * @notice mainnet fork testing
 */
contract FlashZenTestFork is Test {
    using StrategyMath for uint256;

    uint32 internal constant TWAP = 420;
    uint128 internal constant ONE = 1e18;
    uint256 internal constant WETH_DECIMALS_DIFF = 1e12;

    TestUtil internal testUtil;
    FlashZen internal flashBull;
    ZenBullStrategy internal bullStrategy;
    CrabStrategyV2 internal crabV2;
    Controller internal controller;
    Quoter internal quoter;

    address internal weth;
    address internal usdc;
    address internal euler;
    address internal eulerMarketsModule;
    address internal eToken;
    address internal dToken;
    address internal wPowerPerp;
    address internal ethWSqueethPool;
    address internal ethUsdcPool;
    address internal controllerOwner;
    uint256 internal user1Pk;
    uint256 internal deployerPk;
    uint256 internal cap;
    uint256 internal bullOwnerPk;
    address internal user1;
    address internal deployer;
    address internal bullOwner;

    // var to avoid stack too deep in test functions
    uint256 userEthBalanceBeforeTx;

    function setUp() public {
        string memory FORK_URL = vm.envString("FORK_URL");
        vm.createSelectFork(FORK_URL, 15781550);

        deployerPk = 0xAB11CE;
        deployer = vm.addr(deployerPk);

        vm.startPrank(deployer);

        quoter = Quoter(0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6);

        euler = 0x27182842E098f60e3D576794A5bFFb0777E025d3;
        eulerMarketsModule = 0x3520d5a913427E6F0D6A83E07ccD4A4da316e4d3;
        controller = Controller(0x64187ae08781B09368e6253F9E94951243A493D5);
        crabV2 = CrabStrategyV2(0x3B960E47784150F5a63777201ee2B15253D713e8);

        bullOwnerPk = 0xB11CD;
        bullOwner = vm.addr(bullOwnerPk);

        bullStrategy = new ZenBullStrategy(
            address(crabV2),
            address(controller),
            euler,
            eulerMarketsModule
        );
        bullStrategy.transferOwnership(bullOwner);
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
        controllerOwner = controller.owner();

        vm.stopPrank();

        cap = 100000e18;
        vm.prank(bullOwner);
        bullStrategy.setCap(cap);

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

    function testFlashDeposit() public {
        uint256 ethToCrab = 5e18;
        (uint256 ethInCrab, uint256 squeethInCrab) = testUtil.getCrabVaultDetails();
        (uint256 wSqueethToMint, uint256 fee) =
            _calcWsqueethToMintAndFee(ethToCrab, squeethInCrab, ethInCrab);
        uint256 crabToBeMinted =
            _calcSharesToMint(ethToCrab.sub(fee), ethInCrab, IERC20(crabV2).totalSupply());
        uint256 bullCrabBalanceBefore = IERC20(crabV2).balanceOf(address(bullStrategy));

        (uint256 wethToLend, uint256 usdcToBorrow) = bullStrategy.calcLeverageEthUsdc(
            crabToBeMinted, 1e18, ethInCrab, squeethInCrab, crabV2.totalSupply()
        );

        uint256 totalEthToBull =
            calcTotalEthToBull(wethToLend, ethToCrab, usdcToBorrow, wSqueethToMint);

        uint256 minEthFromSqueeth;
        uint256 minEthFromUsdc;
        {
            uint256 ethUsdPrice = UniOracle._getTwap(ethUsdcPool, weth, usdc, TWAP, false);
            uint256 squeethEthPrice =
                UniOracle._getTwap(ethWSqueethPool, wPowerPerp, weth, TWAP, false);
            minEthFromSqueeth = wSqueethToMint.wmul(squeethEthPrice.wmul(99e16));
            minEthFromUsdc =
                usdcToBorrow.mul(WETH_DECIMALS_DIFF).wdiv(ethUsdPrice.wmul(uint256(1e18).add(5e15)));
        }

        uint256 bullToMint = testUtil.calcBullToMint(crabToBeMinted);

        FlashZen.FlashDepositParams memory params = FlashZen.FlashDepositParams({
            ethToCrab: ethToCrab,
            minEthFromSqth: minEthFromSqueeth,
            minEthFromUsdc: minEthFromUsdc,
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
        assertEq(bullToMint, bullStrategy.balanceOf(user1), "User1 bull balance mismatch");
    }

    function testFlashDepositWithFee() public {
        vm.startPrank(address(controller.owner()));
        controller.setFeeRecipient(address(controller.owner()));
        controller.setFeeRate(100);
        vm.stopPrank();
        assertEq(controller.feeRecipient(), address(controller.owner()));
        assertEq(controller.feeRate(), 100);

        uint256 ethToCrab = 5e18;
        (uint256 ethInCrab, uint256 squeethInCrab) = testUtil.getCrabVaultDetails();
        (uint256 wSqueethToMint, uint256 fee) =
            _calcWsqueethToMintAndFee(ethToCrab, squeethInCrab, ethInCrab);
        uint256 crabToBeMinted =
            _calcSharesToMint(ethToCrab.sub(fee), ethInCrab, IERC20(crabV2).totalSupply());
        uint256 bullCrabBalanceBefore = IERC20(crabV2).balanceOf(address(bullStrategy));

        (uint256 wethToLend, uint256 usdcToBorrow) = bullStrategy.calcLeverageEthUsdc(
            crabToBeMinted, 1e18, ethInCrab, squeethInCrab, crabV2.totalSupply()
        );

        uint256 totalEthToBull =
            calcTotalEthToBull(wethToLend, ethToCrab, usdcToBorrow, wSqueethToMint);

        uint256 minEthFromSqueeth;
        uint256 minEthFromUsdc;
        {
            uint256 ethUsdPrice = UniOracle._getTwap(ethUsdcPool, weth, usdc, TWAP, false);
            uint256 squeethEthPrice =
                UniOracle._getTwap(ethWSqueethPool, wPowerPerp, weth, TWAP, false);
            minEthFromSqueeth = wSqueethToMint.wmul(squeethEthPrice.wmul(99e16));
            minEthFromUsdc = usdcToBorrow.mul(1e12).wdiv(ethUsdPrice.wmul(uint256(1e18).add(5e15)));
        }

        uint256 bullToMint = testUtil.calcBullToMint(crabToBeMinted);

        FlashZen.FlashDepositParams memory params = FlashZen.FlashDepositParams({
            ethToCrab: ethToCrab,
            minEthFromSqth: minEthFromSqueeth,
            minEthFromUsdc: minEthFromUsdc,
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
        assertEq(bullToMint, bullStrategy.balanceOf(user1), "User1 bull balance mismatch");
    }

    function testFlashDepositWithHugeSqthSlippage() public {
        uint256 ethToCrab = 5e18;
        (uint256 ethInCrab, uint256 squeethInCrab) = testUtil.getCrabVaultDetails();
        (uint256 wSqueethToMint, uint256 fee) =
            _calcWsqueethToMintAndFee(ethToCrab, squeethInCrab, ethInCrab);
        uint256 crabToBeMinted =
            _calcSharesToMint(ethToCrab.sub(fee), ethInCrab, IERC20(crabV2).totalSupply());

        (uint256 wethToLend, uint256 usdcToBorrow) = bullStrategy.calcLeverageEthUsdc(
            crabToBeMinted, 1e18, ethInCrab, squeethInCrab, crabV2.totalSupply()
        );

        uint256 totalEthToBull =
            calcTotalEthToBull(wethToLend, ethToCrab, usdcToBorrow, wSqueethToMint);

        uint256 minEthFromSqueeth;
        uint256 minEthFromUsdc;
        {
            uint256 ethUsdPrice = UniOracle._getTwap(ethUsdcPool, weth, usdc, TWAP, false);
            uint256 squeethEthPrice =
                UniOracle._getTwap(ethWSqueethPool, wPowerPerp, weth, TWAP, false);
            minEthFromSqueeth = wSqueethToMint.wmul(squeethEthPrice.wmul(101e16));
            minEthFromUsdc =
                usdcToBorrow.mul(WETH_DECIMALS_DIFF).wdiv(ethUsdPrice.wmul(uint256(1e18).add(5e15)));
        }

        FlashZen.FlashDepositParams memory params = FlashZen.FlashDepositParams({
            ethToCrab: ethToCrab,
            minEthFromSqth: minEthFromSqueeth,
            minEthFromUsdc: minEthFromUsdc,
            wPowerPerpPoolFee: uint24(3000),
            usdcPoolFee: uint24(3000)
        });

        vm.startPrank(user1);
        vm.expectRevert(bytes("amount out less than min"));
        flashBull.flashDeposit{value: totalEthToBull}(params);
        vm.stopPrank();
    }

    function testFlashDepositWithHugeUsdcSlippage() public {
        uint256 ethToCrab = 5e18;
        (uint256 ethInCrab, uint256 squeethInCrab) = testUtil.getCrabVaultDetails();
        (uint256 wSqueethToMint, uint256 fee) =
            _calcWsqueethToMintAndFee(ethToCrab, squeethInCrab, ethInCrab);
        uint256 crabToBeMinted =
            _calcSharesToMint(ethToCrab.sub(fee), ethInCrab, IERC20(crabV2).totalSupply());

        (uint256 wethToLend, uint256 usdcToBorrow) = bullStrategy.calcLeverageEthUsdc(
            crabToBeMinted, 1e18, ethInCrab, squeethInCrab, crabV2.totalSupply()
        );

        uint256 totalEthToBull =
            calcTotalEthToBull(wethToLend, ethToCrab, usdcToBorrow, wSqueethToMint);

        uint256 minEthFromSqueeth;
        uint256 minEthFromUsdc;
        {
            uint256 ethUsdPrice = UniOracle._getTwap(ethUsdcPool, weth, usdc, TWAP, false);
            uint256 squeethEthPrice =
                UniOracle._getTwap(ethWSqueethPool, wPowerPerp, weth, TWAP, false);
            minEthFromSqueeth = wSqueethToMint.wmul(squeethEthPrice.wmul(99e16));
            minEthFromUsdc =
                usdcToBorrow.mul(WETH_DECIMALS_DIFF).wdiv(ethUsdPrice.wmul(uint256(1e18).sub(5e15)));
        }

        FlashZen.FlashDepositParams memory params = FlashZen.FlashDepositParams({
            ethToCrab: ethToCrab,
            minEthFromSqth: minEthFromSqueeth,
            minEthFromUsdc: minEthFromUsdc,
            wPowerPerpPoolFee: uint24(3000),
            usdcPoolFee: uint24(3000)
        });

        vm.startPrank(user1);
        vm.expectRevert(bytes("amount out less than min"));
        flashBull.flashDeposit{value: totalEthToBull}(params);
        vm.stopPrank();
    }

    function testScenarioFlashDepositInsufficientValue() public {
        uint256 ethToCrab = 5e18;
        (uint256 ethInCrab, uint256 squeethInCrab) = testUtil.getCrabVaultDetails();
        (uint256 wSqueethToMint, uint256 fee) =
            _calcWsqueethToMintAndFee(ethToCrab, squeethInCrab, ethInCrab);
        uint256 crabToBeMinted =
            _calcSharesToMint(ethToCrab.sub(fee), ethInCrab, IERC20(crabV2).totalSupply());

        (uint256 wethToLend, uint256 usdcToBorrow) = bullStrategy.calcLeverageEthUsdc(
            crabToBeMinted, 1e18, ethInCrab, squeethInCrab, crabV2.totalSupply()
        );

        uint256 totalEthToBull =
            calcTotalEthToBull(wethToLend, ethToCrab, usdcToBorrow, wSqueethToMint);

        uint256 minEthFromSqueeth;
        uint256 minEthFromUsdc;
        {
            uint256 ethUsdPrice = UniOracle._getTwap(ethUsdcPool, weth, usdc, TWAP, false);
            uint256 squeethEthPrice =
                UniOracle._getTwap(ethWSqueethPool, wPowerPerp, weth, TWAP, false);
            minEthFromSqueeth = wSqueethToMint.wmul(squeethEthPrice.wmul(99e16));
            minEthFromUsdc =
                usdcToBorrow.mul(WETH_DECIMALS_DIFF).wdiv(ethUsdPrice.wmul(uint256(1e18).add(5e15)));
        }

        FlashZen.FlashDepositParams memory params = FlashZen.FlashDepositParams({
            ethToCrab: ethToCrab,
            minEthFromSqth: minEthFromSqueeth,
            minEthFromUsdc: minEthFromUsdc,
            wPowerPerpPoolFee: uint24(3000),
            usdcPoolFee: uint24(3000)
        });

        vm.startPrank(user1);
        vm.expectRevert();
        flashBull.flashDeposit{value: totalEthToBull.sub(5e18)}(params);
        vm.stopPrank();
    }

    function testSecondFlashDeposit() public {
        uint256 ethToCrabInitial = 5e18;
        (uint256 ethInCrab, uint256 squeethInCrab) = testUtil.getCrabVaultDetails();
        (uint256 wSqueethToMint, uint256 fee) =
            _calcWsqueethToMintAndFee(ethToCrabInitial, squeethInCrab, ethInCrab);
        uint256 crabToBeMinted =
            _calcSharesToMint(ethToCrabInitial.sub(fee), ethInCrab, IERC20(crabV2).totalSupply());
        uint256 bullCrabBalanceBefore = IERC20(crabV2).balanceOf(address(bullStrategy));

        uint256 bullToMint = testUtil.calcBullToMint(crabToBeMinted);
        (uint256 wethToLend, uint256 usdcToBorrow) = bullStrategy.calcLeverageEthUsdc(
            crabToBeMinted, 1e18, ethInCrab, squeethInCrab, crabV2.totalSupply()
        );

        uint256 totalEthToBull =
            calcTotalEthToBull(wethToLend, ethToCrabInitial, usdcToBorrow, wSqueethToMint);

        uint256 minEthFromSqueeth;
        uint256 minEthFromUsdc;
        {
            uint256 ethUsdPrice = UniOracle._getTwap(ethUsdcPool, weth, usdc, TWAP, false);
            uint256 squeethEthPrice =
                UniOracle._getTwap(ethWSqueethPool, wPowerPerp, weth, TWAP, false);
            minEthFromSqueeth = wSqueethToMint.wmul(squeethEthPrice.wmul(99e16));
            minEthFromUsdc =
                usdcToBorrow.mul(WETH_DECIMALS_DIFF).wdiv(ethUsdPrice.wmul(uint256(1e18).add(5e15)));
        }

        FlashZen.FlashDepositParams memory firstParams = FlashZen.FlashDepositParams({
            ethToCrab: ethToCrabInitial,
            minEthFromSqth: minEthFromSqueeth,
            minEthFromUsdc: minEthFromUsdc,
            wPowerPerpPoolFee: uint24(3000),
            usdcPoolFee: uint24(3000)
        });

        vm.startPrank(user1);
        flashBull.flashDeposit{value: totalEthToBull}(firstParams);
        vm.stopPrank();
        assertEq(IEulerDToken(dToken).balanceOf(address(bullStrategy)), usdcToBorrow);
        assertApproxEqAbs(
            IEulerEToken(eToken).balanceOfUnderlying(address(bullStrategy)), wethToLend, 1
        );
        assertEq(bullStrategy.getCrabBalance().sub(crabToBeMinted), bullCrabBalanceBefore);
        assertEq(bullToMint, bullStrategy.balanceOf(user1), "User1 bull balance mismatch");
        uint256 userBullBalanceBefore = bullStrategy.balanceOf(user1);

        uint256 bullCrabBalanceBeforeSecond = IERC20(crabV2).balanceOf(address(bullStrategy));
        uint256 bullUsdcDebtBefore = IEulerDToken(dToken).balanceOf(address(bullStrategy));
        (uint256 ethInCrabSecond, uint256 squeethInCrabSecond) = testUtil.getCrabVaultDetails();
        uint256 ethToCrabSecond = 7e18;
        (uint256 wSqueethToMintSecond, uint256 feeSecond) =
            _calcWsqueethToMintAndFee(ethToCrabSecond, squeethInCrabSecond, ethInCrabSecond);
        uint256 wethToLendFirst = wethToLend;
        uint256 crabToBeMintedSecond = _calcSharesToMint(
            ethToCrabSecond.sub(feeSecond), ethInCrabSecond, IERC20(crabV2).totalSupply()
        );

        uint256 bullToMintSecond = testUtil.calcBullToMint(crabToBeMintedSecond);
        (uint256 wethToLendSecond, uint256 usdcToBorrowSecond) = bullStrategy.calcLeverageEthUsdc(
            crabToBeMintedSecond,
            bullToMintSecond.wdiv(bullStrategy.totalSupply().add(bullToMintSecond)),
            ethInCrabSecond,
            squeethInCrabSecond,
            crabV2.totalSupply()
        );

        {
            uint256 ethUsdPrice = UniOracle._getTwap(ethUsdcPool, weth, usdc, TWAP, false);
            uint256 squeethEthPrice =
                UniOracle._getTwap(ethWSqueethPool, wPowerPerp, weth, TWAP, false);

            FlashZen.FlashDepositParams memory params = FlashZen.FlashDepositParams({
                ethToCrab: ethToCrabSecond,
                minEthFromSqth: wSqueethToMintSecond.wmul(squeethEthPrice.wmul(99e16)),
                minEthFromUsdc: usdcToBorrowSecond.mul(WETH_DECIMALS_DIFF).wdiv(
                    ethUsdPrice.wmul(uint256(1e18).add(5e15))
                    ),
                wPowerPerpPoolFee: uint24(3000),
                usdcPoolFee: uint24(3000)
            });

            vm.startPrank(user1);
            flashBull.flashDeposit{
                value: calcTotalEthToBull(
                    wethToLendSecond, ethToCrabSecond, usdcToBorrowSecond, wSqueethToMintSecond
                    )
            }(params);
            vm.stopPrank();
        }

        assertEq(
            userBullBalanceBefore.add(bullToMintSecond),
            bullStrategy.balanceOf(user1),
            "Bull balance mismatch for second flashdeposit"
        );
        assertEq(
            IEulerDToken(dToken).balanceOf(address(bullStrategy)).sub(bullUsdcDebtBefore),
            usdcToBorrowSecond,
            "Bull USDC debt amount mismatch for second flashdeposit"
        );
        assertApproxEqAbs(
            IEulerEToken(eToken).balanceOfUnderlying(address(bullStrategy)).sub(wethToLendFirst),
            wethToLendSecond,
            1
        );
        assertEq(
            bullStrategy.getCrabBalance().sub(crabToBeMintedSecond),
            bullCrabBalanceBeforeSecond,
            "Bull crab balance mismatch for second flashdeposit"
        );
    }

    function testFlashWithdraw() public {
        // this is a crab whale, get some crab token from
        vm.prank(0x06CECFbac34101aE41C88EbC2450f8602b3d164b);
        IERC20(crabV2).transfer(user1, 10e18);
        vm.startPrank(user1);
        _deposit(10e18);
        vm.stopPrank();

        uint256 bullToRedeem = bullStrategy.balanceOf(user1);
        (
            uint256 crabToRedeem,
            uint256 wPowerPerpToRedeem,
            uint256 ethToWithdrawFromCrab,
            uint256 usdcToRepay
        ) = calcAssetsNeededForFlashWithdraw(bullToRedeem);
        uint256 maxEthForWPowerPerp;
        uint256 maxEthForUsdc;
        {
            uint256 ethUsdPrice = UniOracle._getTwap(ethUsdcPool, weth, usdc, TWAP, false);
            uint256 squeethEthPrice =
                UniOracle._getTwap(ethWSqueethPool, wPowerPerp, weth, TWAP, false);
            maxEthForWPowerPerp = wPowerPerpToRedeem.wmul(squeethEthPrice.wmul(101e16));
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
        uint256 ethToWithdrawFromBull =
            ethToWithdrawFromCrab.sub(maxEthForWPowerPerp).add(wethToWithdraw.sub(maxEthForUsdc));
        userEthBalanceBeforeTx = user1.balance;

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
            bullStrategy.getCrabBalance(),
            "Bull crab balance mismatch"
        );
        assertTrue((user1.balance).sub(userEthBalanceBeforeTx).sub(ethToWithdrawFromBull) <= 1e17);
    }

    function testScenarioFlashWithdrawInsufficientBull() public {
        // this is a crab whale, get some crab token from
        vm.prank(0x06CECFbac34101aE41C88EbC2450f8602b3d164b);
        IERC20(crabV2).transfer(user1, 10e18);
        vm.startPrank(user1);
        _deposit(2e18);
        vm.stopPrank();

        uint256 bullToRedeem = 10e18;
        (, uint256 wPowerPerpToRedeem,, uint256 usdcToRepay) =
            calcAssetsNeededForFlashWithdraw(bullToRedeem);
        uint256 maxEthForWPowerPerp;
        uint256 maxEthForUsdc;
        {
            uint256 ethUsdPrice = UniOracle._getTwap(ethUsdcPool, weth, usdc, TWAP, false);
            uint256 squeethEthPrice =
                UniOracle._getTwap(ethWSqueethPool, wPowerPerp, weth, TWAP, false);
            maxEthForWPowerPerp = wPowerPerpToRedeem.wmul(squeethEthPrice.wmul(101e16));
            maxEthForUsdc =
                usdcToRepay.mul(WETH_DECIMALS_DIFF).wdiv(ethUsdPrice.wmul(uint256(1e18).sub(5e15)));
        }

        FlashZen.FlashWithdrawParams memory params = FlashZen.FlashWithdrawParams({
            bullAmount: bullToRedeem,
            maxEthForWPowerPerp: maxEthForWPowerPerp,
            maxEthForUsdc: maxEthForUsdc,
            wPowerPerpPoolFee: uint24(3000),
            usdcPoolFee: uint24(3000)
        });

        vm.startPrank(user1);
        bullStrategy.approve(address(flashBull), params.bullAmount);
        vm.expectRevert(bytes("ERC20: transfer amount exceeds balance"));
        flashBull.flashWithdraw(params);
        vm.stopPrank();
    }

    function testScenarioFlashWithdrawUsdcSlippage() public {
        // this is a crab whale, get some crab token from
        vm.prank(0x06CECFbac34101aE41C88EbC2450f8602b3d164b);
        IERC20(crabV2).transfer(user1, 10e18);
        vm.startPrank(user1);
        _deposit(10e18);
        vm.stopPrank();

        uint256 bullToRedeem = bullStrategy.balanceOf(user1);
        (, uint256 wPowerPerpToRedeem,, uint256 usdcToRepay) =
            calcAssetsNeededForFlashWithdraw(bullToRedeem);
        uint256 maxEthForWPowerPerp;
        uint256 maxEthForUsdc;
        {
            uint256 ethUsdPrice = UniOracle._getTwap(ethUsdcPool, weth, usdc, TWAP, false);
            uint256 squeethEthPrice =
                UniOracle._getTwap(ethWSqueethPool, wPowerPerp, weth, TWAP, false);
            maxEthForWPowerPerp = wPowerPerpToRedeem.wmul(squeethEthPrice.wmul(101e16));
            maxEthForUsdc =
                usdcToRepay.mul(WETH_DECIMALS_DIFF).wdiv(ethUsdPrice.wmul(uint256(1e18).add(5e15)));
        }

        FlashZen.FlashWithdrawParams memory params = FlashZen.FlashWithdrawParams({
            bullAmount: bullToRedeem,
            maxEthForWPowerPerp: maxEthForWPowerPerp,
            maxEthForUsdc: maxEthForUsdc,
            wPowerPerpPoolFee: uint24(3000),
            usdcPoolFee: uint24(3000)
        });

        vm.startPrank(user1);
        bullStrategy.approve(address(flashBull), params.bullAmount);
        vm.expectRevert(bytes("amount in greater than max"));
        flashBull.flashWithdraw(params);
        vm.stopPrank();
    }

    function testScenarioFlashWithdrawSqthSlippage() public {
        // this is a crab whale, get some crab token from
        vm.prank(0x06CECFbac34101aE41C88EbC2450f8602b3d164b);
        IERC20(crabV2).transfer(user1, 10e18);
        vm.startPrank(user1);
        _deposit(10e18);
        vm.stopPrank();

        uint256 bullToRedeem = bullStrategy.balanceOf(user1);
        (, uint256 wPowerPerpToRedeem,, uint256 usdcToRepay) =
            calcAssetsNeededForFlashWithdraw(bullToRedeem);
        uint256 maxEthForWPowerPerp;
        uint256 maxEthForUsdc;
        {
            uint256 ethUsdPrice = UniOracle._getTwap(ethUsdcPool, weth, usdc, TWAP, false);
            uint256 squeethEthPrice =
                UniOracle._getTwap(ethWSqueethPool, wPowerPerp, weth, TWAP, false);
            maxEthForWPowerPerp = wPowerPerpToRedeem.wmul(squeethEthPrice.wmul(99e16));
            maxEthForUsdc =
                usdcToRepay.mul(WETH_DECIMALS_DIFF).wdiv(ethUsdPrice.wmul(uint256(1e18).sub(5e15)));
        }

        FlashZen.FlashWithdrawParams memory params = FlashZen.FlashWithdrawParams({
            bullAmount: bullToRedeem,
            maxEthForWPowerPerp: maxEthForWPowerPerp,
            maxEthForUsdc: maxEthForUsdc,
            wPowerPerpPoolFee: uint24(3000),
            usdcPoolFee: uint24(3000)
        });

        vm.startPrank(user1);
        bullStrategy.approve(address(flashBull), params.bullAmount);
        vm.expectRevert(bytes("amount in greater than max"));
        flashBull.flashWithdraw(params);
        vm.stopPrank();
    }

    function testSecondFlashWithdraw() public {
        // this is a crab whale, get some crab token from
        vm.prank(0x06CECFbac34101aE41C88EbC2450f8602b3d164b);
        IERC20(crabV2).transfer(user1, 20e18);
        vm.startPrank(user1);
        _deposit(10e18);
        vm.stopPrank();

        uint256 bullToRedeem = 5e18;
        (uint256 crabToRedeem, uint256 wPowerPerpToRedeem,, uint256 usdcToRepay) =
            calcAssetsNeededForFlashWithdraw(bullToRedeem);
        uint256 maxEthForWPowerPerp;
        uint256 maxEthForUsdc;
        {
            uint256 ethUsdPrice = UniOracle._getTwap(ethUsdcPool, weth, usdc, TWAP, false);
            uint256 squeethEthPrice =
                UniOracle._getTwap(ethWSqueethPool, wPowerPerp, weth, TWAP, false);
            maxEthForWPowerPerp = wPowerPerpToRedeem.wmul(squeethEthPrice.wmul(101e16));
            maxEthForUsdc =
                usdcToRepay.mul(WETH_DECIMALS_DIFF).wdiv(ethUsdPrice.wmul(uint256(1e18).sub(5e15)));
        }

        FlashZen.FlashWithdrawParams memory params = FlashZen.FlashWithdrawParams({
            bullAmount: bullToRedeem,
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
        userEthBalanceBeforeTx = user1.balance;

        vm.startPrank(user1);
        bullStrategy.approve(address(flashBull), params.bullAmount);
        flashBull.flashWithdraw(params);
        vm.stopPrank();

        assertEq(
            usdcBorrowedBefore.sub(usdcToRepay),
            IEulerDToken(dToken).balanceOf(address(bullStrategy)),
            "Bull USDC debt amount mismatch"
        );
        assertApproxEqAbs(
            ethInLendingBefore.sub(wethToWithdraw),
            IEulerEToken(eToken).balanceOfUnderlying(address(bullStrategy)),
            1
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

        // Second withdrawal

        uint256 bullToRedeemSecond = bullStrategy.balanceOf(user1);
        (uint256 crabToRedeemSecond, uint256 wPowerPerpToRedeemSecond,, uint256 usdcToRepaySecond) =
            calcAssetsNeededForFlashWithdraw(bullToRedeemSecond);
        uint256 maxEthForWPowerPerpSecond;
        uint256 maxEthForUsdcSecond;
        {
            uint256 ethUsdPrice = UniOracle._getTwap(ethUsdcPool, weth, usdc, TWAP, false);
            uint256 squeethEthPrice =
                UniOracle._getTwap(ethWSqueethPool, wPowerPerp, weth, TWAP, false);
            maxEthForWPowerPerpSecond = wPowerPerpToRedeemSecond.wmul(squeethEthPrice.wmul(101e16));
            maxEthForUsdcSecond = usdcToRepaySecond.mul(WETH_DECIMALS_DIFF).wdiv(
                ethUsdPrice.wmul(uint256(1e18).sub(5e15))
            );
        }

        FlashZen.FlashWithdrawParams memory paramsSecond = FlashZen.FlashWithdrawParams({
            bullAmount: bullToRedeemSecond,
            maxEthForWPowerPerp: maxEthForWPowerPerpSecond,
            maxEthForUsdc: maxEthForUsdcSecond,
            wPowerPerpPoolFee: uint24(3000),
            usdcPoolFee: uint24(3000)
        });

        uint256 wethToWithdrawSecond = testUtil.calcWethToWithdraw(bullToRedeemSecond);
        uint256 userBullBalanceBeforeSecond = bullStrategy.balanceOf(user1);
        uint256 ethInLendingBeforeSecond =
            IEulerEToken(eToken).balanceOfUnderlying(address(bullStrategy));
        uint256 usdcBorrowedBeforeSecond = IEulerDToken(dToken).balanceOf(address(bullStrategy));
        uint256 crabBalanceBeforeSecond = crabV2.balanceOf(address(bullStrategy));
        userEthBalanceBeforeTx = user1.balance;

        vm.startPrank(user1);
        bullStrategy.approve(address(flashBull), paramsSecond.bullAmount);
        flashBull.flashWithdraw(paramsSecond);
        vm.stopPrank();

        assertEq(
            usdcBorrowedBeforeSecond.sub(usdcToRepaySecond),
            IEulerDToken(dToken).balanceOf(address(bullStrategy)),
            "Bull USDC debt amount mismatch"
        );
        assertApproxEqAbs(
            ethInLendingBeforeSecond.sub(wethToWithdrawSecond),
            IEulerEToken(eToken).balanceOfUnderlying(address(bullStrategy)),
            1
        );
        assertEq(
            userBullBalanceBeforeSecond.sub(bullToRedeemSecond),
            bullStrategy.balanceOf(user1),
            "User1 bull balance mismatch"
        );
        assertEq(
            crabBalanceBeforeSecond.sub(crabToRedeemSecond),
            crabV2.balanceOf(address(bullStrategy)),
            "Bull crab balance mismatch"
        );
    }

    /**
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
    ) internal returns (uint256) {
        uint256 minEthFromSqueeth =
            quoter.quoteExactInputSingle(wPowerPerp, weth, 3000, wSqueethToMint, 0);
        uint256 minEthFromUsdc = quoter.quoteExactInputSingle(usdc, weth, 3000, usdcToBorrow, 0);

        uint256 totalEthToBull =
            wethToLend.add(ethToCrab).sub(minEthFromSqueeth).sub(minEthFromUsdc).add(10e16);
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
