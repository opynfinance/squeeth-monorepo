// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.13;
pragma abicoder v2;

// interface
import { IERC20 } from "openzeppelin/interfaces/IERC20.sol";
import { IZenBullStrategy } from "./interface/IZenBullStrategy.sol";
import { IController } from "./interface/IController.sol";
import { IOracle } from "./interface/IOracle.sol";
import { IEulerSimpleLens } from "./interface/IEulerSimpleLens.sol";
import { IWETH } from "./interface/IWETH.sol";
// contract
import { Ownable } from "openzeppelin/access/Ownable.sol";
import { EIP712 } from "openzeppelin/utils/cryptography/draft-EIP712.sol";
import { ECDSA } from "openzeppelin/utils/cryptography/ECDSA.sol";
import { FlashSwap } from "./FlashSwap.sol";
// lib
import { Address } from "openzeppelin/utils/Address.sol";

/**
 * Error codes
 * ZBN01: Auction TWAP is less than min value
 * ZBN02: OTC price tolerance is greater than max OTC tolerance price
 * ZBN03: Amount to queue for deposit is less than min amount
 * ZBN04: Can not dequeue deposited amount because auction is already live and force dequeued not activated
 * ZBN05: Amount of ETH to deposit left in the queue is less than min amount
 * ZBN06: Queued deposit is not longer than 1 week to force dequeue
 * ZBN07: Amount of ZenBull to queue for withdraw is less than min amount
 * ZBN08: Amount of ZenBull to withdraw left in the queue is less than min amount
 * ZBN09: Queued withdraw is not longer than 1 week to force dequeue
 * ZBN10: ETH quantity to net is less than queued for deposits
 * ZBN11: ZenBull quantity to net is less than queued for withdraws
 * ZBN12: ZenBull Price too high
 * ZBN13: ZenBull Price too low
 * ZBN14: Clearing price too high relative to Uniswap twap
 * ZBN15: Clearing price too low relative to Uniswap twap
 * ZBN16: Invalid order signer
 * ZBN17: Order already expired
 * ZBN18: Nonce already used
 * ZBN19: auction order is not selling
 * ZBN20: sell order price greater than clearing
 */

/**
 * @dev ZenBullNetting contract
 * @notice Contract for Netting Deposits and Withdrawals in ZenBull
 * @author Opyn team
 */
