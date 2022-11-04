pragma solidity =0.7.6;

pragma abicoder v2;

// test dependency
import "forge-std/Test.sol";
import {console} from "forge-std/console.sol";
//interface
import {ERC20} from "openzeppelin/token/ERC20/ERC20.sol";
import {IUniswapV3Factory} from "v3-core/interfaces/IUniswapV3Factory.sol";
import {IUniswapV3Pool} from "v3-core/interfaces/IUniswapV3Pool.sol";
// contract
import {MockErc20} from "squeeth-monorepo/mocks/MockErc20.sol";
import {UniswapV3Factory} from "v3-core/UniswapV3Factory.sol";
import {UniswapV3Pool} from "v3-core/UniswapV3Pool.sol";
import {NonfungiblePositionManager} from "v3-periphery/NonfungiblePositionManager.sol";
import {WETH9Mock} from "./mock/Weth9Mock.t.sol";
import {EulerMarketsMock} from "./mock/EulerMarketsMock.t.sol";
import {EulerEtokenMock} from "./mock/EulerEtokenMock.t.sol";
import {EulerDtokenMock} from "./mock/EulerDtokenMock.t.sol";
import {EulerMock} from "./mock/EulerMock.t.sol";
import {ShortPowerPerp} from "squeeth-monorepo/core/ShortPowerPerp.sol";
import {Controller} from "squeeth-monorepo/core/Controller.sol";
import {Oracle} from "squeeth-monorepo/core/Oracle.sol";
import {WPowerPerp} from "squeeth-monorepo/core/WPowerPerp.sol";
import {CrabStrategyV2} from "squeeth-monorepo/strategy/CrabStrategyV2.sol";
import {BullStrategy} from "../../src/BullStrategy.sol";

// lib
import {VaultLib} from "squeeth-monorepo/libs/VaultLib.sol";
import {StrategyMath} from "squeeth-monorepo/strategy/base/StrategyMath.sol"; // StrategyMath licensed under AGPL-3.0-only
import {Address} from "openzeppelin/utils/Address.sol";

