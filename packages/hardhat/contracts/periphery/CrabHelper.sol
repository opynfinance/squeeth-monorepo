// SPDX-License-Identifier: GPL-3.0-only

pragma solidity =0.7.6;
pragma abicoder v2;

// interface
import {ICrabV2} from "../interfaces/ICrabV2.sol";
import {IWPowerPerp} from "../interfaces/IWPowerPerp.sol";
import {IOracle} from "../interfaces/IOracle.sol";
import {IWETH9} from "../interfaces/IWETH9.sol";
// lib
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
// StrategyMath licensed under AGPL-3.0-only
import {StrategyMath} from "./base/StrategyMath.sol";
import {ECDSA} from "@openzeppelin/contracts/cryptography/ECDSA.sol";

/**
 * @dev CrabStrategyV2 contract
 * @notice Contract for Crab strategy
 * @author Opyn team
 */
contract CrabHelper  {
    using StrategyMath for uint256;
    using Address for address payable;

    uint256 private constant ONE = 1e18;
    /// @dev twap period to use for hedge calculations
    uint32 public hedgingTwapPeriod;

    /// @dev typehash for signed orders
    bytes32 private constant _CRAB_BALANCE_TYPEHASH =
        keccak256(
            "Order(uint256 bidId,address trader,uint256 quantity,uint256 price,bool isBuying,uint256 expiry,uint256 nonce)"
        );

    /// @dev ETH:WSqueeth uniswap pool
    address public immutable ethWSqueethPool;
    /// @dev strategy uniswap oracle
    address public immutable oracle;
    address public immutable ethQuoteCurrencyPool;
    address public immutable quoteCurrency;

    address public immutable weth;
    address public immutable wPowerPerp;


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

    /**
     * @notice constructor
     * @dev uses crabV2 public params 
     * @param _crabV2 crabV2 address
     */
    constructor(address _crabV2){
        ICrabV2 crabv2 = ICrabV2(_crabV2);
        // get addresses from crabv2 contract
        ethWSqueethPool = crabv2.ethWSqueethPool;
        oracle = crabv2.oracle;
        ethQuoteCurrencyPool = crabv2.ethQuoteCurrencyPool;
        quoteCurrency = crabv2.quoteCurrency;
        hedgingTwapPeriod = crabV2.hedgingFrequency;
        weth = crabV2.weth;
        wPowerPerp = crabV2.wPowerPerp;

}

    /**
     * @dev get current nonce of the address
     * @param _owner address of signer
     * @return current the current nonce of the address
     */
    function nonces(address _owner) external view returns (uint256) {
        return crabV2.nonces(owner);
    }

    /**
     * @notice sync strategy debt and collateral amount from vault
     * @return synced debt amount
     * @return synced collateral amount
     */
    function _syncStrategyState() internal view returns (uint256, uint256) {
        (, , uint256 syncedStrategyCollateral, uint256 syncedStrategyDebt) = crabV2._getVaultDetails();

        return (syncedStrategyDebt, syncedStrategyCollateral);
    }

       /// @dev typehash for signed orders
    bytes32 private constant _CRAB_BALANCE_TYPEHASH =
        keccak256(
            "Order(uint256 bidId,address trader,uint256 quantity,uint256 price,bool isBuying,uint256 expiry,uint256 nonce)"
        );

    /**
     * @notice view function to verify an order
     * @param _order crab ratio
     * @return isValid true if order is good
     */
    function _verifyOrder(
        Order memory _order
    ) external view returns (bool) {

        bytes32 structHash = keccak256(
            abi.encode(
                _CRAB_BALANCE_TYPEHASH,
                _order.bidId,
                _order.trader,
                _order.quantity,
                _order.price,
                _order.isBuying,
                _order.expiry,
                nonces(owner)
            )
        );

        bytes32 hash = _hashTypedDataV4(structHash);
        address offerSigner = ECDSA.recover(hash, _order.v, _order.r, _order.s);
        require(offerSigner == _order.trader, "Invalid offer signature");
        require(_order.expiry >= block.timestamp, "Order has expired");

        // weth price for the order
        uint256 wethAmount = _order.quantity.mul(_order.price).div(1e18);

        if (_order.isBuying) {
            // check weth balance and allowance 
            require(IWETH9(weth).balanceOf(_order.trader) >= wethAmount, "Not enough weth balance for trade");
            require(IWETH9(weth).allowance(_order.trader, address(this)) >= wethAmount, "Not enough weth allowance for trade");
            // check allowance
        } else {
            // check wPowerPerp balance and allowance
            require(IWETH9(wPowerPerp).balanceOf(_order.trader) >= _order.quantity, "Not enough wPowerPerp balance for trade");
            require(IWETH9(wPowerPerp).allowance(_order.trader, address(this)) >= _order.quantity, "Not enough wPowerPerp balance for trade");
        }
       return true;
    }

    /**
     * @notice view function for hedge size based on current state
     * @return hedge amount, isSellingSqueeth
     */
    function getHedgeSize() external view returns (uint256, bool){
        // Get state and calculate hedge
        (uint256 strategyDebt, uint256 ethDelta) = _syncStrategyState();
        uint256 wSqueethEthPrice = IOracle(oracle).getTwap(
            ethWSqueethPool,
            wPowerPerp,
            weth,
            hedgingTwapPeriod,
            true
        );

        uint256 wSqueethDelta = strategyDebt.wmul(2e18).wmul(wSqueethEthPrice);

        return (wSqueethDelta > ethDelta)
                ? ((wSqueethDelta.sub(ethDelta)).wdiv(wSqueethEthPrice), false)
                : ((ethDelta.sub(wSqueethDelta)).wdiv(wSqueethEthPrice), true);
    }

}
