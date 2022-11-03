pragma solidity =0.7.6;

pragma abicoder v2;

// test dependency
import "forge-std/Test.sol";
import {console} from "forge-std/console.sol";
//interface
import {IERC20} from "openzeppelin/token/ERC20/IERC20.sol";
import {IUniswapV3Factory} from "v3-core/interfaces/IUniswapV3Factory.sol";
import {IUniswapV3Pool} from "v3-core/interfaces/IUniswapV3Pool.sol";
// contract
import {MockErc20} from "squeeth-monorepo/mocks/MockErc20.sol";
import {UniswapV3Factory} from "v3-core/UniswapV3Factory.sol";
import {UniswapV3Pool} from "v3-core/UniswapV3Pool.sol";
import {NonfungiblePositionManager} from "v3-periphery/NonfungiblePositionManager.sol";
import {ShortPowerPerp} from "squeeth-monorepo/core/ShortPowerPerp.sol";
import {WETH9Mock} from "./mock/Weth9Mock.t.sol";
import {EulerMarketsMock} from "./mock/EulerMarketsMock.t.sol";
import {EulerEtokenMock} from "./mock/EulerEtokenMock.t.sol";
import {EulerDtokenMock} from "./mock/EulerDtokenMock.t.sol";
import {ControllerMock} from "./mock/ControllerMock.t.sol";
import {BullStrategy} from "../../src/BullStrategy.sol";

// lib
import {VaultLib} from "squeeth-monorepo/libs/VaultLib.sol";
import {StrategyMath} from "squeeth-monorepo/strategy/base/StrategyMath.sol"; // StrategyMath licensed under AGPL-3.0-only
import {Address} from "openzeppelin/utils/Address.sol";

contract BullStrategyTest is Test {
    using StrategyMath for uint256;
    using Address for address payable;

    EulerMarketsMock internal eulerMarket;
    EulerEtokenMock internal eToken;
    EulerDtokenMock internal dToken;
    BullStrategy internal bullStrategy;
    NonfungiblePositionManager internal uniNonFungibleManager;
    ControllerMock internal controller;
    ShortPowerPerp internal shortPowerPerp;
    WETH9Mock internal weth;
    MockErc20 internal usdc;

    address internal uniFactory;
    address internal ethWPowerPerpPool;
    address internal ethUsdcPool;

    uint256 internal deployerPk;
    uint256 internal user1Pk;
    uint256 internal randomPk;
    address internal deployer;
    address internal user1;
    address internal random;

    function setUp() public {
        deployerPk = 0xA11CD;
        deployer = vm.addr(deployerPk);

        vm.startPrank(deployer);
        usdc = new MockErc20("USDC", "USDC", 6);
        weth = new WETH9Mock();
        eulerMarket = new EulerMarketsMock();
        eToken = new EulerEtokenMock(address(weth), "eWETH", "eWETH");
        dToken = new EulerDtokenMock(address(usdc), "dUSDC", "dUSDC");

        bullStrategy =
        new BullStrategy(address(0), address(0), address(0), address(0));
        vm.stopPrank();

        user1Pk = 0xA11CE;
        user1 = vm.addr(user1Pk);

        vm.label(user1, "User 1");
        vm.label(address(bullStrategy), "BullStrategy");

        vm.deal(user1, 100000000e18);
    }

    function testRevertReceive() public {
        // vm.prank(user1);
        // payable(address(bullStrategy)).sendValue(5e18);
    }

    // TODO: move to helper later when test refactor PR is merged
    function _deployUniswap() internal {
        uniFactory = address(new UniswapV3Factory());
        uniNonFungibleManager = new NonfungiblePositionManager(uniFactory, address(weth), address(0));
    }

    function sqrt(uint256 x) internal pure returns (uint256){
       uint256 n = x / 2;
       uint256 lstX = 0;
       while (n != lstX){
           lstX = n;
           n = (n + x/n) / 2; 
       }
       return n;
   }

}