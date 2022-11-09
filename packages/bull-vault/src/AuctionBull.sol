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
import {EIP712} from "openzeppelin/drafts/EIP712.sol";
// lib
import { StrategyMath } from "squeeth-monorepo/strategy/base/StrategyMath.sol"; // StrategyMath licensed under AGPL-3.0-only
import {ECDSA} from "openzeppelin/cryptography/ECDSA.sol";

/**
 * Error code
 * AB0: caller is not auction manager
 * AB1: Invalid delta after rebalance
 * AB2: Invalid CR after rebalance
 * AB3: Invalid CR lower and upper values
 * AB4: Invalid delta lower and upper values
 * AB5: 
 * AB6:
 * AB7: 
 * AB8:
 * AB9:
 * AB10:
 * AB11:
 * AB12:
 * AB13: nonce already used
 */

/**
 * @notice AuctionBull contract
 * @author opyn team
 */
contract AuctionBull is UniFlash, Ownable, EIP712 {
    using StrategyMath for uint256;

    /// @dev typehash for signed orders
    bytes32 private constant _FULL_REBALANCE_TYPEHASH =
        keccak256(
            "Order(uint256 bidId,address trader,uint256 quantity,uint256 price,bool isBuying,uint256 expiry,uint256 nonce)"
        );

    /// @dev TWAP period
    uint32 internal constant TWAP = 420;
    /// @dev WETH decimals - USDC decimals
    uint256 internal constant WETH_DECIMALS_DIFF = 1e12;

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

    /// @dev auction manager
    address public auctionManager;

    /// @dev store the used flag for a nonce for each address
    mapping(address => mapping(uint256 => bool)) public nonces;

    /// @dev enum to differentiate between Uniswap swap callback function source
    enum FLASH_SOURCE {
        LEVERAGE_REBALANCE_DECREASE_DEBT,
        LEVERAGE_REBALANCE_INCREASE_DEBT,
        FULL_REBALANCE_BORROW_USDC_BUY_WETH,
        FULL_REBALANCE_REPAY_USDC,
        GENERAL_SWAP
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

    event SetCrUpperAndLower(
        uint256 oldCrLower, uint256 oldCrUpper, uint256 newCrLower, uint256 newCrUpper
    );
    event SetDeltaUpperAndLower(
        uint256 oldDeltaLower, uint256 oldDeltaUpper, uint256 newDeltaLower, uint256 newDeltaUpper
    );
    event LeverageRebalance(bool isSellingUsdc, uint256 usdcAmount, uint256 wethLimitAmount);

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
        bool _isDepositingInCrab
    ) external onlyOwner {
        require(_clearingPrice > 0, "AB5");
        // _checkOTCPrice(_clearingPrice, _isHedgeBuying);

        (uint256 ethInCrab, uint256 squeethInCrab) = IBullStrategy(bullStrategy).getCrabVaultDetails();
        uint256 wPowerPerpAmount = _crabAmount.wmul(squeethInCrab).wdiv(IERC20(crab).totalSupply());

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
                if (!_isDepositingInCrab) {
                    require(currentPrice >= prevPrice, "AB7");
                } else {
                    require(currentPrice <= prevPrice, "AB8");
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

        if (_isDepositingInCrab) {
            /**
             * if auction depositing into crab:
             * - calc amount of ETH needed to deposit into crab and get crabAmount
             * - if target WETH to have in euler greater than current amount in euler, borrow USDC to buy more WETH and deposit in euler
             * - if target WETH to have in euler less than current amount in euler, remove WETH from euler
             * - deposit into crab, and pay auction traders wPowerPerp  
             */
            _executeCrabDeposit(_crabAmount, _wethTargetInEuler, _wethLimitPrice, ethInCrab);
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

            _rebalanceLeverageComponent(_wethTargetInEuler, _wethLimitPrice);
        }
    }

    function _executeCrabDeposit(uint256 _crabAmount, uint256 _wethTargetInEuler, uint256 _wethLimitPrice, uint256 _ethInCrab) internal {
        uint256 wethFromEuler;
        uint256 ethNeededForCrab = _crabAmount.wdiv(IERC20(crab).totalSupply()).wmul(_ethInCrab);
        uint256 wethInCollateral = IEulerEToken(eToken).balanceOfUnderlying(address(bullStrategy));
        if (_wethTargetInEuler > wethInCollateral) {
            uint256 wethToBuy;
            uint256 usdcToBorrow;
            {
                uint256 ethUsdPrice = UniOracle._getTwap(ethUSDCPool, weth, usdc, TWAP, false);
                wethToBuy = _wethTargetInEuler.sub(wethInCollateral);
                usdcToBorrow = wethToBuy.wmul(ethUsdPrice).div(1e12);
            }
            _exactOutFlashSwap(
                usdc,
                weth,
                3000,
                wethToBuy,
                usdcToBorrow.wmul(_wethLimitPrice),
                uint8(FLASH_SOURCE.FULL_REBALANCE_BORROW_USDC_BUY_WETH),
                abi.encodePacked(wethToBuy, usdcToBorrow)
            );
        } else {
            wethFromEuler = wethInCollateral.sub(_wethTargetInEuler);
            IBullStrategy(bullStrategy).repayAndWithdrawFromLeverage(0, wethFromEuler);
        }
        ethNeededForCrab = ethNeededForCrab.sub(wethFromEuler);
        IBullStrategy(bullStrategy).depositEthIntoCrab(ethNeededForCrab);
    }

    function _rebalanceLeverageComponent(uint256 _wethTargetInEuler, uint256 _wethLimitPrice) internal {
        uint256 remainingWeth = IERC20(weth).balanceOf(address(this));
        uint256 wethInCollateral = IEulerEToken(eToken).balanceOfUnderlying(address(bullStrategy));
        if (_wethTargetInEuler > remainingWeth.add(wethInCollateral)) {
            uint256 ethUsdPrice = UniOracle._getTwap(ethUSDCPool, weth, usdc, TWAP, false);
            uint256 wethToBuy = _wethTargetInEuler.sub(remainingWeth.add(wethInCollateral));
            uint256 usdcToBorrow = wethToBuy.wmul(ethUsdPrice).div(1e12);
            _exactOutFlashSwap(
                usdc,
                weth,
                3000,
                wethToBuy,
                usdcToBorrow.wmul(_wethLimitPrice),
                uint8(FLASH_SOURCE.FULL_REBALANCE_BORROW_USDC_BUY_WETH),
                abi.encodePacked(wethToBuy, usdcToBorrow)
            );
        } else {
            uint256 wethToSell = remainingWeth.add(wethInCollateral).sub(_wethTargetInEuler);
            uint256 usdcToRepay = _exactInFlashSwap(
                weth,
                usdc,
                3000,
                wethToSell,
                wethToSell.wdiv(_wethLimitPrice).div(1e12),
                uint8(FLASH_SOURCE.GENERAL_SWAP),
                ""
            );

            IBullStrategy(bullStrategy).repayAndWithdrawFromLeverage(usdcToRepay, 0);
        }
    }

    function _verifyOrder(
        Order memory _order,
        uint256 _clearingPrice,
        bool _isDepositingInCrab
    ) internal {
        // check that order trade against hedge direction
        require(_order.isBuying != _isDepositingInCrab, "AB6");
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
        address offerSigner = ECDSA.recover(hash, _order.v, _order.r, _order.s);
        require(offerSigner == _order.trader, "AB11");
        require(_order.expiry >= block.timestamp, "AB12");
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

    function _transferToOrder(
        Order memory _order,
        uint256 _remainingAmount,
        uint256 _clearingPrice
    ) internal {
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
                == FLASH_SOURCE.GENERAL_SWAP
        ) {
            IERC20(_uniFlashSwapData.tokenIn).transfer(_uniFlashSwapData.pool, _uniFlashSwapData.amountToPay);
        } else if (
            FLASH_SOURCE(_uniFlashSwapData.callSource)
                == FLASH_SOURCE.FULL_REBALANCE_BORROW_USDC_BUY_WETH
        ) {
            (uint256 wethToDeposit, uint256 usdcToBorrow) = abi.decode(_uniFlashSwapData.callData, (uint256, uint256));

            IBullStrategy(bullStrategy).depositAndBorrowFromLeverage(wethToDeposit, usdcToBorrow);

            IERC20(usdc).transfer(_uniFlashSwapData.pool, _uniFlashSwapData.amountToPay);
        } else if (
            FLASH_SOURCE(_uniFlashSwapData.callSource)
                == FLASH_SOURCE.FULL_REBALANCE_REPAY_USDC
        ) {
            (uint256 wethToDeposit, uint256 usdcToBorrow) = abi.decode(_uniFlashSwapData.callData, (uint256, uint256));

            IBullStrategy(bullStrategy).depositAndBorrowFromLeverage(wethToDeposit, usdcToBorrow);

            IERC20(usdc).transfer(_uniFlashSwapData.pool, _uniFlashSwapData.amountToPay);
        }
    }

    /**
     * @notice check if startegy delta and CR ratio is within upper and lower values
     */
    function _isValidLeverageRebalance() internal view {
        (uint256 delta, uint256 cr) = _getCurrentDeltaAndCollatRatio();

        require(delta <= deltaUpper && delta >= deltaLower, "AB1");
        require(cr <= crUpper && cr >= crLower, "AB2");
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
}
