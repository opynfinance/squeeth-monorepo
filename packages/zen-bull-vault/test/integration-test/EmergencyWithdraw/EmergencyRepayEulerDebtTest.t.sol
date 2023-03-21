pragma solidity =0.7.6;
pragma abicoder v2;

// test dependency
import "forge-std/Test.sol";
import { console } from "forge-std/console.sol";

import { IERC20 } from "openzeppelin/token/ERC20/IERC20.sol";
import { IEulerEToken } from "../../../src/interface/IEulerEToken.sol";
import { IEulerDToken } from "../../../src/interface/IEulerDToken.sol";
import { Quoter } from "v3-periphery/lens/Quoter.sol";
import { EmergencyWithdraw } from "../../../src/EmergencyWithdraw.sol";
import { ZenBullStrategy } from "../../../src/ZenBullStrategy.sol";
import { UniOracle } from "../../../src/UniOracle.sol";
import { StrategyMath } from "squeeth-monorepo/strategy/base/StrategyMath.sol";

contract EmergencyRepayEulerDebtTest is Test {
    using StrategyMath for uint256;

    uint256 internal constant ONE = 1e18;

    address payable public constant ZEN_BULL = 0xb46Fb07b0c80DBC3F97cae3BFe168AcaD46dF507;
    address public constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address public constant CRAB = 0x3B960E47784150F5a63777201ee2B15253D713e8;
    address public constant UNI_FACTORY = 0x1F98431c8aD98523631AE4a59f267346ea31F984;
    address public constant WPOWERPERP = 0xf1B99e3E573A1a9C5E6B2Ce818b617F0E664E86B;
    address public constant QUOTER = 0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6;
    address public constant ETH_USDC_POOL = 0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8;
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
        vm.createSelectFork(FORK_URL, 16817896);

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
    }

    function testEmergencyRepayEulerDebt() public {
        uint256 maxEthForUsdc =
            (Quoter(QUOTER).quoteExactOutputSingle(WETH, USDC, 3000, 1e6, 0)).wmul((ONE.add(1e15)));
        uint256 emergencyContractEthBalanceBefore = address(emergencyWithdraw).balance;
        uint256 zenBullDebtBefore = IEulerDToken(D_TOKEN).balanceOf(ZEN_BULL);
        uint256 zenBullCollateralBefore = IEulerEToken(E_TOKEN).balanceOfUnderlying(ZEN_BULL);
        uint256 ratio = 2e17;
        uint256 wethToWithdraw = ratio.wmul(IEulerEToken(E_TOKEN).balanceOfUnderlying(ZEN_BULL));
        uint256 usdcToRepay = ratio.wmul(IEulerDToken(D_TOKEN).balanceOf(ZEN_BULL));
        uint256 ethToRepayForFlashswap =
            Quoter(QUOTER).quoteExactOutputSingle(WETH, USDC, 3000, usdcToRepay, 0);

        vm.startPrank(user1);
        emergencyWithdraw.emergencyRepayEulerDebt(ratio, maxEthForUsdc, 3000);
        vm.stopPrank();

        uint256 emergencyContractEthBalanceAfter = address(emergencyWithdraw).balance;
        uint256 zenBullDebtAfter = IEulerDToken(D_TOKEN).balanceOf(ZEN_BULL);
        uint256 zenBullCollateralAfter = IEulerEToken(E_TOKEN).balanceOfUnderlying(ZEN_BULL);

        assertEq(zenBullDebtBefore.sub(usdcToRepay), zenBullDebtAfter);
        assertApproxEqRel(zenBullCollateralBefore.sub(wethToWithdraw), zenBullCollateralAfter, 1);
        assertEq(
            emergencyContractEthBalanceBefore.add(wethToWithdraw.sub(ethToRepayForFlashswap)),
            emergencyContractEthBalanceAfter
        );
    }

    function testMultipleEmergencyRepayEulerDebt() public {
        uint256 totalEthInContract;

        uint256 ratio = 1e17;
        while (IEulerDToken(D_TOKEN).balanceOf(ZEN_BULL) > 0) {
            if (ratio > 1e18) ratio = 1e18;

            uint256 maxEthForUsdc = 
                (Quoter(QUOTER).quoteExactOutputSingle(WETH, USDC, 3000, 1e6, 0)).wmul((ONE.add(1e15)));
            uint256 emergencyContractEthBalanceBefore = address(emergencyWithdraw).balance;
            uint256 zenBullDebtBefore = IEulerDToken(D_TOKEN).balanceOf(ZEN_BULL);
            uint256 zenBullCollateralBefore = IEulerEToken(E_TOKEN).balanceOfUnderlying(ZEN_BULL);
            uint256 wethToWithdraw = ratio.wmul(IEulerEToken(E_TOKEN).balanceOfUnderlying(ZEN_BULL));
            if (wethToWithdraw > emergencyWithdraw.MAX_WETH_PER_DEBT_REPAY()) {
                ratio = ratio / 2;
                wethToWithdraw = ratio.wmul(IEulerEToken(E_TOKEN).balanceOfUnderlying(ZEN_BULL));
            }
            uint256 usdcToRepay = ratio.wmul(IEulerDToken(D_TOKEN).balanceOf(ZEN_BULL));
            // console.log("usdcToRepay", usdcToRepay);
            uint256 ethToRepayForFlashswap =
                Quoter(QUOTER).quoteExactOutputSingle(WETH, USDC, 3000, usdcToRepay, 0);
            totalEthInContract = totalEthInContract.add(wethToWithdraw.sub(ethToRepayForFlashswap));

            vm.startPrank(user1);
            emergencyWithdraw.emergencyRepayEulerDebt(ratio, maxEthForUsdc, 3000);
            vm.stopPrank();

            uint256 emergencyContractEthBalanceAfter = address(emergencyWithdraw).balance;
            uint256 zenBullDebtAfter = IEulerDToken(D_TOKEN).balanceOf(ZEN_BULL);
            uint256 zenBullCollateralAfter = IEulerEToken(E_TOKEN).balanceOfUnderlying(ZEN_BULL);

            assertEq(zenBullDebtBefore.sub(usdcToRepay), zenBullDebtAfter);
            assertApproxEqRel(
                zenBullCollateralBefore.sub(wethToWithdraw), zenBullCollateralAfter, 1000000000
            );
            assertEq(
                emergencyContractEthBalanceBefore.add(wethToWithdraw.sub(ethToRepayForFlashswap)),
                emergencyContractEthBalanceAfter
            );

            ratio = ratio.mul(2);
        }

        assertEq(IEulerDToken(D_TOKEN).balanceOf(ZEN_BULL), 0);
        assertEq(IEulerEToken(E_TOKEN).balanceOfUnderlying(ZEN_BULL), 0);
        assertEq(address(emergencyWithdraw).balance, totalEthInContract);
    }

    function testEmergencyRepayEulerDebtWhenAmountInGreaterThanMax() public {
        uint256 maxEthForUsdc =
            Quoter(QUOTER).quoteExactOutputSingle(WETH, USDC, 3000, 1e6, 0);
        vm.startPrank(user1);
        vm.expectRevert(bytes("amount in greater than max"));
        emergencyWithdraw.emergencyRepayEulerDebt(2e17, maxEthForUsdc, 3000);
        vm.stopPrank();
    }

    function testEmergencyRepayEulerDebtWhenWethToWithdrawGreaterThanMax() public {
        uint256 maxEthForUsdc =
            (Quoter(QUOTER).quoteExactOutputSingle(WETH, USDC, 3000, 1e6, 0)).wmul((ONE.add(1e16)));

        vm.startPrank(user1);
        vm.expectRevert(bytes("WETH to withdraw is greater than max per repay"));
        emergencyWithdraw.emergencyRepayEulerDebt(1e18, maxEthForUsdc, 3000);
        vm.stopPrank();
    }
}