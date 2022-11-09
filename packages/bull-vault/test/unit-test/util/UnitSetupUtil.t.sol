pragma solidity =0.7.6;

pragma abicoder v2;

// test dependency
import "forge-std/Test.sol";
//interface
import { ERC20 } from "openzeppelin/token/ERC20/ERC20.sol";
import { IUniswapV3Pool } from "v3-core/interfaces/IUniswapV3Pool.sol";
// contract
import { MockErc20 } from "squeeth-monorepo/mocks/MockErc20.sol";
import { UniswapV3Factory } from "v3-core/UniswapV3Factory.sol";
import { UniswapV3Pool } from "v3-core/UniswapV3Pool.sol";
import { NonfungiblePositionManager } from "v3-periphery/NonfungiblePositionManager.sol";
import { WETH9Mock } from "../mock/Weth9Mock.t.sol";
import { ShortPowerPerp } from "squeeth-monorepo/core/ShortPowerPerp.sol";
import { Controller } from "squeeth-monorepo/core/Controller.sol";
import { Oracle } from "squeeth-monorepo/core/Oracle.sol";
import { WPowerPerp } from "squeeth-monorepo/core/WPowerPerp.sol";
import { CrabStrategyV2 } from "squeeth-monorepo/strategy/CrabStrategyV2.sol";
// lib
import { StrategyMath } from "squeeth-monorepo/strategy/base/StrategyMath.sol"; // StrategyMath licensed under AGPL-3.0-only

contract BullStrategyUnitTest is Test {
    using StrategyMath for uint256;

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

    function testToAvoidCoverage() public pure {
        return;
    }

    function _deployUniswap() internal {
        uniFactory = new UniswapV3Factory();
        uniNonFungibleManager =
            new NonfungiblePositionManager(address(uniFactory), address(weth), address(0));
    }

    function _deploySqueethEcosystem(uint256 _squeethEthPrice, uint24 _poolFee) internal {
        usdc = new MockErc20("USDC", "USDC", 6);
        weth = new WETH9Mock();

        ethUsdcPool =
            _createUniPoolAndInitialize(address(usdc), address(weth), 3300e18, uint24(3000));
        vm.warp(block.timestamp + 1000);
        IUniswapV3Pool(ethUsdcPool).increaseObservationCardinalityNext(500);

        wPowerPerp = new WPowerPerp("oSQTH", "oSQTH");
        address _shortPowerPerp = address(new ShortPowerPerp("ShortPowerPerp", "sOSQTH"));
        address _oracle = address(new Oracle());

        ethWPowerPerpPool = _createUniPoolAndInitialize(
            address(weth), address(wPowerPerp), _squeethEthPrice, _poolFee
        );
        vm.warp(block.timestamp + 1000);
        IUniswapV3Pool(ethWPowerPerpPool).increaseObservationCardinalityNext(500);

        controller = new Controller(
            _oracle,
            _shortPowerPerp,
            address(wPowerPerp),
            address(weth),
            address(usdc),
            ethUsdcPool, 
            ethWPowerPerpPool, 
            address(uniNonFungibleManager),
            _poolFee
        );

        wPowerPerp.init(address(controller));
        ShortPowerPerp(_shortPowerPerp).init(address(controller));

        crabV2 =
        new CrabStrategyV2(address(controller), _oracle, address(weth), address(uniFactory), ethWPowerPerpPool, timelock, timelock, uint256(100), uint256(1e17));
    }

    function _createUniPoolAndInitialize(
        address _tokenA,
        address _tokenB,
        uint256 _tokenBPriceInA,
        uint24 _fee
    ) internal returns (address) {
        bool isTokenAToken0 = _tokenA < _tokenB;

        if (ERC20(_tokenA).decimals() < ERC20(_tokenB).decimals()) {
            _tokenBPriceInA =
                _tokenBPriceInA.div(10 ** (ERC20(_tokenB).decimals() - ERC20(_tokenA).decimals()));
        } else {
            _tokenBPriceInA =
                _tokenBPriceInA.mul(10 ** (ERC20(_tokenA).decimals() - ERC20(_tokenB).decimals()));
        }

        // this may be wrong
        uint160 sqrtX96Price = isTokenAToken0
            ? uint160(sqrt(uint256(1e18).div(_tokenBPriceInA)).mul(2 ** 96))
            : uint160(sqrt(_tokenBPriceInA.mul(1e18)).mul(2 ** 96));

        (_tokenA, _tokenB) = isTokenAToken0 ? (_tokenA, _tokenB) : (_tokenB, _tokenA);

        address pool = uniFactory.createPool(_tokenA, _tokenB, _fee);

        IUniswapV3Pool(pool).initialize(sqrtX96Price);

        return pool;
    }

    function sqrt(uint256 x) internal pure returns (uint256) {
        uint256 n = x / 2;
        uint256 lstX = 0;
        while (n != lstX) {
            lstX = n;
            n = (n + x / n) / 2;
        }
        return n;
    }
}
