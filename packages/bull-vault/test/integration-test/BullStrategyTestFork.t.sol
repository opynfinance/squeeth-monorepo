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
// contract
import { TestUtil } from "../util/TestUtil.t.sol";
import { BullStrategy } from "../../src/BullStrategy.sol";
import { CrabStrategyV2 } from "squeeth-monorepo/strategy/CrabStrategyV2.sol";
import { Controller } from "squeeth-monorepo/core/Controller.sol";
// lib
import { VaultLib } from "squeeth-monorepo/libs/VaultLib.sol";
import { StrategyMath } from "squeeth-monorepo/strategy/base/StrategyMath.sol"; // StrategyMath licensed under AGPL-3.0-only
import { UniOracle } from "../../src/UniOracle.sol";

/**
 * @notice Ropsten fork testing
 */
contract BullStrategyTestFork is Test {
    using StrategyMath for uint256;

    TestUtil internal testUtil;
    BullStrategy internal bullStrategy;
    CrabStrategyV2 internal crabV2;
    Controller internal controller;

    uint256 internal bullOwnerPk;
    uint256 internal deployerPk;
    uint256 internal user1Pk;
    uint256 internal ownerPk;
    address internal user1;
    address internal owner;
    address internal weth;
    address internal usdc;
    address internal euler;
    address internal eulerMarketsModule;
    address internal eToken;
    address internal dToken;
    address internal wPowerPerp;
    address internal deployer;
    address internal bullOwner;

    uint256 internal cap;

    function setUp() public {
        string memory FORK_URL = vm.envString("FORK_URL");
        vm.createSelectFork(FORK_URL, 15781550);

        deployerPk = 0xA11CD;
        deployer = vm.addr(deployerPk);
        bullOwnerPk = 0xB11CD;
        bullOwner = vm.addr(bullOwnerPk);

        vm.startPrank(deployer);
        euler = 0x27182842E098f60e3D576794A5bFFb0777E025d3;
        eulerMarketsModule = 0x3520d5a913427E6F0D6A83E07ccD4A4da316e4d3;
        controller = Controller(0x64187ae08781B09368e6253F9E94951243A493D5);
        crabV2 = CrabStrategyV2(0x3B960E47784150F5a63777201ee2B15253D713e8);
        bullStrategy =
        new BullStrategy(bullOwner, address(crabV2), address(controller), euler, eulerMarketsModule);
        usdc = controller.quoteCurrency();
        weth = controller.weth();
        eToken = IEulerMarkets(eulerMarketsModule).underlyingToEToken(weth);
        dToken = IEulerMarkets(eulerMarketsModule).underlyingToDToken(usdc);
        wPowerPerp = controller.wPowerPerp();
        testUtil =
        new TestUtil(address(bullStrategy), address (controller), eToken, dToken, address(crabV2));
        vm.stopPrank();

        cap = 100000e18;
        vm.prank(bullOwner);
        bullStrategy.setCap(cap);

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
        // this is a crab whale, get some crab token from
        vm.prank(0x06CECFbac34101aE41C88EbC2450f8602b3d164b);
        IERC20(crabV2).transfer(user1, 100e18);
        // some WETH and USDC rich address
        vm.prank(0x57757E3D981446D585Af0D9Ae4d7DF6D64647806);
        IERC20(weth).transfer(user1, 10000e18);
    }

    function testSetUp() public {
        assertTrue(bullStrategy.owner() == bullOwner);
        assertTrue(bullStrategy.strategyCap() == cap);
    }

    function testSetCapWhenCallerNotOwner() public {
        cap = 1000000e18;
        vm.startPrank(deployer);
        vm.expectRevert(bytes("Ownable: caller is not the owner"));
        bullStrategy.setCap(10e18);
    }

    function testInitialDeposit() public {
        uint256 crabToDeposit = 10e18;
        uint256 bullCrabBalanceBefore = bullStrategy.getCrabBalance();

        vm.startPrank(user1);
        (uint256 wethToLend, uint256 usdcToBorrow) = _deposit(crabToDeposit);
        vm.stopPrank();

        uint256 bullCrabBalanceAfter = bullStrategy.getCrabBalance();

        assertEq(bullCrabBalanceAfter.sub(crabToDeposit), bullCrabBalanceBefore);
        assertEq(bullStrategy.balanceOf(user1), crabToDeposit);
        assertEq(IEulerDToken(dToken).balanceOf(address(bullStrategy)), usdcToBorrow);
        assertTrue(
            wethToLend.sub(IEulerEToken(eToken).balanceOfUnderlying(address(bullStrategy))) <= 1
        );
        assertEq(IERC20(usdc).balanceOf(user1), usdcToBorrow);
    }

    function testSecondDeposit() public {
        uint256 crabToDepositInitially = 10e18;
        uint256 bullCrabBalanceBefore = bullStrategy.getCrabBalance();

        vm.startPrank(user1);
        (uint256 wethToLend, uint256 usdcToBorrow) = _deposit(crabToDepositInitially);
        vm.stopPrank();

        uint256 bullCrabBalanceAfter = bullStrategy.getCrabBalance();

        assertEq(bullCrabBalanceAfter.sub(crabToDepositInitially), bullCrabBalanceBefore);
        assertEq(bullStrategy.balanceOf(user1), crabToDepositInitially);
        assertEq(IEulerDToken(dToken).balanceOf(address(bullStrategy)), usdcToBorrow);
        assertTrue(
            wethToLend.sub(IEulerEToken(eToken).balanceOfUnderlying(address(bullStrategy))) <= 1
        );
        assertEq(IERC20(usdc).balanceOf(user1), usdcToBorrow);

        bullCrabBalanceBefore = bullStrategy.getCrabBalance();
        uint256 userUsdcBalanceBefore = IERC20(usdc).balanceOf(user1);
        uint256 userBullBalanceBefore = bullStrategy.balanceOf(user1);
        uint256 crabToDepositSecond = 7e18;
        uint256 bullToMint = testUtil.calcBullToMint(crabToDepositSecond);
        vm.startPrank(user1);
        (uint256 wethToLendSecond, uint256 usdcToBorrowSecond) = _deposit(crabToDepositSecond);
        vm.stopPrank();

        bullCrabBalanceAfter = bullStrategy.getCrabBalance();

        assertEq(bullCrabBalanceAfter.sub(crabToDepositSecond), bullCrabBalanceBefore);
        assertEq(bullStrategy.balanceOf(user1).sub(userBullBalanceBefore), bullToMint);
        assertEq(
            IEulerDToken(dToken).balanceOf(address(bullStrategy)).sub(usdcToBorrow),
            usdcToBorrowSecond
        );
        assertTrue(
            wethToLendSecond.sub(
                IEulerEToken(eToken).balanceOfUnderlying(address(bullStrategy)).sub(wethToLend)
            ) <= 1
        );
        assertEq(IERC20(usdc).balanceOf(user1).sub(usdcToBorrowSecond), userUsdcBalanceBefore);
    }

    function testWithdraw() public {
        uint256 crabToDeposit = 15e18;
        uint256 bullToMint = testUtil.calcBullToMint(crabToDeposit);

        // crabby deposit into bull
        vm.startPrank(user1);
        _deposit(crabToDeposit);
        vm.stopPrank();

        (uint256 wPowerPerpToRedeem, uint256 crabToRedeem) =
            _calcWPowerPerpAndCrabNeededForWithdraw(bullToMint);
        uint256 usdcToRepay = _calcUsdcNeededForWithdraw(bullToMint);
        uint256 wethToWithdraw = testUtil.calcWethToWithdraw(bullToMint);
        // transfer some oSQTH from some squeether
        vm.prank(0x56178a0d5F301bAf6CF3e1Cd53d9863437345Bf9);
        IERC20(wPowerPerp).transfer(user1, wPowerPerpToRedeem);

        uint256 userBullBalanceBefore = bullStrategy.balanceOf(user1);
        uint256 ethInLendingBefore = IEulerEToken(eToken).balanceOfUnderlying(address(bullStrategy));
        uint256 usdcBorrowedBefore = IEulerDToken(dToken).balanceOf(address(bullStrategy));
        uint256 userUsdcBalanceBefore = IERC20(usdc).balanceOf(user1);
        uint256 userWPowerPerpBalanceBefore = IERC20(wPowerPerp).balanceOf(user1);
        uint256 crabBalanceBefore = crabV2.balanceOf(address(bullStrategy));

        vm.startPrank(user1);
        IERC20(usdc).approve(address(bullStrategy), usdcToRepay);
        IERC20(wPowerPerp).approve(address(bullStrategy), wPowerPerpToRedeem);
        bullStrategy.withdraw(bullToMint);
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
            userUsdcBalanceBefore.sub(usdcToRepay),
            IERC20(usdc).balanceOf(user1),
            "User1 USDC balance mismatch"
        );
        assertEq(
            userBullBalanceBefore.sub(bullToMint),
            bullStrategy.balanceOf(user1),
            "User1 bull balance mismatch"
        );
        assertEq(
            userWPowerPerpBalanceBefore.sub(wPowerPerpToRedeem),
            IERC20(wPowerPerp).balanceOf(user1),
            "User1 oSQTH balance mismatch"
        );
        assertEq(
            crabBalanceBefore.sub(crabToRedeem),
            crabV2.balanceOf(address(bullStrategy)),
            "Bull ccrab balance mismatch"
        );
    }

    function testReceiveFromNonWethOrCrab() public {
        vm.startPrank(user1);
        (bool status, bytes memory returndata) = address(bullStrategy).call{value: 5e18}("");
        vm.stopPrank();
        assertFalse(status);
        assertEq(_getRevertMsg(returndata), "BS0");
    }

    function testSendLessEthComparedToCrabAmount() public {
        uint256 crabToDeposit = 10e18;

        vm.startPrank(user1);
        (uint256 wethToLend,) = testUtil.calcCollateralAndBorrowAmount(crabToDeposit);
        IERC20(crabV2).approve(address(bullStrategy), crabToDeposit);
        vm.expectRevert(bytes("LB0"));
        bullStrategy.deposit{value: wethToLend.wdiv(2e18)}(crabToDeposit);
        vm.stopPrank();
    }

    function testSendTooMuchCrabRelativeToEth() public {
        uint256 crabToDeposit = 10e18;

        vm.startPrank(user1);
        (uint256 wethToLend,) = testUtil.calcCollateralAndBorrowAmount(crabToDeposit.wdiv(2e18));
        IERC20(crabV2).approve(address(bullStrategy), crabToDeposit);
        vm.expectRevert(bytes("LB0"));
        bullStrategy.deposit{value: wethToLend}(crabToDeposit);
        vm.stopPrank();
    }

    function testFarm() public {
        uint256 daiAmount = 10e18;
        address dai = 0x6B175474E89094C44Da98b954EedeAC495271d0F;
        vm.prank(0x57757E3D981446D585Af0D9Ae4d7DF6D64647806);
        IERC20(dai).transfer(address(bullStrategy), daiAmount);

        uint256 daiBalanceBefore = IERC20(dai).balanceOf(bullOwner);

        vm.prank(bullOwner);
        bullStrategy.farm(dai, bullOwner);

        assertEq(bullStrategy.balanceOf(user1).sub(userBullBalanceBefore), bullToMint);
        assertTrue(
            wethToLend.sub(
                IEulerEToken(eToken).balanceOfUnderlying(address(bullStrategy)).sub(
                    ethInLendingBefore
                )
            ) <= 2
        );
        assertEq(
            IEulerDToken(dToken).balanceOf(address(bullStrategy)).sub(usdcBorrowedBefore),
            usdcToBorrow
        );
        assertEq(IERC20(usdc).balanceOf(user1).sub(userUsdcBalanceBefore), usdcToBorrow);
        assertTrue(
            IEulerEToken(eToken).balanceOfUnderlying(address(bullStrategy))
                <= bullStrategy.strategyCap()
        );
    }

    function testFarmWhenCallerNotOwner() public {
        uint256 daiAmount = 10e18;
        address dai = 0x6B175474E89094C44Da98b954EedeAC495271d0F;
        vm.prank(0x57757E3D981446D585Af0D9Ae4d7DF6D64647806);
        IERC20(dai).transfer(address(bullStrategy), daiAmount);

        vm.prank(deployer);
        vm.expectRevert(bytes("Ownable: caller is not the owner"));
        bullStrategy.farm(dai, bullOwner);
    }

    function testFarmWhenAssetIsNotFarmable() public {
        vm.prank(bullOwner);
        vm.expectRevert(bytes("BS3"));
        bullStrategy.farm(usdc, bullOwner);
    }

    /**
     *
     * /************************************************************* Helper functions for testing! ********************************************************
     */
    function _deposit(uint256 _crabToDeposit) internal returns (uint256, uint256) {
        (uint256 wethToLend, uint256 usdcToBorrow) =
            testUtil.calcCollateralAndBorrowAmount(_crabToDeposit);

        IERC20(crabV2).approve(address(bullStrategy), _crabToDeposit);
        bullStrategy.deposit{value: wethToLend}(_crabToDeposit);

        return (wethToLend, usdcToBorrow);
    }

    function _calcWPowerPerpAndCrabNeededForWithdraw(uint256 _bullAmount)
        internal
        view
        returns (uint256, uint256)
    {
        uint256 share = _bullAmount.wdiv(bullStrategy.totalSupply());
        uint256 crabToRedeem = share.wmul(bullStrategy.getCrabBalance());
        uint256 crabTotalSupply = IERC20(crabV2).totalSupply();
        (, uint256 squeethInCrab) = testUtil.getCrabVaultDetails();
        return (crabToRedeem.wmul(squeethInCrab).wdiv(crabTotalSupply), crabToRedeem);
    }

    function _calcUsdcNeededForWithdraw(uint256 _bullAmount) internal view returns (uint256) {
        uint256 share = _bullAmount.wdiv(bullStrategy.totalSupply());
        return share.wmul(IEulerDToken(dToken).balanceOf(address(bullStrategy)));
    }

    function _getRevertMsg(bytes memory _returnData) internal pure returns (string memory) {
        // If the _res length is less than 68, then the transaction failed silently (without a revert message)
        if (_returnData.length < 68) return "Transaction reverted silently";

        assembly {
            // Slice the sighash.
            _returnData := add(_returnData, 0x04)
        }
        return abi.decode(_returnData, (string)); // All that remains is the revert string
    }
}
