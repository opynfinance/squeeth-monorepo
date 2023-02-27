pragma solidity ^0.8.13;

pragma abicoder v2;

// test dependency
import { console } from "forge-std/console.sol";
import { ZenBullNettingBaseSetup } from "../../ZenBullNettingBaseSetup.t.sol";
// interface
import { IERC20 } from "openzeppelin/token/ERC20/IERC20.sol";
import { IZenBullStrategy } from "../../../src/interface/IZenBullStrategy.sol";
import { IOracle } from "../../../src/interface/IOracle.sol";
import { IEulerSimpleLens } from "../../../src/interface/IEulerSimpleLens.sol";
import { IWETH } from "../../../src/interface/IWETH.sol";
// contract
import { SigUtil } from "../../util/SigUtil.sol";
import { ZenBullNetting } from "../../../src/ZenBullNetting.sol";

contract DepositAuctionFuzzing is ZenBullNettingBaseSetup {
    uint256 public user1Pk;
    address public user1;
    uint256 public user2Pk;
    address public user2;
    uint256 public mm1Pk;
    address public mm1;
    uint256 public mm2Pk;
    address public mm2;

    uint256 minWeth = 5e18;
    uint256 minZenBull = 1e18;

    function setUp() public override {
        ZenBullNettingBaseSetup.setUp();

        vm.startPrank(owner);
        zenBullNetting.setMinEthAmount(minWeth);
        zenBullNetting.setMinZenBullAmount(minZenBull);
        vm.stopPrank();

        (user1, user1Pk) = makeAddrAndKey("User1");
        (user2, user2Pk) = makeAddrAndKey("User2");
        (mm1, mm1Pk) = makeAddrAndKey("MM1");
        (mm2, mm2Pk) = makeAddrAndKey("MM2");

        vm.deal(user1, 5000e18);
        vm.deal(user2, 5000e18);
        vm.deal(mm1, 5000e18);
        vm.deal(mm2, 5000e18);

        vm.prank(mm1);
        IWETH(WETH).deposit{ value: 5000e18 }();
        vm.prank(mm2);
        IWETH(WETH).deposit{ value: 5000e18 }();

        // update ZenBull cap to 100000 ETH
        vm.store(ZEN_BULL, bytes32(uint256(9)), bytes32(uint256(100000e18)));
    }

    function _calAuctionCrabAmount(uint256 _depositToProcess) internal view returns (uint256) {
        uint256 ethUsdPrice = IOracle(ORACLE).getTwap(ethUsdcPool, WETH, USDC, 420, false);
        uint256 squeethEthPrice =
            IOracle(ORACLE).getTwap(ethSqueethPool, WPOWERPERP, WETH, 420, false);
        (uint256 crabCollateral, uint256 crabDebt) =
            IZenBullStrategy(ZEN_BULL).getCrabVaultDetails();
        uint256 crabUsdPrice = (
            crabCollateral * ethUsdPrice / 1e18 - (crabDebt * squeethEthPrice * ethUsdPrice / 1e36)
        ) * 1e18 / IERC20(CRAB).totalSupply();
        uint256 bullEquityValue = (
            IZenBullStrategy(ZEN_BULL).getCrabBalance() * crabUsdPrice / 1e18
        )
            + (
                IEulerSimpleLens(EULER_SIMPLE_LENS).getETokenBalance(WETH, ZEN_BULL) * ethUsdPrice
                    / 1e18
            ) - (IEulerSimpleLens(EULER_SIMPLE_LENS).getDTokenBalance(USDC, ZEN_BULL) * 1e12);
        uint256 expectBullAmount = _depositToProcess * ethUsdPrice * 99e16 / 1e18 / bullEquityValue
            * IZenBullStrategy(ZEN_BULL).totalSupply() / 1e18;

        return expectBullAmount * 1e18 / IZenBullStrategy(ZEN_BULL).totalSupply()
            * IZenBullStrategy(ZEN_BULL).getCrabBalance() / 1e18;
    }

    function testFuzzingDepositAuction(uint256 _amount) public {
        _amount = bound(_amount, zenBullNetting.minEthAmount(), uint256(1000e18));
        _queueEth(user1, _amount);

        uint256 crabAmount = _calAuctionCrabAmount(_amount);
        uint256 crabTotalSupply = IERC20(CRAB).totalSupply();
        (, uint256 crabDebt) = IZenBullStrategy(ZEN_BULL).getCrabVaultDetails();
        uint256 oSqthAmount = crabAmount * crabDebt / crabTotalSupply;

        uint256 squeethEthPrice =
            IOracle(ORACLE).getTwap(ethSqueethPool, WPOWERPERP, WETH, 420, false);
        ZenBullNetting.Order[] memory orders = new ZenBullNetting.Order[](1);
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
                isBuying: true,
                expiry: block.timestamp + 1000,
                nonce: 0
            });
            bytes32 bidDigest = sigUtil.getTypedDataHash(orderSig);
            (v, r, s) = vm.sign(mm1Pk, bidDigest);
            ZenBullNetting.Order memory orderData = ZenBullNetting.Order({
                bidId: 1,
                trader: mm1,
                quantity: oSqthAmount,
                price: squeethEthPrice,
                isBuying: true,
                expiry: block.timestamp + 1000,
                nonce: 0,
                v: v,
                r: r,
                s: s
            });
            orders[0] = orderData;
        }

        ZenBullNetting.DepositAuctionParams memory params = ZenBullNetting.DepositAuctionParams({
            depositsToProcess: _amount,
            crabAmount: crabAmount,
            orders: orders,
            clearingPrice: squeethEthPrice * 99e16 / 1e18,
            flashDepositEthToCrab: 0,
            flashDepositMinEthFromSqth: 0,
            flashDepositMinEthFromUsdc: 0,
            flashDepositWPowerPerpPoolFee: 3000,
            wethUsdcPoolFee: 3000
        });

        vm.prank(mm1);
        IERC20(WETH).approve(address(zenBullNetting), oSqthAmount * params.clearingPrice / 1e18);

        vm.startPrank(owner);
        zenBullNetting.depositAuction(params);
        vm.stopPrank();
    }
}