contract ZenBullNetting is Ownable, EIP712, FlashSwap {
    using Address for address payable;

    /// @dev enum to differentiate between Uniswap swap callback function source
    enum FLASH_SOURCE { WITHDRAW_AUCTION }

    /// @dev typehash for signed orders
    bytes32 private constant _ZENBULL_NETTING_TYPEHASH = keccak256(
        "Order(uint256 bidId,address trader,uint256 quantity,uint256 price,bool isBuying,uint256 expiry,uint256 nonce)"
    );
    /// @dev OTC price tolerance cannot exceed 20%
    uint256 public constant MAX_OTC_PRICE_TOLERANCE = 2e17; // 20%
    /// @dev min auction TWAP
    uint32 public constant MIN_AUCTION_TWAP = 180 seconds;

    /// @dev owner sets to true when starting auction
    bool public isAuctionLive;

    /// @dev min ETH amounts to withdraw or deposit via netting
    uint256 public minEthAmount;
    /// @dev min ZenBull amounts to withdraw or deposit via netting
    uint256 public minZenBullAmount;
    /// @dev array index of last processed deposits
    uint256 public depositsIndex;
    /// @dev array index of last processed withdraws
    uint256 public withdrawsIndex;
    // @dev OTC price must be within this distance of the uniswap twap price
    uint256 public otcPriceTolerance;
    /// @dev twap period to use for auction calculations
    uint32 public auctionTwapPeriod;

    /// @dev WETH token address
    address private immutable weth;
    /// @dev oSQTH token address
    address private immutable oSqth;
    /// @dev USDC token address
    address private immutable usdc;
    /// @dev ZenBull token address
    address private immutable zenBull;
    /// @dev WPowerPerp Oracle address
    address private immutable oracle;
    /// @dev ETH/oSQTH uniswap v3 pool address
    address private immutable ethSqueethPool;
    /// @dev ETH/USDC uniswap v3 pool address
    address private immutable ethUsdcPool;
    /// @dev Euler Simple Lens contract address
    address private immutable eulerLens;

    /// @dev array of ETH deposit receipts
    Receipt[] public deposits;
    /// @dev array of ZenBull withdrawal receipts
    Receipt[] public withdraws;

    /// @dev ETH amount to deposit for an address
    mapping(address => uint256) public ethBalance;
    /// @dev ZenBull amount to withdraw for an address
    mapping(address => uint256) public zenBullBalance;
    /// @dev indexes of deposit receipts of an address
    mapping(address => uint256[]) public userDepositsIndex;
    /// @dev indexes of withdraw receipts of an address
    mapping(address => uint256[]) public userWithdrawsIndex;
    /// @dev store the used flag for a nonce for each address
    mapping(address => mapping(uint256 => bool)) public nonces;

    /// @dev order struct for a signed order from market maker
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

    /// @dev receipt used to store deposits and withdraws
    struct Receipt {
        /// @dev address of the depositor or withdrawer
        address sender;
        /// @dev ETH amount to queue for deposit or ZenBull amount to queue for withdrawal
        uint256 amount;
        /// @dev time of deposit
        uint256 timestamp;
    }

    /// @dev params for withdraw auction
    struct WithdrawAuctionParams {
        /// @dev amont of bull to queue for withdrawal
        uint256 withdrawsToProcess;
        /// @dev orders that sell oSqth to the auction
        Order[] orders;
        /// @dev price that the auction pays for the purchased oSqth
        uint256 clearingPrice;
        /// @dev max WETH to pay for flashswapped USDC
        uint256 maxWethForUsdc;
        /// @dev uniswap fee for swapping eth to USD;
        uint24 wethUsdcPoolFee;
    }

    /// @dev data structs for Uni v3 callback
    struct WithdrawAuctionData {
        uint256 zenBullAmountToBurn;
        uint256 oSqthAmountToRepay;
        uint256 ethAmountToRepay;
    }

    event SetMinZenBullAmount(uint256 oldAmount, uint256 newAmount);
    event SetMinEthAmount(uint256 oldAmount, uint256 newAmount);
    event SetDepositsIndex(uint256 oldDepositsIndex, uint256 newDepositsIndex);
    event SetWithdrawsIndex(uint256 oldWithdrawsIndex, uint256 newWithdrawsIndex);
    event SetAuctionTwapPeriod(uint32 previousTwap, uint32 newTwap);
    event SetOTCPriceTolerance(uint256 previousTolerance, uint256 newOtcPriceTolerance);
    event ToggledAuctionLive(bool isAuctionLive);
    event QueueEth(
        address indexed depositor,
        uint256 amount,
        uint256 depositorsBalance,
        uint256 indexed receiptIndex
    );
    event DequeueEth(address indexed depositor, uint256 amount, uint256 depositorsBalance);
    event QueueZenBull(
        address indexed withdrawer,
        uint256 amount,
        uint256 withdrawersBalance,
        uint256 indexed receiptIndex
    );
    event DequeueZenBull(address indexed withdrawer, uint256 amount, uint256 withdrawersBalance);
    event NetAtPrice(
        bool indexed isDeposit,
        address indexed receiver,
        uint256 amountQueuedProcessed,
        uint256 amountReceived,
        uint256 indexed index
    );
    event WithdrawAuction(
        address indexed trader, uint256 indexed bidId, uint256 quantity, uint256 price
    );
    event ZenBullWithdrawn(
        address indexed withdrawer,
        uint256 crabAmount,
        uint256 usdcAmount,
        uint256 indexed receiptIndex
    );

    constructor(address _zenBull, address _eulerSimpleLens, address _uniFactory)
        EIP712("ZenBullNetting", "1")
        FlashSwap(_uniFactory)
    {
        otcPriceTolerance = 5e16; // 5%
        auctionTwapPeriod = 420 seconds;

        zenBull = _zenBull;
        eulerLens = _eulerSimpleLens;
        weth = IController(IZenBullStrategy(_zenBull).powerTokenController()).weth();
        oracle = IController(IZenBullStrategy(_zenBull).powerTokenController()).oracle();
        ethSqueethPool =
            IController(IZenBullStrategy(_zenBull).powerTokenController()).wPowerPerpPool();
        ethUsdcPool =
            IController(IZenBullStrategy(_zenBull).powerTokenController()).ethQuoteCurrencyPool();
        usdc = IController(IZenBullStrategy(_zenBull).powerTokenController()).quoteCurrency();
        oSqth = IController(IZenBullStrategy(_zenBull).powerTokenController()).wPowerPerp();

        IERC20(usdc).approve(_zenBull, type(uint256).max);
        IERC20(oSqth).approve(_zenBull, type(uint256).max);
    }

    /**
     * @notice receive function to allow ETH transfer to this contract
     */
    receive() external payable { }

    /**
     * @dev view function to get the domain seperator used in signing
     */
    function DOMAIN_SEPARATOR() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    /**
     * @dev toggles the value of isAuctionLive
     */
    function toggleAuctionLive() external onlyOwner {
        isAuctionLive = !isAuctionLive;
        emit ToggledAuctionLive(isAuctionLive);
    }

    /**
     * @notice set min ETH amount
     * @param _amount the amount to be set as minEthAmount
     */
    function setMinEthAmount(uint256 _amount) external onlyOwner {
        emit SetMinEthAmount(minEthAmount, _amount);
        minEthAmount = _amount;
    }

    /**
     * @notice set minZenBullAmount
     * @param _amount the number to be set as minZenBullAmount
     */
    function setMinZenBullAmount(uint256 _amount) external onlyOwner {
        emit SetMinZenBullAmount(minZenBullAmount, _amount);

        minZenBullAmount = _amount;
    }

    /**
     * @notice set the depositIndex so that we want to skip processing some deposits
     * @param _newDepositsIndex the new deposits index
     */
    function setDepositsIndex(uint256 _newDepositsIndex) external onlyOwner {
        emit SetDepositsIndex(depositsIndex, _newDepositsIndex);

        depositsIndex = _newDepositsIndex;
    }

    /**
     * @notice set the withdraw index so that we want to skip processing some withdraws
     * @param _newWithdrawsIndex the new withdraw index
     */
    function setWithdrawsIndex(uint256 _newWithdrawsIndex) external onlyOwner {
        emit SetWithdrawsIndex(withdrawsIndex, _newWithdrawsIndex);

        withdrawsIndex = _newWithdrawsIndex;
    }

    /**
     * @notice owner can set the twap period in seconds that is used for obtaining TWAP prices
     * @param _auctionTwapPeriod the twap period, in seconds
     */
    function setAuctionTwapPeriod(uint32 _auctionTwapPeriod) external onlyOwner {
        require(_auctionTwapPeriod >= MIN_AUCTION_TWAP, "ZBN01");

        emit SetAuctionTwapPeriod(auctionTwapPeriod, _auctionTwapPeriod);

        auctionTwapPeriod = _auctionTwapPeriod;
    }

    /**
     * @notice owner can set a threshold, scaled by 1e18 that determines the maximum discount of a clearing sale price to the current uniswap twap price
     * @param _otcPriceTolerance the OTC price tolerance, in percent, scaled by 1e18
     */
    function setOTCPriceTolerance(uint256 _otcPriceTolerance) external onlyOwner {
        // Tolerance cannot be more than 20%
        require(_otcPriceTolerance <= MAX_OTC_PRICE_TOLERANCE, "ZBN02");

        emit SetOTCPriceTolerance(otcPriceTolerance, _otcPriceTolerance);

        otcPriceTolerance = _otcPriceTolerance;
    }

    /**
     * @notice queue ETH for deposit into ZenBull
     * @dev payable function
     */
    function queueEth() external payable {
        require(msg.value >= minEthAmount, "ZBN03");

        // update eth balance of user, add their receipt, and receipt index to user deposits index
        ethBalance[msg.sender] = ethBalance[msg.sender] + msg.value;
        deposits.push(Receipt(msg.sender, msg.value, block.timestamp));
        userDepositsIndex[msg.sender].push(deposits.length - 1);

        emit QueueEth(msg.sender, msg.value, ethBalance[msg.sender], deposits.length - 1);
    }

    /**
     * @notice withdraw ETH from queue
     * @param _amount ETH amount to dequeue
     * @param _force forceWithdraw if deposited more than a week ago
     */
    function dequeueEth(uint256 _amount, bool _force) external {
        require(!isAuctionLive || _force, "ZBN04");

        ethBalance[msg.sender] = ethBalance[msg.sender] - _amount;

        require(ethBalance[msg.sender] >= minEthAmount || ethBalance[msg.sender] == 0, "ZBN05");

        // start withdrawing from the users last deposit
        uint256 toWithdraw = _amount;
        uint256 lastDepositIndex = userDepositsIndex[msg.sender].length;
        for (uint256 i = lastDepositIndex; i > 0; i--) {
            Receipt storage receipt = deposits[userDepositsIndex[msg.sender][i - 1]];

            if (_force) {
                require(block.timestamp > receipt.timestamp + 1 weeks, "ZBN06");
            }
            if (receipt.amount > toWithdraw) {
                receipt.amount -= toWithdraw;
                break;
            } else {
                toWithdraw -= receipt.amount;
                delete deposits[userDepositsIndex[msg.sender][i - 1]];
                userDepositsIndex[msg.sender].pop();
            }
        }

        payable(msg.sender).sendValue(_amount);

        emit DequeueEth(msg.sender, _amount, ethBalance[msg.sender]);
    }

    /**
     * @notice queue ZenBull token for withdraw from strategy
     * @param _amount ZenBull amount to withdraw
     */
    function queueZenBull(uint256 _amount) external {
        require(_amount >= minZenBullAmount, "ZBN07");

        zenBullBalance[msg.sender] = zenBullBalance[msg.sender] + _amount;
        withdraws.push(Receipt(msg.sender, _amount, block.timestamp));
        userWithdrawsIndex[msg.sender].push(withdraws.length - 1);

        IERC20(zenBull).transferFrom(msg.sender, address(this), _amount);

        emit QueueZenBull(msg.sender, _amount, zenBullBalance[msg.sender], withdraws.length - 1);
    }

    /**
     * @notice withdraw ZenBull from queue
     * @param _amount ZenBull amount to dequeue
     * @param _force forceWithdraw if queued more than a week ago
     */
    function dequeueZenBull(uint256 _amount, bool _force) external {
        require(!isAuctionLive || _force, "ZBN04");

        zenBullBalance[msg.sender] = zenBullBalance[msg.sender] - _amount;

        require(
            zenBullBalance[msg.sender] >= minZenBullAmount || zenBullBalance[msg.sender] == 0,
            "ZBN08"
        );

        // deQueue ZenBull from the last, last in first out
        uint256 toRemove = _amount;
        uint256 lastWithdrawIndex = userWithdrawsIndex[msg.sender].length;
        for (uint256 i = lastWithdrawIndex; i > 0; i--) {
            Receipt storage receipt = withdraws[userWithdrawsIndex[msg.sender][i - 1]];
            if (_force) {
                require(block.timestamp > receipt.timestamp + 1 weeks, "ZBN09");
            }
            if (receipt.amount > toRemove) {
                receipt.amount -= toRemove;
                break;
            } else {
                toRemove -= receipt.amount;
                delete withdraws[userWithdrawsIndex[msg.sender][i - 1]];
                userWithdrawsIndex[msg.sender].pop();
            }
        }

        IERC20(zenBull).transfer(msg.sender, _amount);

        emit DequeueZenBull(msg.sender, _amount, zenBullBalance[msg.sender]);
    }

    /**
     * @notice swaps quantity amount of ETH for ZenBull token at ZenBull/ETH price
     * @param _price price of ZenBull in ETH
     * @param _quantity amount of ETH to net
     */
    function netAtPrice(uint256 _price, uint256 _quantity) external onlyOwner {
        _checkZenBullPrice(_price);

        uint256 zenBullQuantity = (_quantity * 1e18) / _price;

        require(_quantity <= address(this).balance, "ZBN10");
        require(zenBullQuantity <= IERC20(zenBull).balanceOf(address(this)), "ZBN11");

        // process deposits and send ZenBull
        uint256 i = depositsIndex;
        uint256 amountToSend;
        while (_quantity > 0) {
            Receipt memory deposit = deposits[i];
            if (deposit.amount == 0) {
                i++;
                continue;
            }
            if (deposit.amount <= _quantity) {
                // deposit amount is lesser than quantity use it fully
                _quantity = _quantity - deposit.amount;
                ethBalance[deposit.sender] -= deposit.amount;
                amountToSend = (deposit.amount * 1e18) / _price;
                IERC20(zenBull).transfer(deposit.sender, amountToSend);

                emit NetAtPrice(true, deposit.sender, deposit.amount, amountToSend, i);
                delete deposits[i];
                i++;
            } else {
                // deposit amount is greater than quantity; use it partially
                deposits[i].amount = deposit.amount - _quantity;
                ethBalance[deposit.sender] -= _quantity;
                amountToSend = (_quantity * 1e18) / _price;

                IERC20(zenBull).transfer(deposit.sender, amountToSend);

                emit NetAtPrice(true, deposit.sender, _quantity, amountToSend, i);
                _quantity = 0;
            }
        }
        depositsIndex = i;

        // process withdraws and send usdc
        i = withdrawsIndex;
        while (zenBullQuantity > 0) {
            Receipt memory withdraw = withdraws[i];
            if (withdraw.amount == 0) {
                i++;
                continue;
            }
            if (withdraw.amount <= zenBullQuantity) {
                zenBullQuantity = zenBullQuantity - withdraw.amount;
                zenBullBalance[withdraw.sender] -= withdraw.amount;
                amountToSend = (withdraw.amount * _price) / 1e18;

                payable(withdraw.sender).sendValue(amountToSend);

                emit NetAtPrice(false, withdraw.sender, withdraw.amount, amountToSend, i);

                delete withdraws[i];
                i++;
            } else {
                withdraws[i].amount = withdraw.amount - zenBullQuantity;
                zenBullBalance[withdraw.sender] -= zenBullQuantity;
                amountToSend = (zenBullQuantity * _price) / 1e18;

                payable(withdraw.sender).sendValue(amountToSend);

                emit NetAtPrice(false, withdraw.sender, zenBullQuantity, amountToSend, i);

                zenBullQuantity = 0;
            }
        }
        withdrawsIndex = i;
    }

    /**
     * @notice auction for queued withdraws
     * @dev takes in orders from MM's to sell oSQTH
     * @param _params Withdraw Params
     */
    function withdrawAuction(WithdrawAuctionParams calldata _params) public onlyOwner {
        _checkOTCPrice(_params.clearingPrice, true);

        uint256 initialEthBalance = address(this).balance;
        uint256 bullTotalSupply = IERC20(zenBull).totalSupply();
        uint256 crabAmount = _params.withdrawsToProcess * IZenBullStrategy(zenBull).getCrabBalance()
            / bullTotalSupply;
        (, uint256 crabDebt) = IZenBullStrategy(zenBull).getCrabVaultDetails();
        uint256 oSqthAmount =
            crabAmount * crabDebt / IERC20(IZenBullStrategy(zenBull).crab()).totalSupply();

        // get oSQTH from market makers orders
        uint256 toExchange = oSqthAmount;
        for (uint256 i = 0; i < _params.orders.length && toExchange > 0; i++) {
            _checkOrder(_params.orders[i]);
            _useNonce(_params.orders[i].trader, _params.orders[i].nonce);

            require(!_params.orders[i].isBuying, "ZBN19");
            require(_params.orders[i].price <= _params.clearingPrice, "ZBN20");

            if (_params.orders[i].quantity < toExchange) {
                toExchange -= _params.orders[i].quantity;
                IERC20(oSqth).transferFrom(
                    _params.orders[i].trader, address(this), _params.orders[i].quantity
                );
            } else {
                IERC20(oSqth).transferFrom(_params.orders[i].trader, address(this), toExchange);
                break;
            }
        }

        uint256 usdcToRepay = _params.withdrawsToProcess
            * IEulerSimpleLens(eulerLens).getDTokenBalance(usdc, zenBull) / bullTotalSupply;

        // WETH-USDC swap
        _exactOutFlashSwap(
            weth,
            usdc,
            _params.wethUsdcPoolFee,
            usdcToRepay,
            _params.maxWethForUsdc,
            uint8(FLASH_SOURCE.WITHDRAW_AUCTION),
            abi.encodePacked(_params.withdrawsToProcess, oSqthAmount, usdcToRepay)
        );

        // send WETH to market makers
        IWETH(weth).deposit{value: address(this).balance - initialEthBalance}();
        toExchange = oSqthAmount;
        uint256 oSqthQuantity;
        for (uint256 i = 0; i < _params.orders.length && toExchange > 0; i++) {
            if (_params.orders[i].quantity < toExchange) {
                oSqthQuantity = _params.orders[i].quantity;
            } else {
                oSqthQuantity = toExchange;
            }
            IERC20(weth).transfer(
                _params.orders[i].trader, (oSqthQuantity * _params.clearingPrice) / 1e18
            );
            toExchange -= oSqthQuantity;

            emit WithdrawAuction(
                _params.orders[i].trader,
                _params.orders[i].bidId,
                oSqthQuantity,
                _params.clearingPrice
                );
        }

        // send ETH to withdrawers
        uint256 ethToWithdrawers = IWETH(weth).balanceOf(address(this));
        IWETH(weth).withdraw(ethToWithdrawers);

        uint256 remainingWithdraws = _params.withdrawsToProcess;
        uint256 j = withdrawsIndex;
        uint256 ethAmount;

        while (remainingWithdraws > 0) {
            Receipt memory withdraw = withdraws[j];
            if (withdraw.amount == 0) {
                j++;
                continue;
            }
            if (withdraw.amount <= remainingWithdraws) {
                // full usage
                remainingWithdraws -= withdraw.amount;
                zenBullBalance[withdraw.sender] -= withdraw.amount;

                // send proportional usdc
                ethAmount = withdraw.amount * ethToWithdrawers / _params.withdrawsToProcess;

                payable(withdraw.sender).sendValue(ethAmount);

                delete withdraws[j];
                j++;

                emit ZenBullWithdrawn(withdraw.sender, withdraw.amount, ethAmount, j);
            } else {
                withdraws[j].amount -= remainingWithdraws;
                zenBullBalance[withdraw.sender] -= remainingWithdraws;

                // send proportional usdc
                ethAmount = remainingWithdraws * ethToWithdrawers / _params.withdrawsToProcess;

                payable(withdraw.sender).sendValue(ethAmount);

                emit ZenBullWithdrawn(withdraw.sender, remainingWithdraws, ethAmount, j);

                break;
            }
        }

        withdrawsIndex = j;
        isAuctionLive = false;
    }

    /**
     * @notice uniswap flash swap callback function to handle different types of flashswaps
     * @dev this function will be called by flashswap callback function uniswapV3SwapCallback()
     * @param _uniFlashSwapData UniFlashswapCallbackData struct
     */
    function _uniFlashSwap(UniFlashswapCallbackData memory _uniFlashSwapData) internal override {
        if (FLASH_SOURCE(_uniFlashSwapData.callSource) == FLASH_SOURCE.WITHDRAW_AUCTION) {
            WithdrawAuctionData memory data =
                abi.decode(_uniFlashSwapData.callData, (WithdrawAuctionData));

            IZenBullStrategy(zenBull).withdraw(data.zenBullAmountToBurn);
            IWETH(weth).deposit{value: _uniFlashSwapData.amountToPay}();
            IWETH(weth).transfer(_uniFlashSwapData.pool, _uniFlashSwapData.amountToPay);
        }
    }

    /**
     * @notice get the sum of queued ETH
     * @return sum ETH amount in queue
     */
    function depositsQueued() external view returns (uint256) {
        uint256 j = depositsIndex;
        uint256 sum;
        while (j < deposits.length) {
            sum = sum + deposits[j].amount;
            j++;
        }
        return sum;
    }

    /**
     * @notice get a deposit receipt by index
     * @param _index deposit index in deposits array
     * @return receipt sender, amount and timestamp
     */
    function getDepositReceipt(uint256 _index) external view returns (address, uint256, uint256) {
        Receipt memory receipt = deposits[_index];

        return (receipt.sender, receipt.amount, receipt.timestamp);
    }

    /**
     * @notice get the sum of queued ZenBull
     * @return sum ZenBull amount in queue
     */
    function withdrawsQueued() external view returns (uint256) {
        uint256 j = withdrawsIndex;
        uint256 sum;
        while (j < withdraws.length) {
            sum = sum + withdraws[j].amount;
            j++;
        }
        return sum;
    }

    /**
     * @notice get a withdraw receipt by index
     * @param _index withdraw index in withdraws array
     * @return receipt sender, amount and timestamp
     */
    function getWithdrawReceipt(uint256 _index) external view returns (address, uint256, uint256) {
        Receipt memory receipt = withdraws[_index];

        return (receipt.sender, receipt.amount, receipt.timestamp);
    }

    /**
     * @notice get ZenBull token price using uniswap TWAP
     * @return ZenBull price
     */
    function getZenBullPrice() external view returns (uint256) {
        return _getZenBullPrice();
    }

    /**
     * @notice checks the expiry nonce and signer of an order
     * @param _order Order struct
     */
    function checkOrder(Order memory _order) external view returns (bool) {
        return _checkOrder(_order);
    }

    /**
     * @dev set nonce flag of the trader to true
     * @param _trader address of the signer
     * @param _nonce number that is to be traded only once
     */
    function _useNonce(address _trader, uint256 _nonce) internal {
        require(!nonces[_trader][_nonce], "ZBN18");

        nonces[_trader][_nonce] = true;
    }

    /**
     * @dev check that the proposed ZenBull price is within a tolerance of the current Uniswap TWAP
     */
    function _checkZenBullPrice(uint256 _price) internal view {
        uint256 zenBullFairPrice = _getZenBullPrice();

        require(_price <= (zenBullFairPrice * (1e18 + otcPriceTolerance)) / 1e18, "ZBN12");
        require(_price >= (zenBullFairPrice * (1e18 - otcPriceTolerance)) / 1e18, "ZBN13");
    }

    /**
     * @dev get ZenBull token price using uniswap TWAP
     * @return ZenBull price
     */
    function _getZenBullPrice() internal view returns (uint256) {
        uint256 squeethEthPrice =
            IOracle(oracle).getTwap(ethSqueethPool, oSqth, weth, auctionTwapPeriod, false);
        uint256 ethUsdcPrice =
            IOracle(oracle).getTwap(ethUsdcPool, weth, usdc, auctionTwapPeriod, false);
        (uint256 crabCollateral, uint256 crabDebt) = IZenBullStrategy(zenBull).getCrabVaultDetails();
        uint256 crabFairPriceInEth = (crabCollateral - (crabDebt * squeethEthPrice / 1e18)) * 1e18
            / IERC20(IZenBullStrategy(zenBull).crab()).totalSupply();

        uint256 zenBullCrabBalance = IZenBullStrategy(zenBull).getCrabBalance();
        uint256 zenBullFairPrice = (
            IEulerSimpleLens(eulerLens).getETokenBalance(weth, zenBull)
                + (zenBullCrabBalance * crabFairPriceInEth / 1e18)
                - (
                    (IEulerSimpleLens(eulerLens).getDTokenBalance(usdc, zenBull) * 1e12 * 1e18)
                        / ethUsdcPrice
                )
        ) * 1e18 / IERC20(zenBull).totalSupply();

        return zenBullFairPrice;
    }

    /**
     * @notice check that the proposed sale price is within a tolerance of the current Uniswap twap
     * @param _price clearing price provided by manager
     * @param _isAuctionBuying is auction buying or selling oSQTH
     */
    function _checkOTCPrice(uint256 _price, bool _isAuctionBuying) internal view {
        // Get twap
        uint256 squeethEthPrice =
            IOracle(oracle).getTwap(ethSqueethPool, oSqth, weth, auctionTwapPeriod, false);

        if (_isAuctionBuying) {
            require(_price <= (squeethEthPrice * (1e18 + otcPriceTolerance)) / 1e18, "ZBN14");
        } else {
            require(_price >= (squeethEthPrice * (1e18 - otcPriceTolerance)) / 1e18, "ZBN15");
        }
    }

    /**
     * @dev checks the expiry nonce and signer of an order
     * @param _order Order struct
     */
    function _checkOrder(Order memory _order) internal view returns (bool) {
        bytes32 structHash = keccak256(
            abi.encode(
                _ZENBULL_NETTING_TYPEHASH,
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
        require(offerSigner == _order.trader, "ZBN16");
        require(_order.expiry >= block.timestamp, "ZBN17");

        return true;
    }
}
