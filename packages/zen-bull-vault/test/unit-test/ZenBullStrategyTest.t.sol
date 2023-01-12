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
import { IWETH9 } from "squeeth-monorepo/interfaces/IWETH9.sol";
// contract
import { SwapRouter } from "v3-periphery/SwapRouter.sol";
import { TestUtil } from "../util/TestUtil.t.sol";
import { ZenBullStrategy } from "../../src/ZenBullStrategy.sol";
import { CrabStrategyV2 } from "squeeth-monorepo/strategy/CrabStrategyV2.sol";
import { Controller } from "squeeth-monorepo/core/Controller.sol";
import { ZenEmergencyShutdown } from "../../src/ZenEmergencyShutdown.sol";
import { FlashZen } from "../../src/FlashZen.sol";
// lib
import { VaultLib } from "squeeth-monorepo/libs/VaultLib.sol";
import { StrategyMath } from "squeeth-monorepo/strategy/base/StrategyMath.sol"; // StrategyMath licensed under AGPL-3.0-only
import { UniOracle } from "../../src/UniOracle.sol";

/**
 * @notice mainnet fork testing
 */
contract ZenBullStrategyTest is Test {
    using StrategyMath for uint256;

    uint128 internal constant ONE = 1e18;

    TestUtil internal testUtil;
    ZenBullStrategy internal bullStrategy;
    CrabStrategyV2 internal crabV2;
    Controller internal controller;
    ZenEmergencyShutdown internal emergencyShutdown;
    FlashZen internal flashBull;

    uint256 internal bullOwnerPk;
    uint256 internal deployerPk;
    uint256 internal user1Pk;
    uint256 internal ownerPk;
    uint256 internal auctionPk;
    address internal user1;
    address internal owner;
    address internal deployer;
    address internal bullOwner;
    address internal auction;

    address internal weth;
    address internal usdc;
    address internal euler;
    address internal eulerMarketsModule;
    address internal eToken;
    address internal dToken;
    address internal wPowerPerp;
    uint256 internal cap;

    function setUp() public {
        string memory FORK_URL = vm.envString("FORK_URL");
        vm.createSelectFork(FORK_URL, 15781550);

        deployerPk = 0xA11CD;
        deployer = vm.addr(deployerPk);
        bullOwnerPk = 0xB11CD;
        bullOwner = vm.addr(bullOwnerPk);
        auctionPk = 0xC11CD;
        auction = vm.addr(auctionPk);

        vm.startPrank(deployer);

        euler = 0x27182842E098f60e3D576794A5bFFb0777E025d3;
        eulerMarketsModule = 0x3520d5a913427E6F0D6A83E07ccD4A4da316e4d3;
        controller = Controller(0x64187ae08781B09368e6253F9E94951243A493D5);
        crabV2 = CrabStrategyV2(0x3B960E47784150F5a63777201ee2B15253D713e8);
        bullStrategy =
            new ZenBullStrategy(address(crabV2), address(controller), euler, eulerMarketsModule);
        bullStrategy.transferOwnership(bullOwner);
        address factory = 0x1F98431c8aD98523631AE4a59f267346ea31F984;
        flashBull = new FlashZen(address(bullStrategy), factory);
        usdc = controller.quoteCurrency();
        weth = controller.weth();
        eToken = IEulerMarkets(eulerMarketsModule).underlyingToEToken(weth);
        dToken = IEulerMarkets(eulerMarketsModule).underlyingToDToken(usdc);
        wPowerPerp = controller.wPowerPerp();
        emergencyShutdown =
        new ZenEmergencyShutdown(address(bullStrategy), 0x1F98431c8aD98523631AE4a59f267346ea31F984);
        emergencyShutdown.transferOwnership(bullOwner);

        testUtil =
        new TestUtil(address(bullStrategy), address (controller), eToken, dToken, address(crabV2));

        vm.stopPrank();

        cap = 100000e18;
        vm.startPrank(bullOwner);
        bullStrategy.setCap(cap);
        bullStrategy.setAuction(auction);
        bullStrategy.setShutdownContract(address(emergencyShutdown));
        vm.stopPrank();
        user1Pk = 0xA11CE;
        user1 = vm.addr(user1Pk);

        vm.label(user1, "User 1");
        vm.label(address(bullStrategy), "BullStrategy");
        vm.label(euler, "Euler");
        vm.label(eulerMarketsModule, "EulerMarkets");
        vm.label(usdc, "USDC");
        vm.label(weth, "WETH");
        vm.label(wPowerPerp, "oSQTH");
        vm.label(address(crabV2), "crabV2");

        vm.deal(user1, 100000000e18);
        vm.deal(auction, 100000000e18);

        // this is a crab whale, get some crab token from
        vm.prank(0x06CECFbac34101aE41C88EbC2450f8602b3d164b);
        IERC20(crabV2).transfer(user1, 100e18);
        // some WETH and USDC rich address
        vm.prank(0x57757E3D981446D585Af0D9Ae4d7DF6D64647806);
        IERC20(weth).transfer(user1, 10000e18);

        _initateDepositInBull(user1, 5e18);
    }

    function testDepositEthIntoCrabWhenFeeIsZero() public {
        uint256 ethToDeposit = 10e18;
        (uint256 ethInCrab,) = testUtil.getCrabVaultDetails();

        uint256 crabShare = ethToDeposit.wdiv(ethInCrab.add(ethToDeposit));
        uint256 crabToBeMinted =
            IERC20(crabV2).totalSupply().wmul(crabShare).wdiv(uint256(ONE).sub(crabShare));

        uint256 bullCrabBalanceBefore = bullStrategy.getCrabBalance();

        vm.startPrank(auction);
        IWETH9(weth).deposit{value: ethToDeposit}();
        IWETH9(weth).approve(address(bullStrategy), ethToDeposit);
        bullStrategy.depositEthIntoCrab(ethToDeposit);
        vm.stopPrank();

        assertEq(bullStrategy.getCrabBalance().sub(crabToBeMinted), bullCrabBalanceBefore);
    }

    function testDepositEthIntoCrabWhenFeeIsNotZero() public {
        uint256 ethToDeposit = 10e18;
        (uint256 ethInCrab, uint256 squeethInCrab) = testUtil.getCrabVaultDetails();

        (, uint256 fee) = testUtil.calcWsqueethToMintAndFee(ethToDeposit, squeethInCrab, ethInCrab);

        uint256 crabShare = (ethToDeposit.sub(fee)).wdiv(ethInCrab.add(ethToDeposit));
        uint256 crabToBeMinted =
            IERC20(crabV2).totalSupply().wmul(crabShare).wdiv(uint256(ONE).sub(crabShare));

        uint256 bullCrabBalanceBefore = bullStrategy.getCrabBalance();

        vm.startPrank(auction);
        IWETH9(weth).deposit{value: ethToDeposit}();
        IWETH9(weth).approve(address(bullStrategy), ethToDeposit);
        bullStrategy.depositEthIntoCrab(ethToDeposit);
        vm.stopPrank();

        assertEq(bullStrategy.getCrabBalance().sub(crabToBeMinted), bullCrabBalanceBefore);
    }

    function testUnitRedeemCrabAndWithdrawWEth() public {
        uint256 crabToRedeem = 5e18;
        (uint256 wethToLend,) = testUtil.calcCollateralAndBorrowAmount(crabToRedeem);
        vm.startPrank(0x06CECFbac34101aE41C88EbC2450f8602b3d164b);
        IERC20(crabV2).approve(address(bullStrategy), crabToRedeem);
        vm.deal(0x06CECFbac34101aE41C88EbC2450f8602b3d164b, wethToLend);
        bullStrategy.deposit{value: wethToLend}(crabToRedeem);
        vm.stopPrank();

        (, uint256 squeethInCrab) = testUtil.getCrabVaultDetails();
        uint256 wPowerPerpToRedeem =
            squeethInCrab.wmul(crabToRedeem).wdiv(IERC20(crabV2).totalSupply());

        uint256 bullCrabBalanceBefore = bullStrategy.getCrabBalance();

        vm.prank(0x82c427AdFDf2d245Ec51D8046b41c4ee87F0d29C);
        IERC20(wPowerPerp).transfer(auction, wPowerPerpToRedeem);

        vm.startPrank(auction);
        IERC20(wPowerPerp).approve(address(bullStrategy), wPowerPerpToRedeem);
        bullStrategy.redeemCrabAndWithdrawWEth(crabToRedeem, wPowerPerpToRedeem);
        vm.stopPrank();

        assertEq(bullStrategy.getCrabBalance().add(crabToRedeem), bullCrabBalanceBefore);
    }

    function _initateDepositInBull(address _depositor, uint256 _ethToCrab) internal {
        // Put some money in bull to start with
        (uint256 ethInCrab, uint256 squeethInCrab) = testUtil.getCrabVaultDetails();
        (uint256 wSqueethToMint, uint256 fee) =
            testUtil.calcWsqueethToMintAndFee(_ethToCrab, squeethInCrab, ethInCrab);
        uint256 crabToBeMinted =
            testUtil.calcSharesToMint(_ethToCrab.sub(fee), ethInCrab, IERC20(crabV2).totalSupply());
        uint256 bullCrabBalanceBefore = IERC20(crabV2).balanceOf(address(bullStrategy));

        uint256 bullShare = 1e18;
        (uint256 wethToLend, uint256 usdcToBorrow) = bullStrategy.calcLeverageEthUsdc(
            crabToBeMinted, bullShare, ethInCrab, squeethInCrab, crabV2.totalSupply()
        );

        uint256 totalEthToBull =
            testUtil.calcTotalEthToBull(wethToLend, _ethToCrab, usdcToBorrow, wSqueethToMint);

        FlashZen.FlashDepositParams memory params = FlashZen.FlashDepositParams({
            ethToCrab: _ethToCrab,
            minEthFromSqth: 0,
            minEthFromUsdc: 0,
            wPowerPerpPoolFee: uint24(3000),
            usdcPoolFee: uint24(3000)
        });

        vm.startPrank(_depositor);
        flashBull.flashDeposit{value: totalEthToBull}(params);
        vm.stopPrank();

        assertEq(IEulerDToken(dToken).balanceOf(address(bullStrategy)), usdcToBorrow);
        assertApproxEqAbs(
            IEulerEToken(eToken).balanceOfUnderlying(address(bullStrategy)), wethToLend, 1
        );
        assertEq(bullStrategy.getCrabBalance().sub(crabToBeMinted), bullCrabBalanceBefore);
    }
}
