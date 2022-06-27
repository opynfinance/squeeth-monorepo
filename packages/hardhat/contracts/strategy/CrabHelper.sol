//SPDX-License-Identifier: BUSL-1.1

pragma solidity =0.7.6;
pragma abicoder v2;

import {ICrabStrategyV2} from "../interfaces/ICrabStrategyV2.sol";
import {IWETH9} from "../interfaces/IWETH9.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IOracle} from "../interfaces/IOracle.sol";

import {EIP712} from "@openzeppelin/contracts/drafts/EIP712.sol";

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";

import {StrategySwap} from "./helper/StrategySwap.sol";
// StrategyMath licensed under AGPL-3.0-only
import {StrategyMath} from "./base/StrategyMath.sol";
import {ECDSA} from "@openzeppelin/contracts/cryptography/ECDSA.sol";

/**
 * @dev CrabHelper contract
 * @notice Contract for Crab helper functions
 * @author Opyn team
 */
contract CrabHelper is StrategySwap, ReentrancyGuard, EIP712 {
    using Address for address payable;
    using StrategyMath for uint256;

    address public immutable crab;
    address public immutable weth;
    address public immutable wPowerPerp;
    address public immutable ethWSqueethPool;
    address public immutable oracle;
    uint32 public immutable hedgingTwapPeriod;

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

    event FlashDepositERC20(
        address indexed depositor,
        address depositedERC20,
        uint256 depositedAmount,
        uint256 depositedEthAmount,
        uint256 crabAmount,
        uint256 returnedEth
    );

    event FlashWithdrawERC20(
        address indexed withdrawer,
        address withdrawnERC20,
        uint256 withdrawnAmount,
        uint256 withdrawnEthAmount,
        uint256 crabAmount
    );

    constructor(address _crab, address _swapRouter) StrategySwap(_swapRouter) EIP712("CrabOTC", "2") {
        require(_crab != address(0), "Invalid crab address");

        crab = _crab;
        weth = ICrabStrategyV2(_crab).weth();
        wPowerPerp = ICrabStrategyV2(_crab).wPowerPerp();
        ethWSqueethPool = ICrabStrategyV2(_crab).ethWSqueethPool();
        hedgingTwapPeriod = ICrabStrategyV2(_crab).hedgingTwapPeriod();
        oracle = ICrabStrategyV2(_crab).oracle();
    }

    function flashDepositERC20(
        uint256 _ethToDeposit,
        uint256 _amountIn,
        uint256 _minEthToGet,
        uint24 _fee,
        address _tokenIn
    ) external nonReentrant {
        _swapExactInputSingle(_tokenIn, weth, msg.sender, address(this), _amountIn, _minEthToGet, _fee);

        IWETH9(weth).withdraw(IWETH9(weth).balanceOf(address(this)));
        ICrabStrategyV2(crab).flashDeposit{value: address(this).balance}(_ethToDeposit);

        uint256 crabAmount = IERC20(crab).balanceOf(address(this));

        emit FlashDepositERC20(msg.sender, _tokenIn, _amountIn, _ethToDeposit, crabAmount, address(this).balance);

        IERC20(crab).transfer(msg.sender, crabAmount);

        if (address(this).balance > 0) {
            payable(msg.sender).sendValue(address(this).balance);
        }
    }

    function flashWithdrawERC20(
        uint256 _crabAmount,
        uint256 _maxEthToPay,
        address _tokenOut,
        uint256 _minAmountOut,
        uint24 _fee
    ) external nonReentrant {
        IERC20(crab).transferFrom(msg.sender, address(this), _crabAmount);

        ICrabStrategyV2(crab).flashWithdraw(_crabAmount, _maxEthToPay);

        uint256 ethBalance = address(this).balance;
        IWETH9(weth).deposit{value: ethBalance}();
        uint256 tokenReceived = _swapExactInputSingle(
            weth,
            _tokenOut,
            address(this),
            msg.sender,
            ethBalance,
            _minAmountOut,
            _fee
        );

        emit FlashWithdrawERC20(msg.sender, _tokenOut, tokenReceived, ethBalance, _crabAmount);
    }

    /// @dev typehash for signed orders
    bytes32 private constant _CRAB_BALANCE_TYPEHASH =
        keccak256(
            "Order(uint256 bidId,address trader,uint256 quantity,uint256 price,bool isBuying,uint256 expiry,uint256 nonce)"
        );

    /**
     * @notice view function to verify an order
     * @param _order crab otc hedge order
     * @return isValid true if order is good
     */
    function verifyOrder(Order memory _order) external view returns (bool) {
        bytes32 structHash = keccak256(
            abi.encode(
                _CRAB_BALANCE_TYPEHASH,
                _order.bidId,
                _order.trader,
                _order.quantity,
                _order.price,
                _order.isBuying,
                _order.expiry,
                ICrabStrategyV2(crab).nonces(_order.trader)
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
            require(
                IWETH9(weth).allowance(_order.trader, address(this)) >= wethAmount,
                "Not enough weth allowance for trade"
            );
            // check allowance
        } else {
            // check wPowerPerp balance and allowance
            require(
                IWETH9(wPowerPerp).balanceOf(_order.trader) >= _order.quantity,
                "Not enough wPowerPerp balance for trade"
            );
            require(
                IWETH9(wPowerPerp).allowance(_order.trader, address(this)) >= _order.quantity,
                "Not enough wPowerPerp allowance for trade"
            );
        }
        return true;
    }

    /**
     * @notice view function for hedge size based on current state
     * @return hedge amount, isSellingSqueeth
     */
    function getHedgeSize() external view returns (uint256, bool) {
        // Get state and calculate hedge
        (uint256 strategyDebt, uint256 ethDelta) = ICrabStrategyV2(crab).syncStrategyState();
        uint256 wSqueethEthPrice = IOracle(oracle).getTwap(ethWSqueethPool, wPowerPerp, weth, hedgingTwapPeriod, true);
        uint256 wSqueethDelta = strategyDebt.wmul(2e18).wmul(wSqueethEthPrice);

        return
            (wSqueethDelta > ethDelta)
                ? ((wSqueethDelta.sub(ethDelta)).wdiv(wSqueethEthPrice), false)
                : ((ethDelta.sub(wSqueethDelta)).wdiv(wSqueethEthPrice), true);
    }

    /**
     * @notice receive function to allow ETH transfer to this contract
     */
    receive() external payable {
        require(msg.sender == weth || msg.sender == crab, "Cannot receive eth");
    }
}
