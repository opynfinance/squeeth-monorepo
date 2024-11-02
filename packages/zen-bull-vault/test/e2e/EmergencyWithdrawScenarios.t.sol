pragma solidity =0.7.6;
pragma abicoder v2;

// test dependency
import "forge-std/Test.sol";
import { console } from "forge-std/console.sol";

import { IERC20 } from "openzeppelin/token/ERC20/IERC20.sol";
import { IEulerDToken } from "../../src/interface/IEulerDToken.sol";
import { Quoter } from "v3-periphery/lens/Quoter.sol";
import { EmergencyWithdraw } from "../../src/EmergencyWithdraw.sol";
import { ZenBullStrategy } from "../../src/ZenBullStrategy.sol";
import { TestUtil } from "../util/TestUtil.t.sol";
import { StrategyMath } from "squeeth-monorepo/strategy/base/StrategyMath.sol";

contract EmergencyWithdrawScenarios is Test {
    using StrategyMath for uint256;

    address payable public constant ZEN_BULL = 0xb46Fb07b0c80DBC3F97cae3BFe168AcaD46dF507;
    address public constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address public constant USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    address payable public constant CONTROLLER = 0x64187ae08781B09368e6253F9E94951243A493D5;
    address payable public constant CRAB = 0x3B960E47784150F5a63777201ee2B15253D713e8;
    address public constant UNI_FACTORY = 0x1F98431c8aD98523631AE4a59f267346ea31F984;
    address public constant WPOWERPERP = 0xf1B99e3E573A1a9C5E6B2Ce818b617F0E664E86B;
    address public constant ETH_SQUEETH_POOL = 0x82c427AdFDf2d245Ec51D8046b41c4ee87F0d29C;
    address public constant QUOTER = 0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6;
    address public constant ZEN_BULL_OWNER = 0xAfE66363c27EedB597a140c28B70b32F113fd5a8;
    address public constant E_TOKEN = 0x1b808F49ADD4b8C6b5117d9681cF7312Fcf0dC1D;
    address public constant D_TOKEN = 0x84721A3dB22EB852233AEAE74f9bC8477F8bcc42;
    address public constant ETH_USDC_POOL = 0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8;

    uint256 deployerPk;
    uint256 user1Pk;
    uint256 user2Pk;
    uint256 user3Pk;
    address deployer;
    address user1;
    address user2;
    address user3;

    TestUtil internal testUtil;
    EmergencyWithdraw internal emergencyWithdraw;

    function setUp() public virtual {
        string memory FORK_URL = vm.envString("FORK_URL");
        vm.createSelectFork(FORK_URL, 16839439);

        deployerPk = 0xA11CD;
        deployer = vm.addr(deployerPk);
        user1Pk = 0xB21CD;
        user1 = vm.addr(user1Pk);
        user2Pk = 0xB22CD;
        user2 = vm.addr(user2Pk);
        user3Pk = 0xB12CD;
        user3 = vm.addr(user3Pk);

        vm.label(deployer, "Deployer");
        vm.label(user1, "user1");
        vm.label(user2, "user2");
        vm.label(user3, "user3");

        _deployAndConfigure();
    }

    function testDepositWhenEulerIsNotWorking() public {
        uint256 crabToDeposit = 10e18;

        vm.startPrank(user1);
        IERC20(CRAB).approve(ZEN_BULL, crabToDeposit);
        vm.expectRevert(bytes("REVERT"));
        ZenBullStrategy(ZEN_BULL).deposit{ value: 100e18 }(crabToDeposit);
        vm.stopPrank();
    }

    function testEmergencyWithdrawEthFromCrabWhenEulerIsNotWorking() public {
        uint256 bullToRedeem = IERC20(ZEN_BULL).balanceOf(user1);
        (uint256 wPowerPerpToRedeem,) = _calcWPowerPerpAndCrabNeededForWithdraw(bullToRedeem);
        // transfer some oSQTH from some squeether
        vm.prank(0x493dd8a5654549726ABA0a4D8882DA5Cd43EaF25);
        IERC20(WPOWERPERP).transfer(user1, 1000e18);

        vm.startPrank(user1);
        IERC20(USDC).approve(ZEN_BULL, 10000e6);
        IERC20(WPOWERPERP).approve(ZEN_BULL, wPowerPerpToRedeem);
        vm.expectRevert(bytes("REVERT"));
        ZenBullStrategy(ZEN_BULL).withdraw(bullToRedeem);
        vm.stopPrank();
    }

    // function testEmergencyWithdrawEthFromCrabWhenEulerWorksAndAfterEmergencyWithdraw() public {
    //     // block number before euler rekt
    //     vm.rollFork(16817896);
    //     _deployAndConfigure();

    //     uint256 normalWithdrawPayoutBeforeEmergencyWithdraws;
    //     {
    //         // normal withdraw from user2
    //         uint256 bullAmountToWithdraw = IERC20(ZEN_BULL).balanceOf(user2);
    //         (uint256 wPowerPerpToRedeem, uint256 crabToRedeem) =
    //             _calcWPowerPerpAndCrabNeededForWithdraw(bullAmountToWithdraw);
    //         uint256 usdcToRepay = _calcUsdcNeededForWithdraw(bullAmountToWithdraw);
    //         uint256 wethToWithdrawFromEuler = testUtil.calcWethToWithdraw(bullAmountToWithdraw);
    //         (uint256 ethInCrab,) = ZenBullStrategy(ZEN_BULL).getCrabVaultDetails();
    //         uint256 ethToWithdrawFromCrab =
    //             crabToRedeem.wdiv(IERC20(CRAB).totalSupply()).wmul(ethInCrab);
    //         // transfer some oSQTH from some squeether
    //         vm.prank(0x56178a0d5F301bAf6CF3e1Cd53d9863437345Bf9);
    //         IERC20(WPOWERPERP).transfer(user2, wPowerPerpToRedeem);

    //         vm.prank(0x0A59649758aa4d66E25f08Dd01271e891fe52199);
    //         IERC20(USDC).transfer(user2, usdcToRepay);

    //         uint256 user2EthBalanceBefore = address(user2).balance;

    //         vm.startPrank(user2);
    //         IERC20(USDC).approve(ZEN_BULL, usdcToRepay);
    //         IERC20(WPOWERPERP).approve(ZEN_BULL, wPowerPerpToRedeem);
    //         ZenBullStrategy(ZEN_BULL).withdraw(bullAmountToWithdraw);
    //         vm.stopPrank();

    //         uint256 user2EthBalanceAfter = address(user2).balance;
    //         normalWithdrawPayoutBeforeEmergencyWithdraws =
    //             user2EthBalanceAfter.sub(user2EthBalanceBefore);
    //     }

    //     // roll again before euler rekt
    //     vm.rollFork(16817896);
    //     _deployAndConfigure();

    //     // withdraw through emergency contract
    //     {
    //         uint256 emergencyRedeemedBull =
    //             emergencyWithdraw.redeemedZenBullAmountForCrabWithdrawal();
    //         uint256 user1BullBalanceBefore = IERC20(ZEN_BULL).balanceOf(user1);

    //         uint256 maxWethForOsqth;
    //         {
    //             uint256 bullShare = user1BullBalanceBefore.wdiv(
    //                 IERC20(ZEN_BULL).totalSupply().sub(emergencyRedeemedBull)
    //             );
    //             uint256 crabToRedeem = bullShare.wmul(ZenBullStrategy(ZEN_BULL).getCrabBalance());
    //             (uint256 ethInCrab, uint256 wPowerPerpInCrab) =
    //                 ZenBullStrategy(ZEN_BULL).getCrabVaultDetails();
    //             uint256 wPowerPerpToRedeem =
    //                 crabToRedeem.wmul(wPowerPerpInCrab).wdiv(IERC20(CRAB).totalSupply());

    //             maxWethForOsqth = Quoter(QUOTER).quoteExactOutputSingle(
    //                 WETH, WPOWERPERP, 3000, wPowerPerpToRedeem, 0
    //             );
    //         }

    //         vm.startPrank(user1);
    //         IERC20(ZEN_BULL).approve(address(emergencyWithdraw), type(uint256).max);
    //         emergencyWithdraw.emergencyWithdrawEthFromCrab(user1BullBalanceBefore, maxWethForOsqth);
    //         vm.stopPrank();

    //         // user3 emergency withdraw
    //         emergencyRedeemedBull = emergencyWithdraw.redeemedZenBullAmountForCrabWithdrawal();
    //         uint256 user3BullBalanceBefore = IERC20(ZEN_BULL).balanceOf(user3);

    //         {
    //             uint256 bullShare = user3BullBalanceBefore.wdiv(
    //                 IERC20(ZEN_BULL).totalSupply().sub(emergencyRedeemedBull)
    //             );
    //             uint256 crabToRedeem = bullShare.wmul(ZenBullStrategy(ZEN_BULL).getCrabBalance());
    //             (uint256 ethInCrab, uint256 wPowerPerpInCrab) =
    //                 ZenBullStrategy(ZEN_BULL).getCrabVaultDetails();
    //             uint256 wPowerPerpToRedeem =
    //                 crabToRedeem.wmul(wPowerPerpInCrab).wdiv(IERC20(CRAB).totalSupply());

    //             maxWethForOsqth = Quoter(QUOTER).quoteExactOutputSingle(
    //                 WETH, WPOWERPERP, 3000, wPowerPerpToRedeem, 0
    //             );
    //         }

    //         vm.startPrank(user3);
    //         IERC20(ZEN_BULL).approve(address(emergencyWithdraw), type(uint256).max);
    //         emergencyWithdraw.emergencyWithdrawEthFromCrab(user3BullBalanceBefore, maxWethForOsqth);
    //         vm.stopPrank();
    //     }

    //     uint256 normalWithdrawPayoutAfterEmergencyWithdraws;
    //     {
    //         // normal withdraw from user2
    //         uint256 bullAmountToWithdraw = IERC20(ZEN_BULL).balanceOf(user2);
    //         (uint256 wPowerPerpToRedeem, uint256 crabToRedeem) =
    //             _calcWPowerPerpAndCrabNeededForWithdraw(bullAmountToWithdraw);
    //         uint256 usdcToRepay = _calcUsdcNeededForWithdraw(bullAmountToWithdraw);
    //         uint256 wethToWithdrawFromEuler = testUtil.calcWethToWithdraw(bullAmountToWithdraw);
    //         (uint256 ethInCrab,) = ZenBullStrategy(ZEN_BULL).getCrabVaultDetails();
    //         uint256 ethToWithdrawFromCrab =
    //             crabToRedeem.wdiv(IERC20(CRAB).totalSupply()).wmul(ethInCrab);
    //         // transfer some oSQTH from some squeether
    //         vm.prank(0x56178a0d5F301bAf6CF3e1Cd53d9863437345Bf9);
    //         IERC20(WPOWERPERP).transfer(user2, wPowerPerpToRedeem);

    //         vm.prank(0x0A59649758aa4d66E25f08Dd01271e891fe52199);
    //         IERC20(USDC).transfer(user2, usdcToRepay);

    //         uint256 user2EthBalanceBefore = address(user2).balance;

    //         vm.startPrank(user2);
    //         IERC20(USDC).approve(ZEN_BULL, usdcToRepay);
    //         IERC20(WPOWERPERP).approve(ZEN_BULL, wPowerPerpToRedeem);
    //         ZenBullStrategy(ZEN_BULL).withdraw(bullAmountToWithdraw);
    //         vm.stopPrank();

    //         uint256 user2EthBalanceAfter = address(user2).balance;
    //         normalWithdrawPayoutAfterEmergencyWithdraws =
    //             user2EthBalanceAfter.sub(user2EthBalanceBefore);
    //     }

    //     assertLt(
    //         normalWithdrawPayoutAfterEmergencyWithdraws,
    //         normalWithdrawPayoutBeforeEmergencyWithdraws
    //     );
    // }

    function testScenarioEmergencyWithdrawAfterNormalWithdraw() public {
        // block number before euler rekt
        vm.rollFork(16817896);
        _deployAndConfigure();

        // user1 withdraw through emergency contract
        {
            uint256 emergencyRedeemedBull =
                emergencyWithdraw.redeemedZenBullAmountForCrabWithdrawal();
            uint256 user1BullBalanceBefore = IERC20(ZEN_BULL).balanceOf(user1);

            uint256 maxWethForOsqth;
            {
                uint256 bullShare = user1BullBalanceBefore.wdiv(
                    IERC20(ZEN_BULL).totalSupply().sub(emergencyRedeemedBull)
                );
                uint256 crabToRedeem = bullShare.wmul(ZenBullStrategy(ZEN_BULL).getCrabBalance());
                (uint256 ethInCrab, uint256 wPowerPerpInCrab) =
                    ZenBullStrategy(ZEN_BULL).getCrabVaultDetails();
                uint256 wPowerPerpToRedeem =
                    crabToRedeem.wmul(wPowerPerpInCrab).wdiv(IERC20(CRAB).totalSupply());

                maxWethForOsqth = Quoter(QUOTER).quoteExactOutputSingle(
                    WETH, WPOWERPERP, 3000, wPowerPerpToRedeem, 0
                );
            }

            vm.startPrank(user1);
            IERC20(ZEN_BULL).approve(address(emergencyWithdraw), type(uint256).max);
            emergencyWithdraw.emergencyWithdrawEthFromCrab(user1BullBalanceBefore, maxWethForOsqth);
            vm.stopPrank();
        }

        uint256 normalWithdrawPayoutBeforeEmergencyWithdraws;
        {
            // normal withdraw from user2
            uint256 bullAmountToWithdraw = IERC20(ZEN_BULL).balanceOf(user2);
            (uint256 wPowerPerpToRedeem, uint256 crabToRedeem) =
                _calcWPowerPerpAndCrabNeededForWithdraw(bullAmountToWithdraw);
            uint256 usdcToRepay = _calcUsdcNeededForWithdraw(bullAmountToWithdraw);
            uint256 wethToWithdrawFromEuler = testUtil.calcWethToWithdraw(bullAmountToWithdraw);
            (uint256 ethInCrab,) = ZenBullStrategy(ZEN_BULL).getCrabVaultDetails();
            uint256 ethToWithdrawFromCrab =
                crabToRedeem.wdiv(IERC20(CRAB).totalSupply()).wmul(ethInCrab);
            // transfer some oSQTH from some squeether
            vm.prank(0x56178a0d5F301bAf6CF3e1Cd53d9863437345Bf9);
            IERC20(WPOWERPERP).transfer(user2, wPowerPerpToRedeem);

            vm.prank(0x0A59649758aa4d66E25f08Dd01271e891fe52199);
            IERC20(USDC).transfer(user2, usdcToRepay);

            uint256 user2EthBalanceBefore = address(user2).balance;

            vm.startPrank(user2);
            IERC20(USDC).approve(ZEN_BULL, usdcToRepay);
            IERC20(WPOWERPERP).approve(ZEN_BULL, wPowerPerpToRedeem);
            ZenBullStrategy(ZEN_BULL).withdraw(bullAmountToWithdraw);
            vm.stopPrank();

            uint256 user2EthBalanceAfter = address(user2).balance;
            normalWithdrawPayoutBeforeEmergencyWithdraws =
                user2EthBalanceAfter.sub(user2EthBalanceBefore);
        }
    }

    function _deployAndConfigure() internal {
        vm.startPrank(deployer);
        emergencyWithdraw =
        new EmergencyWithdraw(CRAB, ZEN_BULL, WETH, USDC, WPOWERPERP, ETH_USDC_POOL, E_TOKEN, D_TOKEN, UNI_FACTORY);
        testUtil = new TestUtil(ZEN_BULL, CONTROLLER, E_TOKEN, D_TOKEN, CRAB);
        vm.stopPrank();

        vm.label(address(emergencyWithdraw), "EmergencyWithdraw");

        // prank ZenBull owner to point to a new auction contract address
        vm.prank(0xAfE66363c27EedB597a140c28B70b32F113fd5a8);
        ZenBullStrategy(ZEN_BULL).setAuction(address(emergencyWithdraw));

        // bull whale
        vm.startPrank(0xB845d3C82853b362ADF47A045c087d52384a7776);
        IERC20(ZEN_BULL).transfer(
            user1, IERC20(ZEN_BULL).balanceOf(0xB845d3C82853b362ADF47A045c087d52384a7776) / 2
        );
        IERC20(ZEN_BULL).transfer(
            user2, IERC20(ZEN_BULL).balanceOf(0xB845d3C82853b362ADF47A045c087d52384a7776) / 2
        );
        vm.stopPrank();
        vm.startPrank(0xc00d8dAC46b1F8bcEae2477591822B4E5B0a7C6b);
        IERC20(ZEN_BULL).transfer(
            user3, IERC20(ZEN_BULL).balanceOf(0xc00d8dAC46b1F8bcEae2477591822B4E5B0a7C6b)
        );
        vm.stopPrank();
        // crab whale
        vm.prank(0x06CECFbac34101aE41C88EbC2450f8602b3d164b);
        IERC20(CRAB).transfer(user1, 70e18);
        vm.deal(user1, 100e18);
    }

    function _emergencyWithdrawEthFromCrab(address _user, uint256 _zenBullAmount) internal {
        uint256 emergencyRedeemedBull = emergencyWithdraw.redeemedZenBullAmountForCrabWithdrawal();
        uint256 maxWethForOsqth;
        uint256 ethToWithdrawFromCrab;
        {
            uint256 bullShare =
                _zenBullAmount.wdiv(IERC20(ZEN_BULL).totalSupply().sub(emergencyRedeemedBull));
            uint256 crabToRedeem = bullShare.wmul(ZenBullStrategy(ZEN_BULL).getCrabBalance());
            (uint256 ethInCrab, uint256 wPowerPerpInCrab) =
                ZenBullStrategy(ZEN_BULL).getCrabVaultDetails();
            uint256 wPowerPerpToRedeem =
                crabToRedeem.wmul(wPowerPerpInCrab).wdiv(IERC20(CRAB).totalSupply());

            maxWethForOsqth =
                Quoter(QUOTER).quoteExactOutputSingle(WETH, WPOWERPERP, 3000, wPowerPerpToRedeem, 0);
            ethToWithdrawFromCrab = crabToRedeem.wdiv(IERC20(CRAB).totalSupply()).wmul(ethInCrab);
        }

        vm.startPrank(_user);
        IERC20(ZEN_BULL).approve(address(emergencyWithdraw), type(uint256).max);
        emergencyWithdraw.emergencyWithdrawEthFromCrab(_zenBullAmount, maxWethForOsqth);
        vm.stopPrank();
    }

    function _calcWPowerPerpAndCrabNeededForWithdraw(uint256 _bullAmount)
        internal
        view
        returns (uint256, uint256)
    {
        uint256 share = _bullAmount.wdiv(ZenBullStrategy(ZEN_BULL).totalSupply());
        uint256 crabToRedeem = share.wmul(ZenBullStrategy(ZEN_BULL).getCrabBalance());
        uint256 crabTotalSupply = IERC20(CRAB).totalSupply();
        (, uint256 squeethInCrab) = testUtil.getCrabVaultDetails();
        return (crabToRedeem.wmul(squeethInCrab).wdiv(crabTotalSupply), crabToRedeem);
    }

    function _calcUsdcNeededForWithdraw(uint256 _bullAmount) internal view returns (uint256) {
        uint256 share = _bullAmount.wdiv(ZenBullStrategy(ZEN_BULL).totalSupply());
        return share.wmul(IEulerDToken(D_TOKEN).balanceOf(ZEN_BULL));
    }
}
