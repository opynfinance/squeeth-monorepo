// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "forge-std/Test.sol";
import {BaseForkSetup} from "./BaseForkSetup.t.sol";

import {Order, DepositAuctionParams} from "../src/CrabNetting.sol";
import {ICrabStrategyV2} from "../src/interfaces/ICrabStrategyV2.sol";

import {SigUtils} from "./utils/SigUtils.sol";

struct Sign {
    uint8 v;
    bytes32 r;
    bytes32 s;
}

contract DepositAuctionTest is BaseForkSetup {
    SigUtils sig;

    function setUp() public override {
        BaseForkSetup.setUp();
        sig = new SigUtils(netting.DOMAIN_SEPARATOR());

        vm.deal(depositor, 100000000e18);

        // this is a crab whale, get some crab token from
        //vm.prank(0x06CECFbac34101aE41C88EbC2450f8602b3d164b);
        // crab.tranfer(depositor, 100e18);

        // some WETH and USDC rich address
        vm.startPrank(0x57757E3D981446D585Af0D9Ae4d7DF6D64647806);
        weth.transfer(depositor, 10000e18);
        weth.transfer(mm1, 1000e18);
        weth.transfer(mm2, 1000e18);
        usdc.transfer(depositor, 500000e6);
        vm.stopPrank();

        vm.startPrank(depositor);
        usdc.approve(address(netting), 1500000 * 1e6);
        netting.depositUSDC(200000 * 1e6);
        vm.stopPrank();

        // depositor has queued in 200k USDC
    }

    function _findTotalDepositAndToMint(uint256 _eth, uint256 _collateral, uint256 _debt, uint256 _price)
        internal
        pure
        returns (uint256, uint256)
    {
        uint256 totalDeposit = (_eth * 1e18) / (1e18 - ((_debt * _price) / _collateral));
        return (totalDeposit, (totalDeposit * _debt) / _collateral);
    }

    function _findTotalDepositFromAuctioned(uint256 _collateral, uint256 _debt, uint256 _auctionedSqth)
        internal
        pure
        returns (uint256)
    {
        return (_collateral * _auctionedSqth) / _debt;
    }

    function testDepositAuctionPartialFill() public {
        DepositAuctionParams memory p;
        uint256 sqthPriceLimit = (_getSqthPrice(1e18) * 988) / 1000;
        (,, uint256 collateral, uint256 debt) = crab.getVaultDetails();
        // Large first deposit. 10 & 40 as the deposit. 20 is the amount to net
        vm.prank(depositor);
        netting.depositUSDC(300000 * 1e6); //200+300 500k usdc deposited

        p.depositsQueued = 300000 * 1e6;
        p.minEth = (_convertUSDToETH(p.depositsQueued) * 9975) / 10000;

        uint256 toMint;
        (p.totalDeposit, toMint) = _findTotalDepositAndToMint(p.minEth, collateral, debt, sqthPriceLimit);
        bool trade_works = _isEnough(p.minEth, toMint, sqthPriceLimit, p.totalDeposit);
        require(trade_works, "depositing more than we have from sellling");
        Order memory order =
            Order(0, mm1, toMint, (sqthPriceLimit * 1005) / 1000, true, block.timestamp, 0, 1, 0x00, 0x00);

        bytes32 digest = sig.getTypedDataHash(order);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(mm1Pk, digest);
        order.v = v;
        order.r = r;
        order.s = s;

        orders.push(order);
        p.orders = orders;
        vm.prank(mm1);
        weth.approve(address(netting), 1e30);

        p.clearingPrice = (sqthPriceLimit * 1005) / 1000;
        uint256 excessEth = (toMint * (p.clearingPrice - sqthPriceLimit)) / 1e18;

        p.ethUSDFee = 500;
        p.flashDepositFee = 3000;

        // Find the borrow ration for toFlash
        uint256 mid = _findBorrow(excessEth, debt, collateral);
        p.ethToFlashDeposit = (excessEth * mid) / 10 ** 7;
        // ------------- //
        uint256 depositorBalance = weth.balanceOf(depositor);
        netting.depositAuction(p);

        assertApproxEqAbs(ICrabStrategyV2(crab).balanceOf(depositor), 221e18, 1e18);
        assertEq(netting.usdBalance(depositor), 200000e6);
        assertEq(sqth.balanceOf(mm1), toMint);
        assertEq(weth.balanceOf(address(netting)), 1);
        assertApproxEqAbs(weth.balanceOf(depositor) - depositorBalance, 5e17, 1e17);
    }

    function testDepositAuctionAfterFullWithdrawal() public {
        vm.startPrank(depositor);
        console.log(netting.usdBalance(depositor), "depositor balance");
        netting.withdrawUSDC(netting.usdBalance(depositor));
        assertEq(netting.usdBalance(depositor), 0, "depositor balancez ero");
        netting.depositUSDC(200000e6);
        vm.stopPrank();

        DepositAuctionParams memory p;
        uint256 sqthPriceLimit = (_getSqthPrice(1e18) * 988) / 1000;
        (,, uint256 collateral, uint256 debt) = crab.getVaultDetails();
        // Large first deposit. 10 & 40 as the deposit. 20 is the amount to net
        vm.prank(depositor);
        netting.depositUSDC(300000 * 1e6); //200+300 500k usdc deposited

        p.depositsQueued = 300000 * 1e6;
        p.minEth = (_convertUSDToETH(p.depositsQueued) * 9975) / 10000;

        uint256 toMint;
        (p.totalDeposit, toMint) = _findTotalDepositAndToMint(p.minEth, collateral, debt, sqthPriceLimit);
        bool trade_works = _isEnough(p.minEth, toMint, sqthPriceLimit, p.totalDeposit);
        require(trade_works, "depositing more than we have from sellling");
        Order memory order =
            Order(0, mm1, toMint, (sqthPriceLimit * 1005) / 1000, true, block.timestamp, 0, 1, 0x00, 0x00);

        bytes32 digest = sig.getTypedDataHash(order);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(mm1Pk, digest);
        order.v = v;
        order.r = r;
        order.s = s;

        orders.push(order);
        p.orders = orders;
        vm.prank(mm1);
        weth.approve(address(netting), 1e30);

        p.clearingPrice = (sqthPriceLimit * 1005) / 1000;
        uint256 excessEth = (toMint * (p.clearingPrice - sqthPriceLimit)) / 1e18;

        p.ethUSDFee = 500;
        p.flashDepositFee = 3000;

        // Find the borrow ration for toFlash
        uint256 mid = _findBorrow(excessEth, debt, collateral);
        p.ethToFlashDeposit = (excessEth * mid) / 10 ** 7;
        // ------------- //
        uint256 depositorBalance = weth.balanceOf(depositor);
        console.log(depositorBalance, "balance bfore");
        netting.depositAuction(p);

        console.log(ICrabStrategyV2(crab).balanceOf(depositor), "crab balance");
        assertGt(ICrabStrategyV2(crab).balanceOf(depositor), 221e18);
        assertEq(netting.usdBalance(depositor), 200000e6);
        assertEq(sqth.balanceOf(mm1), toMint);
        assertLe(weth.balanceOf(address(netting)), 1e16);
        assertGt(weth.balanceOf(depositor) - depositorBalance, 5e17, "0.5 eth not remaining");
        assertEq(netting.depositsIndex(), 2);
    }

    function testSqthPriceTooLow() public {
        DepositAuctionParams memory p;
        uint256 sqthPriceLimit = (_getSqthPrice(1e18) * 99) / 100;
        (,, uint256 collateral, uint256 debt) = crab.getVaultDetails();
        // Large first deposit. 10 & 40 as the deposit. 20 is the amount to net
        vm.prank(depositor);
        netting.depositUSDC(300000 * 1e6); //200+300 500k usdc deposited

        p.depositsQueued = 300000 * 1e6;
        p.minEth = (_convertUSDToETH(p.depositsQueued) * 9975) / 10000;

        uint256 toMint;
        (p.totalDeposit, toMint) = _findTotalDepositAndToMint(p.minEth, collateral, debt, sqthPriceLimit);
        Order memory order = Order(0, mm1, toMint, sqthPriceLimit, true, block.timestamp, 0, 1, 0x00, 0x00);
        orders.push(order);
        p.orders = orders;

        vm.prank(mm1);
        weth.approve(address(netting), 1e30);

        p.clearingPrice = (sqthPriceLimit * 94) / 100;
        p.ethUSDFee = 500;
        p.flashDepositFee = 3000;
        p.ethToFlashDeposit = (p.ethToFlashDeposit * 1) / 10 ** 7;

        vm.expectRevert(bytes("Price too low relative to Uniswap twap."));
        netting.depositAuction(p);
    }

    function testFirstDepositAuction() public {
        DepositAuctionParams memory p;
        // get the usd to deposit remaining
        p.depositsQueued = netting.depositsQueued();
        // find the eth value of it
        p.minEth = (_convertUSDToETH(p.depositsQueued) * 9975) / 10000;

        // lets get the uniswap price, you can get this from uniswap function in crabstratgegy itself
        uint256 sqthPrice = (_getSqthPrice(1e18) * 988) / 1000;
        // get the vault details
        (,, uint256 collateral, uint256 debt) = crab.getVaultDetails();
        // get the total deposit
        uint256 toMint;
        (p.totalDeposit, toMint) = _findTotalDepositAndToMint(p.minEth, collateral, debt, sqthPrice);
        // --------
        // then write a test suite with a high eth value where it fails
        bool trade_works = _isEnough(p.minEth, toMint, sqthPrice, p.totalDeposit);
        require(trade_works, "depositing more than we have from sellling");

        // if i sell the sqth and get eth add to user eth, will it be > total deposit

        // then reduce the total value to get more trade value like in crab otc looping
        // find out the root cause of this rounding issue

        // turns out the issue did not occur,
        // so we go ahead as though the auction closed for 0.993 osqth price

        Order memory order =
            Order(0, mm1, toMint - 1e18, (sqthPrice * 1005) / 1000, true, block.timestamp, 0, 1, 0x00, 0x00);

        Sign memory s;
        (s.v, s.r, s.s) = vm.sign(mm1Pk, sig.getTypedDataHash(order));
        order.v = s.v;
        order.r = s.r;
        order.s = s.s;

        Order memory order0 = Order(0, mm1, 1e18, (sqthPrice * 1005) / 1000, true, block.timestamp, 1, 1, 0x00, 0x00);

        Sign memory s0;
        (s0.v, s0.r, s0.s) = vm.sign(mm1Pk, sig.getTypedDataHash(order0));
        order0.v = s0.v;
        order0.r = s0.r;
        order0.s = s0.s;

        orders.push(order0);
        orders.push(order);
        vm.prank(mm1);
        weth.approve(address(netting), 1e30);

        p.orders = orders;
        p.clearingPrice = (sqthPrice * 1005) / 1000;
        uint256 excessEth = (toMint * (p.clearingPrice - sqthPrice)) / 1e18;
        console.log(excessEth, "excess eth is");

        console.log(ICrabStrategyV2(crab).balanceOf(depositor), "balance start crab");

        // Find the borrow ration for toFlash
        uint256 mid = _findBorrow(excessEth, debt, collateral);
        console.log(mid, "borrow percentage is");
        p.ethToFlashDeposit = (excessEth * mid) / 10 ** 7;
        console.log("after multiplying", p.ethToFlashDeposit);
        p.ethUSDFee = 500;
        p.flashDepositFee = 3000;
        // ------------- //
        console.log(p.depositsQueued, p.minEth, p.totalDeposit, toMint);
        console.log(p.clearingPrice);
        uint256 initEthBalance = weth.balanceOf(depositor);
        netting.depositAuction(p);

        assertApproxEqAbs(ICrabStrategyV2(crab).balanceOf(depositor), 147e18, 1e18);
        assertEq(sqth.balanceOf(mm1), toMint);
        assertApproxEqAbs(weth.balanceOf(depositor) - initEthBalance, 3e17, 1e17);
    }

    // TODO find a way to make this reusable and test easily
    // for multiple ETH movements and external events like partial fills
    // eth going down
    function testDepositAuctionEthUp() public {
        DepositAuctionParams memory p;
        // get the usd to deposit remaining
        p.depositsQueued = netting.depositsQueued();
        // find the eth value of it
        p.minEth = _convertUSDToETH(p.depositsQueued);
        console.log("Starting ETH", p.minEth / 10 ** 18);

        // lets get the uniswap price, you can get this from uniswap function in crabstratgegy itself
        uint256 sqthPrice = (_getSqthPrice(1e18) * 988) / 1000;
        // get the vault details
        (,, uint256 collateral, uint256 debt) = crab.getVaultDetails();
        // get the total deposit
        uint256 toMint;
        (p.totalDeposit, toMint) = _findTotalDepositAndToMint(p.minEth, collateral, debt, sqthPrice);
        console.log("Auctioning for ", toMint / 10 ** 18, "sqth");
        // --------
        // then write a test suite with a high eth value where it fails
        require(_isEnough(p.minEth, toMint, sqthPrice, p.totalDeposit), "depositing more than we have from sellling");

        // if i sell the sqth and get eth add to user eth, will it be > total deposit

        // then reduce the total value to get more trade value like in crab otc looping
        // find out the root cause of this rounding issue

        // turns out the issue did not occur,
        // so we go ahead as though the auction closed for 0.993 osqth price

        Order memory order = Order(
            0,
            mm1,
            toMint,
            63974748984830990, // sqth price in the future
            true,
            block.timestamp + 26000000,
            0,
            1,
            0x00,
            0x00
        );

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(mm1Pk, sig.getTypedDataHash(order));
        order.v = v;
        order.r = r;
        order.s = s;
        orders.push(order);
        vm.prank(mm1);
        weth.approve(address(netting), 1e30);

        p.orders = orders;
        p.clearingPrice = (sqthPrice * 1005) / 1000;
        uint256 excessEth = (toMint * (p.clearingPrice - sqthPrice)) / 1e18;

        console.log(ICrabStrategyV2(crab).balanceOf(depositor), "balance start crab");

        // Find the borrow ration for toFlash
        uint256 mid = _findBorrow(excessEth, debt, collateral);
        p.ethToFlashDeposit = (excessEth * mid) / 10 ** 7;
        p.ethUSDFee = 500;
        p.flashDepositFee = 3000;
        // ------------- //

        vm.stopPrank();
        assertEq(activeFork, vm.activeFork());
        vm.makePersistent(address(netting));
        vm.makePersistent(address(weth));
        vm.makePersistent(address(usdc));

        vm.rollFork(activeFork, 15829113);
        console.log(address(depositor).balance, "starting");
        p.minEth = _convertUSDToETH(p.depositsQueued);
        p.clearingPrice = _getSqthPrice(1e18);
        console.log("Ending ETH", p.minEth / 10 ** 18);
        (,, collateral, debt) = ICrabStrategyV2(crab).getVaultDetails();
        p.totalDeposit = _findTotalDepositFromAuctioned(collateral, debt, toMint);
        console.log("Using only", toMint, "sqth");
        console.log(p.totalDeposit);

        uint256 mm1Balance = weth.balanceOf(mm1);
        uint256 initDepositorBalance = weth.balanceOf(depositor);
        netting.depositAuction(p);
        assertLe(((toMint * p.clearingPrice) / 10 ** 18) - (mm1Balance - weth.balanceOf(mm1)), 180);

        assertApproxEqAbs(ICrabStrategyV2(crab).balanceOf(depositor), 147e18, 1e18);
        assertApproxEqAbs(
            sqth.balanceOf(mm1), toMint, 0.001e18, "All minted not sold, check if we sold only what we took for"
        );
        assertApproxEqAbs(
            weth.balanceOf(depositor) - initDepositorBalance, 23e17, 1e17, "deposit not refunded enough eth"
        );
    }

    function _findBorrow(uint256 toFlash, uint256 debt, uint256 collateral) internal returns (uint256) {
        // we want a precision of six decimals
        // TODo fix the inifinte loop
        uint8 decimals = 6;

        uint256 start = 5 * 10 ** decimals;
        uint256 end = 30 * 10 ** decimals;
        uint256 mid;
        uint256 ethToBorrow;
        uint256 totDep;
        uint256 debtMinted;
        uint256 ethReceived;
        while (true) {
            mid = (start + end) / 2;
            ethToBorrow = (toFlash * mid) / 10 ** (decimals + 1);
            totDep = toFlash + ethToBorrow;
            debtMinted = (totDep * debt) / collateral;

            // get quote for debt minted and check if eth value is > borrowed but within deviation
            // if eth value is lesser, then we borrow less so end = mid; else start = mid
            ethReceived = _getSqthPrice(debtMinted);
            if (ethReceived >= ethToBorrow && ethReceived <= (ethToBorrow * 10100) / 10000) {
                break;
            }
            // mid is the multiple
            else {
                if (ethReceived > ethToBorrow) {
                    start = mid;
                } else {
                    end = mid;
                }
            }
        }
        // why is all the eth not being take in
        return mid + 1e7;
    }

    function _isEnough(uint256 _userETh, uint256 oSqthQuantity, uint256 oSqthPrice, uint256 _totalDep)
        internal
        pure
        returns (bool)
    {
        uint256 totalAfterSelling = (_userETh + ((oSqthQuantity * oSqthPrice)) / 1e18);
        return totalAfterSelling > _totalDep;
    }

    function _convertUSDToETH(uint256 _usdc) internal returns (uint256) {
        // get the uniswap quoter contract code and address and initiate it
        return quoter.quoteExactInputSingle(
            address(usdc),
            address(weth),
            500, //3000 is 0.3
            _usdc,
            0
        );
    }

    function _getSqthPrice(uint256 _quantity) internal returns (uint256) {
        return quoter.quoteExactInputSingle(address(sqth), address(weth), 3000, _quantity, 0);
    }
}
