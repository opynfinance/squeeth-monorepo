// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.13;

// contract
import { Ownable } from "openzeppelin/access/Ownable.sol";
import { EIP712 } from "openzeppelin/utils/cryptography/draft-EIP712.sol";

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
 */

/**
 * @dev ZenBullNetting contract
 * @notice Contract for Netting Deposits and Withdrawals in ZenBull
 * @author Opyn team
 */
contract ZenBullNetting is Ownable, EIP712 {
    /// @dev typehash for signed orders
    bytes32 private constant _ZENBULL_NETTING_TYPEHASH = keccak256(
        "Order(uint256 bidId,address trader,uint256 quantity,uint256 price,bool isBuying,uint256 expiry,uint256 nonce)"
    );
    // @dev OTC price tolerance cannot exceed 20%
    uint256 public constant MAX_OTC_PRICE_TOLERANCE = 2e17; // 20%
    uint32 public constant MIN_AUCTION_TWAP = 180 seconds;

    /// @dev owner sets to true when starting auction
    bool public isAuctionLive;

    /// @dev min WETH amounts to withdraw or deposit via netting
    uint256 public minWethAmount;
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
    address private weth;
    /// @dev ZenBull token address
    address private zenBull;

    /// @dev array of WETH deposit receipts
    Receipt[] public deposits;
    /// @dev array of ZenBull withdrawal receipts
    Receipt[] public withdraws;

    /// @dev WETH amount to deposit for an address
    mapping(address => uint256) public wethBalance;
    /// @dev ZenBull amount to withdraw for an address
    mapping(address => uint256) public zenBullBalance;
    /// @dev indexes of deposit receipts of an address
    mapping(address => uint256[]) public userDepositsIndex;
    /// @dev indexes of withdraw receipts of an address
    mapping(address => uint256[]) public userWithdrawsIndex;

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

    event SetMinZenBullAmount(uint256 oldAmount, uint256 newAmount);
    event SetMinWethAmount(uint256 oldAmount, uint256 newAmount);
    event SetDepositsIndex(uint256 oldDepositsIndex, uint256 newDepositsIndex);
    event SetWithdrawsIndex(uint256 oldWithdrawsIndex, uint256 newWithdrawsIndex);
    event SetAuctionTwapPeriod(uint32 previousTwap, uint32 newTwap);
    event SetOTCPriceTolerance(uint256 previousTolerance, uint256 newOtcPriceTolerance);
    event ToggledAuctionLive(bool isAuctionLive);
    event QueueWeth(
        address indexed depositor,
        uint256 amount,
        uint256 depositorsBalance,
        uint256 indexed receiptIndex
    );
    event DequeueWeth(address indexed depositor, uint256 amount, uint256 depositorsBalance);
    event QueueZenBull(
        address indexed withdrawer,
        uint256 amount,
        uint256 withdrawersBalance,
        uint256 indexed receiptIndex
    );
    event DequeueZenBull(address indexed withdrawer, uint256 amount, uint256 withdrawersBalance);

    constructor(address _weth, address _zenBull) EIP712("ZenBullNetting", "1") {
        otcPriceTolerance = 5e16; // 5%
        auctionTwapPeriod = 420 seconds;

        weth = _weth;
        zenBull = _zenBull;
    }

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
     * @notice set min Weth amount
     * @param _amount the amount to be set as minWethAmount
     */
    function setMinWethAmount(uint256 _amount) external onlyOwner {
        emit SetMinWethAmount(minWethAmount, _amount);
        minWethAmount = _amount;
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
        require(_auctionTwapPeriod >= MIN_AUCTION_TWAP, "N18");

        emit SetAuctionTwapPeriod(auctionTwapPeriod, _auctionTwapPeriod);

        auctionTwapPeriod = _auctionTwapPeriod;
    }

    /**
     * @notice owner can set a threshold, scaled by 1e18 that determines the maximum discount of a clearing sale price to the current uniswap twap price
     * @param _otcPriceTolerance the OTC price tolerance, in percent, scaled by 1e18
     */
    function setOTCPriceTolerance(uint256 _otcPriceTolerance) external onlyOwner {
        // Tolerance cannot be more than 20%
        require(_otcPriceTolerance <= MAX_OTC_PRICE_TOLERANCE, "N19");

        emit SetOTCPriceTolerance(otcPriceTolerance, _otcPriceTolerance);

        otcPriceTolerance = _otcPriceTolerance;
    }

    /**
     * @notice queue WETH for deposit into ZenBull
     * @param _amount WETH amount to deposit
     */
    function queueWeth(uint256 _amount) external {
        require(_amount >= minWethAmount, "ZBN03");

        // update weth balance of user, add their receipt, and receipt index to user deposits index
        wethBalance[msg.sender] = wethBalance[msg.sender] + _amount;
        deposits.push(Receipt(msg.sender, _amount, block.timestamp));
        userDepositsIndex[msg.sender].push(deposits.length - 1);

        IERC20(weth).transferFrom(msg.sender, address(this), _amount);

        emit QueueWeth(msg.sender, _amount, wethBalance[msg.sender], deposits.length - 1);
    }

    /**
     * @notice withdraw WETH from queue
     * @param _amount WETH amount to dequeue
     * @param _force forceWithdraw if deposited more than a week ago
     */
    function dequeueWeth(uint256 _amount, bool _force) external {
        require(!isAuctionLive || _force, "ZBN04");

        wethBalance[msg.sender] = wethBalance[msg.sender] - _amount;

        require(wethBalance[msg.sender] >= minWethAmount || wethBalance[msg.sender] == 0, "ZBN05");

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

        IERC20(weth).transfer(msg.sender, _amount);

        emit DequeueWeth(msg.sender, _amount, wethBalance[msg.sender]);
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
     * @notice get the sum of queued WETH
     * @return sum WETH amount in queue
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

    function getWithdrawReceipt(uint256 _index) external view returns (address, uint256, uint256) {
        Receipt memory receipt = withdraws[_index];

        return (receipt.sender, receipt.amount, receipt.timestamp);
    }
}
