// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "forge-std/Test.sol";

import {IWETH} from "../src/interfaces/IWETH.sol";

import {CrabNetting, Order} from "../src/CrabNetting.sol";
import {ERC20} from "openzeppelin/token/ERC20/ERC20.sol";
import {IQuoter} from "@uniswap/v3-periphery/contracts/interfaces/IQuoter.sol";
import {ICrabStrategyV2} from "../src/interfaces/ICrabStrategyV2.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";

contract FixedERC20 is ERC20 {
    constructor(uint256 initialSupply) ERC20("USDC", "USDC") {
        _mint(msg.sender, initialSupply);
    }
}

contract DepositAuctionTest is Test {
    ISwapRouter public immutable swapRouter =
        ISwapRouter(0xE592427A0AEce92De3Edee1F18E0157C05861564);
    uint256 internal depositorPk;
    address internal depositor;

    uint256 internal mm1Pk;
    address internal mm1;

    uint256 internal mm2Pk;
    address internal mm2;

    ICrabStrategyV2 crab;
    IWETH weth;
    ERC20 usdc;
    ERC20 sqth;
    CrabNetting netting;
    Order[] orders;
    IQuoter quoter;

    function setUp() public {
        string memory FORK_URL = vm.envString("FORK_URL");
        vm.createSelectFork(FORK_URL, 15819213); // price of eth in this block is 1,343.83
        quoter = IQuoter(0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6);
        crab = ICrabStrategyV2(0x3B960E47784150F5a63777201ee2B15253D713e8);
        weth = IWETH(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);
        usdc = ERC20(0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48);
        sqth = ERC20(0xf1B99e3E573A1a9C5E6B2Ce818b617F0E664E86B);

        depositorPk = 0xA11CE;
        depositor = vm.addr(depositorPk);
        vm.deal(depositor, 100000000e18);
        mm1Pk = 0xA11CC;
        mm1 = vm.addr(mm1Pk);
        mm2Pk = 0xA11CA;
        mm2 = vm.addr(mm2Pk);

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

        netting = new CrabNetting(address(usdc), address(crab), address(weth));
        console.log(address(netting).balance, "netting balance at deploy");
        vm.startPrank(depositor);
        usdc.approve(address(netting), 200000 * 1e6);
        netting.depositUSDC(200000 * 1e6);
        vm.stopPrank();
    }

    function testDepositAuction() public {
        _findTotalDeposit();
        // approx 400 sqth needs to be sold for this
        // at a price of clearning price
        // create an array of orders
        //netting.depositWithAuctionOrder()
    }

    function _findTotalDeposit() internal {
        // const _ethAmount = toBigNumber(ethAmount || '0', 18)
        // const _limitPrice = toBigNumber(limitPrice || '0', 18)
        // const debt = vault.shortAmount
        // const collat = vault.collateral
        // totalDeposit = userEth / (1-(debt*oSQTHPx / collateral))
        // const totalDeposit = wdiv(_ethAmount, BIG_ONE.sub(wdiv(wmul(debt, _limitPrice), collat)))
        // ====
        // get the usd to deposit remaining
        uint256 depositsQueued = netting.depositsQueued();
        // find the eth value of it
        uint256 depositsQdInETH = _convertUSDToETH(depositsQueued);
        _log(depositsQdInETH, "ETH depo");

        // lets get the uniswap price, you can get this from uniswap function in crabstratgegy itself
        console.log(_getSqthPrice(1e18), "price original");
        uint256 sqthPrice = (_getSqthPrice(1e18) * 988) / 1000;
        _log(sqthPrice, "sqth price 15 decimals", 15);
        // get the vault details
        (, , uint256 collateral, uint256 debt) = crab.getVaultDetails();
        _log(collateral, "vault eth");
        _log(debt, "vault sqth");
        // get the total deposit
        uint256 totalDeposit = (depositsQdInETH * 1e18) /
            (1e18 - ((debt * sqthPrice) / collateral));
        _log(totalDeposit, "total deposit");

        uint256 toMint = (totalDeposit * debt) / collateral;
        _log(toMint, "toMint");
        // --------
        // then write a test suite with a high eth value where it fails
        bool trade_works = _isEnough(
            depositsQdInETH,
            toMint,
            sqthPrice,
            totalDeposit
        );
        require(trade_works, "depositing more than we have from sellling");

        // if i sell the sqth and get eth add to user eth, will it be > total deposit

        // then reduce the total value to get more trade value like in crab otc looping
        // find out the root cause of this rounding issue

        // turns out the issue did not occur,
        // so we go ahead as though the auction closed for 0.993 osqth price
        orders.push(
            Order(0, mm1, toMint, sqthPrice, true, 0, 0, 1, 0x00, 0x00)
        );
        vm.prank(mm1);
        weth.approve(address(netting), 1e30);

        uint256 auctionPrice = (sqthPrice * 1010) / 1000;
        uint256 excessEth = (toMint * (auctionPrice - sqthPrice)) / 1e18;
        console.log(excessEth, "excess");

        uint256 toFlash = ((excessEth * collateral) /
            ((debt * auctionPrice) / 1e18));
        console.log(toFlash, "toFlash");

        console.log(
            ICrabStrategyV2(crab).balanceOf(depositor),
            "balance start crab"
        );

        // Find the borrow ration for toFlash
        uint256 mid = _findBorrow(toFlash, debt, collateral);
        // ------------- //
        netting.depositAuction(
            depositsQueued,
            depositsQdInETH,
            totalDeposit,
            orders,
            auctionPrice,
            (toFlash * mid) / 10**7
            //(excessEth * 396791) / 200000
        );

        assertGt(ICrabStrategyV2(crab).balanceOf(depositor), 148e18);
        assertEq(sqth.balanceOf(mm1), toMint);
    }

    function _findBorrow(
        uint256 toFlash,
        uint256 debt,
        uint256 collateral
    ) internal returns (uint256) {
        // we want a precision of six decimals
        // TODo fix the inifinte loop
        uint8 decimals = 6;

        uint256 start = 5 * 10**decimals;
        uint256 end = 30 * 10**decimals;
        uint256 mid;
        uint256 ethToBorrow;
        uint256 totDep;
        uint256 debtMinted;
        uint256 ethReceived;
        while (true) {
            mid = (start + end) / 2;
            console.log(mid, "mid");
            ethToBorrow = (toFlash * mid) / 10**(decimals + 1);
            console.log(ethToBorrow, "ethborrow");
            totDep = toFlash + ethToBorrow;
            debtMinted = (totDep * debt) / collateral;

            // get quote for debt minted and check if eth value is > borrowed but within deviation
            // if eth value is lesser, then we borrow less so end = mid; else start = mid
            ethReceived = _getSqthPrice(debtMinted);
            if (
                ethReceived >= ethToBorrow &&
                ethReceived <= (ethToBorrow * 10100) / 10000
            ) {
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
        console.log(mid);
        return mid;
    }

    function _isEnough(
        uint256 _userETh,
        uint256 oSqthQuantity,
        uint256 oSqthPrice,
        uint256 _totalDep
    ) internal returns (bool) {
        uint256 totalAfterSelling = (_userETh +
            ((oSqthQuantity * oSqthPrice)) /
            1e18);
        console.log(totalAfterSelling, "totalAfterSelling");
        return totalAfterSelling > _totalDep;
    }

    function _convertUSDToETH(uint256 _usdc) internal returns (uint256) {
        // get the uniswap quoter contract code and address and initiate it
        return
            quoter.quoteExactInputSingle(
                address(usdc),
                address(weth),
                500, //3000 is 0.3
                _usdc,
                0
            );
    }

    function _getSqthPrice(uint256 _quantity) internal returns (uint256) {
        return
            quoter.quoteExactInputSingle(
                address(sqth),
                address(weth),
                3000,
                _quantity,
                0
            );
    }

    function _log(
        uint256 val,
        string memory s,
        uint16 decimals
    ) internal view {
        if (decimals == 0) decimals = 16;
        console.log(val / (10**decimals), s, val);
    }

    function _log(uint256 val, string memory s) internal view {
        console.log((val / 1e18), s, val);
    }
}
