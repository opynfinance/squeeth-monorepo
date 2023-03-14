// SPDX-License-Identifier: GPL-3.0-only
pragma solidity =0.7.6;
pragma abicoder v2;

// interface
import { IController } from "squeeth-monorepo/interfaces/IController.sol";
import { IZenBullStrategy } from "./interface/IZenBullStrategy.sol";
import { IERC20 } from "openzeppelin/token/ERC20/IERC20.sol";
import { IWETH9 } from "squeeth-monorepo/interfaces/IWETH9.sol";
// import { ICrabStrategyV2 } from "./interface/IEulerDToken.sol";
// contract
import { Ownable } from "openzeppelin/access/Ownable.sol";
import { UniFlash } from "./UniFlash.sol";
import { UniOracle } from "./UniOracle.sol";
import { EIP712 } from "openzeppelin/drafts/EIP712.sol";
// lib
import { StrategyMath } from "squeeth-monorepo/strategy/base/StrategyMath.sol";
import { ECDSA } from "openzeppelin/cryptography/ECDSA.sol";
import { Address } from "openzeppelin/utils/Address.sol";

contract EmergencyWithdrawAuction is Ownable, EIP712 {
    using StrategyMath for uint256;
    using Address for address payable;

    /// @dev typehash for signed orders
    bytes32 private constant _EMERGENCY_WITHDRAW_AUCTION_TYPEHASH = keccak256(
        "Order(uint256 bidId,address trader,uint256 quantity,uint256 price,bool isBuying,uint256 expiry,uint256 nonce)"
    );

    address internal constant BURN_ADDR = address(0);

    /// @dev 1e18
    uint256 internal constant ONE = 1e18;
    /// @dev TWAP period
    uint32 internal constant TWAP = 420;
    /// @dev WETH decimals - USDC decimals
    uint256 internal constant WETH_DECIMALS_DIFF = 1e12;

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

    bool isAlreadyAuctionned;

    address immutable zenBull;
    address immutable crab;
    address immutable bullStrategy;
    address immutable wPowerPerp;
    address immutable weth;

    /// @dev store the used flag for a nonce for each address
    mapping(address => mapping(uint256 => bool)) public nonces;

    constructor(
        address _zenBull,
        address _crab,
        address _bullStrategy,
        address _wPowerPerp,
        address _weth
    ) Ownable() EIP712("EmergencyWithdrawAuction", "1") {
        zenBull = _zenBull;
        crab = _crab;
        bullStrategy = _bullStrategy;
        wPowerPerp = _wPowerPerp;
        weth = _weth;
    }

    /**
     * @notice receive function to allow ETH transfer to this contract
     */
    receive() external payable {
        require(msg.sender == weth);
    }

    function withdrawAuction(Order[] memory _orders, uint256 _crabAmount, uint256 _clearingPrice)
        external
        onlyOwner
    {
        require(_clearingPrice > 0);

        // get current crab vault state
        (uint256 ethInCrab, uint256 wPowerPerpInCrab) =
            IZenBullStrategy(bullStrategy).getCrabVaultDetails();
        // total amount of wPowerPerp to trade given crab amount
        uint256 wPowerPerpAmount =
            _calcWPowerPerpAmountFromCrab(_crabAmount, ethInCrab, wPowerPerpInCrab);

        uint256 wPowerPerpBalance = IERC20(wPowerPerp).balanceOf(address(this));
        _pullWPowerPerp(_orders, wPowerPerpAmount, _clearingPrice);
        wPowerPerpBalance = IERC20(wPowerPerp).balanceOf(address(this)).sub(wPowerPerpBalance);

        IERC20(wPowerPerp).approve(zenBull, wPowerPerpBalance);
        IZenBullStrategy(zenBull).redeemCrabAndWithdrawWEth(_crabAmount, wPowerPerpBalance);

        _pushWeth(_orders, wPowerPerpBalance, _clearingPrice);

        IWETH9(weth).withdraw(IERC20(weth).balanceOf(address(this)));

        isAlreadyAuctionned = true;
    }

    function redeemZenBull(uint256 _amount) external {
        require(isAlreadyAuctionned);

        uint256 payout = _amount.mul(address(this).balance).div(IERC20(zenBull).totalSupply());

        IERC20(zenBull).transferFrom(msg.sender, BURN_ADDR, _amount);

        payable(msg.sender).sendValue(payout);
    }

    /**
     * @notice pushes funds to trader of auction orders (weth or wPowerPerp) depending on the direction of trade
     * @param _orders list of orders
     * @param remainingAmount amount of wPowerPerp to trade
     * @param _clearingPrice clearing price weth/wPowerPerp, in 1e18 units
     */
    function _pushWeth(Order[] memory _orders, uint256 _remainingAmount, uint256 _clearingPrice)
        internal
    {
        uint256 ordersLength = _orders.length;

        for (uint256 i; i < ordersLength; ++i) {
            if (_remainingAmount < _orders[i].quantity) {
                _orders[i].quantity = _remainingAmount;

                uint256 wethAmount = _orders[i].quantity.wmul(_clearingPrice);
                IERC20(weth).transfer(_orders[i].trader, wethAmount);

                break;
            } else {
                _remainingAmount = _remainingAmount.sub(_orders[i].quantity);
                uint256 wethAmount = _orders[i].quantity.wmul(_clearingPrice);
                IERC20(weth).transfer(_orders[i].trader, wethAmount);
            }
        }
    }

    /**
     * @notice pulls funds from trader of auction orders (weth or wPowerPerp) depending on the direction of trade
     * @param _orders list of orders
     * @param _remainingAmount amount of wPowerPerp to trade
     * @param _clearingPrice clearing price weth/wPowerPerp, in 1e18 units
     */
    function _pullWPowerPerp(
        Order[] memory _orders,
        uint256 remainingAmount,
        uint256 _clearingPrice
    ) internal {
        uint256 prevPrice = _orders[0].price;
        uint256 ordersLength = _orders.length;

        for (uint256 i; i < ordersLength; ++i) {
            _verifyOrder(_orders[i], _clearingPrice);

            uint256 currentPrice = _orders[i].price;
            // check that orders are in order
            require(currentPrice >= prevPrice);
            prevPrice = currentPrice;

            if (remainingAmount < _orders[i].quantity) {
                _orders[i].quantity = remainingAmount;

                IERC20(wPowerPerp).transferFrom(
                    _orders[i].trader, address(this), _orders[i].quantity
                );
                break;
            } else {
                remainingAmount = remainingAmount.sub(_orders[i].quantity);

                IERC20(wPowerPerp).transferFrom(
                    _orders[i].trader, address(this), _orders[i].quantity
                );
            }
        }
    }

    /**
     * @notice verify that an auction order is valid
     * @param _order Order struct
     * @param _clearingPrice clearing price in WETH/wPowerPerp
     */
    function _verifyOrder(Order memory _order, uint256 _clearingPrice) internal {
        // check that order trade against hedge direction
        require(_order.isBuying == false);
        require(_clearingPrice >= _order.price);

        _useNonce(_order.trader, _order.nonce);
        bytes32 structHash = keccak256(
            abi.encode(
                _EMERGENCY_WITHDRAW_AUCTION_TYPEHASH,
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
        require(orderSigner == _order.trader);
        require(_order.expiry >= block.timestamp);
    }

    /**
     * @dev set nonce flag of the trader to true
     * @param _trader address of the signer
     * @param _nonce number that is to be traded only once
     */
    function _useNonce(address _trader, uint256 _nonce) internal {
        require(!nonces[_trader][_nonce]);
        nonces[_trader][_nonce] = true;
    }

    /**
     * @dev calculate amount of wPowerPerp associated with a crab deposit or withdrawal
     * @param _crabAmount amount of crab to deposit/withdraw
     * @param _ethInCrab amount of eth collateral owned by crab strategy
     * @param _wPowerPerpInCrab amount of wPowerPerp debt owed by crab strategy
     * @return amount of wPowerPerp
     */
    function _calcWPowerPerpAmountFromCrab(
        uint256 _crabAmount,
        uint256 _ethInCrab,
        uint256 _wPowerPerpInCrab
    ) internal view returns (uint256) {
        return _crabAmount.wmul(_wPowerPerpInCrab).wdiv(IERC20(crab).totalSupply());
    }
}
