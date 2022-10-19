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
import {UniBullHelper} from "../helper/UniBullHelper.sol";
// lib
import {VaultLib} from "squeeth-monorepo/libs/VaultLib.sol";
import {StrategyMath} from "squeeth-monorepo/strategy/base/StrategyMath.sol"; // StrategyMath licensed under AGPL-3.0-only

/**
 * @notice Ropsten fork testing
 */
contract BullStrategyTestFork is Test {
    using StrategyMath for uint256;

    uint32 internal constant TWAP = 420;

    BullStrategy internal bullStrategy;
    CrabStrategyV2 internal crabV2;
    Controller internal controller;
    UniBullHelper internal uniBullHelper;

    uint256 internal user1Pk;
    address internal user1;
    address internal weth;
    address internal usdc;
    address internal euler;
    address internal eulerMarketsModule;
    address internal eToken;
    address internal dToken;
    address internal wPowerPerp;

    function setUp() public {
        string memory FORK_URL = vm.envString("FORK_URL");
        vm.createSelectFork(FORK_URL, 15781550);

        euler = 0x27182842E098f60e3D576794A5bFFb0777E025d3;
        eulerMarketsModule = 0x3520d5a913427E6F0D6A83E07ccD4A4da316e4d3;
        controller = Controller(0x64187ae08781B09368e6253F9E94951243A493D5);
        crabV2 = CrabStrategyV2(0x3B960E47784150F5a63777201ee2B15253D713e8);
        bullStrategy =
        new BullStrategy(address(crabV2), address(controller), 0x1F98431c8aD98523631AE4a59f267346ea31F984, euler, eulerMarketsModule);
        uniBullHelper = new UniBullHelper(0x1F98431c8aD98523631AE4a59f267346ea31F984);
        usdc = controller.quoteCurrency();
        weth = controller.weth();
        eToken = IEulerMarkets(eulerMarketsModule).underlyingToEToken(weth);
        dToken = IEulerMarkets(eulerMarketsModule).underlyingToDToken(usdc);
        wPowerPerp = controller.wPowerPerp();

        user1Pk = 0xA11CE;
        user1 = vm.addr(user1Pk);

        vm.label(user1, "User 1");
        vm.label(address(bullStrategy), "BullStrategy");
        vm.label(euler, "Euler");
        vm.label(eulerMarketsModule, "EulerMarkets");
        vm.label(usdc, "USDC");
        vm.label(weth, "WETH");

        vm.deal(user1, 100e18);
        // this is a crab whale, get some crab token from
        vm.prank(0x06CECFbac34101aE41C88EbC2450f8602b3d164b);
        IERC20(crabV2).transfer(user1, 100e18);
        // some WETH and USDC rich address
        vm.prank(0x57757E3D981446D585Af0D9Ae4d7DF6D64647806);
        IERC20(weth).transfer(user1, 10000e18);
    }

    function testInitialDeposit() public {
        uint256 crabToDeposit = 10e18;
        uint256 ethUsdPrice = uniBullHelper.getTwap(
            controller.ethQuoteCurrencyPool(), controller.weth(), controller.quoteCurrency(), TWAP, false
        );
        uint256 squeethEthPrice =
            uniBullHelper.getTwap(controller.wPowerPerpPool(), controller.wPowerPerp(), controller.weth(), TWAP, false);
        (uint256 ethInCrab, uint256 squeethInCrab) = _getCrabVaultDetails();
        uint256 crabUsdPrice =
            (ethInCrab.wmul(ethUsdPrice).sub(squeethInCrab.wmul(squeethEthPrice).wmul(ethUsdPrice))).wdiv(crabV2.totalSupply());
        uint256 wethToLend;
        uint256 usdcToBorrow;
        {
            wethToLend = bullStrategy.TARGET_CR().wmul(crabToDeposit).wmul(crabUsdPrice).wdiv(ethUsdPrice);
            usdcToBorrow = wethToLend.wmul(ethUsdPrice).wdiv(bullStrategy.TARGET_CR()).div(1e12);
        }

        vm.startPrank(user1);
        IERC20(crabV2).approve(address(bullStrategy), crabToDeposit);
        bullStrategy.deposit{value: wethToLend}(crabToDeposit);
        vm.stopPrank();

        uint256 bullDelta = IEulerEToken(eToken).balanceOf(address(bullStrategy)).wmul(ethUsdPrice).wdiv(
            crabToDeposit.wmul(crabUsdPrice).add(
                IEulerEToken(eToken).balanceOf(address(bullStrategy)).wmul(ethUsdPrice)
            ).sub(usdcToBorrow)
        );

        console.log("wethToLend", wethToLend);
        console.log("ethInCrab", ethInCrab);
        console.log("squeethInCrab", squeethInCrab);
        console.log("bullDelta", bullDelta);
        console.log("ethUsdPrice", ethUsdPrice);
        console.log("squeethEthPrice", squeethEthPrice);
        console.log("crabUsdPrice", crabUsdPrice);
        console.log("crabV2.totalSupply()", crabV2.totalSupply());

        assertEq(bullStrategy.balanceOf(user1), crabToDeposit);
        assertEq(IEulerDToken(dToken).balanceOf(address(bullStrategy)), usdcToBorrow);
        assertEq(IERC20(usdc).balanceOf(user1), usdcToBorrow);

    }

    function _getCrabVaultDetails() internal view returns (uint256, uint256) {
        VaultLib.Vault memory strategyVault = IController(address(controller)).vaults(crabV2.vaultId());

        return (strategyVault.collateralAmount, strategyVault.shortAmount);
    }
}
