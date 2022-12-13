// SPDX-License-Identifier: GPL-3.0-only
pragma solidity =0.7.6;
pragma abicoder v2;

// interface
import { IController } from "squeeth-monorepo/interfaces/IController.sol";
import { IZenBullStrategy } from "./interface/IZenBullStrategy.sol";
import { IERC20 } from "openzeppelin/token/ERC20/IERC20.sol";
import { IEulerEToken } from "./interface/IEulerEToken.sol";
import { IEulerDToken } from "./interface/IEulerDToken.sol";
// contract
import { Ownable } from "openzeppelin/access/Ownable.sol";
import { UniFlash } from "./UniFlash.sol";
import { UniOracle } from "./UniOracle.sol";
import { EIP712 } from "openzeppelin/drafts/EIP712.sol";
// lib
import { StrategyMath } from "squeeth-monorepo/strategy/base/StrategyMath.sol";
import { ECDSA } from "openzeppelin/cryptography/ECDSA.sol";
import { Address } from "openzeppelin/utils/Address.sol";

/**
 * Error code
 * AB0: caller is not auction manager
 * AB1: invalid delta after rebalance
 * AB2: invalid CR after rebalance
 * AB3: invalid CR lower and upper values
 * AB4: invalid delta lower and upper values
 * AB5: invalid clearing price
 * AB6: order is not taking the other side of the trade
 * AB7: current order price smaller than previous order price
 * AB8: current order price greater than previous order price
 * AB9: order price is less than clearing price
 * AB10: order price is greater than clearing price
 * AB11: order signer is different than order trader
 * AB12: order already expired
 * AB13: nonce already used
 * AB14: clearning price tolerance is too high
 * AB15: ETH limit price is out of tolerance range
 * AB16: WETH limit price tolerance is too high
 * AB17: price too low relative to Uniswap twap
 * AB18: price too high relative to Uniswap twap
 * AB19: auction manager can not be 0 address
 * AB20: can only receive eth from bull strategy
 * AB21: invalid receiver address
 */

/**
 * @notice ZenAuction contract
 * @author opyn team
 */
