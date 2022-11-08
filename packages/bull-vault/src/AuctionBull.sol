// SPDX-License-Identifier: GPL-3.0-only
pragma solidity =0.7.6;
pragma abicoder v2;

// interface
import { IController } from "squeeth-monorepo/interfaces/IController.sol";
import { IBullStrategy } from "./interface/IBullStrategy.sol";
import { IERC20 } from "openzeppelin/token/ERC20/IERC20.sol";
import { IWETH9 } from "./interface/IWETH9.sol";
import { IEulerEToken } from "./interface/IEulerEToken.sol";
import { IEulerDToken } from "./interface/IEulerDToken.sol";
// contract
import { Ownable } from "openzeppelin/access/Ownable.sol";
import { UniFlash } from "./UniFlash.sol";
import { ECDSA } from "@openzeppelin/contracts/cryptography/ECDSA.sol";
import { EIP712 } from "@openzeppelin/contracts/drafts/EIP712.sol";
// lib
import { UniOracle } from "./UniOracle.sol";
import { StrategyBase } from "squeeth-monorepo/strategy/base/StrategyBase.sol";
import { StrategyMath } from "squeeth-monorepo/strategy/base/StrategyMath.sol"; // StrategyMath licensed under AGPL-3.0-only
import { console } from "forge-std/console.sol";

/**
 * @notice AuctionBull contract
 * @author opyn team
 */
