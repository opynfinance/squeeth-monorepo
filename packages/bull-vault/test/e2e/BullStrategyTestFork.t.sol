// pragma solidity 0.8.13;

// // test dependency
// import "@std/Test.sol";
// import {console} from "@std/console.sol";
// import {Solenv} from "solenv/Solenv.sol";

// // contract
// import {BullStrategy} from "../../src/BullStrategy.sol";

// /**
//  * @notice Ropsten fork testing
//  */
// contract BullStrategyTestFork is Test {
//     // MockERC20 internal usdc;
//     // MockERC20 internal squeeth;
//     BullStrategy internal bullStrategy;

//     uint256 internal user1Pk;
//     address internal user1;

//     function setUp() public {
//         Solenv.config();

//         usdc = MockERC20(0x27415c30d8c87437BeCbd4f98474f26E712047f4);
//         squeeth = MockERC20(0xa4222f78d23593e82Aa74742d25D06720DCa4ab7);
//         bullStrategy = bullStrategy(address(0));

//         user1Pk = vm.envUint("USER_1_PK");
//         user1 = vm.addr(user1Pk);

//         vm.label(user1, "User 1");
//         vm.label(address(bullStrategy), "BullStrategy");
//         vm.label(address(usdc), "USDC");
//         vm.label(address(squeeth), "oSQTH");

//         // to execute tx on behalf user1 
//         // vm.prank(user1);
//         squeeth.approve(address(bullStrategy), type(uint256).max);
//     }
//     function testDeposit() public {}

// }