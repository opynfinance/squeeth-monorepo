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
import {FlashBull} from "../../src/FlashBull.sol";
// lib
import {VaultLib} from "squeeth-monorepo/libs/VaultLib.sol";
import {StrategyMath} from "squeeth-monorepo/strategy/base/StrategyMath.sol"; // StrategyMath licensed under AGPL-3.0-only

/**
 * @notice Ropsten fork testing
 */
contract FlashBullTestFork is Test {
    using StrategyMath for uint256;

    uint32 internal constant TWAP = 420;

    FlashBull internal flashBull;
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
        flashBull = new FlashBull(address(bullStrategy), 0x1F98431c8aD98523631AE4a59f267346ea31F984);
        usdc = controller.quoteCurrency();
        weth = controller.weth();
        eToken = IEulerMarkets(eulerMarketsModule).underlyingToEToken(weth);
        dToken = IEulerMarkets(eulerMarketsModule).underlyingToDToken(usdc);
        wPowerPerp = controller.wPowerPerp();

        user1Pk = 0xA11CE;
        user1 = vm.addr(user1Pk);

        vm.label(user1, "User 1");
        vm.label(address(bullStrategy), "BullStrategy");
        vm.label(address(flashBull), "FlashBull");
        vm.label(euler, "Euler");
        vm.label(eulerMarketsModule, "EulerMarkets");
        vm.label(usdc, "USDC");
        vm.label(weth, "WETH");

        vm.deal(user1, 100000000e18);
        // this is a crab whale, get some crab token from
        vm.prank(0x06CECFbac34101aE41C88EbC2450f8602b3d164b);
        IERC20(crabV2).transfer(user1, 100e18);
        // some WETH and USDC rich address
        vm.prank(0x57757E3D981446D585Af0D9Ae4d7DF6D64647806);
        IERC20(weth).transfer(user1, 10000e18);
    }

    function testInitialFlashDeposit() public {
        uint256 ethToCrab = 5e18;
        uint256 totalEthToBull = 25e18;
        uint24 poolFee = 3000;

        vm.startPrank(user1);
        flashBull.flashDeposit{value: totalEthToBull}(totalEthToBull, ethToCrab, poolFee);
        vm.stopPrank();

        // assertEq(bullStrategy.balanceOf(user1), crabToDeposit);
        // assertEq(IEulerDToken(dToken).balanceOf(address(bullStrategy)), usdcToBorrow);
        // assertTrue(wethToLend.sub(IEulerEToken(eToken).balanceOfUnderlying(address(bullStrategy))) <= 1);
        // assertEq(IERC20(usdc).balanceOf(user1), usdcToBorrow);
    }
}
