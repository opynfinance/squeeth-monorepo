// SPDX-License-Identifier: GPL-3.0-only
pragma solidity =0.7.6;

pragma abicoder v2;

// interface
import { IController } from "squeeth-monorepo/interfaces/IController.sol";
import { IBullStrategy } from "./interface/IBullStrategy.sol";
import { IERC20 } from "openzeppelin/token/ERC20/IERC20.sol";
import { IEulerEToken } from "./interface/IEulerEToken.sol";
import { IEulerDToken } from "./interface/IEulerDToken.sol";
// contract
import { Ownable } from "openzeppelin/access/Ownable.sol";
import { UniFlash } from "./UniFlash.sol";
import { UniOracle } from "./UniOracle.sol";
import { EIP712 } from "openzeppelin/drafts/EIP712.sol";
// lib
import { StrategyMath } from "squeeth-monorepo/strategy/base/StrategyMath.sol"; // StrategyMath licensed under AGPL-3.0-only
import { ECDSA } from "openzeppelin/cryptography/ECDSA.sol";

/**
 * Error code
 * AB0: caller is not auction manager
 * AB1: Invalid delta after rebalance
 * AB2: Invalid CR after rebalance
 * AB3: Invalid CR lower and upper values
 * AB4: Invalid delta lower and upper values
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
 */

/**
 * @notice AuctionBull contract
 * @author opyn team
 */
