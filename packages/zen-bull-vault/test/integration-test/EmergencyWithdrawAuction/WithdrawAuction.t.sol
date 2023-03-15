pragma solidity =0.7.6;

pragma abicoder v2;

// test dependency
import "forge-std/Test.sol";
import { console } from "forge-std/console.sol";
//interface
import { IERC20 } from "openzeppelin/token/ERC20/IERC20.sol";
import { IWETH9 } from "squeeth-monorepo/interfaces/IWETH9.sol";
// import { IController } from "squeeth-monorepo/interfaces/IController.sol";
// import { IEulerMarkets } from "../../src/interface/IEulerMarkets.sol";
// import { IEulerEToken } from "../../src/interface/IEulerEToken.sol";
// import { IEulerDToken } from "../../src/interface/IEulerDToken.sol";
// import { ISwapRouter } from "v3-periphery/interfaces/ISwapRouter.sol";
// contract
import { EmergencyWithdrawAuction } from "../../../src/EmergencyWithdrawAuction.sol";
// import { TestUtil } from "../util/TestUtil.t.sol";
// import { SwapRouter } from "v3-periphery/SwapRouter.sol";
// import { Quoter } from "v3-periphery/lens/Quoter.sol";
import { ZenBullStrategy } from "../../../src/ZenBullStrategy.sol";
// import { CrabStrategyV2 } from "squeeth-monorepo/strategy/CrabStrategyV2.sol";
// import { Controller } from "squeeth-monorepo/core/Controller.sol";
// import { ZenAuction } from "../../src/ZenAuction.sol";
// import { FlashZen } from "../../src/FlashZen.sol";
import { SigUtil } from "../../util/SigUtil.sol";
// lib
// import { VaultLib } from "squeeth-monorepo/libs/VaultLib.sol";
import { StrategyMath } from "squeeth-monorepo/strategy/base/StrategyMath.sol"; // StrategyMath licensed under AGPL-3.0-only
import { UniOracle } from "../../../src/UniOracle.sol";

/**
 * @notice mainnet fork testing
 */
