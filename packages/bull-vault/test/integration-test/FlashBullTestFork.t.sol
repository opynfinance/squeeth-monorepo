pragma solidity =0.7.6;

pragma abicoder v2;

// test dependency
import "forge-std/Test.sol";
//interface
import {IERC20} from "openzeppelin/token/ERC20/IERC20.sol";
import {IController} from "squeeth-monorepo/interfaces/IController.sol";
import {IEulerMarkets} from "../../src/interface/IEulerMarkets.sol";
import {IEulerEToken} from "../../src/interface/IEulerEToken.sol";
import {IEulerDToken} from "../../src/interface/IEulerDToken.sol";
// contract
import {BullStrategy} from "../../src/BullStrategy.sol";
import {CrabStrategyV2} from "squeeth-monorepo/strategy/CrabStrategyV2.sol";
import {Controller} from "squeeth-monorepo/core/Controller.sol";
import {FlashBull} from "../../src/FlashBull.sol";
// lib
import {VaultLib} from "squeeth-monorepo/libs/VaultLib.sol";
import {StrategyMath} from "squeeth-monorepo/strategy/base/StrategyMath.sol"; // StrategyMath licensed under AGPL-3.0-only
import {UniOracle} from "../../src/UniOracle.sol";

/**
 * @notice Ropsten fork testing
 */