contract AuctionBull is UniFlash, Ownable, EIP712 {
    using StrategyMath for uint256;

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

    // @dev full rebalance clearing price tolerance cannot exceed 20%
    uint256 public constant MAX_FULL_REBALANCE_PRICE_TOLERANCE = 2e17; // 20%

    /// @dev USDC address
    address private immutable usdc;
    /// @dev WETH address
    address private immutable weth;
    address private immutable bullStrategy;
    address private immutable ethWSqueethPool;
    address private immutable ethUSDCPool;
    address private immutable wPowerPerp;
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
    /// @dev full rebalance clearing price must be within this distance of the oSQTH:eth uniswap twap price
    uint256 public fullRebalanceClearingPriceTolerance = 5e16; // 5%
    /// @dev full rebalance weth limit price must be within this distance of the eth:usd uniswap twap price
    uint256 public fullRebalanceWethLimitPriceTolerance = 5e16; // 5%

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
        FULL_REBALANCE_WITHDRAW_WETH_BORROW_USDC_DEPOSIT_INTO_CRAB
    }

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

    struct ExecuteCrabDepositParams {
        uint256 crabAmount;
        uint256 wethTargetInEuler;
        uint256 wethLimitPrice;
        uint256 ethInCrab;
        uint24 ethUsdcPoolFee;
    }

    event SetCrUpperAndLower(
        uint256 oldCrLower, uint256 oldCrUpper, uint256 newCrLower, uint256 newCrUpper
    );
    event SetDeltaUpperAndLower(
        uint256 oldDeltaLower, uint256 oldDeltaUpper, uint256 newDeltaLower, uint256 newDeltaUpper
    );
    event LeverageRebalance(bool isSellingUsdc, uint256 usdcAmount, uint256 wethLimitAmount);
    event SetFullRebalanceClearingPriceTolerance(uint256 _oldPriceTolerance, uint256 _newPriceTolerance);

    constructor(
        address _auctionOwner,
        address _auctionManager,
        address _bull,
        address _factory,
        address _crab,
        address _eToken,
        address _dToken
    ) UniFlash(_factory) Ownable() EIP712("AuctionBull", "1") {
        auctionManager = _auctionManager;
        bullStrategy = _bull;
        weth = IController(IBullStrategy(_bull).powerTokenController()).weth();
        usdc = IController(IBullStrategy(_bull).powerTokenController()).quoteCurrency();
        ethWSqueethPool = IController(IBullStrategy(_bull).powerTokenController()).wPowerPerpPool();
        ethUSDCPool =
            IController(IBullStrategy(_bull).powerTokenController()).ethQuoteCurrencyPool();
        wPowerPerp = IController(IBullStrategy(_bull).powerTokenController()).wPowerPerp();
        crab = _crab;
        eToken = _eToken;
        dToken = _dToken;

        IERC20(IController(IBullStrategy(_bull).powerTokenController()).weth()).approve(
            _bull, type(uint256).max
        );
        IERC20(IController(IBullStrategy(_bull).powerTokenController()).quoteCurrency()).approve(
            _bull, type(uint256).max
        );
        IERC20(IController(IBullStrategy(_bull).powerTokenController()).wPowerPerp()).approve(
            _bull, type(uint256).max
        );

        transferOwnership(_auctionOwner);
    }

    receive() external payable {
        require(msg.sender == address(bullStrategy));
    }

    /**
     * @notice owner can set a threshold, scaled by 1e18 that determines the maximum discount of a clearing sale price to the current uniswap twap price
     * @param _fullRebalancePriceTolerance the OTC price tolerance, in percent, scaled by 1e18
     */
    function setFullRebalanceClearingPriceTolerance(uint256 _fullRebalancePriceTolerance)
        external
        onlyOwner
    {
        // Tolerance cannot be more than 20%
        require(_fullRebalancePriceTolerance <= MAX_FULL_REBALANCE_PRICE_TOLERANCE, "AB14");

        emit SetFullRebalanceClearingPriceTolerance(
            fullRebalanceClearingPriceTolerance, _fullRebalancePriceTolerance
            );

        fullRebalanceClearingPriceTolerance = _fullRebalancePriceTolerance;
    }

    /**
     * @notice set strategy lower and upper collat ratio
     * @dev should only be callable by owner
     * @param _crLower lower CR
     * @param _crUpper upper CR
     */
    function setCrUpperAndLower(uint256 _crLower, uint256 _crUpper) external onlyOwner {
        require(_crUpper > _crLower, "AB3");

        emit SetCrUpperAndLower(crLower, crUpper, _crLower, _crUpper);

        crLower = _crLower;
        crUpper = _crUpper;
    }

    /**
     * @notice set strategy lower and upper delta
     * @dev should only be callable by owner
     * @param _deltaLower lower delta
     * @param _deltaUpper upper delta
     */
    function setDeltaUpperAndLower(uint256 _deltaLower, uint256 _deltaUpper) external onlyOwner {
        require(_deltaUpper > _deltaLower, "AB4");

        emit SetDeltaUpperAndLower(deltaLower, deltaUpper, _deltaLower, _deltaUpper);

        deltaLower = _deltaLower;
        deltaUpper = _deltaUpper;
    }

    // solhint-disable-next-line func-name-mixedcase
    function DOMAIN_SEPARATOR() external view returns (bytes32) {
        return _domainSeparatorV4();
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
     * @dev hedge function to reduce delta using an array of signed orders
     * @param _orders list of orders
     * @param _crabAmount amount of crab to withdraw or deposit
     * @param _clearingPrice clearing price in weth
     * @param _wethTargetInEuler target WETH collateral amount in leverage component
     * @param _wethLimitPrice limit price
     * @param _isDepositingInCrab true if the rebalance will deposit into Crab, false if withdrawing funds from crab
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
        _checkFullRebalanceLimitPrice(_wethLimitPrice);

        (uint256 ethInCrab, uint256 squeethInCrab) =
            IBullStrategy(bullStrategy).getCrabVaultDetails();
        uint256 wPowerPerpAmount = _calcWPowerPerpAmountFromCrab(
            _isDepositingInCrab, _crabAmount, ethInCrab, squeethInCrab
        );
        if (_isDepositingInCrab) {
            // loop through orders, check each order validity
            // pull funds from orders
            {
                uint256 remainingAmount = wPowerPerpAmount;
                uint256 prevPrice = _orders[0].price;
                uint256 currentPrice = _orders[0].price;

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

                    _transferFromOrder(_orders[i], remainingAmount, _clearingPrice);

                    if (remainingAmount > _orders[i].quantity) {
                        remainingAmount = remainingAmount.sub(_orders[i].quantity);
                    } else {
                        break;
                    }
                }
            }

            /**
             * if auction depositing into crab:
             * - calc amount of ETH needed to deposit into crab and get crabAmount
             * - if target WETH to have in euler greater than current amount in euler, borrow USDC to buy more WETH and deposit in euler
             * - if target WETH to have in euler less than current amount in euler, remove WETH from euler
             * - deposit into crab, and pay auction traders wPowerPerp
             */
            _executeCrabDeposit(
                ExecuteCrabDepositParams({
                    crabAmount: _crabAmount,
                    wethTargetInEuler: _wethTargetInEuler,
                    wethLimitPrice: _wethLimitPrice,
                    ethInCrab: ethInCrab,
                    ethUsdcPoolFee: _ethUsdcPoolFee
                })
            );
            {
                uint256 remainingAmount = wPowerPerpAmount;
                uint256 ordersLength = _orders.length;
                for (uint256 i; i < ordersLength; ++i) {
                    _transferToOrder(_orders[i], remainingAmount, _clearingPrice);
                    if (remainingAmount > _orders[i].quantity) {
                        remainingAmount = remainingAmount.sub(_orders[i].quantity);
                    } else {
                        break;
                    }
                }
            }
        } else {
            // loop through orders, check each order validity
            // pull funds from orders
            {
                uint256 remainingAmount = wPowerPerpAmount;
                uint256 prevPrice = _orders[0].price;
                uint256 currentPrice = _orders[0].price;

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

                    _transferFromOrder(_orders[i], remainingAmount, _clearingPrice);

                    if (remainingAmount > _orders[i].quantity) {
                        remainingAmount = remainingAmount.sub(_orders[i].quantity);
                    } else {
                        break;
                    }
                }
            }

            IBullStrategy(bullStrategy).redeemCrabAndWithdrawWEth(_crabAmount, wPowerPerpAmount);

            {
                uint256 remainingAmount = wPowerPerpAmount;
                uint256 ordersLength = _orders.length;
                for (uint256 i; i < ordersLength; ++i) {
                    _transferToOrder(_orders[i], remainingAmount, _clearingPrice);
                    if (remainingAmount > _orders[i].quantity) {
                        remainingAmount = remainingAmount.sub(_orders[i].quantity);
                    } else {
                        break;
                    }
                }
            }

            _rebalanceLeverageComponent(_wethTargetInEuler, _wethLimitPrice, _ethUsdcPoolFee);
        }
    }

    function _executeCrabDeposit(ExecuteCrabDepositParams memory _params) internal {
        uint256 totalEthNeededForCrab =
            _params.crabAmount.wdiv(IERC20(crab).totalSupply()).wmul(_params.ethInCrab);
        uint256 ethNeededForCrab = totalEthNeededForCrab.sub(IERC20(weth).balanceOf(address(this)));
        uint256 wethInCollateral = IEulerEToken(eToken).balanceOfUnderlying(address(bullStrategy));
        if (_params.wethTargetInEuler > wethInCollateral) {
            uint256 wethToGet =
                _params.wethTargetInEuler.sub(wethInCollateral).add(ethNeededForCrab);
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
            uint256 wethFromEuler = wethInCollateral.sub(_params.wethTargetInEuler);
            uint256 wethToGet = ethNeededForCrab.sub(wethFromEuler);
            _exactOutFlashSwap(
                usdc,
                weth,
                _params.ethUsdcPoolFee,
                wethToGet,
                wethToGet.wmul(_params.wethLimitPrice).div(WETH_DECIMALS_DIFF),
                uint8(FLASH_SOURCE.FULL_REBALANCE_WITHDRAW_WETH_BORROW_USDC_DEPOSIT_INTO_CRAB),
                abi.encodePacked(wethFromEuler, totalEthNeededForCrab)
            );
        }
    }

    /**
     * @notice changes the leverage component composition by increasing or decreasing USDC debt
     * @dev should only be called by auction manager
     * @param _isSellingUsdc true if startegy is selling USDC, false if not
     * @param _usdcAmount USDC amount to trade
     * @param _wethLimitAmount WETH limit price
     * @param _poolFee USDC/WETH pool fee
     */
    function leverageRebalance(
        bool _isSellingUsdc,
        uint256 _usdcAmount,
        uint256 _wethLimitAmount,
        uint24 _poolFee
    ) external {
        require(msg.sender == auctionManager, "AB0");

        if (_isSellingUsdc) {
            // swap USDC to WETH
            _exactInFlashSwap(
                usdc,
                weth,
                _poolFee,
                _usdcAmount,
                _wethLimitAmount,
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
                _wethLimitAmount,
                uint8(FLASH_SOURCE.LEVERAGE_REBALANCE_DECREASE_DEBT),
                abi.encodePacked(_usdcAmount)
            );
        }

        _isValidLeverageRebalance();

        emit LeverageRebalance(_isSellingUsdc, _usdcAmount, _wethLimitAmount);
    }

    /**
     * @notice get current delta and bull CR ration in Euler
     * @return delta and CR ratio
     */
    function getCurrentDeltaAndCollatRatio() external view returns (uint256, uint256) {
        return _getCurrentDeltaAndCollatRatio();
    }

    /**
     * @dev Uniswap V3 internal callback
     * @param _uniFlashSwapData UniFlashswapCallbackData struct
     */
    function _uniFlashSwap(UniFlashswapCallbackData memory _uniFlashSwapData) internal override {
        if (
            FLASH_SOURCE(_uniFlashSwapData.callSource)
                == FLASH_SOURCE.LEVERAGE_REBALANCE_INCREASE_DEBT
        ) {
            IBullStrategy(bullStrategy).depositAndBorrowFromLeverage(
                IERC20(weth).balanceOf(address(this)), _uniFlashSwapData.amountToPay
            );

            IERC20(usdc).transfer(_uniFlashSwapData.pool, _uniFlashSwapData.amountToPay);
        } else if (
            FLASH_SOURCE(_uniFlashSwapData.callSource)
                == FLASH_SOURCE.LEVERAGE_REBALANCE_DECREASE_DEBT
        ) {
            uint256 usdcToRepay = abi.decode(_uniFlashSwapData.callData, (uint256));
            // Repay some USDC debt
            IBullStrategy(bullStrategy).repayAndWithdrawFromLeverage(
                usdcToRepay, _uniFlashSwapData.amountToPay
            );

            IERC20(weth).transfer(_uniFlashSwapData.pool, _uniFlashSwapData.amountToPay);
        } else if (
            FLASH_SOURCE(_uniFlashSwapData.callSource)
                == FLASH_SOURCE.FULL_REBALANCE_BORROW_USDC_BUY_WETH
        ) {
            uint256 wethToDeposit = abi.decode(_uniFlashSwapData.callData, (uint256));
            IBullStrategy(bullStrategy).depositAndBorrowFromLeverage(
                wethToDeposit, _uniFlashSwapData.amountToPay
            );

            IERC20(usdc).transfer(_uniFlashSwapData.pool, _uniFlashSwapData.amountToPay);
        } else if (
            FLASH_SOURCE(_uniFlashSwapData.callSource)
                == FLASH_SOURCE.FULL_REBALANCE_REPAY_USDC_WITHDRAW_WETH
        ) {
            uint256 remainingWeth = abi.decode(_uniFlashSwapData.callData, (uint256));

            IBullStrategy(bullStrategy).repayAndWithdrawFromLeverage(
                IERC20(usdc).balanceOf(address(this)),
                _uniFlashSwapData.amountToPay.sub(remainingWeth)
            );

            IERC20(weth).transfer(_uniFlashSwapData.pool, _uniFlashSwapData.amountToPay);
        } else if (
            FLASH_SOURCE(_uniFlashSwapData.callSource)
                == FLASH_SOURCE.FULL_REBALANCE_DEPOSIT_WETH_BORROW_USDC_DEPOSIT_INTO_CRAB
        ) {
            (uint256 wethToLeverage, uint256 ethToCrab) =
                abi.decode(_uniFlashSwapData.callData, (uint256, uint256));

            IBullStrategy(bullStrategy).depositAndBorrowFromLeverage(
                wethToLeverage, _uniFlashSwapData.amountToPay
            );

            IBullStrategy(bullStrategy).depositEthIntoCrab(ethToCrab);

            IERC20(usdc).transfer(_uniFlashSwapData.pool, _uniFlashSwapData.amountToPay);
        } else if (
            FLASH_SOURCE(_uniFlashSwapData.callSource)
                == FLASH_SOURCE.FULL_REBALANCE_WITHDRAW_WETH_BORROW_USDC_DEPOSIT_INTO_CRAB
        ) {
            (uint256 wethToWithdraw, uint256 ethToCrab) =
                abi.decode(_uniFlashSwapData.callData, (uint256, uint256));

            IBullStrategy(bullStrategy).repayAndWithdrawFromLeverage(0, wethToWithdraw);

            IBullStrategy(bullStrategy).depositAndBorrowFromLeverage(
                0, _uniFlashSwapData.amountToPay
            );

            IBullStrategy(bullStrategy).depositEthIntoCrab(ethToCrab);

            IERC20(usdc).transfer(_uniFlashSwapData.pool, _uniFlashSwapData.amountToPay);
        }
    }

    function _rebalanceLeverageComponent(
        uint256 _wethTargetInEuler,
        uint256 _wethLimitPrice,
        uint24 _ethUsdcPoolFee
    ) internal {
        uint256 remainingWeth = IERC20(weth).balanceOf(address(this));
        uint256 wethInCollateral = IEulerEToken(eToken).balanceOfUnderlying(address(bullStrategy));
        if (_wethTargetInEuler > remainingWeth.add(wethInCollateral)) {
            uint256 wethToBuy = _wethTargetInEuler.sub(remainingWeth.add(wethInCollateral));
            _exactOutFlashSwap(
                usdc,
                weth,
                _ethUsdcPoolFee,
                wethToBuy,
                wethToBuy.wmul(_wethLimitPrice).div(WETH_DECIMALS_DIFF),
                uint8(FLASH_SOURCE.FULL_REBALANCE_BORROW_USDC_BUY_WETH),
                abi.encodePacked(wethToBuy.add(remainingWeth))
            );
        } else {
            uint256 wethToSell = remainingWeth.add(wethInCollateral).sub(_wethTargetInEuler);
            _exactInFlashSwap(
                weth,
                usdc,
                _ethUsdcPoolFee,
                wethToSell,
                wethToSell.wmul(_wethLimitPrice).div(WETH_DECIMALS_DIFF),
                uint8(FLASH_SOURCE.FULL_REBALANCE_REPAY_USDC_WITHDRAW_WETH),
                abi.encodePacked(remainingWeth)
            );
        }
    }

    function _transferToOrder(Order memory _order, uint256 _remainingAmount, uint256 _clearingPrice)
        internal
    {
        // adjust quantity for partial fills
        if (_remainingAmount < _order.quantity) {
            _order.quantity = _remainingAmount;
        }

        if (_order.isBuying) {
            // trader sent weth and receives oSQTH
            // weth clearing price for the order
            IERC20(wPowerPerp).transfer(_order.trader, _order.quantity);
        } else {
            // trader sent oSQTH and receives WETH
            uint256 wethAmount = _order.quantity.wmul(_clearingPrice);
            IERC20(weth).transfer(_order.trader, wethAmount);
        }
    }

    function _transferFromOrder(
        Order memory _order,
        uint256 _remainingAmount,
        uint256 _clearingPrice
    ) internal {
        // adjust quantity for partial fills
        if (_remainingAmount < _order.quantity) {
            _order.quantity = _remainingAmount;
        }

        if (_order.isBuying) {
            // trader sends weth and receives oSQTH
            // weth clearing price for the order
            uint256 wethAmount = _order.quantity.wmul(_clearingPrice);
            IERC20(weth).transferFrom(_order.trader, address(this), wethAmount);
        } else {
            // trader send oSQTH and receives WETH
            IERC20(wPowerPerp).transferFrom(_order.trader, address(this), _order.quantity);
        }
    }

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
     * @notice check if startegy delta and CR ratio is within upper and lower values
     */
    function _isValidLeverageRebalance() internal view {
        (uint256 delta, uint256 cr) = _getCurrentDeltaAndCollatRatio();

        require(delta <= deltaUpper && delta >= deltaLower, "AB1");
        require(cr <= crUpper && cr >= crLower, "AB2");
    }

    function _calcWPowerPerpAmountFromCrab(
        bool _isDepositingInCrab,
        uint256 _crabAmount,
        uint256 _ethInCrab,
        uint256 _squeethInCrab
    ) internal view returns (uint256) {
        uint256 wPowerPerpAmount;
        if (_isDepositingInCrab) {
            uint256 ethToDepositInCrab =
                _crabAmount.wdiv(IERC20(crab).totalSupply()).wmul(_ethInCrab);
            (wPowerPerpAmount,) =
                _calcWsqueethToMintAndFee(ethToDepositInCrab, _squeethInCrab, _ethInCrab);
        } else {
            wPowerPerpAmount = _crabAmount.wmul(_squeethInCrab).wdiv(IERC20(crab).totalSupply());
        }

        return wPowerPerpAmount;
    }

    /**
     * @notice get current bull startegy delta and leverage collat ratio
     * @return delta and CR ratio
     */
    function _getCurrentDeltaAndCollatRatio() internal view returns (uint256, uint256) {
        (uint256 ethInCrab, uint256 squeethInCrab) =
            IBullStrategy(bullStrategy).getCrabVaultDetails();
        uint256 ethUsdPrice = UniOracle._getTwap(ethUSDCPool, weth, usdc, TWAP, false);
        uint256 squeethEthPrice = UniOracle._getTwap(ethWSqueethPool, wPowerPerp, weth, TWAP, false);
        uint256 crabUsdPrice = (
            ethInCrab.wmul(ethUsdPrice).sub(squeethInCrab.wmul(squeethEthPrice).wmul(ethUsdPrice))
        ).wdiv(IERC20(crab).totalSupply());

        uint256 usdcDebt = IEulerDToken(dToken).balanceOf(address(bullStrategy));
        uint256 wethInCollateral = IEulerEToken(eToken).balanceOfUnderlying(address(bullStrategy));

        uint256 delta = (wethInCollateral.wmul(ethUsdPrice)).wdiv(
            (IBullStrategy(bullStrategy).getCrabBalance().wmul(crabUsdPrice)).add(
                wethInCollateral.wmul(ethUsdPrice)
            ).sub(usdcDebt.mul(WETH_DECIMALS_DIFF))
        );

        uint256 cr = wethInCollateral.wmul(ethUsdPrice).wdiv(usdcDebt.mul(WETH_DECIMALS_DIFF));

        return (delta, cr);
    }

    /**
     * @dev calculate amount of wSqueeth to mint and fee based on ETH to deposit into crab
     */
    function _calcWsqueethToMintAndFee(
        uint256 _depositedEthAmount,
        uint256 _strategyDebtAmount,
        uint256 _strategyCollateralAmount
    ) internal view returns (uint256, uint256) {
        uint256 squeethEthPrice = UniOracle._getTwap(ethWSqueethPool, wPowerPerp, weth, TWAP, false);
        uint256 feeRate = IController(IBullStrategy(bullStrategy).powerTokenController()).feeRate();
        uint256 feeAdjustment = squeethEthPrice.mul(feeRate).div(10000);
        uint256 wSqueethToMint = _depositedEthAmount.wmul(_strategyDebtAmount).wdiv(
            _strategyCollateralAmount.add(_strategyDebtAmount.wmul(feeAdjustment))
        );
        uint256 fee = wSqueethToMint.wmul(feeAdjustment);

        return (wSqueethToMint, fee);
    }

    /**
     * @notice check that the proposed sale price is within a tolerance of the current Uniswap twap
     * @param _price clearing price provided by manager
     * @param _isDepositingInCrab is bull depositing in Crab
     */
    function _checkFullRebalanceClearingPrice(uint256 _price, bool _isDepositingInCrab)
        internal
        view
    {
        // Get twap
        uint256 squeethEthPrice = UniOracle._getTwap(ethWSqueethPool, wPowerPerp, weth, TWAP, false);

        if (_isDepositingInCrab) {
            require(
                _price >= squeethEthPrice.mul((ONE.sub(fullRebalanceClearingPriceTolerance))).div(ONE),
                "Price too low relative to Uniswap twap."
            );
        } else {
            require(
                _price <= squeethEthPrice.mul((ONE.add(fullRebalanceClearingPriceTolerance))).div(ONE),
                "Price too high relative to Uniswap twap."
            );
        }
    }

    /**
     * @notice check that the proposed sale price is within a tolerance of the current Uniswap twap
     * @param _wethLimitPrice WETH limit price provided by manager
     */
    function _checkFullRebalanceLimitPrice(uint256 _wethLimitPrice)
        internal
        view
    {
        // Get twap
        uint256 ethUsdPrice = UniOracle._getTwap(ethUSDCPool, weth, usdc, TWAP, false);

        require (
            (_wethLimitPrice >= ethUsdPrice.wmul((ONE.sub(fullRebalanceWethLimitPriceTolerance)))) ||
            (_wethLimitPrice <= ethUsdPrice.wmul((ONE.sub(fullRebalanceWethLimitPriceTolerance)))),
            "AB15"
        );
    }

}
