pragma solidity ^0.8.13;

pragma abicoder v2;

// test dependency
import "forge-std/Test.sol";
import { console } from "forge-std/console.sol";

// contracts
import { ZenBullNetting } from "../src/ZenBullNetting.sol";

/**
 * Unit tests
 */
contract ZenBullNettingBaseSetup is Test {
    ZenBullNetting internal zenBullNetting;

    address public constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address public constant ZEN_BULL = 0xb46Fb07b0c80DBC3F97cae3BFe168AcaD46dF507;

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
        zenBullNetting = new ZenBullNetting(WETH, ZEN_BULL);
        zenBullNetting.transferOwnership(owner);
        vm.stopPrank();

        vm.label(deployer, "Deployer");
        vm.label(owner, "Owner");
        vm.label(address(zenBullNetting), "ZenBullNetting");
    }

    function testIgnoreCoverageReport() public { }

    function _queueWeth(address _user, uint256 _amount) internal {
        vm.startPrank(_user);
        IERC20(WETH).approve(address(zenBullNetting), _amount);
        zenBullNetting.queueWeth(_amount);
        vm.stopPrank();
    }

    function _queueZenBull(address _user, uint256 _amount) internal {
        vm.startPrank(_user);
        IERC20(ZEN_BULL).approve(address(zenBullNetting), _amount);
        zenBullNetting.queueZenBull(_amount);
        vm.stopPrank();
    }
}