contract FlashBullTestFork is Test {
    using StrategyMath for uint256;

    uint32 internal constant TWAP = 420;
    uint128 internal constant ONE = 1e18;

    FlashBull internal flashBull;
    BullStrategy internal bullStrategy;
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

    uint256 internal ownerPk;
    uint256 internal user1Pk;
    uint256 internal deployerPk;
    address internal user1;
    address internal deployer;
    address internal owner;

    uint256 internal cap;

    // var to avoid stack too deep in test functions
    uint256 userEthBalanceBeforeTx;
    uint256 bullToMint;

    function setUp() public {
        string memory FORK_URL = vm.envString("FORK_URL");
        vm.createSelectFork(FORK_URL, 15781550);

        deployerPk = 0xAB11CE;
        deployer = vm.addr(deployerPk);

        ownerPk = 0xA1CCE;
        owner = vm.addr(ownerPk);

        vm.startPrank(deployer);
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
        flashBull = new FlashBull(
            address(bullStrategy),
            0x1F98431c8aD98523631AE4a59f267346ea31F984
        );
        vm.stopPrank();
        usdc = controller.quoteCurrency();
        weth = controller.weth();
        eToken = IEulerMarkets(eulerMarketsModule).underlyingToEToken(weth);
        dToken = IEulerMarkets(eulerMarketsModule).underlyingToDToken(usdc);
        wPowerPerp = controller.wPowerPerp();
        ethWSqueethPool = IController(bullStrategy.powerTokenController())
            .wPowerPerpPool();
        ethUsdcPool = IController(bullStrategy.powerTokenController())
            .ethQuoteCurrencyPool();

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

    function testInitialFlashDeposit() public {
        uint256 ethToCrab = 5e18;
        (uint256 ethInCrab, uint256 squeethInCrab) = _getCrabVaultDetails();
        (uint256 wSqueethToMint, uint256 fee) = _calcWsqueethToMintAndFee(
            ethToCrab,
            squeethInCrab,
            ethInCrab
        );
        uint256 crabToBeMinted = _calcSharesToMint(
            ethToCrab.sub(fee),
            ethInCrab,
            IERC20(crabV2).totalSupply()
        );
        uint256 bullCrabBalanceBefore = IERC20(crabV2).balanceOf(
            address(bullStrategy)
        );

        uint256 bullShare = 1e18;
        (uint256 wethToLend, uint256 usdcToBorrow) = bullStrategy
            .calcLeverageEthUsdc(
                crabToBeMinted,
                bullShare,
                ethInCrab,
                squeethInCrab,
                crabV2.totalSupply()
            );

        uint256 totalEthToBull = calcTotalEthToBull(
            wethToLend,
            ethToCrab,
            usdcToBorrow,
            wSqueethToMint
        );

        FlashBull.FlashDepositParams memory params = FlashBull.FlashDepositParams({
            ethToCrab: ethToCrabInitial,
            minEthFromSqth: minEthFromSqueeth,
            minEthFromUsdc: minEthFromUsdc,
            wPowerPerpPoolFee: uint24(3000),
            usdcPoolFee: uint24(3000)
        });

        vm.startPrank(user1);
        flashBull.flashDeposit{value: totalEthToBull}(ethToCrab, 0, 0, 3000);
        vm.stopPrank();

        assertEq(
            IEulerDToken(dToken).balanceOf(address(bullStrategy)),
            usdcToBorrow
        );
        assertApproxEqAbs(
            IEulerEToken(eToken).balanceOfUnderlying(address(bullStrategy)),
            wethToLend,
            1
        );
        assertEq(
            bullStrategy.getCrabBalance().sub(crabToBeMinted),
            bullCrabBalanceBefore
        );
    }

    function testSecondFlashDeposit() public {
        uint256 ethToCrabInitial = 5e18;
        (uint256 ethInCrab, uint256 squeethInCrab) = _getCrabVaultDetails();
        (uint256 wSqueethToMint, uint256 fee) = _calcWsqueethToMintAndFee(
            ethToCrabInitial,
            squeethInCrab,
            ethInCrab
        );
        uint256 crabToBeMinted = _calcSharesToMint(
            ethToCrabInitial.sub(fee),
            ethInCrab,
            IERC20(crabV2).totalSupply()
        );
        uint256 bullCrabBalanceBefore = IERC20(crabV2).balanceOf(
            address(bullStrategy)
        );

        uint256 bullShare = 1e18;
        (uint256 wethToLend, uint256 usdcToBorrow) = bullStrategy
            .calcLeverageEthUsdc(
                crabToBeMinted,
                bullShare,
                ethInCrab,
                squeethInCrab,
                crabV2.totalSupply()
            );

        uint256 totalEthToBull = calcTotalEthToBull(
            wethToLend,
            ethToCrabInitial,
            usdcToBorrow,
            wSqueethToMint
        );

        vm.startPrank(user1);
        flashBull.flashDeposit{value: totalEthToBull}(
            ethToCrabInitial,
            0,
            0,
            3000
        );
        vm.stopPrank();
        assertEq(
            IEulerDToken(dToken).balanceOf(address(bullStrategy)),
            usdcToBorrow
        );
        assertApproxEqAbs(
            IEulerEToken(eToken).balanceOfUnderlying(address(bullStrategy)),
            wethToLend,
            1
        );
        assertEq(
            bullStrategy.getCrabBalance().sub(crabToBeMinted),
            bullCrabBalanceBefore
        );

        uint256 bullUsdcDebtBefore = IEulerDToken(dToken).balanceOf(
            address(bullStrategy)
        );
        uint256 userBullBalanceBefore = bullStrategy.balanceOf(user1);
        bullCrabBalanceBefore = bullStrategy.getCrabBalance();

        uint256 ethToCrabSecond = 7e18;
        (
            uint256 ethInCrabSecond,
            uint256 squeethInCrabSecond
        ) = _getCrabVaultDetails();
        (
            uint256 wSqueethToMintSecond,
            uint256 feeSecond
        ) = _calcWsqueethToMintAndFee(
                ethToCrabSecond,
                squeethInCrabSecond,
                ethInCrabSecond
            );
        uint256 crabToBeMintedSecond = _calcSharesToMint(
            ethToCrabSecond.sub(feeSecond),
            ethInCrabSecond,
            IERC20(crabV2).totalSupply()
        );
        uint256 bullCrabBalanceBeforeSecond = IERC20(crabV2).balanceOf(
            address(bullStrategy)
        );

        uint256 bullToMint = _calcBullToMint(crabToBeMintedSecond);
        uint256 bullShareSecond = bullToMint.wdiv(
            bullStrategy.totalSupply().add(bullToMint)
        );
        uint256 wethToLendFirst = wethToLend;
        (uint256 wethToLendSecond, uint256 usdcToBorrowSecond) = bullStrategy
            .calcLeverageEthUsdc(
                crabToBeMintedSecond,
                bullShareSecond,
                ethInCrabSecond,
                squeethInCrabSecond,
                crabV2.totalSupply()
            );

        vm.startPrank(user1);
        flashBull.flashDeposit{
            value: calcTotalEthToBull(
                wethToLendSecond,
                ethToCrabSecond,
                usdcToBorrowSecond,
                wSqueethToMintSecond
            )
        }(ethToCrabSecond, 0, 0, 3000);
        vm.stopPrank();

        assertEq(
            IEulerDToken(dToken).balanceOf(address(bullStrategy)).sub(
                bullUsdcDebtBefore
            ),
            usdcToBorrowSecond,
            "Bull USDC debt amount mismatch for second flashdeposit"
        );
        assertApproxEqAbs(
            IEulerEToken(eToken).balanceOfUnderlying(address(bullStrategy)).sub(
                wethToLendFirst
            ),
            wethToLendSecond,
            1
        );
        assertEq(
            bullStrategy.getCrabBalance().sub(crabToBeMintedSecond),
            bullCrabBalanceBeforeSecond,
            "Bull crab balance mismatch for second flashdeposit"
        );
    }

    function testSecondFlashDeposit() public {
        uint256 ethToCrabInitial = 5e18;
        (uint256 ethInCrab, uint256 squeethInCrab) = _getCrabVaultDetails();
        (uint256 wSqueethToMint, uint256 fee) = _calcWsqueethToMintAndFee(
            ethToCrabInitial,
            squeethInCrab,
            ethInCrab
        );
        uint256 crabToBeMinted = _calcSharesToMint(
            ethToCrabInitial.sub(fee),
            ethInCrab,
            IERC20(crabV2).totalSupply()
        );
        uint256 bullCrabBalanceBefore = IERC20(crabV2).balanceOf(
            address(bullStrategy)
        );

        uint256 bullShare = 1e18;
        (uint256 wethToLend, uint256 usdcToBorrow) = bullStrategy
            .calcLeverageEthUsdc(
                crabToBeMinted,
                bullShare,
                ethInCrab,
                squeethInCrab,
                crabV2.totalSupply()
            );

        uint256 totalEthToBull = calcTotalEthToBull(
            wethToLend,
            ethToCrabInitial,
            usdcToBorrow,
            wSqueethToMint
        );

        vm.startPrank(user1);
        flashBull.flashDeposit{value: totalEthToBull}(
            ethToCrabInitial,
            0,
            0,
            3000
        );
        vm.stopPrank();
        assertEq(
            IEulerDToken(dToken).balanceOf(address(bullStrategy)),
            usdcToBorrow
        );
        assertEq(
            IEulerEToken(eToken).balanceOfUnderlying(address(bullStrategy)),
            wethToLend
        );
        assertEq(
            bullStrategy.getCrabBalance().sub(crabToBeMinted),
            bullCrabBalanceBefore
        );

        uint256 bullUsdcDebtBefore = IEulerDToken(dToken).balanceOf(
            address(bullStrategy)
        );
        uint256 userBullBalanceBefore = bullStrategy.balanceOf(user1);
        bullCrabBalanceBefore = bullStrategy.getCrabBalance();

        uint256 ethToCrabSecond = 7e18;
        (
            uint256 ethInCrabSecond,
            uint256 squeethInCrabSecond
        ) = _getCrabVaultDetails();
        (
            uint256 wSqueethToMintSecond,
            uint256 feeSecond
        ) = _calcWsqueethToMintAndFee(
                ethToCrabSecond,
                squeethInCrabSecond,
                ethInCrabSecond
            );
        uint256 crabToBeMintedSecond = _calcSharesToMint(
            ethToCrabSecond.sub(feeSecond),
            ethInCrabSecond,
            IERC20(crabV2).totalSupply()
        );
        uint256 bullCrabBalanceBeforeSecond = IERC20(crabV2).balanceOf(
            address(bullStrategy)
        );

        uint256 bullToMint = _calcBullToMint(crabToBeMintedSecond);
        uint256 bullShareSecond = bullToMint.wdiv(
            bullStrategy.totalSupply().add(bullToMint)
        );
        uint256 wethToLendFirst = wethToLend;
        (uint256 wethToLendSecond, uint256 usdcToBorrowSecond) = bullStrategy
            .calcLeverageEthUsdc(
                crabToBeMintedSecond,
                bullShareSecond,
                ethInCrabSecond,
                squeethInCrabSecond,
                crabV2.totalSupply()
            );

        vm.startPrank(user1);
        flashBull.flashDeposit{
            value: calcTotalEthToBull(
                wethToLendSecond,
                ethToCrabSecond,
                usdcToBorrowSecond,
                wSqueethToMintSecond
            )
        }(ethToCrabSecond, 0, 0, 3000);
        vm.stopPrank();

        assertEq(
            IEulerDToken(dToken).balanceOf(address(bullStrategy)).sub(
                bullUsdcDebtBefore
            ),
            usdcToBorrowSecond,
            "Bull USDC debt amount mismatch for second flashdeposit"
        );
        assertTrue(
            wethToLendSecond.sub(
                IEulerEToken(eToken)
                    .balanceOfUnderlying(address(bullStrategy))
                    .sub(wethToLendFirst)
            ) <= 1
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
        uint256 maxEthForSqueeth;
        uint256 maxEthForUsdc;
        {
            uint256 ethUsdPrice = UniOracle._getTwap(
                ethUsdcPool,
                weth,
                usdc,
                TWAP,
                false
            );
            uint256 squeethEthPrice = UniOracle._getTwap(
                ethWSqueethPool,
                wPowerPerp,
                weth,
                TWAP,
                false
            );
            maxEthForSqueeth = wPowerPerpToRedeem.wmul(
                squeethEthPrice.wmul(101e16)
            );
            maxEthForUsdc = usdcToRepay.mul(1e12).wdiv(
                ethUsdPrice.wmul(uint256(1e18).sub(5e15))
            );
        }

        FlashBull.FlashWithdrawParams memory params = FlashBull
            .FlashWithdrawParams({
                bullAmount: bullStrategy.balanceOf(user1),
                maxEthForSqueeth: maxEthForSqueeth,
                maxEthForUsdc: maxEthForUsdc,
                wPowerPerpPoolFee: uint24(3000),
                usdcPoolFee: uint24(3000)
            });

        uint256 wethToWithdraw = _calcWethToWithdraw(bullToRedeem);
        uint256 userBullBalanceBefore = bullStrategy.balanceOf(user1);
        uint256 ethInLendingBefore = IEulerEToken(eToken).balanceOfUnderlying(
            address(bullStrategy)
        );
        uint256 usdcBorrowedBefore = IEulerDToken(dToken).balanceOf(
            address(bullStrategy)
        );
        uint256 crabBalanceBefore = crabV2.balanceOf(address(bullStrategy));
        uint256 ethToWithdrawFromBull = ethToWithdrawFromCrab
            .sub(maxEthForSqueeth)
            .add(wethToWithdraw.sub(maxEthForUsdc));
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
            crabV2.balanceOf(address(bullStrategy)),
            "Bull crab balance mismatch"
        );
        assertTrue(
            (user1.balance).sub(userEthBalanceBeforeTx).sub(
                ethToWithdrawFromBull
            ) <= 1e17
        );
    }

    /**
     *
     * /************************************************************* Fuzz testing is awesome! ************************************************************
     */
    function testFuzzingFlashDeposit(uint256 _ethToCrab) public {
        _ethToCrab = bound(_ethToCrab, 1e16, 1890e18); // 1890 ETH because can't hit Crab cap
        (uint256 ethInCrab, uint256 squeethInCrab) = _getCrabVaultDetails();

        (uint256 wSqueethToMint, uint256 fee) = _calcWsqueethToMintAndFee(
            _ethToCrab,
            squeethInCrab,
            ethInCrab
        );
        uint256 crabToBeMinted = _calcSharesToMint(
            _ethToCrab.sub(fee),
            ethInCrab,
            IERC20(crabV2).totalSupply()
        );
        uint256 bullCrabBalanceBefore = IERC20(crabV2).balanceOf(
            address(bullStrategy)
        );

        {
            ethInCrab += _ethToCrab;
            squeethInCrab += wSqueethToMint;
        }

        uint256 bullShare = 1e18;
        (uint256 wethToLend, uint256 usdcToBorrow) = bullStrategy
            .calcLeverageEthUsdc(
                crabToBeMinted,
                bullShare,
                ethInCrab,
                squeethInCrab,
                crabV2.totalSupply().add(crabToBeMinted)
            );

        vm.startPrank(user1);
        flashBull.flashDeposit{
            value: calcTotalEthToBull(
                wethToLend,
                _ethToCrab,
                usdcToBorrow,
                wSqueethToMint
            )
        }(_ethToCrab, 0, 0, 3000);
        vm.stopPrank();

        assertEq(
            IEulerDToken(dToken).balanceOf(address(bullStrategy)),
            usdcToBorrow,
            "Bull USDC debt amount mismatch"
        );
        assertApproxEqAbs(
            IEulerEToken(eToken).balanceOfUnderlying(address(bullStrategy)),
            wethToLend,
            5
        );
        assertEq(
            bullStrategy.getCrabBalance().sub(crabToBeMinted),
            bullCrabBalanceBefore,
            "Bull crab balance mismatch"
        );
    }

    function testFuzzingFlashWithdraw(uint256 _crabAmount) public {
        _crabAmount = bound(
            _crabAmount,
            1e18,
            IERC20(crabV2).balanceOf(0x06CECFbac34101aE41C88EbC2450f8602b3d164b)
        );
        // this is a crab whale, get some crab token from
        vm.prank(0x06CECFbac34101aE41C88EbC2450f8602b3d164b);
        IERC20(crabV2).transfer(user1, _crabAmount);
        vm.startPrank(user1);
        _deposit(_crabAmount);
        vm.stopPrank();

        uint256 bullToRedeem = bullStrategy.balanceOf(user1);
        (
            uint256 crabToRedeem,
            uint256 wPowerPerpToRedeem,
            ,
            uint256 usdcToRepay
        ) = calcAssetsNeededForFlashWithdraw(bullToRedeem);
        uint256 maxEthForSqueeth;
        uint256 maxEthForUsdc;
        {
            uint256 ethUsdPrice = UniOracle._getTwap(
                ethUsdcPool,
                weth,
                usdc,
                TWAP,
                false
            );
            uint256 squeethEthPrice = UniOracle._getTwap(
                ethWSqueethPool,
                wPowerPerp,
                weth,
                TWAP,
                false
            );

            maxEthForSqueeth = wPowerPerpToRedeem.wmul(
                squeethEthPrice.wmul(105e16)
            );
            maxEthForUsdc = usdcToRepay.mul(1e12).wdiv(
                ethUsdPrice.wmul(uint256(1e18).sub(5e15))
            );
        }

        FlashBull.FlashWithdrawParams memory params = FlashBull
            .FlashWithdrawParams({
                bullAmount: bullStrategy.balanceOf(user1),
                maxEthForSqueeth: maxEthForSqueeth,
                maxEthForUsdc: maxEthForUsdc,
                wPowerPerpPoolFee: uint24(3000),
                usdcPoolFee: uint24(3000)
            });

        uint256 wethToWithdraw = _calcWethToWithdraw(bullToRedeem);
        uint256 userBullBalanceBefore = bullStrategy.balanceOf(user1);
        uint256 ethInLendingBefore = IEulerEToken(eToken).balanceOfUnderlying(
            address(bullStrategy)
        );
        uint256 usdcBorrowedBefore = IEulerDToken(dToken).balanceOf(
            address(bullStrategy)
        );
        uint256 crabBalanceBefore = crabV2.balanceOf(address(bullStrategy));
        // uint256 ethToWithdrawFromBull = ethToWithdrawFromCrab.sub(maxEthForSqueeth).add(wethToWithdraw.sub(maxEthForUsdc));
        // userEthBalanceBeforeTx = user1.balance;

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
        return
            UniOracle._getTwap(ethWSqueethPool, wPowerPerp, weth, TWAP, false);
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
        uint256 totalEthToBull = wethToLend
            .add(ethToCrab)
            .sub(usdcToBorrow.wdiv(ethPrice()))
            .sub(wSqueethToMint.wmul(squeethPrice()))
            .add(1e16);
        return totalEthToBull;
    }

    function _calcWsqueethToMintAndFee(
        uint256 _depositedAmount,
        uint256 _strategyDebtAmount,
        uint256 _strategyCollateralAmount
    ) internal view returns (uint256, uint256) {
        uint256 wSqueethToMint;
        uint256 wSqueethEthPrice = UniOracle._getTwap(
            ethWSqueethPool,
            wPowerPerp,
            weth,
            TWAP,
            false
        );
        uint256 feeRate = IController(bullStrategy.powerTokenController())
            .feeRate();
        uint256 feeAdjustment = wSqueethEthPrice.mul(feeRate).div(10000);

        wSqueethToMint = _depositedAmount.wmul(_strategyDebtAmount).wdiv(
            _strategyCollateralAmount.add(
                _strategyDebtAmount.wmul(feeAdjustment)
            )
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
        uint256 depositorShare = _amount.wdiv(
            _strategyCollateralAmount.add(_amount)
        );

        if (_crabTotalSupply != 0) {
            return
                _crabTotalSupply.wmul(depositorShare).wdiv(
                    uint256(ONE).sub(depositorShare)
                );
        }

        return _amount;
    }

    function _getCrabVaultDetails() internal view returns (uint256, uint256) {
        VaultLib.Vault memory strategyVault = IController(address(controller))
            .vaults(crabV2.vaultId());

        return (strategyVault.collateralAmount, strategyVault.shortAmount);
    }

    function _deposit(uint256 _crabToDeposit)
        internal
        returns (uint256, uint256)
    {
        (
            uint256 wethToLend,
            uint256 usdcToBorrow
        ) = _calcCollateralAndBorrowAmount(_crabToDeposit);

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
                (
                    uint256 ethInCrab,
                    uint256 squeethInCrab
                ) = _getCrabVaultDetails();
                uint256 crabUsdPrice = (
                    ethInCrab.wmul(ethUsdPrice).sub(
                        squeethInCrab.wmul(squeethEthPrice).wmul(ethUsdPrice)
                    )
                ).wdiv(crabV2.totalSupply());
                wethToLend = bullStrategy
                    .TARGET_CR()
                    .wmul(_crabToDeposit)
                    .wmul(crabUsdPrice)
                    .wdiv(ethUsdPrice);
                usdcToBorrow = wethToLend
                    .wmul(ethUsdPrice)
                    .wdiv(bullStrategy.TARGET_CR())
                    .div(1e12);
            }
        } else {
            uint256 share = _crabToDeposit.wdiv(bullStrategy.getCrabBalance());
            wethToLend = IEulerEToken(eToken)
                .balanceOfUnderlying(address(bullStrategy))
                .wmul(share)
                .wdiv(uint256(1e18).sub(share));
            usdcToBorrow = IEulerDToken(dToken)
                .balanceOf(address(bullStrategy))
                .wmul(share)
                .wdiv(uint256(1e18).sub(share))
                .div(1e12);
        }
        return (wethToLend, usdcToBorrow);
    }

    function calcAssetsNeededForFlashWithdraw(uint256 _bullAmount)
        internal
        view
        returns (
            uint256,
            uint256,
            uint256,
            uint256
        )
    {
        uint256 bullShare = _bullAmount.wdiv(bullStrategy.totalSupply());
        uint256 crabToRedeem = bullShare.wmul(
            crabV2.balanceOf(address(bullStrategy))
        );
        (uint256 ethInCrab, uint256 squeethInCrab) = bullStrategy
            .getCrabVaultDetails();
        uint256 crabTotalSupply = crabV2.totalSupply();
        uint256 wPowerPerpToRedeem = crabToRedeem.wmul(squeethInCrab).wdiv(
            crabTotalSupply
        );
        uint256 ethToWithdraw = crabToRedeem.wmul(ethInCrab).wdiv(
            crabTotalSupply
        );
        uint256 usdcToRepay = bullStrategy.calcUsdcToRepay(bullShare);

        return (crabToRedeem, wPowerPerpToRedeem, ethToWithdraw, usdcToRepay);
    }

    function _calcWethToWithdraw(uint256 _bullAmount)
        internal
        view
        returns (uint256)
    {
        return
            _bullAmount
                .wmul(
                    IEulerEToken(eToken).balanceOfUnderlying(
                        address(bullStrategy)
                    )
                )
                .wdiv(bullStrategy.totalSupply());
    }

    function _calcBullToMint(uint256 _crabToDeposit)
        internal
        view
        returns (uint256)
    {
        if (IERC20(bullStrategy).totalSupply() == 0) {
            return _crabToDeposit;
        } else {
            uint256 share = _crabToDeposit.wdiv(
                bullStrategy.getCrabBalance().add(_crabToDeposit)
            );
            return
                share.wmul(bullStrategy.totalSupply()).wdiv(
                    uint256(1e18).sub(share)
                );
        }
    }
}
