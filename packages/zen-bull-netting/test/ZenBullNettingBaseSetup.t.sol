pragma solidity ^0.8.13;

pragma abicoder v2;

// test dependency
import "forge-std/Test.sol";
import { console } from "forge-std/console.sol";
//interface
import { IERC20 } from "openzeppelin/token/ERC20/IERC20.sol";
// contracts
import { ZenBullNetting } from "../src/ZenBullNetting.sol";

/**
 * ZenBull Netting Setup
 */
contract ZenBullNettingBaseSetup is Test {
    ZenBullNetting internal zenBullNetting;

    address public constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address public constant ZEN_BULL = 0xb46Fb07b0c80DBC3F97cae3BFe168AcaD46dF507;
    address public constant EULER_SIMPLE_LENS = 0x5077B7642abF198b4a5b7C4BdCE4f03016C7089C;
    address public constant UNI_FACTORY = 0x1F98431c8aD98523631AE4a59f267346ea31F984;

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
        zenBullNetting = new ZenBullNetting(ZEN_BULL, EULER_SIMPLE_LENS, UNI_FACTORY);
        zenBullNetting.transferOwnership(owner);
        vm.stopPrank();

        vm.label(deployer, "Deployer");
        vm.label(owner, "Owner");
        vm.label(address(zenBullNetting), "ZenBullNetting");
    }

    function testIgnoreCoverageReport() public { }

    function _queueEth(address _user, uint256 _amount) internal {
        vm.startPrank(_user);
        zenBullNetting.queueEth{value: _amount}();
        vm.stopPrank();
    }

    function _queueZenBull(address _user, uint256 _amount) internal {
        vm.startPrank(_user);
        IERC20(ZEN_BULL).approve(address(zenBullNetting), _amount);
        zenBullNetting.queueZenBull(_amount);
        vm.stopPrank();
    }
}