contract ZenAuction is UniFlash, Ownable, EIP712 {
    using StrategyMath for uint256;
    using Address for address payable;

    /// @dev typehash for signed orders
    bytes32 private constant _FULL_REBALANCE_TYPEHASH = keccak256(
        "Order(uint256 bidId,address trader,uint256 quantity,uint256 price,bool isBuying,uint256 expiry,uint256 nonce)"
    );

    /// @dev 1e18
    uint256 internal constant ONE = 1e18;
    /// @dev TWAP period
    uint32 internal constant TWAP = 420;
    /// @dev WETH decimals - USDC decimals
    uint256 internal constant WETH_DECIMALS_DIFF = 1e12;

    /// @dev full rebalance clearing price tolerance cannot exceed 20%
    uint256 public constant MAX_FULL_REBALANCE_CLEARING_PRICE_TOLERANCE = 2e17; // 20%
    /// @dev full rebalance WETH limit price tolerance cannot exceed 20%
    uint256 public constant MAX_REBALANCE_WETH_LIMIT_PRICE_TOLERANCE = 2e17; // 20%

    /// @dev USDC address
    address private immutable usdc;
    /// @dev WETH address
    address private immutable weth;
    /// @dev bull strategy address
    address private immutable bullStrategy;
    /// @dev wPowerPerp/eth uniswap pool address
    address private immutable ethWPowerPerpPool;
    /// @dev eth/usdc uniswap pool address
    address private immutable ethUSDCPool;
    /// @dev wPowerPerp address
    address private immutable wPowerPerp;
    /// @dev crab strategy address
    address private immutable crab;
    /// @dev euler eToken for WETH
    address private immutable eToken;
    /// @dev euler dToken for USDC
    address private immutable dToken;

    /// @dev highest delta the auction manager can rebalance to
    uint256 public deltaUpper;
    /// @dev lowest delta the auction manager can rebalance to
    uint256 public deltaLower;
    /// @dev highest CR the auction manager can rebalance to
    uint256 public crUpper;
    /// @dev lowest CR the auction manager can rebalance to
    uint256 public crLower;
    /// @dev full rebalance clearing price must be within this distance of the wPowerPerp:eth uniswap twap price
    uint256 public fullRebalanceClearingPriceTolerance = 5e16; // 5%
    /// @dev full rebalance WETH limit price must be within this distance of the eth:usd uniswap twap price
    uint256 public rebalanceWethLimitPriceTolerance = 5e16; // 5%

    /// @dev auction manager
    address public auctionManager;

    /// @dev store the used flag for a nonce for each address
    mapping(address => mapping(uint256 => bool)) public nonces;

    /// @dev enum to differentiate between Uniswap swap callback function source
    enum FLASH_SOURCE {
        LEVERAGE_REBALANCE_DECREASE_DEBT,
        LEVERAGE_REBALANCE_INCREASE_DEBT,
        FULL_REBALANCE_BORROW_USDC_BUY_WETH,
        FULL_REBALANCE_REPAY_USDC_WITHDRAW_WETH,
        FULL_REBALANCE_DEPOSIT_WETH_BORROW_USDC_DEPOSIT_INTO_CRAB,
        FULL_REBALANCE_WITHDRAW_WETH_BORROW_USDC_DEPOSIT_INTO_CRAB,
        FULL_REBALANCE_SELL_WETH_REPAY_USDC_DEPOSIT_INTO_CRAB,
        FULL_REBALANCE_REPAY_USDC_DEPOSIT_WETH
    }
    ///@dev fullRebalance order struct

    struct Order {
        uint256 bidId;
        address trader;
        uint256 quantity;
        uint256 price;
        bool isBuying;
        uint256 expiry;
        uint256 nonce;
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    ///@dev _executeCrabDeposit params struct

    ///@dev _executeCrabDeposit params struct
    struct ExecuteCrabDepositParams {
        uint256 crabAmount;
        uint256 wethTargetInEuler;
        uint256 wethLimitPrice;
        uint256 ethInCrab;
        uint256 wethBoughtFromAuction;
        uint24 ethUsdcPoolFee;
    }

    ///@dev _executeLeverageComponentRebalancing params struct
    struct ExecuteLeverageComponentRebalancingParams {
        uint256 wethTargetInEuler;
        uint256 wethLimitPrice;
        uint256 netWethReceived;
        uint24 ethUsdcPoolFee;
    }

    event SetCrUpperAndLower(
        uint256 oldCrLower, uint256 oldCrUpper, uint256 newCrLower, uint256 newCrUpper
    );
    event SetDeltaUpperAndLower(
        uint256 oldDeltaLower, uint256 oldDeltaUpper, uint256 newDeltaLower, uint256 newDeltaUpper
    );
    event LeverageRebalance(bool isSellingUsdc, uint256 usdcAmount, uint256 wethLimitAmount);

    event FullRebalance(
        uint256 crabAmount,
        uint256 clearingPrice,
        bool isDepositingInCrab,
        uint256 wPowerPerpAmount,
        uint256 wethTargetInEuler
    );

    event SetFullRebalanceClearingPriceTolerance(
        uint256 oldPriceTolerance, uint256 newPriceTolerance
    );
    event SetRebalanceWethLimitPriceTolerance(
        uint256 oldWethLimitPriceTolerance, uint256 newWethLimitPriceTolerance
    );
    event SetAuctionManager(address oldAuctionManager, address newAuctionManager);
    event Farm(address indexed asset, address indexed receiver);

    /**
     * @notice constructor for ZenAuction
     * @param _auctionManager the address that can run auctions
     * @param _bull bull strategy address
     * @param _factory uniswap factory address
     * @param _crab crab strategy address
     * @param _eToken euler collateral token address for weth
     * @param _dToken euler debt token address for usdc
     */
    constructor(
        address _auctionManager,
        address _bull,
        address _factory,
        address _crab,
        address _eToken,
        address _dToken
    ) UniFlash(_factory) Ownable() EIP712("AuctionBull", "1") {
        auctionManager = _auctionManager;
        bullStrategy = _bull;
        weth = IController(IZenBullStrategy(_bull).powerTokenController()).weth();
        usdc = IController(IZenBullStrategy(_bull).powerTokenController()).quoteCurrency();
        ethWPowerPerpPool =
            IController(IZenBullStrategy(_bull).powerTokenController()).wPowerPerpPool();
        ethUSDCPool =
            IController(IZenBullStrategy(_bull).powerTokenController()).ethQuoteCurrencyPool();
        wPowerPerp = IController(IZenBullStrategy(_bull).powerTokenController()).wPowerPerp();
        crab = _crab;
        eToken = _eToken;
        dToken = _dToken;

        IERC20(IController(IZenBullStrategy(_bull).powerTokenController()).weth()).approve(
            _bull, type(uint256).max
        );
        IERC20(IController(IZenBullStrategy(_bull).powerTokenController()).quoteCurrency()).approve(
            _bull, type(uint256).max
        );
        IERC20(IController(IZenBullStrategy(_bull).powerTokenController()).wPowerPerp()).approve(
            _bull, type(uint256).max
        );
    }

    /**
     * @notice receive function to allow ETH transfer to this contract
     */
    receive() external payable {
        require(msg.sender == address(bullStrategy), "AB20");
    }

    /**
     * @notice sets the auction manager, who has permission to run fullRebalance() and leverageRebalance() functions to rebalance the strategy
     * @param _auctionManager the new auction manager address
     */
    function setAuctionManager(address _auctionManager) external onlyOwner {
        require(_auctionManager != address(0), "AB19");

        emit SetAuctionManager(auctionManager, _auctionManager);

        auctionManager = _auctionManager;
    }

    /**
     * @notice owner can set a threshold, scaled by 1e18 that determines the maximum tolerance between a clearing sale price and the current uniswap twap price
     * @param _fullRebalancePriceTolerance the OTC price tolerance, in percent, scaled by 1e18
     */
    function setFullRebalanceClearingPriceTolerance(uint256 _fullRebalancePriceTolerance)
        external
        onlyOwner
    {
        // tolerance cannot be more than 20%
        require(_fullRebalancePriceTolerance <= MAX_FULL_REBALANCE_CLEARING_PRICE_TOLERANCE, "AB14");

        emit SetFullRebalanceClearingPriceTolerance(
            fullRebalanceClearingPriceTolerance, _fullRebalancePriceTolerance
            );

        fullRebalanceClearingPriceTolerance = _fullRebalancePriceTolerance;
    }

    /**
     * @notice owner can set a threshold, scaled by 1e18 that determines the maximum tolerance between a WETH limit price and the current uniswap twap price
     * @param _rebalanceWethLimitPriceTolerance the WETH limit price tolerance, in percent, scaled by 1e18
     */
    function setRebalanceWethLimitPriceTolerance(uint256 _rebalanceWethLimitPriceTolerance)
        external
        onlyOwner
    {
        // tolerance cannot be more than 20%
        require(
            _rebalanceWethLimitPriceTolerance <= MAX_REBALANCE_WETH_LIMIT_PRICE_TOLERANCE, "AB16"
        );

        emit SetRebalanceWethLimitPriceTolerance(
            rebalanceWethLimitPriceTolerance, _rebalanceWethLimitPriceTolerance
            );

        rebalanceWethLimitPriceTolerance = _rebalanceWethLimitPriceTolerance;
    }

    /**
     * @notice set strategy lower and upper collateral ratio
     * @dev should only be callable by owner
     * @param _crLower lower CR scaled by 1e18
     * @param _crUpper upper CR scaled by 1e18
     */
    function setCrUpperAndLower(uint256 _crLower, uint256 _crUpper) external onlyOwner {
        require(_crUpper > _crLower, "AB3");

        emit SetCrUpperAndLower(crLower, crUpper, _crLower, _crUpper);

        crLower = _crLower;
        crUpper = _crUpper;
    }

    /**
     * @notice set strategy lower and upper delta to ETH price
     * @dev can only be callable by owner
     * @param _deltaLower lower delta scaled by 1e18
     * @param _deltaUpper upper delta scaled by 1e18
     */
    function setDeltaUpperAndLower(uint256 _deltaLower, uint256 _deltaUpper) external onlyOwner {
        require(_deltaUpper > _deltaLower, "AB4");

        emit SetDeltaUpperAndLower(deltaLower, deltaUpper, _deltaLower, _deltaUpper);

        deltaLower = _deltaLower;
        deltaUpper = _deltaUpper;
    }

    /**
     * @notice withdraw assets transfered directly to this contract
     * @dev can only be called by owner
     * @param _asset asset address
     * @param _receiver receiver address
     */
    function farm(address _asset, address _receiver) external onlyOwner {
        require(_receiver != address(0), "AB21");

        if (_asset == address(0)) {
            payable(_receiver).sendValue(address(this).balance);
        } else {
            IERC20(_asset).transfer(_receiver, IERC20(_asset).balanceOf(address(this)));
        }

        emit Farm(_asset, _receiver);
    }

    /**
     * @notice rebalance delta and collateral ratio of strategy using an array of signed orders
     * @dev can only be called by the auction manager
     * @param _orders list of orders
     * @param _crabAmount amount of crab to withdraw or deposit
     * @param _clearingPrice clearing price in WETH per wPowerPerp, in 1e18 units
     * @param _wethTargetInEuler target WETH collateral amount in leverage component
     * @param _wethLimitPrice limit price for WETH/USDC trade
     * @param _isDepositingInCrab true if the rebalance will deposit into crab, false if withdrawing funds from crab
     */
    function fullRebalance(
        Order[] memory _orders,
        uint256 _crabAmount,
        uint256 _clearingPrice,
        uint256 _wethTargetInEuler,
        uint256 _wethLimitPrice,
        uint24 _ethUsdcPoolFee,
        bool _isDepositingInCrab
    ) external {
        require(msg.sender == auctionManager, "AB0");
        require(_clearingPrice > 0, "AB5");

        _checkFullRebalanceClearingPrice(_clearingPrice, _isDepositingInCrab);
        _checkRebalanceLimitPrice(_wethLimitPrice);

        // get current crab vault state
        (uint256 ethInCrab, uint256 wPowerPerpInCrab) =
            IZenBullStrategy(bullStrategy).getCrabVaultDetails();
        // total amount of wPowerPerp to trade given crab amount
        uint256 wPowerPerpAmount = _calcWPowerPerpAmountFromCrab(
            _isDepositingInCrab, _crabAmount, ethInCrab, wPowerPerpInCrab
        );

        uint256 pulledFunds =
            _pullFundsFromOrders(_orders, wPowerPerpAmount, _clearingPrice, _isDepositingInCrab);

        if (_isDepositingInCrab) {
            /**
             * if auction is depositing into crab:
             * - if target WETH to have in Euler is greater than current amount in Euler, borrow USDC to buy more WETH and deposit in Euler
             * - if target WETH to have in Euler is less than current amount in Euler, remove WETH from Euler
             * - deposit into crab, pay auction traders wPowerPerp
             */
            _executeCrabDeposit(
                ExecuteCrabDepositParams({
                    crabAmount: _crabAmount,
                    wethTargetInEuler: _wethTargetInEuler,
                    wethLimitPrice: _wethLimitPrice,
                    ethInCrab: ethInCrab,
                    wethBoughtFromAuction: pulledFunds,
                    ethUsdcPoolFee: _ethUsdcPoolFee
                })
            );

            _pushFundsFromOrders(_orders, wPowerPerpAmount, _clearingPrice);
        } else {
            uint256 wethFromCrab = IZenBullStrategy(bullStrategy).redeemCrabAndWithdrawWEth(
                _crabAmount, wPowerPerpAmount
            );
            uint256 pushedFunds = _pushFundsFromOrders(_orders, wPowerPerpAmount, _clearingPrice);

            // rebalance bull strategy delta
            _executeLeverageComponentRebalancing(
                ExecuteLeverageComponentRebalancingParams({
                    wethTargetInEuler: _wethTargetInEuler,
                    wethLimitPrice: _wethLimitPrice,
                    netWethReceived: wethFromCrab.sub(pushedFunds),
                    ethUsdcPoolFee: _ethUsdcPoolFee
                })
            );
        }

        // check that rebalance does not breach collateral ratio or delta tolerance
        _isValidRebalance();

        emit FullRebalance(
            _crabAmount, _clearingPrice, _isDepositingInCrab, wPowerPerpAmount, _wethTargetInEuler
            );
    }

    /**
     * @notice change the strategy eth delta by increasing or decreasing USDC debt
     * @dev can only be called by auction manager
     * @param _isSellingUsdc true if strategy is selling USDC
     * @param _usdcAmount USDC amount to trade
     * @param _wethLimitPrice WETH/USDC limit price, scaled 1e18 units
     * @param _poolFee USDC/WETH pool fee
     */
    function leverageRebalance(
        bool _isSellingUsdc,
        uint256 _usdcAmount,
        uint256 _wethLimitPrice,
        uint24 _poolFee
    ) external {
        require(msg.sender == auctionManager, "AB0");

        _checkRebalanceLimitPrice(_wethLimitPrice);

        if (_isSellingUsdc) {
            // swap USDC to WETH
            _exactInFlashSwap(
                usdc,
                weth,
                _poolFee,
                _usdcAmount,
                _usdcAmount.mul(WETH_DECIMALS_DIFF).wdiv(_wethLimitPrice),
                uint8(FLASH_SOURCE.LEVERAGE_REBALANCE_INCREASE_DEBT),
                ""
            );
        } else {
            // swap WETH to USDC
            _exactOutFlashSwap(
                weth,
                usdc,
                _poolFee,
                _usdcAmount,
                _usdcAmount.mul(WETH_DECIMALS_DIFF).wdiv(_wethLimitPrice),
                uint8(FLASH_SOURCE.LEVERAGE_REBALANCE_DECREASE_DEBT),
                abi.encodePacked(_usdcAmount)
            );
        }

        _isValidRebalance();

        emit LeverageRebalance(_isSellingUsdc, _usdcAmount, _wethLimitPrice);
    }

    /**
     * @notice allows an order to be cancelled by marking its nonce used for a given msg.sender
     * @param _nonce the nonce to mark as used
     */
    function useNonce(uint256 _nonce) external {
        _useNonce(msg.sender, _nonce);
    }
    /**
     * @notice returns the domain separator
     * @return the domain separator
     */
    // solhint-disable-next-line func-name-mixedcase

    function DOMAIN_SEPARATOR() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    /**
     * @notice get current bull strategy delta and collateral ratio
     * @return delta and collateral ratio
     */
    function getCurrentDeltaAndCollatRatio() external view returns (uint256, uint256) {
        return _getCurrentDeltaAndCollatRatio();
    }

    /**
     * @notice pulls funds from trader of auction orders (weth or wPowerPerp) depending on the direction of trade
     * @param _orders list of orders
     * @param remainingAmount amount of wPowerPerp to trade
     * @param _clearingPrice clearing price weth/wPowerPerp, in 1e18 units
     * @param _isDepositingInCrab true if the rebalance will deposit into Crab, false if withdrawing funds from Crab
     */
    function _pullFundsFromOrders(
        Order[] memory _orders,
        uint256 remainingAmount,
        uint256 _clearingPrice,
        bool _isDepositingInCrab
    ) internal returns (uint256) {
        // loop through orders, check each order validity
        // pull funds from orders

        uint256 prevPrice = _orders[0].price;
        uint256 currentPrice;

        uint256 amountTransfered;
        uint256 ordersLength = _orders.length;
        for (uint256 i; i < ordersLength; ++i) {
            _verifyOrder(_orders[i], _clearingPrice, _isDepositingInCrab);

            currentPrice = _orders[i].price;
            // check that orders are in order
            if (_isDepositingInCrab) {
                require(currentPrice <= prevPrice, "AB8");
            } else {
                require(currentPrice >= prevPrice, "AB7");
            }
            prevPrice = currentPrice;

            amountTransfered = amountTransfered.add(
                _transferFromOrder(_orders[i], remainingAmount, _clearingPrice)
            );

            if (remainingAmount > _orders[i].quantity) {
                remainingAmount = remainingAmount.sub(_orders[i].quantity);
            } else {
                break;
            }
        }

        return amountTransfered;
    }

    /**
     * @notice pushes funds to trader of auction orders (weth or wPowerPerp) depending on the direction of trade
     * @param _orders list of orders
     * @param remainingAmount amount of wPowerPerp to trade
     * @param _clearingPrice clearing price weth/wPowerPerp, in 1e18 units
     */

    function _pushFundsFromOrders(
        Order[] memory _orders,
        uint256 remainingAmount,
        uint256 _clearingPrice
    ) internal returns (uint256) {
        uint256 pushedFunds;
        uint256 ordersLength = _orders.length;
        for (uint256 i; i < ordersLength; ++i) {
            pushedFunds =
                pushedFunds.add(_transferToOrder(_orders[i], remainingAmount, _clearingPrice));
            if (remainingAmount > _orders[i].quantity) {
                remainingAmount = remainingAmount.sub(_orders[i].quantity);
            } else {
                break;
            }
        }

        return pushedFunds;
    }

    /**
     * @notice execute crab deposit as well as changes to euler collateral and debt as part of a full rebalance
     * @param _params ExecuteCrabDepositParams struct
     */
    function _executeCrabDeposit(ExecuteCrabDepositParams memory _params) internal {
        // total eth needed for this crab deposit
        uint256 totalEthNeededForCrab =
            _params.crabAmount.wdiv(IERC20(crab).totalSupply()).wmul(_params.ethInCrab);
        // additional eth needed
        uint256 ethNeededForCrab = totalEthNeededForCrab.sub(_params.wethBoughtFromAuction);
        // WETH collateral in Euler
        uint256 wethInCollateral = IEulerEToken(eToken).balanceOfUnderlying(address(bullStrategy));
        if (_params.wethTargetInEuler > wethInCollateral) {
            // crab deposit eth + collateral shortfall
            uint256 wethToGet =
                _params.wethTargetInEuler.sub(wethInCollateral).add(ethNeededForCrab);
            // sell USDC to buy WETH
            _exactOutFlashSwap(
                usdc,
                weth,
                _params.ethUsdcPoolFee,
                wethToGet,
                wethToGet.wmul(_params.wethLimitPrice).div(WETH_DECIMALS_DIFF),
                uint8(FLASH_SOURCE.FULL_REBALANCE_DEPOSIT_WETH_BORROW_USDC_DEPOSIT_INTO_CRAB),
                abi.encodePacked(
                    _params.wethTargetInEuler.sub(wethInCollateral), totalEthNeededForCrab
                )
            );
        } else {
            // WETH to take out of Euler
            uint256 wethFromEuler = wethInCollateral.sub(_params.wethTargetInEuler);

            if (ethNeededForCrab >= wethFromEuler) {
                // crab deposit eth - excess collateral
                uint256 wethToGet = ethNeededForCrab.sub(wethFromEuler);
                // sell USDC to buy WETH
                _exactOutFlashSwap(
                    usdc,
                    weth,
                    _params.ethUsdcPoolFee,
                    wethToGet,
                    wethToGet.wmul(_params.wethLimitPrice).div(WETH_DECIMALS_DIFF),
                    uint8(FLASH_SOURCE.FULL_REBALANCE_WITHDRAW_WETH_BORROW_USDC_DEPOSIT_INTO_CRAB),
                    abi.encodePacked(wethFromEuler, totalEthNeededForCrab)
                );
            } else {
                uint256 wethToSell = wethFromEuler.sub(ethNeededForCrab);
                // sell WETH for USDC
                _exactInFlashSwap(
                    weth,
                    usdc,
                    _params.ethUsdcPoolFee,
                    wethToSell,
                    wethToSell.wmul(_params.wethLimitPrice).div(WETH_DECIMALS_DIFF),
                    uint8(FLASH_SOURCE.FULL_REBALANCE_SELL_WETH_REPAY_USDC_DEPOSIT_INTO_CRAB),
                    abi.encodePacked(wethFromEuler, totalEthNeededForCrab)
                );
            }
        }
    }

    /**
     * @notice uniswap flash swap callback function to handle different types of flashswaps
     * @dev this function will be called by flashswap callback function uniswapV3SwapCallback()
     * @param _uniFlashSwapData UniFlashswapCallbackData struct
     */
    function _uniFlashSwap(UniFlashswapCallbackData memory _uniFlashSwapData) internal override {
        if (
            FLASH_SOURCE(_uniFlashSwapData.callSource)
                == FLASH_SOURCE.LEVERAGE_REBALANCE_INCREASE_DEBT
        ) {
            IZenBullStrategy(bullStrategy).depositAndBorrowFromLeverage(
                IERC20(weth).balanceOf(address(this)), _uniFlashSwapData.amountToPay
            );

            IERC20(usdc).transfer(_uniFlashSwapData.pool, _uniFlashSwapData.amountToPay);
        } else if (
            FLASH_SOURCE(_uniFlashSwapData.callSource)
                == FLASH_SOURCE.LEVERAGE_REBALANCE_DECREASE_DEBT
        ) {
            uint256 usdcToRepay = abi.decode(_uniFlashSwapData.callData, (uint256));
            // Repay some USDC debt
            IZenBullStrategy(bullStrategy).auctionRepayAndWithdrawFromLeverage(
                usdcToRepay, _uniFlashSwapData.amountToPay
            );

            IERC20(weth).transfer(_uniFlashSwapData.pool, _uniFlashSwapData.amountToPay);
        } else if (
            FLASH_SOURCE(_uniFlashSwapData.callSource)
                == FLASH_SOURCE.FULL_REBALANCE_BORROW_USDC_BUY_WETH
        ) {
            uint256 wethToDeposit = abi.decode(_uniFlashSwapData.callData, (uint256));
            IZenBullStrategy(bullStrategy).depositAndBorrowFromLeverage(
                wethToDeposit, _uniFlashSwapData.amountToPay
            );

            IERC20(usdc).transfer(_uniFlashSwapData.pool, _uniFlashSwapData.amountToPay);
        } else if (
            FLASH_SOURCE(_uniFlashSwapData.callSource)
                == FLASH_SOURCE.FULL_REBALANCE_REPAY_USDC_DEPOSIT_WETH
        ) {
            uint256 wethToDeposit = abi.decode(_uniFlashSwapData.callData, (uint256));

            IZenBullStrategy(bullStrategy).auctionDepositAndRepayFromLeverage(
                wethToDeposit, IERC20(usdc).balanceOf(address(this))
            );
            IERC20(weth).transfer(_uniFlashSwapData.pool, _uniFlashSwapData.amountToPay);
        } else if (
            FLASH_SOURCE(_uniFlashSwapData.callSource)
                == FLASH_SOURCE.FULL_REBALANCE_REPAY_USDC_WITHDRAW_WETH
        ) {
            uint256 remainingWeth = abi.decode(_uniFlashSwapData.callData, (uint256));

            IZenBullStrategy(bullStrategy).auctionRepayAndWithdrawFromLeverage(
                IERC20(usdc).balanceOf(address(this)),
                _uniFlashSwapData.amountToPay.sub(remainingWeth)
            );

            // we need to withdraw
            IERC20(weth).transfer(_uniFlashSwapData.pool, _uniFlashSwapData.amountToPay);
        } else if (
            FLASH_SOURCE(_uniFlashSwapData.callSource)
                == FLASH_SOURCE.FULL_REBALANCE_DEPOSIT_WETH_BORROW_USDC_DEPOSIT_INTO_CRAB
        ) {
            (uint256 wethToLeverage, uint256 ethToCrab) =
                abi.decode(_uniFlashSwapData.callData, (uint256, uint256));

            IZenBullStrategy(bullStrategy).depositAndBorrowFromLeverage(
                wethToLeverage, _uniFlashSwapData.amountToPay
            );

            IZenBullStrategy(bullStrategy).depositEthIntoCrab(ethToCrab);

            IERC20(usdc).transfer(_uniFlashSwapData.pool, _uniFlashSwapData.amountToPay);
        } else if (
            FLASH_SOURCE(_uniFlashSwapData.callSource)
                == FLASH_SOURCE.FULL_REBALANCE_WITHDRAW_WETH_BORROW_USDC_DEPOSIT_INTO_CRAB
        ) {
            (uint256 wethToWithdraw, uint256 ethToCrab) =
                abi.decode(_uniFlashSwapData.callData, (uint256, uint256));

            IZenBullStrategy(bullStrategy).auctionRepayAndWithdrawFromLeverage(0, wethToWithdraw);

            IZenBullStrategy(bullStrategy).depositAndBorrowFromLeverage(
                0, _uniFlashSwapData.amountToPay
            );

            IZenBullStrategy(bullStrategy).depositEthIntoCrab(ethToCrab);

            IERC20(usdc).transfer(_uniFlashSwapData.pool, _uniFlashSwapData.amountToPay);
        } else if (
            FLASH_SOURCE(_uniFlashSwapData.callSource)
                == FLASH_SOURCE.FULL_REBALANCE_SELL_WETH_REPAY_USDC_DEPOSIT_INTO_CRAB
        ) {
            (uint256 wethToWithdraw, uint256 ethToCrab) =
                abi.decode(_uniFlashSwapData.callData, (uint256, uint256));

            IZenBullStrategy(bullStrategy).auctionRepayAndWithdrawFromLeverage(
                IERC20(usdc).balanceOf(address(this)), wethToWithdraw
            );

            IZenBullStrategy(bullStrategy).depositEthIntoCrab(ethToCrab);

            IERC20(weth).transfer(_uniFlashSwapData.pool, _uniFlashSwapData.amountToPay);
        }
    }

    /**
     * @notice rebalance bull strategy delta by borrowing or repaying USDC and changing eth collateral as part of a full rebalance when withdrawing from crab
     * @param _params ExecuteLeverageComponentRebalancingParams struct
     */
    function _executeLeverageComponentRebalancing(
        ExecuteLeverageComponentRebalancingParams memory _params
    ) internal {
        uint256 wethInCollateral = IEulerEToken(eToken).balanceOfUnderlying(address(bullStrategy));
        if (_params.wethTargetInEuler > _params.netWethReceived.add(wethInCollateral)) {
            // have less ETH than we need in Euler, we have to buy and deposit it
            // borrow more USDC to buy WETH
            uint256 wethToBuy =
                _params.wethTargetInEuler.sub(_params.netWethReceived.add(wethInCollateral));
            _exactOutFlashSwap(
                usdc,
                weth,
                _params.ethUsdcPoolFee,
                wethToBuy,
                wethToBuy.wmul(_params.wethLimitPrice).div(WETH_DECIMALS_DIFF),
                uint8(FLASH_SOURCE.FULL_REBALANCE_BORROW_USDC_BUY_WETH),
                abi.encodePacked(wethToBuy.add(_params.netWethReceived))
            );
        } else {
            // have more ETH than we need in either Euler or from withdrawing from crab
            //we need to sell ETH and either deposit or withdraw from euler
            uint256 wethToSell =
                _params.netWethReceived.add(wethInCollateral).sub(_params.wethTargetInEuler);
            // wethToSell + wEthTargetInEuler = _params.netWethReceived+wethInCollateral

            // repay USDC debt from WETH
            if (_params.wethTargetInEuler < wethInCollateral) {
                // if we need to withdraw from in euler, do that
                _exactInFlashSwap(
                    weth,
                    usdc,
                    _params.ethUsdcPoolFee,
                    wethToSell,
                    wethToSell.wmul(_params.wethLimitPrice).div(WETH_DECIMALS_DIFF),
                    uint8(FLASH_SOURCE.FULL_REBALANCE_REPAY_USDC_WITHDRAW_WETH),
                    abi.encodePacked(_params.netWethReceived)
                );
            } else {
                // if we need to deposit to euler do that
                _exactInFlashSwap(
                    weth,
                    usdc,
                    _params.ethUsdcPoolFee,
                    wethToSell,
                    wethToSell.wmul(_params.wethLimitPrice).div(WETH_DECIMALS_DIFF),
                    uint8(FLASH_SOURCE.FULL_REBALANCE_REPAY_USDC_DEPOSIT_WETH),
                    abi.encodePacked(_params.wethTargetInEuler.sub(wethInCollateral))
                );
            }
        }
    }

    /**
     * @notice transfer payment to auction participant from contract
     * @param _order Order struct
     * @param _remainingAmount remaining amount to be transfered
     * @param _clearingPrice clearing price in WETH/wPowerPerp determined at auction
     */
    function _transferToOrder(Order memory _order, uint256 _remainingAmount, uint256 _clearingPrice)
        internal
        returns (uint256)
    {
        // adjust quantity for partial fills
        if (_remainingAmount < _order.quantity) {
            _order.quantity = _remainingAmount;
        }
        if (_order.isBuying) {
            // trader sent WETH and receives wPowerPerp
            IERC20(wPowerPerp).transfer(_order.trader, _order.quantity);

            return _order.quantity;
        } else {
            // trader sent wPowerPerp and receives WETH
            // WETH clearing price for the order
            uint256 wethAmount = _order.quantity.wmul(_clearingPrice);
            IERC20(weth).transfer(_order.trader, wethAmount);

            return wethAmount;
        }
    }

    /**
     * @notice transfer payment from auction participant to contract
     * @param _order Order struct
     * @param _remainingAmount remaining amount to be transfered
     * @param _clearingPrice clearing price in WETH/wPowerPerp determined at auction
     */
    function _transferFromOrder(
        Order memory _order,
        uint256 _remainingAmount,
        uint256 _clearingPrice
    ) internal returns (uint256) {
        // adjust quantity for partial fills
        if (_remainingAmount < _order.quantity) {
            _order.quantity = _remainingAmount;
        }

        if (_order.isBuying) {
            // trader sends WETH and receives wPowerPerp
            // WETH clearing price for the order
            uint256 wethAmount = _order.quantity.wmul(_clearingPrice);
            IERC20(weth).transferFrom(_order.trader, address(this), wethAmount);

            return wethAmount;
        } else {
            // trader send wPowerPerp and receives WETH
            IERC20(wPowerPerp).transferFrom(_order.trader, address(this), _order.quantity);

            return _order.quantity;
        }
    }

    /**
     * @notice verify that an auction order is valid
     * @param _order Order struct
     * @param _clearingPrice clearing price in WETH/wPowerPerp
     * @param _isDepositingInCrab true if rebalance is depositing into crab
     */
    function _verifyOrder(Order memory _order, uint256 _clearingPrice, bool _isDepositingInCrab)
        internal
    {
        // check that order trade against hedge direction
        require(_order.isBuying == _isDepositingInCrab, "AB6");
        // check that order beats clearing price
        if (_order.isBuying) {
            require(_clearingPrice <= _order.price, "AB9");
        } else {
            require(_clearingPrice >= _order.price, "AB10");
        }

        _useNonce(_order.trader, _order.nonce);
        bytes32 structHash = keccak256(
            abi.encode(
                _FULL_REBALANCE_TYPEHASH,
                _order.bidId,
                _order.trader,
                _order.quantity,
                _order.price,
                _order.isBuying,
                _order.expiry,
                _order.nonce
            )
        );

        bytes32 hash = _hashTypedDataV4(structHash);
        address orderSigner = ECDSA.recover(hash, _order.v, _order.r, _order.s);
        require(orderSigner == _order.trader, "AB11");
        require(_order.expiry >= block.timestamp, "AB12");
    }

    /**
     * @dev set nonce flag of the trader to true
     * @param _trader address of the signer
     * @param _nonce number that is to be traded only once
     */
    function _useNonce(address _trader, uint256 _nonce) internal {
        require(!nonces[_trader][_nonce], "AB13");
        nonces[_trader][_nonce] = true;
    }

    /**
     * @notice check if strategy delta and collateral is within tolerance
     */
    function _isValidRebalance() internal view {
        (uint256 delta, uint256 cr) = _getCurrentDeltaAndCollatRatio();

        require(delta <= deltaUpper && delta >= deltaLower, "AB1");
        require(cr <= crUpper && cr >= crLower, "AB2");
    }

    /**
     * @dev calculate amount of wPowerPerp associated with a crab deposit or withdrawal
     * @param _isDepositingInCrab true if depositing into crab
     * @param _crabAmount amount of crab to deposit/withdraw
     * @param _ethInCrab amount of eth collateral owned by crab strategy
     * @param _wPowerPerpInCrab amount of wPowerPerp debt owed by crab strategy
     * @return wPowerPerpAmount
     */
    function _calcWPowerPerpAmountFromCrab(
        bool _isDepositingInCrab,
        uint256 _crabAmount,
        uint256 _ethInCrab,
        uint256 _wPowerPerpInCrab
    ) internal view returns (uint256) {
        uint256 wPowerPerpAmount;
        if (_isDepositingInCrab) {
            uint256 ethToDepositInCrab =
                _crabAmount.wdiv(IERC20(crab).totalSupply()).wmul(_ethInCrab);
            (wPowerPerpAmount,) =
                _calcWPowerPerpToMintAndFee(ethToDepositInCrab, _wPowerPerpInCrab, _ethInCrab);
        } else {
            wPowerPerpAmount = _crabAmount.wmul(_wPowerPerpInCrab).wdiv(IERC20(crab).totalSupply());
        }

        return wPowerPerpAmount;
    }

    /**
     * @notice get current bull strategy delta and collateral ratio
     * @return delta and collateral ratio
     */
    function _getCurrentDeltaAndCollatRatio() internal view returns (uint256, uint256) {
        (uint256 ethInCrab, uint256 wPowerPerpInCrab) =
            IZenBullStrategy(bullStrategy).getCrabVaultDetails();
        uint256 ethUsdPrice = UniOracle._getTwap(ethUSDCPool, weth, usdc, TWAP, false);
        uint256 wPowerPerpEthPrice =
            UniOracle._getTwap(ethWPowerPerpPool, wPowerPerp, weth, TWAP, false);
        uint256 crabUsdPrice = (
            ethInCrab.wmul(ethUsdPrice).sub(
                wPowerPerpInCrab.wmul(wPowerPerpEthPrice).wmul(ethUsdPrice)
            )
        ).wdiv(IERC20(crab).totalSupply());

        uint256 usdcDebt = IEulerDToken(dToken).balanceOf(address(bullStrategy));
        uint256 wethInCollateral = IEulerEToken(eToken).balanceOfUnderlying(address(bullStrategy));

        uint256 delta = (wethInCollateral.wmul(ethUsdPrice)).wdiv(
            (IZenBullStrategy(bullStrategy).getCrabBalance().wmul(crabUsdPrice)).add(
                wethInCollateral.wmul(ethUsdPrice)
            ).sub(usdcDebt.mul(WETH_DECIMALS_DIFF))
        );

        uint256 cr = wethInCollateral.wmul(ethUsdPrice).wdiv(usdcDebt.mul(WETH_DECIMALS_DIFF));

        return (delta, cr);
    }

    /**
     * @dev calculate amount of wPowerPerp to mint and fee based on ETH to deposit into crab
     * @param _depositedEthAmount amount of ETH deposited
     * @param _strategyDebtAmount amount of wPowerperp debt in strategy vault before deposit
     * @param _strategyCollateralAmount amount of ETH collatal in strategy vault before deposit
     * @return amount of wPowerPerp to mint and fee
     */
    function _calcWPowerPerpToMintAndFee(
        uint256 _depositedEthAmount,
        uint256 _strategyDebtAmount,
        uint256 _strategyCollateralAmount
    ) internal view returns (uint256, uint256) {
        uint256 wPowerPerpEthPrice =
            UniOracle._getTwap(ethWPowerPerpPool, wPowerPerp, weth, TWAP, false);
        uint256 feeRate =
            IController(IZenBullStrategy(bullStrategy).powerTokenController()).feeRate();
        uint256 feeAdjustment = wPowerPerpEthPrice.mul(feeRate).div(10000);
        uint256 wPowerPerpToMint = _depositedEthAmount.wmul(_strategyDebtAmount).wdiv(
            _strategyCollateralAmount.add(_strategyDebtAmount.wmul(feeAdjustment))
        );
        uint256 fee = wPowerPerpToMint.wmul(feeAdjustment);

        return (wPowerPerpToMint, fee);
    }

    /**
     * @notice check that the proposed auction price is within a tolerance of the current Uniswap twap
     * @param _price clearing price provided by manager
     * @param _isDepositingInCrab is bull depositing in Crab
     */
    function _checkFullRebalanceClearingPrice(uint256 _price, bool _isDepositingInCrab)
        internal
        view
    {
        // Get twap
        uint256 wPowerPerpEthPrice =
            UniOracle._getTwap(ethWPowerPerpPool, wPowerPerp, weth, TWAP, false);

        if (_isDepositingInCrab) {
            require(
                _price >= wPowerPerpEthPrice.wmul((ONE.sub(fullRebalanceClearingPriceTolerance))),
                "AB17"
            );
        } else {
            require(
                _price <= wPowerPerpEthPrice.wmul((ONE.add(fullRebalanceClearingPriceTolerance))),
                "AB18"
            );
        }
    }

    /**
     * @notice check that the proposed auction price is within a tolerance of the current Uniswap twap
     * @param _wethLimitPrice WETH limit price provided by manager
     */
    function _checkRebalanceLimitPrice(uint256 _wethLimitPrice) internal view {
        // get twaps to check price within tolerance
        uint256 ethUsdPrice = UniOracle._getTwap(ethUSDCPool, weth, usdc, TWAP, false);

        require(
            (_wethLimitPrice >= ethUsdPrice.wmul((ONE.sub(rebalanceWethLimitPriceTolerance))))
                && (_wethLimitPrice <= ethUsdPrice.wmul((ONE.add(rebalanceWethLimitPriceTolerance)))),
            "AB15"
        );
    }
}