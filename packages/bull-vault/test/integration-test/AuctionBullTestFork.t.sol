pragma solidity =0.7.6;

pragma abicoder v2;

// test dependency
import "forge-std/Test.sol";
import { console } from "forge-std/console.sol";
//interface
import { IERC20 } from "openzeppelin/token/ERC20/IERC20.sol";
import { IWETH9 } from "squeeth-monorepo/interfaces/IWETH9.sol";
import { IController } from "squeeth-monorepo/interfaces/IController.sol";
import { IEulerMarkets } from "../../src/interface/IEulerMarkets.sol";
import { IEulerEToken } from "../../src/interface/IEulerEToken.sol";
import { IEulerDToken } from "../../src/interface/IEulerDToken.sol";
import { ISwapRouter } from "v3-periphery/interfaces/ISwapRouter.sol";
// contract
import { TestUtil } from "../util/TestUtil.t.sol";
import { SwapRouter } from "v3-periphery/SwapRouter.sol";
import { Quoter } from "v3-periphery/lens/Quoter.sol";
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
    SwapRouter internal swapRouter;
    TestUtil internal testUtil;
    Quoter internal quoter;

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
        quoter = Quoter(0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6);
        swapRouter = SwapRouter(0xE592427A0AEce92De3Edee1F18E0157C05861564);
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
        testUtil = new TestUtil(
            address(bullStrategy),
            address(controller),
            eToken,
            dToken,
            address(crabV2)
        );
        vm.stopPrank();

        cap = 100000e18;
        vm.startPrank(owner);
        bullStrategy.setCap(cap);
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
        vm.label(address(swapRouter), "SwapRouter");

        vm.deal(user1, 100000000e18);
        // this is a crab whale, get some crab token from
        vm.prank(0x06CECFbac34101aE41C88EbC2450f8602b3d164b);
        IERC20(crabV2).transfer(user1, 100e18);
        // some WETH and USDC rich address
        vm.prank(0x57757E3D981446D585Af0D9Ae4d7DF6D64647806);
        IERC20(weth).transfer(user1, 10000e18);
        vm.prank(0x40ec5B33f54e0E8A33A975908C5BA1c14e5BbbDf);
        IERC20(usdc).transfer(user1, 500000000e6);
        vm.stopPrank();
        // osQTH whale
        vm.prank(0x35AeD16f957b39342744B8366A8c13172507D7b8);
        IERC20(wPowerPerp).transfer(user1, 1000e18);
        _initateDepositInBull();
    }

    function testLeverageRebalanceWhereCrIsInvalid() public {
        vm.startPrank(user1);
        IWETH9(weth).deposit{value: 50000e18}();
        IERC20(weth).approve(address(swapRouter), 50000e18);
        swapRouter.exactInputSingle(
            ISwapRouter.ExactInputSingleParams({
                tokenIn: weth,
                tokenOut: usdc,
                fee: uint24(3000),
                recipient: msg.sender,
                deadline: block.timestamp,
                amountIn: 50000e18,
                amountOutMinimum: 0,
                sqrtPriceLimitX96: 0
            })
        );
        vm.stopPrank();
        vm.warp(block.timestamp + 10000);

        uint256 crabPrice = testUtil.getCrabPrice();
        uint256 usdcDebtTarget =
            crabPrice.wmul(IERC20(crabV2).balanceOf(address(bullStrategy))).div(1e12);
        bool isSellingUsdc =
            (usdcDebtTarget > IEulerDToken(dToken).balanceOf(address(bullStrategy))) ? true : false;

        assertEq(isSellingUsdc, false);

        uint256 usdcAmount = (
            usdcDebtTarget > IEulerDToken(dToken).balanceOf(address(bullStrategy))
        )
            ? usdcDebtTarget.sub(IEulerDToken(dToken).balanceOf(address(bullStrategy)))
            : IEulerDToken(dToken).balanceOf(address(bullStrategy)).sub(usdcDebtTarget);
        uint256 maxEthForUsdc = quoter.quoteExactOutputSingle(weth, usdc, 3000, usdcAmount, 0);
        vm.startPrank(auctionManager);
        vm.expectRevert(bytes("AB2"));
        auctionBull.leverageRebalance(isSellingUsdc, usdcAmount, maxEthForUsdc, 3000);
        vm.stopPrank();
    }

    function testLeverageRebalanceWhenEthUp() public {
        uint256 usdcDebtBefore = IEulerDToken(dToken).balanceOf(address(bullStrategy));
        uint256 ethBalanceBefore = IEulerEToken(eToken).balanceOfUnderlying(address(bullStrategy));

        // move prices up
        vm.startPrank(user1);
        IERC20(usdc).approve(address(swapRouter), 10000000e6);
        swapRouter.exactInputSingle(
            ISwapRouter.ExactInputSingleParams({
                tokenIn: usdc,
                tokenOut: weth,
                fee: uint24(3000),
                recipient: msg.sender,
                deadline: block.timestamp,
                amountIn: 10000000e6,
                amountOutMinimum: 0,
                sqrtPriceLimitX96: 0
            })
        );
        IWETH9(weth).deposit{value: 100e18}();
        IERC20(weth).approve(address(swapRouter), 100e18);
        swapRouter.exactInputSingle(
            ISwapRouter.ExactInputSingleParams({
                tokenIn: weth,
                tokenOut: wPowerPerp,
                fee: uint24(3000),
                recipient: msg.sender,
                deadline: block.timestamp,
                amountIn: 100e18,
                amountOutMinimum: 0,
                sqrtPriceLimitX96: 0
            })
        );
        vm.stopPrank();
        vm.warp(block.timestamp + 1000);

        (uint256 deltaBeforeRebalance, uint256 crBeforeRebalance) =
            auctionBull.getCurrentDeltaAndCollatRatio();

        uint256 crabPrice = testUtil.getCrabPrice();
        uint256 usdcDebtTarget =
            crabPrice.wmul(IERC20(crabV2).balanceOf(address(bullStrategy))).div(1e12);
        bool isSellingUsdc =
            (usdcDebtTarget > IEulerDToken(dToken).balanceOf(address(bullStrategy))) ? true : false;

        assertEq(isSellingUsdc, true);

        uint256 usdcAmount = (
            usdcDebtTarget > IEulerDToken(dToken).balanceOf(address(bullStrategy))
        )
            ? usdcDebtTarget.sub(IEulerDToken(dToken).balanceOf(address(bullStrategy)))
            : IEulerDToken(dToken).balanceOf(address(bullStrategy)).sub(usdcDebtTarget);
        uint256 minEthForUsdc = quoter.quoteExactInputSingle(usdc, weth, 3000, usdcAmount, 0);
        vm.startPrank(auctionManager);
        auctionBull.leverageRebalance(isSellingUsdc, usdcAmount, minEthForUsdc, 3000);
        vm.stopPrank();

        (uint256 deltaAfterRebalance, uint256 crAfterRebalance) =
            auctionBull.getCurrentDeltaAndCollatRatio();

        assertApproxEqAbs(
            IEulerDToken(dToken).balanceOf(address(bullStrategy)),
            usdcDebtBefore.add(usdcAmount),
            1e6
        );
        assertGt(deltaAfterRebalance, deltaBeforeRebalance);
        assertLt(crAfterRebalance, crBeforeRebalance);
        assertTrue(
            ethBalanceBefore.add(minEthForUsdc)
                <= IEulerEToken(eToken).balanceOfUnderlying(address(bullStrategy))
        );
    }

    function testLeverageRebalanceWhenEthDown() public {
        // move prices down
        vm.startPrank(user1);
        IWETH9(weth).deposit{value: 10000e18}();
        IERC20(weth).approve(address(swapRouter), 10000e18);
        swapRouter.exactInputSingle(
            ISwapRouter.ExactInputSingleParams({
                tokenIn: weth,
                tokenOut: usdc,
                fee: uint24(3000),
                recipient: msg.sender,
                deadline: block.timestamp,
                amountIn: 10000e18,
                amountOutMinimum: 0,
                sqrtPriceLimitX96: 0
            })
        );
        IERC20(wPowerPerp).approve(address(swapRouter), 900e18);
        swapRouter.exactInputSingle(
            ISwapRouter.ExactInputSingleParams({
                tokenIn: wPowerPerp,
                tokenOut: weth,
                fee: uint24(3000),
                recipient: msg.sender,
                deadline: block.timestamp,
                amountIn: 900e18,
                amountOutMinimum: 0,
                sqrtPriceLimitX96: 0
            })
        );
        vm.stopPrank();
        vm.warp(block.timestamp + 1000);

        (uint256 deltaBeforeRebalance, uint256 crBeforeRebalance) =
            auctionBull.getCurrentDeltaAndCollatRatio();
        uint256 crabPrice = testUtil.getCrabPrice();
        uint256 usdcDebtTarget =
            crabPrice.wmul(IERC20(crabV2).balanceOf(address(bullStrategy))).div(1e12);
        bool isSellingUsdc =
            (usdcDebtTarget > IEulerDToken(dToken).balanceOf(address(bullStrategy))) ? true : false;

        assertEq(isSellingUsdc, false);

        uint256 usdcAmount = (
            usdcDebtTarget > IEulerDToken(dToken).balanceOf(address(bullStrategy))
        )
            ? usdcDebtTarget.sub(IEulerDToken(dToken).balanceOf(address(bullStrategy)))
            : IEulerDToken(dToken).balanceOf(address(bullStrategy)).sub(usdcDebtTarget);
        uint256 maxEthForUsdc = quoter.quoteExactOutputSingle(weth, usdc, 3000, usdcAmount, 0);
        uint256 usdcDebtBefore = IEulerDToken(dToken).balanceOf(address(bullStrategy));
        uint256 ethBalanceBefore = IEulerEToken(eToken).balanceOfUnderlying(address(bullStrategy));
        vm.startPrank(auctionManager);
        auctionBull.leverageRebalance(isSellingUsdc, usdcAmount, maxEthForUsdc, 3000);
        vm.stopPrank();

        (uint256 deltaAfterRebalance, uint256 crAfterRebalance) =
            auctionBull.getCurrentDeltaAndCollatRatio();

        assertApproxEqAbs(
            IEulerDToken(dToken).balanceOf(address(bullStrategy)),
            usdcDebtBefore.sub(usdcAmount),
            1e6
        );
        assertLt(deltaAfterRebalance, deltaBeforeRebalance);
        assertGt(crAfterRebalance, crBeforeRebalance);
        assertApproxEqAbs(
            ethBalanceBefore.sub(maxEthForUsdc),
            IEulerEToken(eToken).balanceOfUnderlying(address(bullStrategy)),
            1
        );
    }

    // Helper functions
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
