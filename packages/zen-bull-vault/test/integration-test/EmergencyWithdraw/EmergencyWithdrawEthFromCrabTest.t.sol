pragma solidity =0.7.6;
pragma abicoder v2;

// test dependency
import "forge-std/Test.sol";
import { console } from "forge-std/console.sol";

import { IERC20 } from "openzeppelin/token/ERC20/IERC20.sol";
import { Quoter } from "v3-periphery/lens/Quoter.sol";
import { EmergencyWithdraw } from "../../../src/EmergencyWithdraw.sol";
import { ZenBullStrategy } from "../../../src/ZenBullStrategy.sol";
import { UniOracle } from "../../../src/UniOracle.sol";
import { StrategyMath } from "squeeth-monorepo/strategy/base/StrategyMath.sol";

contract EmergencyWithdrawEthFromCrabTest is Test {
    using StrategyMath for uint256;

    address payable public constant ZEN_BULL = 0xb46Fb07b0c80DBC3F97cae3BFe168AcaD46dF507;
    address public constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address public constant CRAB = 0x3B960E47784150F5a63777201ee2B15253D713e8;
    address public constant UNI_FACTORY = 0x1F98431c8aD98523631AE4a59f267346ea31F984;
    address public constant WPOWERPERP = 0xf1B99e3E573A1a9C5E6B2Ce818b617F0E664E86B;
    address public constant QUOTER = 0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6;
    address public constant ETH_USDC_POOL = 0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640;
    address public constant USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    address public constant E_TOKEN = 0x1b808F49ADD4b8C6b5117d9681cF7312Fcf0dC1D;
    address public constant D_TOKEN = 0x84721A3dB22EB852233AEAE74f9bC8477F8bcc42;

    uint256 deployerPk;
    uint256 user1Pk;
    uint256 user2Pk;
    address deployer;
    address user1;
    address user2;

    EmergencyWithdraw internal emergencyWithdraw;

    function setUp() public virtual {
        string memory FORK_URL = vm.envString("FORK_URL");
        vm.createSelectFork(FORK_URL, 16838439);

        deployerPk = 0xA11CD;
        deployer = vm.addr(deployerPk);
        user1Pk = 0xB21CD;
        user1 = vm.addr(user1Pk);
        user2Pk = 0xB22CD;
        user2 = vm.addr(user2Pk);

        vm.startPrank(deployer);
        emergencyWithdraw =
        new EmergencyWithdraw(CRAB, ZEN_BULL, WETH, USDC, WPOWERPERP, ETH_USDC_POOL, E_TOKEN, D_TOKEN, UNI_FACTORY);
        vm.stopPrank();

        // prank ZenBull owner to point to a new auction contract address
        vm.prank(0xAfE66363c27EedB597a140c28B70b32F113fd5a8);
        ZenBullStrategy(ZEN_BULL).setAuction(address(emergencyWithdraw));

        vm.label(deployer, "Deployer");
        vm.label(user1, "user1");
        vm.label(address(emergencyWithdraw), "EmergencyWithdraw");

        // bull whale
        vm.startPrank(0xB845d3C82853b362ADF47A045c087d52384a7776);
        IERC20(ZEN_BULL).transfer(
            user1, IERC20(ZEN_BULL).balanceOf(0xB845d3C82853b362ADF47A045c087d52384a7776) / 2
        );
        IERC20(ZEN_BULL).transfer(
            user2, IERC20(ZEN_BULL).balanceOf(0xB845d3C82853b362ADF47A045c087d52384a7776) / 2
        );
        vm.stopPrank();
    }

    function testSetup() public {
        assertEq(emergencyWithdraw.redeemedZenBullAmountForCrabWithdrawal(), 0);
    }

    function testEmergencyWithdrawEthFromCrab() public {
        uint256 emergencyRedeemedBull = emergencyWithdraw.redeemedZenBullAmountForCrabWithdrawal();
        uint256 user1BullBalanceBefore = IERC20(ZEN_BULL).balanceOf(user1);
        uint256 user1EthBalanceBefore = address(user1).balance;
        uint256 user1RecoveryTokenBalanceBefore = IERC20(emergencyWithdraw).balanceOf(user1);

        uint256 maxWethForOsqth;
        uint256 ethToWithdrawFromCrab;
        {
            uint256 bullShare = user1BullBalanceBefore.wdiv(
                IERC20(ZEN_BULL).totalSupply().sub(emergencyRedeemedBull)
            );
            uint256 crabToRedeem = bullShare.wmul(ZenBullStrategy(ZEN_BULL).getCrabBalance());
            (uint256 ethInCrab, uint256 wPowerPerpInCrab) =
                ZenBullStrategy(ZEN_BULL).getCrabVaultDetails();
            uint256 wPowerPerpToRedeem =
                crabToRedeem.wmul(wPowerPerpInCrab).wdiv(IERC20(CRAB).totalSupply());

            maxWethForOsqth =
                Quoter(QUOTER).quoteExactOutputSingle(WETH, WPOWERPERP, 3000, wPowerPerpToRedeem, 0);
            ethToWithdrawFromCrab = crabToRedeem.wdiv(IERC20(CRAB).totalSupply()).wmul(ethInCrab);
        }

        vm.startPrank(user1);
        IERC20(ZEN_BULL).approve(address(emergencyWithdraw), type(uint256).max);
        emergencyWithdraw.emergencyWithdrawEthFromCrab(user1BullBalanceBefore, maxWethForOsqth);
        vm.stopPrank();

        uint256 bullSupplyAfter = emergencyWithdraw.redeemedZenBullAmountForCrabWithdrawal();
        uint256 user1BullBalanceAfter = IERC20(ZEN_BULL).balanceOf(user1);
        uint256 user1EthBalanceAfter = address(user1).balance;
        uint256 user1RecoveryTokenBalanceAfter = IERC20(emergencyWithdraw).balanceOf(user1);

        assertEq(bullSupplyAfter, emergencyRedeemedBull.add(user1BullBalanceBefore));
        assertEq(user1BullBalanceAfter, 0);
        assertEq(
            user1RecoveryTokenBalanceAfter - user1RecoveryTokenBalanceBefore, user1BullBalanceBefore
        );
        assertEq(
            ethToWithdrawFromCrab.sub(maxWethForOsqth),
            user1EthBalanceAfter.sub(user1EthBalanceBefore)
        );
    }

    function testMultipleEmergencyWithdrawEthFromCrab() public {
        {
            uint256 emergencyRedeemedBull =
                emergencyWithdraw.redeemedZenBullAmountForCrabWithdrawal();
            uint256 user1BullBalanceBefore = IERC20(ZEN_BULL).balanceOf(user1);
            uint256 user1EthBalanceBefore = address(user1).balance;
            uint256 user1RecoveryTokenBalanceBefore = IERC20(emergencyWithdraw).balanceOf(user1);

            uint256 maxWethForOsqth;
            uint256 ethToWithdrawFromCrab;
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
                ethToWithdrawFromCrab =
                    crabToRedeem.wdiv(IERC20(CRAB).totalSupply()).wmul(ethInCrab);
            }

            vm.startPrank(user1);
            IERC20(ZEN_BULL).approve(address(emergencyWithdraw), type(uint256).max);
            emergencyWithdraw.emergencyWithdrawEthFromCrab(user1BullBalanceBefore, maxWethForOsqth);
            vm.stopPrank();

            uint256 bullSupplyAfter = emergencyWithdraw.redeemedZenBullAmountForCrabWithdrawal();
            uint256 user1BullBalanceAfter = IERC20(ZEN_BULL).balanceOf(user1);
            uint256 user1EthBalanceAfter = address(user1).balance;
            uint256 user1RecoveryTokenBalanceAfter = IERC20(emergencyWithdraw).balanceOf(user1);

            assertEq(bullSupplyAfter, emergencyRedeemedBull.add(user1BullBalanceBefore));
            assertEq(user1BullBalanceAfter, 0);
            assertEq(
                user1RecoveryTokenBalanceAfter - user1RecoveryTokenBalanceBefore,
                user1BullBalanceBefore
            );
            assertEq(
                ethToWithdrawFromCrab.sub(maxWethForOsqth),
                user1EthBalanceAfter.sub(user1EthBalanceBefore)
            );
        }

        uint256 emergencyRedeemedBull = emergencyWithdraw.redeemedZenBullAmountForCrabWithdrawal();
        uint256 user2BullBalanceBefore = IERC20(ZEN_BULL).balanceOf(user2);
        uint256 user2EthBalanceBefore = address(user2).balance;
        uint256 user2RecoveryTokenBalanceBefore = IERC20(emergencyWithdraw).balanceOf(user2);

        uint256 maxWethForOsqth;
        uint256 ethToWithdrawFromCrab;
        {
            uint256 bullShare = user2BullBalanceBefore.wdiv(
                IERC20(ZEN_BULL).totalSupply().sub(emergencyRedeemedBull)
            );
            uint256 crabToRedeem = bullShare.wmul(ZenBullStrategy(ZEN_BULL).getCrabBalance());
            (uint256 ethInCrab, uint256 wPowerPerpInCrab) =
                ZenBullStrategy(ZEN_BULL).getCrabVaultDetails();
            uint256 wPowerPerpToRedeem =
                crabToRedeem.wmul(wPowerPerpInCrab).wdiv(IERC20(CRAB).totalSupply());

            maxWethForOsqth =
                Quoter(QUOTER).quoteExactOutputSingle(WETH, WPOWERPERP, 3000, wPowerPerpToRedeem, 0);
            ethToWithdrawFromCrab = crabToRedeem.wdiv(IERC20(CRAB).totalSupply()).wmul(ethInCrab);
        }

        vm.startPrank(user2);
        IERC20(ZEN_BULL).approve(address(emergencyWithdraw), type(uint256).max);
        emergencyWithdraw.emergencyWithdrawEthFromCrab(user2BullBalanceBefore, maxWethForOsqth);
        vm.stopPrank();

        uint256 bullSupplyAfter = emergencyWithdraw.redeemedZenBullAmountForCrabWithdrawal();
        uint256 user2BullBalanceAfter = IERC20(ZEN_BULL).balanceOf(user2);
        uint256 user2EthBalanceAfter = address(user2).balance;
        uint256 user2RecoveryTokenBalanceAfter = IERC20(emergencyWithdraw).balanceOf(user2);

        assertEq(bullSupplyAfter, emergencyRedeemedBull.add(user2BullBalanceBefore));
        assertEq(user2BullBalanceAfter, 0);
        assertEq(
            user2RecoveryTokenBalanceAfter - user2RecoveryTokenBalanceBefore, user2BullBalanceBefore
        );
        assertEq(
            ethToWithdrawFromCrab.sub(maxWethForOsqth),
            user2EthBalanceAfter.sub(user2EthBalanceBefore)
        );
    }
}
