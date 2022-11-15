pragma solidity =0.7.6;

pragma abicoder v2;

// test dependency
import "forge-std/Test.sol";
import { console } from "forge-std/console.sol";
//interface
import { IERC20 } from "openzeppelin/token/ERC20/IERC20.sol";
import { IWETH9 } from "squeeth-monorepo/interfaces/IWETH9.sol";
import { IEulerMarkets } from "../../src/interface/IEulerMarkets.sol";
import { IEulerEToken } from "../../src/interface/IEulerEToken.sol";
// contract
import { LeverageBull } from "../../src/LeverageBull.sol";
import { Controller } from "squeeth-monorepo/core/Controller.sol";
// lib
import { VaultLib } from "squeeth-monorepo/libs/VaultLib.sol";
import { StrategyMath } from "squeeth-monorepo/strategy/base/StrategyMath.sol"; // StrategyMath licensed under AGPL-3.0-only
import { UniOracle } from "../../src/UniOracle.sol";

/**
 * @notice Ropsten fork testing
 */
contract LeverageBullTestFork is Test {
    using StrategyMath for uint256;

    Controller internal controller;
    LeverageBull internal leverageBull;

    uint256 internal leverageOwnerPk;
    uint256 internal deployerPk;
    uint256 internal auctionPk;

    address internal leverageOwner;
    address internal deployer;
    address internal auction;

    address internal weth;
    address internal usdc;
    address internal euler;
    address internal eulerMarketsModule;
    address internal eToken;

    function setUp() public {
        string memory FORK_URL = vm.envString("FORK_URL");
        vm.createSelectFork(FORK_URL, 15781550);

        deployerPk = 0xA11CD;
        deployer = vm.addr(deployerPk);
        leverageOwnerPk = 0xB11CD;
        leverageOwner = vm.addr(leverageOwnerPk);
        auctionPk = 0xA11CE;
        auction = vm.addr(auctionPk);

        vm.startPrank(deployer);
        euler = 0x27182842E098f60e3D576794A5bFFb0777E025d3;
        eulerMarketsModule = 0x3520d5a913427E6F0D6A83E07ccD4A4da316e4d3;
        controller = Controller(0x64187ae08781B09368e6253F9E94951243A493D5);
        leverageBull =
            new LeverageBull(leverageOwner, euler, eulerMarketsModule, address(controller));
        usdc = controller.quoteCurrency();
        weth = controller.weth();
        eToken = IEulerMarkets(eulerMarketsModule).underlyingToEToken(weth);
        vm.stopPrank();

        vm.prank(leverageOwner);
        leverageBull.setAuction(auction);

        vm.label(auction, "Auction");
        vm.label(address(leverageBull), "LeverageBull");
        vm.label(euler, "Euler");
        vm.label(eulerMarketsModule, "EulerMarkets");
        vm.label(usdc, "USDC");
        vm.label(weth, "WETH");
    }

    function testFuzzingDepositAndWithdrawFullBalanceOfUnderlying(uint256 _wethToDeposit) public {
        _wethToDeposit = bound(_wethToDeposit, 1e18, 100000000e18);

        vm.deal(auction, _wethToDeposit);

        vm.startPrank(auction);
        // deposit first WETH in euler
        IWETH9(weth).deposit{value: _wethToDeposit}();
        IWETH9(weth).approve(address(leverageBull), _wethToDeposit);
        leverageBull.depositAndBorrowFromLeverage(_wethToDeposit, 0);
        vm.stopPrank();

        vm.prank(address(leverageBull));
        IEulerMarkets(eulerMarketsModule).enterMarket(0, weth);

        uint256 balanceOfUnderlying =
            IEulerEToken(eToken).balanceOfUnderlying(address(leverageBull));
        uint256 wethBalanceBefore = IERC20(weth).balanceOf(auction);

        // balanceOfUnderlying is rounded down after deposit, 2wei delta sometimes
        assertApproxEqAbs(balanceOfUnderlying, _wethToDeposit, 2);

        vm.prank(auction);
        leverageBull.auctionRepayAndWithdrawFromLeverage(0, balanceOfUnderlying);

        uint256 wethBalanceAfter = IERC20(weth).balanceOf(auction);
        uint256 eTokenBalanceAfter = IERC20(eToken).balanceOf(address(leverageBull));

        assertEq(eTokenBalanceAfter, 0);
        assertEq(wethBalanceAfter.sub(wethBalanceBefore), balanceOfUnderlying);
    }

    function testFuzzingDepositAndWithdrawPartialBalanceOfUnderlying(
        uint256 _wethToDeposit,
        uint256 _percentage
    ) public {
        _wethToDeposit = bound(_wethToDeposit, 1e18, 100000000e18);
        _percentage = bound(_percentage, 0, 100);

        vm.deal(auction, _wethToDeposit);

        vm.startPrank(auction);
        // deposit first WETH in euler
        IWETH9(weth).deposit{value: _wethToDeposit}();
        IWETH9(weth).approve(address(leverageBull), _wethToDeposit);
        leverageBull.depositAndBorrowFromLeverage(_wethToDeposit, 0);
        vm.stopPrank();

        vm.prank(address(leverageBull));
        IEulerMarkets(eulerMarketsModule).enterMarket(0, weth);

        uint256 balanceOfUnderlying =
            IEulerEToken(eToken).balanceOfUnderlying(address(leverageBull));
        uint256 wethBalanceBefore = IERC20(weth).balanceOf(auction);
        uint256 balanceOfUnderlyingToWithdraw = balanceOfUnderlying.mul(_percentage).div(100);

        // balanceOfUnderlying is rounded down after deposit, 2wei delta sometimes
        assertApproxEqAbs(balanceOfUnderlying, _wethToDeposit, 2);

        vm.prank(auction);
        leverageBull.auctionRepayAndWithdrawFromLeverage(0, balanceOfUnderlyingToWithdraw);

        uint256 wethBalanceAfter = IERC20(weth).balanceOf(auction);

        assertEq(wethBalanceAfter.sub(wethBalanceBefore), balanceOfUnderlyingToWithdraw);
    }
}