contract WithdrawAuctionTest is Test {
    using StrategyMath for uint256;

    EmergencyWithdrawAuction internal emergencyAuction;
    SigUtil internal sigUtil;

    address public constant USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    address public constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address payable public constant ZEN_BULL = 0xb46Fb07b0c80DBC3F97cae3BFe168AcaD46dF507;
    // address public constant EULER_SIMPLE_LENS = 0x5077B7642abF198b4a5b7C4BdCE4f03016C7089C;
    // address public constant UNI_FACTORY = 0x1F98431c8aD98523631AE4a59f267346ea31F984;
    address public constant WPOWERPERP = 0xf1B99e3E573A1a9C5E6B2Ce818b617F0E664E86B;
    address public constant ORACLE = 0x65D66c76447ccB45dAf1e8044e918fA786A483A1;
    address public constant CRAB = 0x3B960E47784150F5a63777201ee2B15253D713e8;

    address public ethSqueethPool = 0x82c427AdFDf2d245Ec51D8046b41c4ee87F0d29C;
    // address public ethUsdcPool = 0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8;

    uint256 deployerPk;
    uint256 ownerPk;
    uint256 mm1Pk;
    address deployer;
    address owner;
    address mm1;

    function setUp() public virtual {
        string memory FORK_URL = vm.envString("FORK_URL");
        vm.createSelectFork(FORK_URL, 16827269);

        deployerPk = 0xA11CD;
        deployer = vm.addr(deployerPk);
        ownerPk = 0xB11CD;
        owner = vm.addr(ownerPk);
        mm1Pk = 0xB21CD;
        mm1 = vm.addr(mm1Pk);

        vm.startPrank(deployer);
        emergencyAuction =
            new EmergencyWithdrawAuction(ZEN_BULL, CRAB, WPOWERPERP, WETH, ethSqueethPool);
        emergencyAuction.transferOwnership(owner);
        sigUtil = new SigUtil(emergencyAuction.DOMAIN_SEPARATOR());
        vm.stopPrank();

        vm.prank(0xAfE66363c27EedB597a140c28B70b32F113fd5a8);
        ZenBullStrategy(ZEN_BULL).setAuction(address(emergencyAuction));

        vm.label(deployer, "Deployer");
        vm.label(owner, "Owner");
        vm.label(mm1, "MM1");
        vm.label(address(emergencyAuction), "EmergencyWithdrawAuction");

        // osQTH whale
        vm.startPrank(0x8D5ACF995dae10BdbBada2044C7217ac99edF5Bf);
        IERC20(WPOWERPERP).transfer(
            mm1, IERC20(WPOWERPERP).balanceOf(0x8D5ACF995dae10BdbBada2044C7217ac99edF5Bf)
        );
        vm.stopPrank();
    }

    function testDeployment() public {
        assertEq(emergencyAuction.owner(), owner);
        assertEq(emergencyAuction.AUCTION_CLEARING_PRICE_TOLERANCE(), 2e17);
        // assertEq(emergencyAuction.MIN_AUCTION_TWAP(), 180);
        // assertEq(emergencyAuction.otcPriceTolerance(), 5e16);
        // assertEq(emergencyAuction.auctionTwapPeriod(), 420);
        assertEq(
            emergencyAuction.DOMAIN_SEPARATOR(),
            keccak256(
                abi.encode(
                    keccak256(
                        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
                    ),
                    keccak256(bytes("EmergencyWithdrawAuction")),
                    keccak256(bytes("1")),
                    getChainID(),
                    address(emergencyAuction)
                )
            )
        );
    }

    function testWithdrawAuction() public {
        uint256 crabAmount = IERC20(CRAB).balanceOf(ZEN_BULL);
        (uint256 crabCollateral, uint256 crabDebt) = ZenBullStrategy(ZEN_BULL).getCrabVaultDetails();

        uint256 oSqthAmount = crabAmount.wmul(crabDebt).wdiv(IERC20(CRAB).totalSupply());

        uint256 squeethEthPrice = UniOracle._getTwap(ethSqueethPool, WPOWERPERP, WETH, 420, false);
        EmergencyWithdrawAuction.Order[] memory orders = new EmergencyWithdrawAuction.Order[](1);
        {
            // trader signature vars
            uint8 v;
            bytes32 r;
            bytes32 s;
            // trader signing bid
            SigUtil.Order memory orderSig = SigUtil.Order({
                bidId: 1,
                trader: mm1,
                quantity: oSqthAmount,
                price: squeethEthPrice,
                isBuying: false,
                expiry: block.timestamp + 1000,
                nonce: 0
            });
            bytes32 bidDigest = sigUtil.getTypedDataHash(orderSig);
            (v, r, s) = vm.sign(mm1Pk, bidDigest);
            EmergencyWithdrawAuction.Order memory orderData = EmergencyWithdrawAuction.Order({
                bidId: 1,
                trader: mm1,
                quantity: oSqthAmount,
                price: squeethEthPrice,
                isBuying: false,
                expiry: block.timestamp + 1000,
                nonce: 0,
                v: v,
                r: r,
                s: s
            });
            orders[0] = orderData;
        }

        vm.prank(mm1);
        IERC20(WPOWERPERP).approve(address(emergencyAuction), oSqthAmount);

        uint256 mm1WethBalanceBefore = IERC20(WETH).balanceOf(mm1);
        uint256 mm1WpowerPerpBalanceBefore = IERC20(WPOWERPERP).balanceOf(mm1);
        uint256 contractEthBalanceBefore = address(emergencyAuction).balance;

        assertEq(contractEthBalanceBefore, 0);
        // uint256 debtBalanceBefore =
        //     IEulerSimpleLens(EULER_SIMPLE_LENS).getDTokenBalance(USDC, ZEN_BULL);
        // uint256 usdcToRepay = amount * debtBalanceBefore / IERC20(ZEN_BULL).totalSupply();
        // uint256 wethInEulerBefore =
        //     IEulerSimpleLens(EULER_SIMPLE_LENS).getETokenBalance(WETH, ZEN_BULL);
        // uint256 wethToWithdraw = amount * wethInEulerBefore / IERC20(ZEN_BULL).totalSupply();

        // (, uint256 receiptAmountBefore,) = emergencyAuction.getWithdrawReceipt(0);
        // uint256 user1EthBalanceBefore = user1.balance;

        uint256 crabShare = crabAmount.wdiv(IERC20(CRAB).totalSupply());
        uint256 ethAmountFromCrab = crabCollateral.wmul(crabShare);

        vm.startPrank(owner);
        emergencyAuction.withdrawAuction(orders, crabAmount, squeethEthPrice);
        vm.stopPrank();

        assertEq(IERC20(WPOWERPERP).balanceOf(mm1) + oSqthAmount, mm1WpowerPerpBalanceBefore);
        assertEq(
            IERC20(WETH).balanceOf(mm1) - (oSqthAmount * squeethEthPrice / 1e18),
            mm1WethBalanceBefore
        );

        console.log("ethAmountFromCrab", ethAmountFromCrab);
        console.log("oSqthAmount * squeethEthPrice / 1e18", oSqthAmount * squeethEthPrice / 1e18);
        console.log("address(emergencyAuction).balance", address(emergencyAuction).balance);
        assertEq(
            address(emergencyAuction).balance
                - (ethAmountFromCrab - (oSqthAmount * squeethEthPrice / 1e18)),
            contractEthBalanceBefore
        );
        assertEq(
            address(emergencyAuction).balance,
            ethAmountFromCrab - (oSqthAmount * squeethEthPrice / 1e18)
        );
        // assertLt(IERC20(WPOWERPERP).balanceOf(mm1), mm1WpowerPerpBalanceBefore);
        // assertEq(
        //     IEulerSimpleLens(EULER_SIMPLE_LENS).getDTokenBalance(USDC, ZEN_BULL) + usdcToRepay,
        //     debtBalanceBefore
        // );
        // assertApproxEqAbs(
        //     IEulerSimpleLens(EULER_SIMPLE_LENS).getETokenBalance(WETH, ZEN_BULL) + wethToWithdraw,
        //     wethInEulerBefore,
        //     200
        // );
        // uint256 user1EthBalanceAfter = user1.balance;
        // assertGt(user1EthBalanceAfter, user1EthBalanceBefore);
    }

    function getChainID() internal pure returns (uint256) {
        uint256 id;
        assembly {
            id := chainid()
        }
        return id;
    }
}
