// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// interface
import { IERC20 } from "openzeppelin/interfaces/IERC20.sol";
import { IZenBullStrategy } from "./interface/IZenBullStrategy.sol";
import { IOracle } from "./interface/IOracle.sol";
import { IEulerSimpleLens } from "./interface/IEulerSimpleLens.sol";
import { IWETH } from "./interface/IWETH.sol";

library NettingLib {
    event DepositAuction(address indexed trader, uint256 indexed bidId, uint256 quantity);
    event WithdrawAuction(
        address indexed trader, uint256 indexed bidId, uint256 quantity, uint256 price
    );

    function transferWethFromMarketMakers(
        address weth,
        address trader,
        uint256 quantity,
        uint256 oSqthToMint,
        uint256 clearingPrice
    ) external returns (bool, uint256) {
        if (quantity >= oSqthToMint) {
            IWETH(weth).transferFrom(trader, address(this), (oSqthToMint * clearingPrice) / 1e18);

            return (true, 0);
        } else {
            IWETH(weth).transferFrom(trader, address(this), (quantity * clearingPrice) / 1e18);

            return (false, (oSqthToMint - quantity));
        }
    }

    function transferOsqthFromMarketMakers(
        address oSqth,
        address trader,
        uint256 toExchange,
        uint256 quantity
    ) internal returns (bool, uint256) {
        if (quantity < toExchange) {
            IERC20(oSqth).transferFrom(trader, address(this), quantity);
            return (false, (toExchange - quantity));
        } else {
            IERC20(oSqth).transferFrom(trader, address(this), toExchange);
            return (true, 0);
        }
    }

    function transferOsqthToMarketMakers(
        address oSqth,
        address trader,
        uint256 bidId,
        uint256 oSqthBalance,
        uint256 quantity
    ) external returns (bool, uint256) {
        if (quantity < oSqthBalance) {
            IERC20(oSqth).transfer(trader, quantity);

            emit DepositAuction(trader, bidId, quantity);

            return (false, (oSqthBalance - quantity));
        } else {
            IERC20(oSqth).transfer(trader, oSqthBalance);

            emit DepositAuction(trader, bidId, oSqthBalance);

            return (true, 0);
        }
    }

    function transferWethToMarketMaker(
        address weth,
        address trader,
        uint256 bidId,
        uint256 toExchange,
        uint256 quantity,
        uint256 clearingPrice
    ) external returns (uint256) {
        uint256 oSqthQuantity;

        if (quantity < toExchange) {
            oSqthQuantity = quantity;
        } else {
            oSqthQuantity = toExchange;
        }

        IERC20(weth).transfer(trader, (oSqthQuantity * clearingPrice) / 1e18);
        toExchange -= oSqthQuantity;

        emit WithdrawAuction(trader, bidId, oSqthQuantity, clearingPrice);

        return toExchange;
    }

    function getCrabPrice(
        address oracle,
        address crab,
        address ethUsdcPool,
        address ethSqueethPool,
        address oSqth,
        address usdc,
        address weth,
        address zenBull,
        uint32 auctionTwapPeriod
    ) external view returns (uint256, uint256) {
        uint256 squeethEthPrice =
            IOracle(oracle).getTwap(ethSqueethPool, oSqth, weth, auctionTwapPeriod, false);
        uint256 ethUsdcPrice =
            IOracle(oracle).getTwap(ethUsdcPool, weth, usdc, auctionTwapPeriod, false);
        (uint256 crabCollateral, uint256 crabDebt) = IZenBullStrategy(zenBull).getCrabVaultDetails();
        uint256 crabFairPriceInEth = (crabCollateral - (crabDebt * squeethEthPrice / 1e18)) * 1e18
            / IERC20(crab).totalSupply();

        return (crabFairPriceInEth, ethUsdcPrice);
    }

    function getZenBullPrice(
        address zenBull,
        address eulerLens,
        address usdc,
        address weth,
        uint256 crabFairPriceInEth,
        uint256 ethUsdcPrice
    ) external view returns (uint256) {
        uint256 zenBullCrabBalance = IZenBullStrategy(zenBull).getCrabBalance();
        return (
            IEulerSimpleLens(eulerLens).getETokenBalance(weth, zenBull)
                + (zenBullCrabBalance * crabFairPriceInEth / 1e18)
                - (
                    (IEulerSimpleLens(eulerLens).getDTokenBalance(usdc, zenBull) * 1e12 * 1e18)
                        / ethUsdcPrice
                )
        ) * 1e18 / IERC20(zenBull).totalSupply();
    }

    function calcOsqthToMintAndEthIntoCrab(address crab, address zenBull, uint256 crabAmount)
        external
        view
        returns (uint256, uint256)
    {
        uint256 crabTotalSupply = IERC20(crab).totalSupply();
        (uint256 crabEth, uint256 crabDebt) = IZenBullStrategy(zenBull).getCrabVaultDetails();
        uint256 oSqthToMint = crabAmount * crabDebt / crabTotalSupply;
        uint256 ethIntoCrab = crabAmount * crabEth / crabTotalSupply;

        return (oSqthToMint, ethIntoCrab);
    }

    function caclWethToLendAndUsdcToBorrow(
        address eulerLens,
        address zenBull,
        address weth,
        address usdc,
        uint256 crabAmount
    ) external view returns (uint256, uint256) {
        uint256 share =
            crabAmount * 1e18 / (IZenBullStrategy(zenBull).getCrabBalance() + crabAmount);
        uint256 bullTotalSupply = IERC20(zenBull).totalSupply();
        uint256 bullToMint = share * bullTotalSupply / (1e18 - share);
        uint256 wethToLend = bullToMint
            * IEulerSimpleLens(eulerLens).getETokenBalance(weth, zenBull) / bullTotalSupply;
        uint256 usdcToBorrow = bullToMint
            * IEulerSimpleLens(eulerLens).getDTokenBalance(usdc, zenBull) / bullTotalSupply;

        return (wethToLend, usdcToBorrow);
    }

    function calcOsqthAmount(address zenBull, address crab, uint256 withdrawsToProcess)
        external
        view
        returns (uint256)
    {
        uint256 bullTotalSupply = IERC20(zenBull).totalSupply();
        uint256 crabAmount =
            withdrawsToProcess * IZenBullStrategy(zenBull).getCrabBalance() / bullTotalSupply;
        (, uint256 crabDebt) = IZenBullStrategy(zenBull).getCrabVaultDetails();
        return (crabAmount * crabDebt / IERC20(crab).totalSupply());
    }
}
