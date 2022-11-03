pragma solidity =0.7.6;

pragma abicoder v2;

// test dependency
import "forge-std/Test.sol";
import {console} from "forge-std/console.sol";
//interface
import {IERC20} from "openzeppelin/token/ERC20/IERC20.sol";
// contract
import {MockErc20} from "squeeth-monorepo/mocks/MockErc20.sol";
import {WETH9Mock} from "squeeth-monorepo/mocks/Weth9Mock.t.sol";
import {EulerMarketsMock} from "./mock/EulerMarketsMock.t.sol";
import {EulerEtokenMock} from "./mock/EulerEtokenMock.t.sol";
import {EulerDtokenMock} from "./mock/EulerDtokenMock.t.sol";
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
    EulerEtokenMock internal dToken;
    BullStrategy internal bullStrategy;

    WETH9Mock internal weth;
    MockErc20 internal usdc;

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
        eToken = new EulerEtokenMock(address(weth));
        dToken = new EulerDtokenMock(address(usdc));

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
        vm.prank(user1);
        payable(address(bullStrategy)).sendValue(5e18);
    }
}