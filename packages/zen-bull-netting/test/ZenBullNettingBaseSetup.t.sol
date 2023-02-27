pragma solidity ^0.8.13;

pragma abicoder v2;

// test dependency
import "forge-std/Test.sol";
import { console } from "forge-std/console.sol";
//interface
import { IERC20 } from "openzeppelin/token/ERC20/IERC20.sol";
// contracts
import { SigUtil } from "./util/SigUtil.sol";
import { ZenBullNetting } from "../src/ZenBullNetting.sol";
//lib
import { NettingLib } from "../src/NettingLib.sol";

/**
 * ZenBull Netting Setup
 */
contract ZenBullNettingBaseSetup is Test {
    SigUtil internal sigUtil;
    ZenBullNetting internal zenBullNetting;

    address public constant USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    address public constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address public constant ZEN_BULL = 0xb46Fb07b0c80DBC3F97cae3BFe168AcaD46dF507;
    address public constant EULER_SIMPLE_LENS = 0x5077B7642abF198b4a5b7C4BdCE4f03016C7089C;
    address public constant UNI_FACTORY = 0x1F98431c8aD98523631AE4a59f267346ea31F984;
    address public constant WPOWERPERP = 0xf1B99e3E573A1a9C5E6B2Ce818b617F0E664E86B;
    address public constant ORACLE = 0x65D66c76447ccB45dAf1e8044e918fA786A483A1;
    address public constant CRAB = 0x3B960E47784150F5a63777201ee2B15253D713e8;
    address public constant FLASH_ZEN = 0x11A56a3A7A6Eb768A9125798B1eABE9EBD9EcE02;

    address public ethSqueethPool = 0x82c427AdFDf2d245Ec51D8046b41c4ee87F0d29C;
    address public ethUsdcPool = 0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8;

    uint256 public deployerPk;
    uint256 public ownerPk;
    address public deployer;
    address public owner;

    function setUp() public virtual {
        string memory FORK_URL = vm.envString("FORK_URL");
        vm.createSelectFork(FORK_URL, 16419302);

        deployerPk = 0xA11CD;
        deployer = vm.addr(deployerPk);
        ownerPk = 0xB11CD;
        owner = vm.addr(ownerPk);

        vm.startPrank(deployer);
        zenBullNetting = new ZenBullNetting(ZEN_BULL, EULER_SIMPLE_LENS, FLASH_ZEN, UNI_FACTORY);
        zenBullNetting.transferOwnership(owner);
        sigUtil = new SigUtil(zenBullNetting.DOMAIN_SEPARATOR());
        vm.stopPrank();

        vm.label(deployer, "Deployer");
        vm.label(owner, "Owner");
        vm.label(address(zenBullNetting), "ZenBullNetting");
    }

    function testDeployment() public {
        assertEq(zenBullNetting.owner(), owner);
        assertEq(zenBullNetting.MAX_OTC_PRICE_TOLERANCE(), 2e17);
        assertEq(zenBullNetting.MIN_AUCTION_TWAP(), 180);
        assertEq(zenBullNetting.otcPriceTolerance(), 5e16);
        assertEq(zenBullNetting.auctionTwapPeriod(), 420);
        assertEq(
            zenBullNetting.DOMAIN_SEPARATOR(),
            keccak256(
                abi.encode(
                    keccak256(
                        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
                    ),
                    keccak256(bytes("ZenBullNetting")),
                    keccak256(bytes("1")),
                    block.chainid,
                    address(zenBullNetting)
                )
            )
        );
    }

    function _queueEth(address _user, uint256 _amount) internal {
        vm.startPrank(_user);
        zenBullNetting.queueEth{ value: _amount }();
        vm.stopPrank();
    }

    function _queueZenBull(address _user, uint256 _amount) internal {
        vm.startPrank(_user);
        IERC20(ZEN_BULL).approve(address(zenBullNetting), _amount);
        zenBullNetting.queueZenBull(_amount);
        vm.stopPrank();
    }

    /**
     * @dev get ZenBull token price using uniswap TWAP
     * @return ZenBull price
     */
    function getZenBullPrice() internal view returns (uint256) {
        (uint256 crabFairPriceInEth, uint256 ethUsdcPrice) = NettingLib.getCrabPrice(
            ORACLE,
            CRAB,
            ethUsdcPool,
            ethSqueethPool,
            WPOWERPERP,
            USDC,
            WETH,
            ZEN_BULL,
            zenBullNetting.auctionTwapPeriod()
        );

        return NettingLib.getZenBullPrice(
            ZEN_BULL, EULER_SIMPLE_LENS, USDC, WETH, crabFairPriceInEth, ethUsdcPrice
        );
    }

    function mul(uint256 x, uint256 y) internal pure returns (uint256) {
        // add(mul(x, y), WAD / 2) / WAD;
        return ((x * y) + (1e18 / 2)) / 1e18;
    }

    function div(uint256 x, uint256 y) internal pure returns (uint256) {
        // add(mul(x, WAD), y / 2) / y;
        return ((x * 1e18) + (y / 2)) / y;
    }
}
