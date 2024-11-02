pragma solidity =0.7.6;
pragma abicoder v2;

// test dependency
import "forge-std/Test.sol";
import { console } from "forge-std/console.sol";

import { IERC20 } from "openzeppelin/token/ERC20/IERC20.sol";
import { IOracle } from "squeeth-monorepo/interfaces/IOracle.sol";
import { IController } from "squeeth-monorepo/interfaces/IController.sol";
import { ShutdownEmergencyWithdraw } from "../../src/ShutdownEmergencyWithdraw.sol";
import { ZenBullStrategy } from "../../src/ZenBullStrategy.sol";
import { IZenEmergencyWithdraw } from "../../src/interface/IZenEmergencyWithdraw.sol";
import { StrategyMath } from "squeeth-monorepo/strategy/base/StrategyMath.sol";

contract ShutdownEmergencyWithdrawTest is Test {
    using StrategyMath for uint256;

    address payable public constant ZEN_BULL = 0xb46Fb07b0c80DBC3F97cae3BFe168AcaD46dF507;
    address public constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address public constant USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    address payable public constant CRAB = 0x3B960E47784150F5a63777201ee2B15253D713e8;
    address public constant OSQTH = 0xf1B99e3E573A1a9C5E6B2Ce818b617F0E664E86B;
    address public constant ETH_USDC_POOL = 0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8;
    address payable public constant CONTROLLER = 0x64187ae08781B09368e6253F9E94951243A493D5;
    address public constant ORACLE = 0x65D66c76447ccB45dAf1e8044e918fA786A483A1;
    address public constant ZEN_BULL_EMERGENCY_WITHDRAW = 0x3DdC956B08c0A6dA2249f8c528fF0594F5AEa381;

    // multisig owner
    address public constant OWNER = 0xAfE66363c27EedB597a140c28B70b32F113fd5a8;

    uint256 public constant INDEX_SCALE = 1e4;
    uint32 public constant TWAP_PERIOD = 420 seconds;

    uint256 deployerPk;
    uint256 user3Pk;
    address deployer;
    address user1;
    address user2;
    address user3;

    ShutdownEmergencyWithdraw internal shutdownEmergencyWithdraw;

    function setUp() public virtual {
        string memory FORK_URL = vm.envString("FORK_URL");
        vm.createSelectFork(FORK_URL, 21095588);

        deployerPk = 0xA11CD;
        deployer = vm.addr(deployerPk);
        user1 = 0x73738c989398EBAfdAfD097836Fd910BAc14CCDC;
        user2 = 0x1ba20876565280C8274eEd551B575936097e414F;
        user3Pk = 0xB12CD;
        user3 = vm.addr(user3Pk);

        vm.label(deployer, "Deployer");
        vm.label(user1, "User1");
        vm.label(user2, "User2");
        _deployAndConfigure();
    }

    function testShutdownEmergencyWithdrawNotOwner() public {
        vm.startPrank(user1);
        vm.expectRevert("Ownable: caller is not the owner");
        shutdownEmergencyWithdraw.shutdownEmergencyWithdraw();
        vm.stopPrank();
    }

    function testShutdownEmergencyWithdrawFromDeployerNotOwner() public {
        vm.startPrank(deployer);
        vm.expectRevert("Ownable: caller is not the owner");
        shutdownEmergencyWithdraw.shutdownEmergencyWithdraw();
        vm.stopPrank();
    }

    function testShutdownEmergencyWithdraw() public {
        // get initial crab balance in zen bull strategy
        uint256 initialZenBullCrabBalance = ZenBullStrategy(ZEN_BULL).getCrabBalance();

        (uint256 ethInCrab, uint256 wPowerPerpInCrab) =
            ZenBullStrategy(ZEN_BULL).getCrabVaultDetails();

        uint256 ethShare = initialZenBullCrabBalance.wdiv(IERC20(CRAB).totalSupply());
        uint256 wethToReceive = ethInCrab.wmul(ethShare);

        uint256 ethIndexPrice =
            IOracle(ORACLE).getTwap(ETH_USDC_POOL, WETH, USDC, TWAP_PERIOD, true).div(INDEX_SCALE);

        uint256 wPowerPerpToProvide =
            initialZenBullCrabBalance.wmul(wPowerPerpInCrab).wdiv(IERC20(CRAB).totalSupply());
        uint256 wethToCaller = wPowerPerpToProvide.wmul(ethIndexPrice).wmul(
            IController(CONTROLLER).getExpectedNormalizationFactor()
        );

        // use deal() to get some oSQTH for testing
        deal(address(OSQTH), address(OWNER), wPowerPerpToProvide);

        // get initial balances
        uint256 initialOwnerWethBalance = IERC20(WETH).balanceOf(OWNER);
        uint256 initialOwnerWPowerPerpBalance = IERC20(OSQTH).balanceOf(OWNER);

        // execute emergency withdrawal
        vm.startPrank(OWNER);
        IERC20(OSQTH).approve(address(shutdownEmergencyWithdraw), wPowerPerpToProvide);
        shutdownEmergencyWithdraw.shutdownEmergencyWithdraw();
        vm.stopPrank();

        // verify the results
        uint256 finalOwnerWethBalance = IERC20(WETH).balanceOf(OWNER);
        uint256 finalZenBullCrabBalance = ZenBullStrategy(ZEN_BULL).getCrabBalance();
        uint256 finalZenBullCrabBalanceFromCrab = IERC20(CRAB).balanceOf(address(ZEN_BULL));
        uint256 finalOwnerWPowerPerpBalance = IERC20(OSQTH).balanceOf(OWNER);

        // check that ETH was received by deployer
        assertEq(
            finalOwnerWethBalance,
            initialOwnerWethBalance + wethToCaller,
            "Owner should have received correct WETH"
        );

        // check that contract has correct eth balance
        assertEq(
            IERC20(WETH).balanceOf(address(shutdownEmergencyWithdraw)),
            wethToReceive - wethToCaller,
            "ShutdownEmergencyWithdraw should have correct WETH balance"
        );
        assertApproxEqRel(
            IERC20(WETH).balanceOf(address(shutdownEmergencyWithdraw)),
            wethToCaller,
            7e16,
            "The value of WETH should be close to 50% / 50%, within 7%"
        );
        // check that Crab balance was reduced and wpowerperp was provided correctly
        assertEq(finalZenBullCrabBalance, 0, "All Crab should have been redeemed");
        assertEq(finalZenBullCrabBalanceFromCrab, 0, "All Crab should have been redeemed");
        assertEq(
            finalOwnerWPowerPerpBalance,
            initialOwnerWPowerPerpBalance - wPowerPerpToProvide,
            "Owner should have provided correct WPowerPerp"
        );
    }

    function testClaimZenBullRedemption() public {
        // get initial crab balance in zen bull strategy
        uint256 initialZenBullCrabBalance = ZenBullStrategy(ZEN_BULL).getCrabBalance();

        (uint256 ethInCrab, uint256 wPowerPerpInCrab) =
            ZenBullStrategy(ZEN_BULL).getCrabVaultDetails();

        uint256 ethShare = initialZenBullCrabBalance.wdiv(IERC20(CRAB).totalSupply());
        uint256 wethToReceive = ethInCrab.wmul(ethShare);

        uint256 wPowerPerpToProvide =
            initialZenBullCrabBalance.wmul(wPowerPerpInCrab).wdiv(IERC20(CRAB).totalSupply());

        // use deal() to get some oSQTH for testing
        deal(address(OSQTH), address(OWNER), wPowerPerpToProvide);

        // execute emergency withdrawal
        vm.startPrank(OWNER);
        IERC20(OSQTH).approve(address(shutdownEmergencyWithdraw), wPowerPerpToProvide);
        shutdownEmergencyWithdraw.shutdownEmergencyWithdraw();
        vm.stopPrank();

        // get initial balances before claiming
        uint256 initialOwnerWethBalance = IERC20(WETH).balanceOf(OWNER);
        uint256 initialUser1WethBalance = IERC20(WETH).balanceOf(user1);
        uint256 initialUser1ZenBullBalance = IERC20(ZEN_BULL).balanceOf(user1);
        uint256 initialUser2WethBalance = IERC20(WETH).balanceOf(user2);
        uint256 initialUser2ZenBullBalance = IERC20(ZEN_BULL).balanceOf(user2);

        assertGt(initialUser1ZenBullBalance, 0, "User1 should have some ZenBull");
        assertGt(initialUser2ZenBullBalance, 0, "User2 should have some ZenBull");

        uint256 remainingZenBullTotalSupply = IERC20(ZEN_BULL).totalSupply()
            - IZenEmergencyWithdraw(ZEN_BULL_EMERGENCY_WITHDRAW).redeemedZenBullAmountForCrabWithdrawal(
            );
        uint256 user1WethToReceive = initialUser1ZenBullBalance.wmul(
            IERC20(WETH).balanceOf(address(shutdownEmergencyWithdraw))
        ).wdiv(remainingZenBullTotalSupply);
        uint256 user2WethToReceive = initialUser2ZenBullBalance.wmul(
            IERC20(WETH).balanceOf(address(shutdownEmergencyWithdraw))
        ).wdiv(remainingZenBullTotalSupply);

        vm.startPrank(user1);
        IERC20(ZEN_BULL).approve(address(shutdownEmergencyWithdraw), initialUser1ZenBullBalance);
        shutdownEmergencyWithdraw.claimZenBullRedemption(initialUser1ZenBullBalance);
        vm.stopPrank();

        uint256 finalUser1WethBalance = IERC20(WETH).balanceOf(user1);
        uint256 finalUser1ZenBullBalance = IERC20(ZEN_BULL).balanceOf(user1);

        vm.startPrank(user2);
        IERC20(ZEN_BULL).approve(address(shutdownEmergencyWithdraw), initialUser2ZenBullBalance);
        shutdownEmergencyWithdraw.claimZenBullRedemption(initialUser2ZenBullBalance);
        vm.stopPrank();

        vm.startPrank(user3);
        IERC20(ZEN_BULL).approve(address(shutdownEmergencyWithdraw), 1e18);
        vm.expectRevert("ERC20: transfer amount exceeds balance");
        shutdownEmergencyWithdraw.claimZenBullRedemption(1e18);
        vm.stopPrank();

        uint256 finalUser2WethBalance = IERC20(WETH).balanceOf(user2);
        uint256 finalUser2ZenBullBalance = IERC20(ZEN_BULL).balanceOf(user2);
        uint256 finalOwnerWethBalance = IERC20(WETH).balanceOf(OWNER);

        //user 1
        assertEq(finalUser1ZenBullBalance, 0, "User1 should have no ZenBull left");
        assertEq(
            finalUser1WethBalance,
            initialUser1WethBalance + user1WethToReceive,
            "User1 should have received correct WETH"
        );
        //user 2
        assertEq(finalUser2ZenBullBalance, 0, "User2 should have no ZenBull left");
        assertEq(
            finalUser2WethBalance,
            initialUser2WethBalance + user2WethToReceive,
            "User2 should have received correct WETH"
        );
        //owner
        assertEq(
            finalOwnerWethBalance,
            initialOwnerWethBalance,
            "Owner should have not received any WETH"
        );
    }

    function _deployAndConfigure() internal {
        vm.startPrank(deployer);
        shutdownEmergencyWithdraw = new ShutdownEmergencyWithdraw(
            CRAB,
            ZEN_BULL,
            WETH,
            USDC,
            OSQTH,
            ETH_USDC_POOL,
            ORACLE,
            ZEN_BULL_EMERGENCY_WITHDRAW,
            CONTROLLER,
            OWNER
        );
        vm.stopPrank();

        // prank ZenBull owner to point to a new auction contract address
        vm.prank(OWNER);
        ZenBullStrategy(ZEN_BULL).setAuction(address(shutdownEmergencyWithdraw));

        assertEq(
            shutdownEmergencyWithdraw.owner(),
            OWNER,
            "ShutdownEmergencyWithdraw should have the correct owner"
        );

        vm.label(address(shutdownEmergencyWithdraw), "ShutdownWithdraw");
    }
}