contract AuctionBull is UniFlash, Ownable, EIP712, StrategyBase {
    using StrategyMath for uint256;

    /// @dev highest delta the auction manager can rebalance to
    uint256 internal constant DELTA_UPPER = 1.1e18;
    /// @dev lowest delta the auction manager can rebalance to
    uint256 internal constant DELTA_LOWER = 0.9e18;
    /// @dev highest CR the auction manager can rebalance to
    uint256 internal constant CR_UPPER = 3e18;
    /// @dev lowest CR the auction manager can rebalance to
    uint256 internal constant CR_LOWER = 1.5e18;

    /// @dev basic unit used for calculation
    uint256 private constant ONE = 1e18;
    uint256 private constant ONE_ONE = 1e36;

    /// @dev TWAP period
    uint32 internal constant TWAP = 420;

    // @dev OTC price must be within this distance of the uniswap twap price
    uint256 public otcPriceTolerance = 5e16; // 5%

    // @dev OTC price tolerance cannot exceed 20%
    uint256 public constant MAX_OTC_PRICE_TOLERANCE = 2e17; // 20%

    /// @dev twap period to use for hedge calculations
    uint32 public hedgingTwapPeriod = 420 seconds;

    /// @dev time difference to trigger a hedge (seconds)
    uint256 public hedgeTimeThreshold;
    /// @dev price movement to trigger a hedge (0.1*1e18 = 10%)
    uint256 public hedgePriceThreshold;

    /// @dev timestamp when last hedge executed
    uint256 public timeAtLastHedge;
    /// @dev wSqueeth/Eth price when last hedge executed
    uint256 public priceAtLastHedge;

    /// @dev true if CrabV2 was initialized
    bool public isInitialized;

    /// @dev typehash for signed orders
    bytes32 private constant _CRAB_BALANCE_TYPEHASH = keccak256(
        "Order(uint256 bidId,address trader,uint256 quantity,uint256 price,bool isBuying,uint256 expiry,uint256 nonce)"
    );

    /// @dev USDC address
    address private immutable usdc;
    /// @dev WETH address
    address private immutable bullStrategy;
    address private immutable ethWSqueethPool;
    address private immutable ethUSDCPool;
    address private immutable crab;
    /// @dev euler eToken for WETH
    address private immutable eToken;
    /// @dev euler dToken for USDC
    address private immutable dToken;

    /// @dev auction manager
    address public auctionManager;

    /// @dev enum to differentiate between Uniswap swap callback function source
    enum FLASH_SOURCE {
        SELLING_USDC,
        BUYING_USDC
    }

    /// @dev store the used flag for a nonce for each address
    mapping(address => mapping(uint256 => bool)) public nonces;

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

    event HedgeOTCSingle(
        address trader,
        uint256 bidId,
        uint256 quantity,
        uint256 price,
        bool isBuying,
        uint256 clearingPrice
    );
    event HedgeOTC(uint256 bidId, uint256 quantity, bool isBuying, uint256 clearingPrice);

    constructor(
        address _auctionOwner,
        address _auctionManager,
        address _bull,
        address _factory,
        address _crab,
        address _eToken,
        address _dToken
    )
        UniFlash(_factory)
        StrategyBase(
            IBullStrategy(_bull).powerTokenController(),
            IController(IBullStrategy(_bull).powerTokenController()).weth(),
            "Bull Strategy v0",
            "Bullv0"
        )
        EIP712("BullOTC", "1")
        Ownable()
    {
        auctionManager = _auctionManager;
        bullStrategy = _bull;
        usdc = IController(IBullStrategy(_bull).powerTokenController()).quoteCurrency();
        ethWSqueethPool = IController(IBullStrategy(_bull).powerTokenController()).wPowerPerpPool();
        ethUSDCPool =
            IController(IBullStrategy(_bull).powerTokenController()).ethQuoteCurrencyPool();
        crab = _crab;
        eToken = _eToken;
        dToken = _dToken;

        IERC20(IController(IBullStrategy(_bull).powerTokenController()).weth()).approve(
            _bull, type(uint256).max
        );
        IERC20(IController(IBullStrategy(_bull).powerTokenController()).quoteCurrency()).approve(
            _bull, type(uint256).max
        );

        transferOwnership(_auctionOwner);
    }

    function fullRebalance() external {
        require(msg.sender == auctionManager);
    }

    /**
     * @dev set nonce flag of the trader to true
     * @param _trader address of the signer
     * @param _nonce number that is to be traded only once
     */
    function _useNonce(address _trader, uint256 _nonce) internal {
        require(!nonces[_trader][_nonce], "C27");
        nonces[_trader][_nonce] = true;
    }

    /**
     * @dev view function to get the domain seperator used in signing
     */
    // solhint-disable-next-line func-name-mixedcase
    function DOMAIN_SEPARATOR() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    /**
     * @dev check the signer and swap tokens in the order
     * @param _remainingAmount quantity the manager wants to trade
     * @param _clearingPrice the price at which all orders are traded
     * @param _order a signed order to swap tokens
     */
    function _execOrder(uint256 _remainingAmount, uint256 _clearingPrice, Order memory _order)
        internal
    {
        // check that order beats clearing price
        if (_order.isBuying) {
            require(_clearingPrice <= _order.price, "C17");
        } else {
            require(_clearingPrice >= _order.price, "C18");
        }

        _useNonce(_order.trader, _order.nonce);
        bytes32 structHash = keccak256(
            abi.encode(
                _CRAB_BALANCE_TYPEHASH,
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
        address offerSigner = ECDSA.recover(hash, _order.v, _order.r, _order.s);
        require(offerSigner == _order.trader, "C19");
        require(_order.expiry >= block.timestamp, "C20");

        // adjust quantity for partial fills
        if (_remainingAmount < _order.quantity) {
            _order.quantity = _remainingAmount;
        }
        // weth clearing price for the order
        uint256 wethAmount = _order.quantity.mul(_clearingPrice).div(ONE);

        if (_order.isBuying) {
            // trader sends weth and receives oSQTH
            IWETH9(weth).transferFrom(_order.trader, address(this), wethAmount);
            IWETH9(weth).withdraw(wethAmount);
            _mintWPowerPerp(_order.trader, _order.quantity, wethAmount, false);
        } else {
            // trader sends oSQTH and receives weth
            _burnWPowerPerp(_order.trader, _order.quantity, wethAmount, false);
            // wrap it
            IWETH9(weth).deposit{value: wethAmount}();
            IWETH9(weth).transfer(_order.trader, wethAmount);
        }

        emit HedgeOTCSingle(
            _order.trader, // market maker
            _order.bidId,
            _order.quantity, // order oSQTH quantity
            _order.price, // order price
            _order.isBuying, // order direction
            _clearingPrice // executed price for order
        );
    }

    /**
     * @dev hedge function to reduce delta using an array of signed orders
     * @param _totalQuantity quantity the manager wants to trade
     * @param _clearingPrice clearing price in weth
     * @param _isHedgeBuying direction of hedge trade
     * @param _orders an array of signed order to swap tokens
     */
    function hedgeOTC(
        uint256 _totalQuantity,
        uint256 _clearingPrice,
        bool _isHedgeBuying,
        Order[] memory _orders
    ) external onlyOwner {
        require(_clearingPrice > 0, "C21");
        require(_isTimeHedge() || _isPriceHedge(), "C22");
        _checkOTCPrice(_clearingPrice, _isHedgeBuying);

        timeAtLastHedge = block.timestamp;
        priceAtLastHedge = _clearingPrice;

        uint256 remainingAmount = _totalQuantity;
        uint256 prevPrice = _orders[0].price;
        uint256 currentPrice = _orders[0].price;
        bool isOrderBuying = _orders[0].isBuying;
        require(_isHedgeBuying != isOrderBuying, "C23");

        // iterate through order array and execute if valid
        for (uint256 i; i < _orders.length; ++i) {
            currentPrice = _orders[i].price;
            require(_orders[i].isBuying == isOrderBuying, "C24");
            if (_isHedgeBuying) {
                require(currentPrice >= prevPrice, "C25");
            } else {
                require(currentPrice <= prevPrice, "C25");
            }
            prevPrice = currentPrice;

            _execOrder(remainingAmount, _clearingPrice, _orders[i]);

            if (remainingAmount > _orders[i].quantity) {
                remainingAmount = remainingAmount.sub(_orders[i].quantity);
            } else {
                break;
            }
        }

        emit HedgeOTC(_orders[0].bidId, _totalQuantity, _isHedgeBuying, _clearingPrice);
    }

    /**
     * @notice check that the proposed sale price is within a tolerance of the current Uniswap twap
     * @param _price clearing price provided by manager
     * @param _isHedgeBuying is crab buying or selling oSQTH
     */
    function _checkOTCPrice(uint256 _price, bool _isHedgeBuying) internal view {
        // Get twap
        uint256 wSqueethEthPrice =
            UniOracle._getTwap(ethWSqueethPool, wPowerPerp, weth, TWAP, false);

        if (_isHedgeBuying) {
            require(
                _price <= wSqueethEthPrice.mul((ONE.add(otcPriceTolerance))).div(ONE),
                "Price too high relative to Uniswap twap."
            );
        } else {
            require(
                _price >= wSqueethEthPrice.mul((ONE.sub(otcPriceTolerance))).div(ONE),
                "Price too low relative to Uniswap twap."
            );
        }
    }

    /**
     * @dev changes the leverage component composition by buying or selling eth
     */
    function leverageRebalance(
        bool _isBuyingUsdc,
        uint256 _usdcAmount,
        uint256 _wethThresholdAmount,
        uint24 _poolFee
    ) external {
        require(msg.sender == auctionManager);

        if (_isBuyingUsdc) {
            // swap ETH to USDC
            _exactOutFlashSwap(
                weth,
                usdc,
                _poolFee,
                _usdcAmount,
                _wethThresholdAmount,
                uint8(FLASH_SOURCE.BUYING_USDC),
                abi.encodePacked(_usdcAmount)
            );
        } else {
            // swap USDC to ETH
            _exactInFlashSwap(
                usdc,
                weth,
                _poolFee,
                _usdcAmount,
                _wethThresholdAmount,
                uint8(FLASH_SOURCE.SELLING_USDC),
                ""
            );
        }

        _isValidLeverageRebalance();
    }

    function _uniFlashSwap(UniFlashswapCallbackData memory _uniFlashSwapData) internal override {
        if (FLASH_SOURCE(_uniFlashSwapData.callSource) == FLASH_SOURCE.SELLING_USDC) {
            IBullStrategy(bullStrategy).depositAndBorrowFromLeverage(
                IERC20(weth).balanceOf(address(this)), _uniFlashSwapData.amountToPay
            );

            IERC20(_uniFlashSwapData.tokenIn).transfer(
                _uniFlashSwapData.pool, _uniFlashSwapData.amountToPay
            );

            IERC20(usdc).transfer(_uniFlashSwapData.pool, _uniFlashSwapData.amountToPay);
        } else if (FLASH_SOURCE(_uniFlashSwapData.callSource) == FLASH_SOURCE.BUYING_USDC) {
            uint256 usdcToRepay = abi.decode(_uniFlashSwapData.callData, (uint256));
            // Repay some USDC debt
            IERC20(usdc).approve(address(bullStrategy), usdcToRepay);
            IBullStrategy(bullStrategy).repayAndWithdrawFromLeverage(
                usdcToRepay, _uniFlashSwapData.amountToPay
            );

            IERC20(weth).transfer(_uniFlashSwapData.pool, _uniFlashSwapData.amountToPay);
        }
    }

    /**
     * @notice check if hedging based on time threshold is allowed
     * @return true if time hedging is allowed
     */
    function _isTimeHedge() internal view returns (bool) {
        return (block.timestamp >= timeAtLastHedge.add(hedgeTimeThreshold));
    }

    /**
     * @notice check if hedging based on price threshold is allowed
     * @return true if hedging is allowed
     */
    function _isPriceHedge() internal view returns (bool) {
        uint256 wSqueethEthPrice =
            UniOracle._getTwap(ethWSqueethPool, wPowerPerp, weth, hedgingTwapPeriod, true);
        uint256 cachedRatio = wSqueethEthPrice.wdiv(priceAtLastHedge);
        uint256 priceThreshold =
            cachedRatio > ONE ? (cachedRatio).sub(ONE) : uint256(ONE).sub(cachedRatio);

        return priceThreshold >= hedgePriceThreshold;
    }

    function _isValidLeverageRebalance() internal view {
        (uint256 delta, uint256 cr) = _getCurrentDeltaAndCollatRatio();
        require(delta <= DELTA_UPPER && delta >= DELTA_LOWER, "Invalid delta after rebalance");
        require(cr <= CR_UPPER && cr >= CR_LOWER, "Invalid CR after rebalance");
    }

    function getCurrentDeltaAndCollatRatio() external view returns (uint256, uint256) {
        return _getCurrentDeltaAndCollatRatio();
    }

    /**
     * @notice get expected bull startegy delta and leverage collat ratio after leverage rebalance
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

        console.log("here");
        uint256 delta = (wethInCollateral.wmul(ethUsdPrice)).wdiv(
            (IBullStrategy(bullStrategy).getCrabBalance().wmul(crabUsdPrice)).add(
                wethInCollateral.wmul(ethUsdPrice)
            ).sub(usdcDebt.mul(1e12))
        );
        console.log("here2");
        console.log("delta", delta);
        console.log("wethInCollateral", wethInCollateral);
        console.log("ethUsdPrice", ethUsdPrice);
        console.log("usdcDebt", usdcDebt);

        uint256 cr = wethInCollateral.wmul(ethUsdPrice).wdiv(usdcDebt.mul(1e12));

        return (delta, cr);
    }
}