contract BullStrategyUnitTest is Test {
    using StrategyMath for uint256;
    using Address for address payable;

    EulerMock internal euler;
    EulerMarketsMock internal eulerMarket;
    EulerEtokenMock internal eToken;
    EulerDtokenMock internal dToken;
    BullStrategy internal bullStrategy;
    NonfungiblePositionManager internal uniNonFungibleManager;
    ShortPowerPerp internal shortPowerPerp;
    WPowerPerp internal wPowerPerp;
    Controller internal controller;
    WETH9Mock internal weth;
    MockErc20 internal usdc;
    UniswapV3Factory internal uniFactory;
    CrabStrategyV2 internal crabV2;

    address internal ethWPowerPerpPool;
    address internal ethUsdcPool;

    uint256 internal timelockPk;
    uint256 internal deployerPk;
    uint256 internal user1Pk;
    uint256 internal randomPk;
    address internal deployer;
    address internal user1;
    address internal random;
    address internal timelock;

    function setUp() public {
        deployerPk = 0xA11CD;
        deployer = vm.addr(deployerPk);
        timelockPk = 0xA12CD;
        timelock = vm.addr(timelockPk);

        vm.startPrank(deployer);
        usdc = new MockErc20("USDC", "USDC", 6);
        weth = new WETH9Mock();
        eulerMarket = new EulerMarketsMock();

        (address payable _uniFactory, address payable _uniNonFungibleManager) = _deployUniswap();
        uniFactory = UniswapV3Factory(_uniFactory);
        uniNonFungibleManager = NonfungiblePositionManager(_uniNonFungibleManager);

        // the token prices below could be wrong
        ethUsdcPool = _createUniPool(address(usdc), address(weth), 3300e18, uint24(3000));
        vm.warp(block.timestamp + 1000);

        IUniswapV3Pool(ethUsdcPool).increaseObservationCardinalityNext(500);
        IUniswapV3Pool(ethUsdcPool).increaseObservationCardinalityNext(500);
        IUniswapV3Pool(ethUsdcPool).increaseObservationCardinalityNext(500);
        IUniswapV3Pool(ethUsdcPool).increaseObservationCardinalityNext(500);
        IUniswapV3Pool(ethUsdcPool).increaseObservationCardinalityNext(500);
        IUniswapV3Pool(ethUsdcPool).increaseObservationCardinalityNext(500);
        IUniswapV3Pool(ethUsdcPool).increaseObservationCardinalityNext(500);
        IUniswapV3Pool(ethUsdcPool).increaseObservationCardinalityNext(500);

        // (uint160 sqrtPriceX96,,,,,,) = IUniswapV3Pool(ethUsdcPool).slot0();
        // console.log("slot", sqrtPriceX96);

        (address _controller, , ) = _deploySqueethEcosystem(ethUsdcPool, 3300, uint24(3000));
        euler = new EulerMock();
        eToken = new EulerEtokenMock(address(euler), address(weth), "eWETH", "eWETH", 18);
        dToken = new EulerDtokenMock(address(euler), address(usdc), "dUSDC", "dUSDC", 6);
        bullStrategy =
        new BullStrategy(address(crabV2), _controller, address(euler), address(eulerMarket));
        vm.stopPrank();

        user1Pk = 0xA11CE;
        user1 = vm.addr(user1Pk);

        vm.label(user1, "User 1");
        vm.label(address(bullStrategy), "BullStrategy");
        vm.label(address(usdc), "USDC");
        vm.label(address(weth), "WETH");
        vm.label(address(uniNonFungibleManager), "UniNonFungibleManager");
        vm.label(address(uniFactory), "UniFactory");

        vm.deal(user1, 100000000e18);
    }

    // using .call() and checking status because for no reason expectRevert always pass this test even with diff error message
    // we can only use (bool status, bytes memory returndata) without expectRevert, because expectRevert mess with returndata and switch status from 0 to 1
    // therefore hard to get error message from returndata combined with expectRevert()
    function testReceive() public {
        // vm.deal(address(weth), 10e18);
        // vm.startPrank(address(weth));
        vm.startPrank(user1);
        vm.expectRevert(bytes4("BSa0"));
        (bool status, bytes memory returndata) = address(bullStrategy).call{ value: 5e18 }("");
        console.log("status", status);
        // assertFalse(!status);
        // assertEq(_getRevertMsg(returndata), "BS0");
        vm.stopPrank();
    }

    function testScenario() public {
        vm.startPrank(user1);
        vm.expectRevert(bytes("invalid input"));
        bullStrategy.forTestExpectRevert(50);
    }

    // TODO: move to helper later when test refactor PR is merged
    function _deployUniswap() internal returns (address payable, address payable) {
        address payable _uniFactory = payable(address(new UniswapV3Factory()));
        address payable _uniNonFungibleManager = payable(address(new NonfungiblePositionManager(address(uniFactory), address(weth), address(0))));

        return (_uniFactory, _uniNonFungibleManager);
    }

    function _getRevertMsg(bytes memory _returnData) internal pure returns (string memory) {
        // If the _res length is less than 68, then the transaction failed silently (without a revert message)
        if (_returnData.length < 68) return 'Transaction reverted silently';

        assembly {
            // Slice the sighash.
            _returnData := add(_returnData, 0x04)
        }
        return abi.decode(_returnData, (string)); // All that remains is the revert string
    }

    // TODO: move to helper later when test refactor PR is merged
    function _deploySqueethEcosystem(address _ethQuoteCurrencyPool, uint256 _squeethEthPrice, uint24 _poolFee) internal returns (address, address, address) {
        wPowerPerp = new WPowerPerp("oSQTH", "oSQTH");
        address _shortPowerPerp = address(new ShortPowerPerp("ShortPowerPerp", "sOSQTH"));
        address _oracle = address(new Oracle());
        address _ethWPowerPerpPool = _createUniPool(address(weth), address(wPowerPerp), _squeethEthPrice, _poolFee);
        vm.warp(block.timestamp + 1000);
        IUniswapV3Pool(_ethWPowerPerpPool).increaseObservationCardinalityNext(500);
        IUniswapV3Pool(_ethWPowerPerpPool).increaseObservationCardinalityNext(500);
        IUniswapV3Pool(_ethWPowerPerpPool).increaseObservationCardinalityNext(500);
        IUniswapV3Pool(_ethWPowerPerpPool).increaseObservationCardinalityNext(500);
        IUniswapV3Pool(_ethWPowerPerpPool).increaseObservationCardinalityNext(500);
        IUniswapV3Pool(_ethWPowerPerpPool).increaseObservationCardinalityNext(500);
        IUniswapV3Pool(_ethWPowerPerpPool).increaseObservationCardinalityNext(500);
        IUniswapV3Pool(_ethWPowerPerpPool).increaseObservationCardinalityNext(500);

        address _controller = address(new Controller(
            _oracle,
            _shortPowerPerp,
            address(wPowerPerp),
            address(weth),
            address(usdc),
            _ethQuoteCurrencyPool, 
            _ethWPowerPerpPool, 
            address(uniNonFungibleManager),
            _poolFee
        ));

        wPowerPerp.init(_controller);
        ShortPowerPerp(_shortPowerPerp).init(_controller);

        crabV2 = new CrabStrategyV2(_controller, _oracle, address(weth), address(uniFactory), _ethWPowerPerpPool, timelock, timelock, uint256(100), uint256(1e17));

        return (_controller, _shortPowerPerp, _oracle);
    }

    // TODO: move to helper later when test refactor PR is merged
    function _createUniPool(address _tokenA, address _tokenB, uint256 _tokenBPriceInA, uint24 _fee) internal returns (address) {
        bool isTokenAToken0 = _tokenA < _tokenB;

        if (ERC20(_tokenA).decimals() < ERC20(_tokenB).decimals()) {
            _tokenBPriceInA = _tokenBPriceInA.div(10**(ERC20(_tokenB).decimals() - ERC20(_tokenA).decimals()));
        } else {
            _tokenBPriceInA = _tokenBPriceInA.mul(10**(ERC20(_tokenA).decimals() - ERC20(_tokenB).decimals()));
        }

        // this may be wrong
        uint160 sqrtX96Price =
            isTokenAToken0 ? uint160(sqrt(uint256(1e18).div(_tokenBPriceInA)).mul(2**96)) : uint160(sqrt(_tokenBPriceInA.mul(1e18)).mul(2**96));

        (_tokenA, _tokenB) = isTokenAToken0 ? (_tokenA, _tokenB) : (_tokenB, _tokenA);

        address pool = uniFactory.createPool(_tokenA, _tokenB, _fee);

        IUniswapV3Pool(pool).initialize(sqrtX96Price);

        return pool;
    }

    // TODO: move to helper later when test refactor PR is merged
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