pragma solidity =0.7.6;

pragma abicoder v2;

// test dependency
import "forge-std/Test.sol";
import {console} from "forge-std/console.sol";
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
import {AuctionBull} from "../../src/AuctionBull.sol";
// lib
import {VaultLib} from "squeeth-monorepo/libs/VaultLib.sol";
import {StrategyMath} from "squeeth-monorepo/strategy/base/StrategyMath.sol"; // StrategyMath licensed under AGPL-3.0-only
import {UniOracle} from "../../src/UniOracle.sol";

/**
 * @notice Ropsten fork testing
 */
contract AuctionBullTestFork is Test {
    using StrategyMath for uint256;

    uint32 internal constant TWAP = 420;

    BullStrategy internal bullStrategy;
    AuctionBull internal auctionBull;
    CrabStrategyV2 internal crabV2;
    Controller internal controller;

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
    uint256 internal deployerPk;
    address internal deployer;
    
    function setUp() public {
        string memory FORK_URL = vm.envString("FORK_URL");
        vm.createSelectFork(FORK_URL, 15781550);

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
        auctionBull = new AuctionBull(
            owner,
            owner,
            address(bullStrategy),
            0x1F98431c8aD98523631AE4a59f267346ea31F984
        );
        usdc = controller.quoteCurrency();
        weth = controller.weth();
        eToken = IEulerMarkets(eulerMarketsModule).underlyingToEToken(weth);
        dToken = IEulerMarkets(eulerMarketsModule).underlyingToDToken(usdc);
        wPowerPerp = controller.wPowerPerp();
        vm.stopPrank();

        vm.startPrank(owner);
        bullStrategy.setAuction(address(auctionBull));
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
        // this is a crab whale, get some crab token from
        vm.prank(0x06CECFbac34101aE41C88EbC2450f8602b3d164b);
        IERC20(crabV2).transfer(user1, 100e18);
        // some WETH and USDC rich address
        vm.prank(0x57757E3D981446D585Af0D9Ae4d7DF6D64647806);
        IERC20(weth).transfer(user1, 10000e18);

        // Put some money in bull to start with
        uint256 crabToDeposit = 10e18;
        uint256 bullCrabBalanceBefore = bullStrategy.getCrabBalance();

        vm.startPrank(user1);
        (uint256 wethToLend, uint256 usdcToBorrow) = _deposit(crabToDeposit);
        vm.stopPrank();

        uint256 bullCrabBalanceAfter = bullStrategy.getCrabBalance();

        assertEq(
            bullCrabBalanceAfter.sub(crabToDeposit),
            bullCrabBalanceBefore
        );
        assertEq(bullStrategy.balanceOf(user1), crabToDeposit);
        assertEq(
            IEulerDToken(dToken).balanceOf(address(bullStrategy)),
            usdcToBorrow
        );
        (
            wethToLend.sub(
                IEulerEToken(eToken).balanceOfUnderlying(address(bullStrategy))
            ) <= 1
        );
        assertEq(IERC20(usdc).balanceOf(user1), usdcToBorrow);
    }

    function testLeverageRebalanceSell() public {
        uint256 bullCrabBalanceBefore = bullStrategy.getCrabBalance();
        uint256 usdcDebtBefore = IEulerDToken(dToken).balanceOf(
            address(bullStrategy)
        );
        uint256 ethBalanceBefore = IEulerEToken(eToken).balanceOfUnderlying(
            address(bullStrategy)
        );
        // Should not experience more than $5 slippage
        uint256 usdcSlippageTolerance = 5e6; 

        uint256 ethToSell = 1e18;
        uint256 ethUsdPrice = UniOracle._getTwap(
            controller.ethQuoteCurrencyPool(),
            controller.weth(),
            controller.quoteCurrency(),
            TWAP,
            false
        );
        uint256 usdcToBuy = ethToSell.wmul(ethUsdPrice).div(1e12);
        auctionBull.leverageRebalance(true, ethToSell, 0, 3000);

        uint256 bullCrabBalanceAfter = bullStrategy.getCrabBalance();
        uint256 usdcDebtAfter = IEulerDToken(dToken).balanceOf(
            address(bullStrategy)
        );
        uint256 ethBalanceAfter = IEulerEToken(eToken).balanceOfUnderlying(
            address(bullStrategy)
        );

        console.log("usdcDebtAfter", usdcDebtAfter);
        console.log("ethBalanceAfter", ethBalanceAfter);

        // The auction contract should hold no remaining funds
        assertEq(
            IERC20(usdc).balanceOf(address(auctionBull)),
            0,
            "USDC balance of auction contract should be 0"
        );
        assertEq(
            IERC20(weth).balanceOf(address(auctionBull)),
            0,
            "WETH balance of auction contract should be 0"
        );
        
        assertEq(
            bullCrabBalanceBefore,
            bullCrabBalanceAfter,
            "Bull's crab balance should not change on leverage rebalance"
        );

        assertApproxEqAbs(
            ethBalanceBefore.sub(ethToSell),
            ethBalanceAfter,
            1,
            "Bull ETH in collateral mismatch"
        );

        assertApproxEqAbs(
            usdcDebtBefore.sub(usdcToBuy),
            usdcDebtAfter,
            usdcSlippageTolerance,
            "Bull USDC debt mismatch"
        );
    }

    // Helper functions
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
            uint256 share = _crabToDeposit.wdiv(
                bullStrategy.getCrabBalance().add(_crabToDeposit)
            );
            wethToLend = IEulerEToken(eToken)
                .balanceOfUnderlying(address(bullStrategy))
                .wmul(share)
                .wdiv(uint256(1e18).sub(share));
            usdcToBorrow = IEulerDToken(dToken)
                .balanceOf(address(bullStrategy))
                .wmul(share)
                .wdiv(uint256(1e18).sub(share));
        }

        return (wethToLend, usdcToBorrow);
    }

    function _getCrabVaultDetails() internal view returns (uint256, uint256) {
        VaultLib.Vault memory strategyVault = IController(address(controller))
            .vaults(crabV2.vaultId());

        return (strategyVault.collateralAmount, strategyVault.shortAmount);
    }
}
