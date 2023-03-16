pragma solidity =0.7.6;

pragma abicoder v2;

// test dependency
import "forge-std/Test.sol";

import { console } from "forge-std/console.sol";


import { EmergencyWithdraw } from "../../../src/EmergencyWithdraw.sol";
import { ZenBullStrategy } from "../../../src/ZenBullStrategy.sol";
import { IERC20 } from "openzeppelin/token/ERC20/IERC20.sol";
import { UniOracle } from "../../../src/UniOracle.sol";


contract EmergencyWithdrawTest is Test {
	EmergencyWithdraw internal emergencyWithdraw;
	address public constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
	address payable public constant ZEN_BULL = 0xb46Fb07b0c80DBC3F97cae3BFe168AcaD46dF507;
	address public constant CONTROLLER = 0x64187ae08781B09368e6253F9E94951243A493D5;
	address public constant CRAB = 0x3B960E47784150F5a63777201ee2B15253D713e8;
    address public constant FACTORY = 0x1F98431c8aD98523631AE4a59f267346ea31F984;
    address public constant WPOWERPERP = 0xf1B99e3E573A1a9C5E6B2Ce818b617F0E664E86B;

    address public ethSqueethPool = 0x82c427AdFDf2d245Ec51D8046b41c4ee87F0d29C;

	uint256 deployerPk;
    uint256 ownerPk;
    uint256 mm1Pk;
    address deployer;
    address owner;
    address mm1;

	function setUp() public virtual {
        string memory FORK_URL = vm.envString("FORK_URL");
        vm.createSelectFork(FORK_URL, 16838345);

        deployerPk = 0xA11CD;
        deployer = vm.addr(deployerPk);
        ownerPk = 0xB11CD;
        owner = vm.addr(ownerPk);
        mm1Pk = 0xB21CD;
        mm1 = vm.addr(mm1Pk);

        vm.startPrank(deployer);
        emergencyWithdraw =
            new EmergencyWithdraw(CRAB, ZEN_BULL, CONTROLLER, FACTORY);
        vm.stopPrank();

        vm.prank(0xAfE66363c27EedB597a140c28B70b32F113fd5a8);
        ZenBullStrategy(ZEN_BULL).setAuction(address(emergencyWithdraw));

        vm.label(deployer, "Deployer");
        vm.label(owner, "Owner");
        vm.label(mm1, "MM1");
        vm.label(address(emergencyWithdraw), "EmergencyWithdraw");

        // bull whale
        vm.startPrank(0xB845d3C82853b362ADF47A045c087d52384a7776);
        IERC20(ZEN_BULL).transfer(
            mm1, IERC20(ZEN_BULL).balanceOf(0xB845d3C82853b362ADF47A045c087d52384a7776)
        );
        vm.stopPrank();
    }

	function testSetup() public {
		assertEq(emergencyWithdraw.bullSupply(), ZenBullStrategy(ZEN_BULL).totalSupply());
    }

	function testWithdraw() public {
		uint256 bullSupplyBefore = emergencyWithdraw.bullSupply();
		uint256 mm1WethBalanceBefore = IERC20(WETH).balanceOf(mm1);
		uint256 mm1BullBalanceBefore = IERC20(ZEN_BULL).balanceOf(mm1);

		uint256 squeethEthPrice = UniOracle._getTwap(ethSqueethPool, WPOWERPERP, WETH, 420, false);
		
		(uint256 crabAmount, uint256 oSqthAmount) = emergencyWithdraw.getWithdrawTokenDetails(mm1BullBalanceBefore);
		console.log("crabAmount:", crabAmount);
		assertEq(mm1BullBalanceBefore, 27297951325003713524);

		uint256 maxWeth = oSqthAmount * squeethEthPrice / 1e18 + (oSqthAmount * squeethEthPrice / 1e18 * 10 / 100);
		vm.startPrank(mm1);
		IERC20(ZEN_BULL).approve(address(emergencyWithdraw), type(uint256).max);
		emergencyWithdraw.withdraw(mm1BullBalanceBefore, maxWeth);
		vm.stopPrank();

		uint256 bullSupplyAfter = emergencyWithdraw.bullSupply();
		uint256 mm1BullBalanceAfter = IERC20(ZEN_BULL).balanceOf(mm1);

		assertEq(bullSupplyAfter, bullSupplyBefore - mm1BullBalanceBefore);
		assertEq(mm1BullBalanceAfter, 0);
	}
}