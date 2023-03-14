// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// interface
import { IERC20 } from "openzeppelin/interfaces/IERC20.sol";
import { IZenBullStrategy } from "./interface/IZenBullStrategy.sol";
import { IOracle } from "./interface/IOracle.sol";
import { IEulerSimpleLens } from "./interface/IEulerSimpleLens.sol";

library NettingLib {
    event TransferWethFromMarketMakers(
        address indexed trader,
        uint256 quantity,
        uint256 wethAmount,
        uint256 remainingOsqthBalance,
        uint256 clearingPrice
    );
    event TransferOsqthToMarketMakers(
        address indexed trader, uint256 bidId, uint256 quantity, uint256 remainingOsqthBalance
    );
    event TransferOsqthFromMarketMakers(
        address indexed trader, uint256 quantity, uint256 oSqthRemaining
    );
    event TransferWethToMarketMaker(
        address indexed trader,
        uint256 bidId,
        uint256 quantity,
        uint256 wethAmount,
        uint256 oSqthRemaining,
        uint256 clearingPrice
    );

    /**
     * @notice transfer WETH from market maker to netting contract
     * @dev this is executed during the deposit auction, MM buying OSQTH for WETH
     * @param _weth WETH address
     * @param _trader market maker address
     * @param _quantity oSQTH quantity
     * @param _oSqthToMint remaining amount of the total oSqthToMint
     * @param _clearingPrice auction clearing price
     */
    function transferWethFromMarketMakers(
        address _weth,
        address _trader,
        uint256 _quantity,
        uint256 _oSqthToMint,
        uint256 _clearingPrice
    ) external returns (bool, uint256) {
        uint256 wethAmount;
        uint256 remainingOsqthToMint;
        if (_quantity >= _oSqthToMint) {
            wethAmount = (_oSqthToMint * _clearingPrice) / 1e18;
            IERC20(_weth).transferFrom(_trader, address(this), wethAmount);

            emit TransferWethFromMarketMakers(
                _trader, _oSqthToMint, wethAmount, remainingOsqthToMint, _clearingPrice
            );
            return (true, remainingOsqthToMint);
        } else {
            wethAmount = (_quantity * _clearingPrice) / 1e18;
            remainingOsqthToMint = _oSqthToMint - _quantity;
            IERC20(_weth).transferFrom(_trader, address(this), wethAmount);

            emit TransferWethFromMarketMakers(
                _trader, _quantity, wethAmount, remainingOsqthToMint, _clearingPrice
            );
            return (false, remainingOsqthToMint);
        }
    }

    /**
     * @notice transfer oSQTH to market maker
     * @dev this is executed during the deposit auction, MM buying OSQTH for WETH
     * @param _oSqth oSQTH address
     * @param _trader market maker address
     * @param _bidId MM's bid ID
     * @param _oSqthBalance remaining netting contracts's oSQTH balance
     * @param _quantity oSQTH quantity in market maker order
     */
    function transferOsqthToMarketMakers(
        address _oSqth,
        address _trader,
        uint256 _bidId,
        uint256 _oSqthBalance,
        uint256 _quantity
    ) external returns (bool, uint256) {
        uint256 remainingOsqthBalance;
        if (_quantity < _oSqthBalance) {
            IERC20(_oSqth).transfer(_trader, _quantity);

            remainingOsqthBalance = _oSqthBalance - _quantity;

            emit TransferOsqthToMarketMakers(_trader, _bidId, _quantity, remainingOsqthBalance);

            return (false, remainingOsqthBalance);
        } else {
            IERC20(_oSqth).transfer(_trader, _oSqthBalance);

            emit TransferOsqthToMarketMakers(_trader, _bidId, _oSqthBalance, remainingOsqthBalance);

            return (true, remainingOsqthBalance);
        }
    }

    /**
     * @notice transfer oSQTH from market maker
     * @dev this is executed during the withdraw auction, MM selling OSQTH for WETH
     * @param _oSqth oSQTH address
     * @param _trader market maker address
     * @param _remainingOsqthToPull remaining amount of oSQTH from the total oSQTH amount to transfer from order array
     * @param _quantity oSQTH quantity in market maker order
     */
    function transferOsqthFromMarketMakers(
        address _oSqth,
        address _trader,
        uint256 _remainingOsqthToPull,
        uint256 _quantity
    ) internal returns (uint256) {
        uint256 oSqthRemaining;
        if (_quantity < _remainingOsqthToPull) {
            IERC20(_oSqth).transferFrom(_trader, address(this), _quantity);

            oSqthRemaining = _remainingOsqthToPull - _quantity;

            emit TransferOsqthFromMarketMakers(_trader, _quantity, oSqthRemaining);
        } else {
            IERC20(_oSqth).transferFrom(_trader, address(this), _remainingOsqthToPull);

            emit TransferOsqthFromMarketMakers(_trader, _remainingOsqthToPull, oSqthRemaining);
        }

        return oSqthRemaining;
    }

    /**
     * @notice transfer WETH to market maker
     * @dev this is executed during the withdraw auction, MM selling OSQTH for WETH
     * @param _weth WETH address
     * @param _trader market maker address
     * @param _bidId market maker bid ID
     * @param _remainingOsqthToPull total oSQTH to get from orders array
     * @param _quantity market maker's oSQTH order quantity
     * @param _clearingPrice auction clearing price
     */
    function transferWethToMarketMaker(
        address _weth,
        address _trader,
        uint256 _bidId,
        uint256 _remainingOsqthToPull,
        uint256 _quantity,
        uint256 _clearingPrice
    ) external returns (uint256) {
        uint256 oSqthQuantity;

        if (_quantity < _remainingOsqthToPull) {
            oSqthQuantity = _quantity;
        } else {
            oSqthQuantity = _remainingOsqthToPull;
        }

        uint256 wethAmount = (oSqthQuantity * _clearingPrice) / 1e18;
        _remainingOsqthToPull -= oSqthQuantity;
        IERC20(_weth).transfer(_trader, wethAmount);

        emit TransferWethToMarketMaker(
            _trader, _bidId, _quantity, wethAmount, _remainingOsqthToPull, _clearingPrice
        );

        return _remainingOsqthToPull;
    }

    /**
     * @notice get _crab token price
     * @param _oracle oracle address
     * @param _crab crab token address
     * @param _ethUsdcPool ETH/USDC Uni v3 pool address
     * @param _ethSqueethPool ETH/oSQTH Uni v3 pool address
     * @param _oSqth oSQTH address
     * @param _usdc USDC address
     * @param _weth WETH address
     * @param _zenBull ZenBull strategy address
     * @param _auctionTwapPeriod auction TWAP
     */
    function getCrabPrice(
        address _oracle,
        address _crab,
        address _ethUsdcPool,
        address _ethSqueethPool,
        address _oSqth,
        address _usdc,
        address _weth,
        address _zenBull,
        uint32 _auctionTwapPeriod
    ) external view returns (uint256, uint256) {
        uint256 squeethEthPrice =
            IOracle(_oracle).getTwap(_ethSqueethPool, _oSqth, _weth, _auctionTwapPeriod, false);
        uint256 _ethUsdcPrice =
            IOracle(_oracle).getTwap(_ethUsdcPool, _weth, _usdc, _auctionTwapPeriod, false);
        (uint256 crabCollateral, uint256 crabDebt) =
            IZenBullStrategy(_zenBull).getCrabVaultDetails();
        uint256 _crabFairPriceInEth = (crabCollateral - (crabDebt * squeethEthPrice / 1e18)) * 1e18
            / IERC20(_crab).totalSupply();

        return (_crabFairPriceInEth, _ethUsdcPrice);
    }

    /**
     * @notice get ZenBull token price
     * @param _zenBull ZenBull token address
     * @param _eulerLens EulerSimpleLens contract address
     * @param _usdc USDC address
     * @param _weth WETH address
     * @param _crabFairPriceInEth Crab token price
     * @param _ethUsdcPrice ETH/USDC price
     */
    function getZenBullPrice(
        address _zenBull,
        address _eulerLens,
        address _usdc,
        address _weth,
        uint256 _crabFairPriceInEth,
        uint256 _ethUsdcPrice
    ) external view returns (uint256) {
        uint256 zenBullCrabBalance = IZenBullStrategy(_zenBull).getCrabBalance();
        return (
            IEulerSimpleLens(_eulerLens).getETokenBalance(_weth, _zenBull)
                + (zenBullCrabBalance * _crabFairPriceInEth / 1e18)
                - (
                    (IEulerSimpleLens(_eulerLens).getDTokenBalance(_usdc, _zenBull) * 1e12 * 1e18)
                        / _ethUsdcPrice
                )
        ) * 1e18 / IERC20(_zenBull).totalSupply();
    }

    /**
     * @notice calculate oSQTH to mint and amount of eth to deposit into Crab v2 based on amount of crab token
     * @param _crab crab strategy address
     * @param _zenBull ZenBull strategy address
     * @param _crabAmount amount of crab token
     */
    function calcOsqthToMintAndEthIntoCrab(address _crab, address _zenBull, uint256 _crabAmount)
        external
        view
        returns (uint256, uint256)
    {
        uint256 crabTotalSupply = IERC20(_crab).totalSupply();
        (uint256 crabEth, uint256 crabDebt) = IZenBullStrategy(_zenBull).getCrabVaultDetails();
        uint256 _oSqthToMint = _crabAmount * crabDebt / crabTotalSupply;
        uint256 ethIntoCrab = _crabAmount * crabEth / crabTotalSupply;

        return (_oSqthToMint, ethIntoCrab);
    }

    /**
     * @notice calculate amount of WETH to lend in and USDC to borrow from Euler
     * @param _eulerLens EulerSimpleLens contract address
     * @param _zenBull ZenBull strategy address
     * @param _weth WETH address
     * @param _usdc USDC address
     * @param _crabAmount amount of crab token
     */
    function calcWethToLendAndUsdcToBorrow(
        address _eulerLens,
        address _zenBull,
        address _weth,
        address _usdc,
        uint256 _crabAmount
    ) external view returns (uint256, uint256) {
        uint256 share =
            div(_crabAmount, (IZenBullStrategy(_zenBull).getCrabBalance() + _crabAmount));
        uint256 wethToLend = div(
            mul(IEulerSimpleLens(_eulerLens).getETokenBalance(_weth, _zenBull), share), 1e18 - share
        );
        uint256 usdcToBorrow = div(
            mul(IEulerSimpleLens(_eulerLens).getDTokenBalance(_usdc, _zenBull), share), 1e18 - share
        );

        return (wethToLend, usdcToBorrow);
    }

    /**
     * @notice calculate amount of oSQTH to get based on amount of ZenBull to Withdraw
     * @param _zenBull ZenBull strategy address
     * @param _crab crab strategy address
     * @param _withdrawsToProcess amount of ZenBull token to withdraw
     */
    function calcOsqthAmount(address _zenBull, address _crab, uint256 _withdrawsToProcess)
        external
        view
        returns (uint256)
    {
        uint256 bullTotalSupply = IERC20(_zenBull).totalSupply();
        (, uint256 crabDebt) = IZenBullStrategy(_zenBull).getCrabVaultDetails();
        uint256 share = div(_withdrawsToProcess, bullTotalSupply);
        uint256 _crabAmount = mul(share, IZenBullStrategy(_zenBull).getCrabBalance());

        return div(mul(_crabAmount, crabDebt), IERC20(_crab).totalSupply());
    }

    function mul(uint256 _x, uint256 _y) internal pure returns (uint256) {
        // add(mul(_x, _y), WAD / 2) / WAD;
        return ((_x * _y) + (1e18 / 2)) / 1e18;
    }

    function div(uint256 _x, uint256 _y) internal pure returns (uint256) {
        // add(mul(_x, WAD), _y / 2) / _y;
        return ((_x * 1e18) + (_y / 2)) / _y;
    }
}
