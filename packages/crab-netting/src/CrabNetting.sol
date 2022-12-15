// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.13;

// interface
import {IERC20} from "openzeppelin/token/ERC20/IERC20.sol";
import {IWETH} from "../src/interfaces/IWETH.sol";
import {IOracle} from "../src/interfaces/IOracle.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import {ICrabStrategyV2} from "../src/interfaces/ICrabStrategyV2.sol";
import {IController} from "../src/interfaces/IController.sol";

// contract
import {Ownable} from "openzeppelin/access/Ownable.sol";
import {EIP712} from "openzeppelin/utils/cryptography/draft-EIP712.sol";
import {ECDSA} from "openzeppelin/utils/cryptography/ECDSA.sol";

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

/// @dev struct to store proportional amounts of erc20s (received or to send)
struct Portion {
    uint256 crab;
    uint256 eth;
    uint256 sqth;
}

/// @dev params for deposit auction
struct DepositAuctionParams {
    /// @dev USDC to deposit
    uint256 depositsQueued;
    /// @dev minETH equivalent to get from uniswap of the USDC to deposit
    uint256 minEth;
    /// @dev total ETH to deposit after selling the minted SQTH
    uint256 totalDeposit;
    /// @dev orders to buy sqth
    Order[] orders;
    /// @dev price from the auction to sell sqth
    uint256 clearingPrice;
    /// @dev remaining ETH to flashDeposit
    uint256 ethToFlashDeposit;
    /// @dev fee to pay uniswap for ethUSD swap
    uint24 ethUSDFee;
    /// @dev fee to pay uniswap for sqthETH swap
    uint24 flashDepositFee;
}

/// @dev params for withdraw auction
struct WithdrawAuctionParams {
    /// @dev amont of crab to queue for withdrawal
    uint256 crabToWithdraw;
    /// @dev orders that sell sqth to the auction
    Order[] orders;
    /// @dev price that the auction pays for the purchased sqth
    uint256 clearingPrice;
    /// @dev minUSDC to receive from swapping the ETH obtained by withdrawing
    uint256 minUSDC;
    /// @dev uniswap fee for swapping eth to USD;
    uint24 ethUSDFee;
}

/// @dev receipt used to store deposits and withdraws
struct Receipt {
    /// @dev address of the depositor or withdrawer
    address sender;
    /// @dev usdc amount to queue for deposit or crab amount to queue for withdrawal
    uint256 amount;
    /// @dev time of deposit
    uint256 timestamp;
}

/**
 * Crab netting error codes
 * N1: deposit amount smaller than minimum OTC amount
 * N2: auction is live
 * N3: remaining amount smaller than minimum, consider removing full balance
 * N4: force withdraw after 1 week from deposit
 * N5: withdraw amount smaller than minimum OTC amount
 * N6: remaining amount smaller than minimum, consider removing full balance
 * N7: Not enough deposits to net
 * N8: Not enough withdrawals to net
 * N9: signature incorrect
 * N10: order expired
 * N11: Min ETH out too low
 * N12: auction order not buying sqth
 * N13: buy order price less than clearing
 * N14: not enough buy orders for sqth
 * N15: auction order is not selling
 * N16: sell order price greater than clearing
 * N17: min USDC out too low
 * N18: twap period cannot be less than 180
 * N19: Price tolerance has to be less than 20%
 * N20: Nonce already used
 * N21: Price too high relative to Uniswap twap.
 * N22: Price too low relative to Uniswap twap.
 * N23: Crab Price too high
 * N24: Crab Price too low
 * N25: only weth and crab can send me monies
 */

/**
 * @dev CrabNetting contract
 * @notice Contract for Netting Deposits and Withdrawals
 * @author Opyn team
 */
contract CrabNetting is Ownable, EIP712 {
    /// @dev typehash for signed orders
    bytes32 private constant _CRAB_NETTING_TYPEHASH = keccak256(
        "Order(uint256 bidId,address trader,uint256 quantity,uint256 price,bool isBuying,uint256 expiry,uint256 nonce)"
    );
    /// @dev owner sets to true when starting auction
    bool public isAuctionLive;

    /// @dev sqth twap period
    uint32 public immutable sqthTwapPeriod;
    /// @dev twap period to use for auction calculations
    uint32 public auctionTwapPeriod = 420 seconds;

    /// @dev min USDC amounts to withdraw or deposit via netting
    uint256 public minUSDCAmount;

    /// @dev min CRAB amounts to withdraw or deposit via netting
    uint256 public minCrabAmount;

    // @dev OTC price must be within this distance of the uniswap twap price
    uint256 public otcPriceTolerance = 5e16; // 5%
    // @dev OTC price tolerance cannot exceed 20%
    uint256 public constant MAX_OTC_PRICE_TOLERANCE = 2e17; // 20%

    /// @dev address for ERC20 tokens
    address public immutable usdc;
    address public immutable crab;
    address public immutable weth;
    address public immutable sqth;

    /// @dev address for uniswap router
    ISwapRouter public immutable swapRouter;

    /// @dev address for uniswap oracle
    address public immutable oracle;

    /// @dev address for sqth eth pool
    address public immutable ethSqueethPool;

    /// @dev address for usdc eth pool
    address public immutable ethUsdcPool;

    /// @dev address for sqth controller
    address public immutable sqthController;

    /// @dev array index of last processed deposits
    uint256 public depositsIndex;

    /// @dev array index of last processed withdraws
    uint256 public withdrawsIndex;

    /// @dev array of deposit receipts
    Receipt[] public deposits;
    /// @dev array of withdrawal receipts
    Receipt[] public withdraws;

    /// @dev usd amount to deposit for an address
    mapping(address => uint256) public usdBalance;

    /// @dev crab amount to withdraw for an address
    mapping(address => uint256) public crabBalance;

    /// @dev indexes of deposit receipts of an address
    mapping(address => uint256[]) public userDepositsIndex;

    /// @dev indexes of withdraw receipts of an address
    mapping(address => uint256[]) public userWithdrawsIndex;

    /// @dev store the used flag for a nonce for each address
    mapping(address => mapping(uint256 => bool)) public nonces;

    event USDCQueued(
        address indexed depositor, uint256 amount, uint256 depositorsBalance, uint256 indexed receiptIndex
    );

    event USDCDeQueued(address indexed depositor, uint256 amount, uint256 depositorsBalance);

    event CrabQueued(
        address indexed withdrawer, uint256 amount, uint256 withdrawersBalance, uint256 indexed receiptIndex
    );

    event CrabDeQueued(address indexed withdrawer, uint256 amount, uint256 withdrawersBalance);

    event USDCDeposited(
        address indexed depositor,
        uint256 usdcAmount,
        uint256 crabAmount,
        uint256 indexed receiptIndex,
        uint256 refundedETH
    );

    event CrabWithdrawn(
        address indexed withdrawer, uint256 crabAmount, uint256 usdcAmount, uint256 indexed receiptIndex
    );

    event WithdrawRejected(address indexed withdrawer, uint256 crabAmount, uint256 index);

    event BidTraded(uint256 indexed bidId, address indexed trader, uint256 quantity, uint256 price, bool isBuying);

    event SetAuctionTwapPeriod(uint32 previousTwap, uint32 newTwap);
    event SetOTCPriceTolerance(uint256 previousTolerance, uint256 newOtcPriceTolerance);
    event SetMinCrab(uint256 amount);
    event SetMinUSDC(uint256 amount);
    event SetDepositsIndex(uint256 newDepositsIndex);
    event SetWithdrawsIndex(uint256 newWithdrawsIndex);
    event NonceTrue(address sender, uint256 nonce);
    event ToggledAuctionLive(bool isAuctionLive);

    /**
     * @notice netting contract constructor
     * @dev initializes the erc20 address, uniswap router and approves them
     * @param _crab address of crab contract token
     * @param _swapRouter address of uniswap swap router
     */
    constructor(address _crab, address _swapRouter) EIP712("CRABNetting", "1") {
        crab = _crab;
        swapRouter = ISwapRouter(_swapRouter);

        sqthController = ICrabStrategyV2(_crab).powerTokenController();
        usdc = IController(sqthController).quoteCurrency();
        weth = ICrabStrategyV2(_crab).weth();
        sqth = ICrabStrategyV2(_crab).wPowerPerp();
        oracle = ICrabStrategyV2(_crab).oracle();
        ethSqueethPool = ICrabStrategyV2(_crab).ethWSqueethPool();
        ethUsdcPool = IController(sqthController).ethQuoteCurrencyPool();
        sqthTwapPeriod = IController(sqthController).TWAP_PERIOD();

        // approve crab and sqth so withdraw can happen
        IERC20(sqth).approve(crab, type(uint256).max);

        IERC20(weth).approve(address(swapRouter), type(uint256).max);
        IERC20(usdc).approve(address(swapRouter), type(uint256).max);
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
     * @notice set nonce to true
     * @param _nonce the number to be set true
     */
    function setNonceTrue(uint256 _nonce) external {
        nonces[msg.sender][_nonce] = true;
        emit NonceTrue(msg.sender, _nonce);
    }

    /**
     * @notice set minUSDCAmount
     * @param _amount the number to be set as minUSDC
     */
    function setMinUSDC(uint256 _amount) external onlyOwner {
        minUSDCAmount = _amount;
        emit SetMinUSDC(_amount);
    }

    /**
     * @notice set minCrabAmount
     * @param _amount the number to be set as minCrab
     */
    function setMinCrab(uint256 _amount) external onlyOwner {
        minCrabAmount = _amount;
        emit SetMinCrab(_amount);
    }

    /**
     * @notice set the depositIndex so that we want to skip processing some deposits
     * @param _newDepositsIndex the new deposits index
     */
    function setDepositsIndex(uint256 _newDepositsIndex) external onlyOwner {
        depositsIndex = _newDepositsIndex;
        emit SetDepositsIndex(_newDepositsIndex);
    }

    /**
     * @notice set the withdraw index so that we want to skip processing some withdraws
     * @param _newWithdrawsIndex the new withdraw index
     */
    function setWithdrawsIndex(uint256 _newWithdrawsIndex) external onlyOwner {
        withdrawsIndex = _newWithdrawsIndex;
        emit SetWithdrawsIndex(_newWithdrawsIndex);
    }

    /**
     * @notice queue USDC for deposit into crab strategy
     * @param _amount USDC amount to deposit
     */
    function depositUSDC(uint256 _amount) external {
        require(_amount >= minUSDCAmount, "N1");

        IERC20(usdc).transferFrom(msg.sender, address(this), _amount);

        // update usd balance of user, add their receipt, and receipt index to user deposits index
        usdBalance[msg.sender] = usdBalance[msg.sender] + _amount;
        deposits.push(Receipt(msg.sender, _amount, block.timestamp));
        userDepositsIndex[msg.sender].push(deposits.length - 1);

        emit USDCQueued(msg.sender, _amount, usdBalance[msg.sender], deposits.length - 1);
    }

    /**
     * @notice withdraw USDC from queue
     * @param _amount USDC amount to dequeue
     * @param _force forceWithdraw if deposited more than a week ago
     */
    function withdrawUSDC(uint256 _amount, bool _force) external {
        require(!isAuctionLive || _force, "N2");

        usdBalance[msg.sender] = usdBalance[msg.sender] - _amount;
        require(usdBalance[msg.sender] >= minUSDCAmount || usdBalance[msg.sender] == 0, "N3");

        // start withdrawing from the users last deposit
        uint256 toRemove = _amount;
        uint256 lastIndexP1 = userDepositsIndex[msg.sender].length;
        for (uint256 i = lastIndexP1; i > 0; i--) {
            Receipt storage r = deposits[userDepositsIndex[msg.sender][i - 1]];
            if (_force) {
                require(block.timestamp > r.timestamp + 1 weeks, "N4");
            }
            if (r.amount > toRemove) {
                r.amount -= toRemove;
                toRemove = 0;
                break;
            } else {
                toRemove -= r.amount;
                delete deposits[userDepositsIndex[msg.sender][i - 1]];
                userDepositsIndex[msg.sender].pop();
            }
        }
        IERC20(usdc).transfer(msg.sender, _amount);

        emit USDCDeQueued(msg.sender, _amount, usdBalance[msg.sender]);
    }

    /**
     * @notice queue Crab for withdraw from crab strategy
     * @param _amount crab amount to withdraw
     */
    function queueCrabForWithdrawal(uint256 _amount) external {
        require(_amount >= minCrabAmount, "N5");
        IERC20(crab).transferFrom(msg.sender, address(this), _amount);
        crabBalance[msg.sender] = crabBalance[msg.sender] + _amount;
        withdraws.push(Receipt(msg.sender, _amount, block.timestamp));
        userWithdrawsIndex[msg.sender].push(withdraws.length - 1);
        emit CrabQueued(msg.sender, _amount, crabBalance[msg.sender], withdraws.length - 1);
    }

    /**
     * @notice withdraw Crab from queue
     * @param _amount Crab amount to dequeue
     * @param _force forceWithdraw if deposited more than a week ago
     */
    function dequeueCrab(uint256 _amount, bool _force) external {
        require(!isAuctionLive || _force, "N2");
        crabBalance[msg.sender] = crabBalance[msg.sender] - _amount;
        require(crabBalance[msg.sender] >= minCrabAmount || crabBalance[msg.sender] == 0, "N6");
        // deQueue crab from the last, last in first out
        uint256 toRemove = _amount;
        uint256 lastIndexP1 = userWithdrawsIndex[msg.sender].length;
        for (uint256 i = lastIndexP1; i > 0; i--) {
            Receipt storage r = withdraws[userWithdrawsIndex[msg.sender][i - 1]];
            if (_force) {
                require(block.timestamp > r.timestamp + 1 weeks, "N4");
            }
            if (r.amount > toRemove) {
                r.amount -= toRemove;
                toRemove = 0;
                break;
            } else {
                toRemove -= r.amount;
                delete withdraws[userWithdrawsIndex[msg.sender][i - 1]];
                userWithdrawsIndex[msg.sender].pop();
            }
        }
        IERC20(crab).transfer(msg.sender, _amount);
        emit CrabDeQueued(msg.sender, _amount, crabBalance[msg.sender]);
    }

    /**
     * @dev swaps _quantity amount of usdc for crab at _price
     * @param _price price of crab in usdc
     * @param _quantity amount of USDC to net
     */
    function netAtPrice(uint256 _price, uint256 _quantity) external onlyOwner {
        _checkCrabPrice(_price);
        uint256 crabQuantity = (_quantity * 1e18) / _price;
        require(_quantity <= IERC20(usdc).balanceOf(address(this)), "N7");
        require(crabQuantity <= IERC20(crab).balanceOf(address(this)), "N8");

        // process deposits and send crab
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
                usdBalance[deposit.sender] -= deposit.amount;
                amountToSend = (deposit.amount * 1e18) / _price;
                IERC20(crab).transfer(deposit.sender, amountToSend);
                emit USDCDeposited(deposit.sender, deposit.amount, amountToSend, i, 0);
                delete deposits[i];
                i++;
            } else {
                // deposit amount is greater than quantity; use it partially
                deposits[i].amount = deposit.amount - _quantity;
                usdBalance[deposit.sender] -= _quantity;
                amountToSend = (_quantity * 1e18) / _price;
                IERC20(crab).transfer(deposit.sender, amountToSend);
                emit USDCDeposited(deposit.sender, _quantity, amountToSend, i, 0);
                _quantity = 0;
            }
        }
        depositsIndex = i;

        // process withdraws and send usdc
        i = withdrawsIndex;
        while (crabQuantity > 0) {
            Receipt memory withdraw = withdraws[i];
            if (withdraw.amount == 0) {
                i++;
                continue;
            }
            if (withdraw.amount <= crabQuantity) {
                crabQuantity = crabQuantity - withdraw.amount;
                crabBalance[withdraw.sender] -= withdraw.amount;
                amountToSend = (withdraw.amount * _price) / 1e18;
                IERC20(usdc).transfer(withdraw.sender, amountToSend);

                emit CrabWithdrawn(withdraw.sender, withdraw.amount, amountToSend, i);

                delete withdraws[i];
                i++;
            } else {
                withdraws[i].amount = withdraw.amount - crabQuantity;
                crabBalance[withdraw.sender] -= crabQuantity;
                amountToSend = (crabQuantity * _price) / 1e18;
                IERC20(usdc).transfer(withdraw.sender, amountToSend);

                emit CrabWithdrawn(withdraw.sender, withdraw.amount, amountToSend, i);

                crabQuantity = 0;
            }
        }
        withdrawsIndex = i;
    }

    /**
     * @return sum usdc amount in queue
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
     * @return sum crab amount in queue
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

    function checkOrder(Order memory _order) external view {
        return _checkOrder(_order);
    }

    /**
     * @dev checks the expiry nonce and signer of an order
     * @param _order is the Order struct
     */
    function _checkOrder(Order memory _order) internal view {
        bytes32 structHash = keccak256(
            abi.encode(
                _CRAB_NETTING_TYPEHASH,
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
        require(offerSigner == _order.trader, "N9");
        require(_order.expiry >= block.timestamp, "N10");
    }

    /**
     * @dev calculates wSqueeth minted when amount is deposited
     * @param _amount to deposit into crab
     */
    function _debtToMint(uint256 _amount) internal view returns (uint256) {
        uint256 feeAdjustment = _calcFeeAdjustment();
        (,, uint256 collateral, uint256 debt) = ICrabStrategyV2(crab).getVaultDetails();
        uint256 wSqueethToMint = (_amount * debt) / (collateral + (debt * feeAdjustment) / 1e18);
        return wSqueethToMint;
    }

    /**
     * @dev takes in orders from mm's to buy sqth and deposits the usd amount from the depositQueue into crab along with the eth from selling sqth
     * @param _p DepositAuction Params that contain orders, usdToDeposit, uniswap min amount and fee
     */
    function depositAuction(DepositAuctionParams calldata _p) external onlyOwner {
        _checkOTCPrice(_p.clearingPrice, false);
        uint256 ethUSDCPrice = IOracle(oracle).getTwap(ethUsdcPool, weth, usdc, auctionTwapPeriod, true);
        require((_p.depositsQueued * (1e18 - otcPriceTolerance) * 1e12 / ethUSDCPrice) < _p.minEth, "N11");
        /**
         * step 1: get eth from mm
         *     step 2: get eth from deposit usdc
         *     step 3: crab deposit
         *     step 4: flash deposit
         *     step 5: send sqth to mms
         *     step 6: send crab to depositors
         */
        uint256 initCrabBalance = IERC20(crab).balanceOf(address(this));
        uint256 initEthBalance = address(this).balance;

        uint256 sqthToSell = _debtToMint(_p.totalDeposit);
        // step 1 get all the eth in
        uint256 remainingToSell = sqthToSell;
        for (uint256 i = 0; i < _p.orders.length; i++) {
            require(_p.orders[i].isBuying, "N12");
            require(_p.orders[i].price >= _p.clearingPrice, "N13");
            _checkOrder(_p.orders[i]);
            _useNonce(_p.orders[i].trader, _p.orders[i].nonce);
            if (_p.orders[i].quantity >= remainingToSell) {
                IWETH(weth).transferFrom(
                    _p.orders[i].trader, address(this), (remainingToSell * _p.clearingPrice) / 1e18
                );
                remainingToSell = 0;
                break;
            } else {
                IWETH(weth).transferFrom(
                    _p.orders[i].trader, address(this), (_p.orders[i].quantity * _p.clearingPrice) / 1e18
                );
                remainingToSell -= _p.orders[i].quantity;
            }
        }
        require(remainingToSell == 0, "N14");

        // step 2
        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
            tokenIn: usdc,
            tokenOut: weth,
            fee: _p.ethUSDFee,
            recipient: address(this),
            deadline: block.timestamp,
            amountIn: _p.depositsQueued,
            amountOutMinimum: _p.minEth,
            sqrtPriceLimitX96: 0
        });
        swapRouter.exactInputSingle(params);

        // step 3
        IWETH(weth).withdraw(IWETH(weth).balanceOf(address(this)));
        ICrabStrategyV2(crab).deposit{value: _p.totalDeposit}();

        // step 4
        Portion memory to_send;
        to_send.eth = address(this).balance - initEthBalance;
        if (to_send.eth > 0 && _p.ethToFlashDeposit > 0) {
            if (to_send.eth <= _p.ethToFlashDeposit) {
                // we cant send more than the flashDeposit
                ICrabStrategyV2(crab).flashDeposit{value: to_send.eth}(_p.ethToFlashDeposit, _p.flashDepositFee);
            }
        }

        // step 5
        to_send.sqth = IERC20(sqth).balanceOf(address(this));
        remainingToSell = to_send.sqth;
        for (uint256 j = 0; j < _p.orders.length; j++) {
            if (_p.orders[j].quantity < remainingToSell) {
                IERC20(sqth).transfer(_p.orders[j].trader, _p.orders[j].quantity);
                remainingToSell -= _p.orders[j].quantity;
                emit BidTraded(_p.orders[j].bidId, _p.orders[j].trader, _p.orders[j].quantity, _p.clearingPrice, true);
            } else {
                IERC20(sqth).transfer(_p.orders[j].trader, remainingToSell);
                emit BidTraded(_p.orders[j].bidId, _p.orders[j].trader, remainingToSell, _p.clearingPrice, true);
                break;
            }
        }

        // step 6 send crab to depositors
        uint256 remainingDeposits = _p.depositsQueued;
        uint256 k = depositsIndex;

        to_send.crab = IERC20(crab).balanceOf(address(this)) - initCrabBalance;
        // get the balance between start and now
        to_send.eth = address(this).balance - initEthBalance;
        IWETH(weth).deposit{value: to_send.eth}();

        while (remainingDeposits > 0) {
            uint256 queuedAmount = deposits[k].amount;
            Portion memory portion;
            if (queuedAmount == 0) {
                k++;
                continue;
            }
            if (queuedAmount <= remainingDeposits) {
                remainingDeposits = remainingDeposits - queuedAmount;
                usdBalance[deposits[k].sender] -= queuedAmount;

                portion.crab = queuedAmount * to_send.crab / _p.depositsQueued;

                IERC20(crab).transfer(deposits[k].sender, portion.crab);

                portion.eth = queuedAmount * to_send.eth / _p.depositsQueued;
                if (portion.eth > 1e12) {
                    IWETH(weth).transfer(deposits[k].sender, portion.eth);
                } else {
                    portion.eth = 0;
                }
                emit USDCDeposited(deposits[k].sender, queuedAmount, portion.crab, k, portion.eth);

                delete deposits[k];
                k++;
            } else {
                usdBalance[deposits[k].sender] -= remainingDeposits;

                portion.crab = remainingDeposits * to_send.crab / _p.depositsQueued;
                IERC20(crab).transfer(deposits[k].sender, portion.crab);

                portion.eth = remainingDeposits * to_send.eth / _p.depositsQueued;
                if (portion.eth > 1e12) {
                    IWETH(weth).transfer(deposits[k].sender, portion.eth);
                } else {
                    portion.eth = 0;
                }
                emit USDCDeposited(deposits[k].sender, remainingDeposits, portion.crab, k, portion.eth);

                deposits[k].amount -= remainingDeposits;
                remainingDeposits = 0;
            }
        }
        depositsIndex = k;
        isAuctionLive = false;
    }

    /**
     * @dev takes in orders from mm's to sell sqth and withdraws the crab amount in q
     * @param _p Withdraw Params that contain orders, crabToWithdraw, uniswap min amount and fee
     */
    function withdrawAuction(WithdrawAuctionParams calldata _p) public onlyOwner {
        _checkOTCPrice(_p.clearingPrice, true);
        uint256 initWethBalance = IERC20(weth).balanceOf(address(this));
        uint256 initEthBalance = address(this).balance;
        /**
         * step 1: get sqth from mms
         *     step 2: withdraw from crab
         *     step 3: send eth to mms
         *     step 4: convert eth to usdc
         *     step 5: send usdc to withdrawers
         */

        // step 1 get sqth from mms
        uint256 sqthRequired = ICrabStrategyV2(crab).getWsqueethFromCrabAmount(_p.crabToWithdraw);
        uint256 toPull = sqthRequired;
        for (uint256 i = 0; i < _p.orders.length && toPull > 0; i++) {
            _checkOrder(_p.orders[i]);
            _useNonce(_p.orders[i].trader, _p.orders[i].nonce);
            require(!_p.orders[i].isBuying, "N15");
            require(_p.orders[i].price <= _p.clearingPrice, "N16");
            if (_p.orders[i].quantity < toPull) {
                toPull -= _p.orders[i].quantity;
                IERC20(sqth).transferFrom(_p.orders[i].trader, address(this), _p.orders[i].quantity);
            } else {
                IERC20(sqth).transferFrom(_p.orders[i].trader, address(this), toPull);
                toPull = 0;
            }
        }

        // step 2 withdraw from crab
        ICrabStrategyV2(crab).withdraw(_p.crabToWithdraw);

        // step 3 pay all mms
        IWETH(weth).deposit{value: address(this).balance - initEthBalance}();
        toPull = sqthRequired;
        uint256 sqthQuantity;
        for (uint256 i = 0; i < _p.orders.length && toPull > 0; i++) {
            if (_p.orders[i].quantity < toPull) {
                sqthQuantity = _p.orders[i].quantity;
            } else {
                sqthQuantity = toPull;
            }
            IERC20(weth).transfer(_p.orders[i].trader, (sqthQuantity * _p.clearingPrice) / 1e18);
            toPull -= sqthQuantity;
            emit BidTraded(_p.orders[i].bidId, _p.orders[i].trader, sqthQuantity, _p.clearingPrice, false);
        }

        // step 4 convert to USDC
        uint256 ethUSDCPrice = IOracle(oracle).getTwap(ethUsdcPool, weth, usdc, auctionTwapPeriod, true);
        uint256 amountIn = (IERC20(weth).balanceOf(address(this)) - initWethBalance);
        require((amountIn * ethUSDCPrice * (1e18 - otcPriceTolerance) / 1e36 / 1e12) < _p.minUSDC, "N17");
        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
            tokenIn: address(weth),
            tokenOut: address(usdc),
            fee: _p.ethUSDFee,
            recipient: address(this),
            deadline: block.timestamp,
            amountIn: amountIn,
            amountOutMinimum: _p.minUSDC,
            sqrtPriceLimitX96: 0
        });
        uint256 usdcReceived = swapRouter.exactInputSingle(params);

        // step 5 pay all withdrawers and mark their withdraws as done
        uint256 remainingWithdraws = _p.crabToWithdraw;
        uint256 j = withdrawsIndex;
        uint256 usdcAmount;
        while (remainingWithdraws > 0) {
            Receipt memory withdraw = withdraws[j];
            if (withdraw.amount == 0) {
                j++;
                continue;
            }
            if (withdraw.amount <= remainingWithdraws) {
                // full usage
                remainingWithdraws -= withdraw.amount;
                crabBalance[withdraw.sender] -= withdraw.amount;

                // send proportional usdc
                usdcAmount = withdraw.amount * usdcReceived / _p.crabToWithdraw;
                IERC20(usdc).transfer(withdraw.sender, usdcAmount);
                emit CrabWithdrawn(withdraw.sender, withdraw.amount, usdcAmount, j);
                delete withdraws[j];
                j++;
            } else {
                withdraws[j].amount -= remainingWithdraws;
                crabBalance[withdraw.sender] -= remainingWithdraws;

                // send proportional usdc
                usdcAmount = remainingWithdraws * usdcReceived / _p.crabToWithdraw;
                IERC20(usdc).transfer(withdraw.sender, usdcAmount);
                emit CrabWithdrawn(withdraw.sender, remainingWithdraws, usdcAmount, j);

                remainingWithdraws = 0;
            }
        }
        withdrawsIndex = j;
        isAuctionLive = false;
    }

    /**
     * @dev owner rejects the withdraw at index i thereby sending the withdrawer their crab back
     * @param i index of the Withdraw receipt to reject
     */
    function rejectWithdraw(uint256 i) external onlyOwner {
        Receipt memory withdraw = withdraws[i];
        crabBalance[withdraw.sender] -= withdraw.amount;
        ICrabStrategyV2(crab).transfer(withdraw.sender, withdraw.amount);
        delete withdraws[i];

        emit WithdrawRejected(withdraw.sender, withdraw.amount, i);
    }

    /**
     * @notice owner can set the twap period in seconds that is used for obtaining TWAP prices
     * @param _auctionTwapPeriod the twap period, in seconds
     */
    function setAuctionTwapPeriod(uint32 _auctionTwapPeriod) external onlyOwner {
        require(_auctionTwapPeriod >= 180, "N18");
        uint32 previousTwap = auctionTwapPeriod;

        auctionTwapPeriod = _auctionTwapPeriod;

        emit SetAuctionTwapPeriod(previousTwap, _auctionTwapPeriod);
    }

    /**
     * @notice owner can set a threshold, scaled by 1e18 that determines the maximum discount of a clearing sale price to the current uniswap twap price
     * @param _otcPriceTolerance the OTC price tolerance, in percent, scaled by 1e18
     */
    function setOTCPriceTolerance(uint256 _otcPriceTolerance) external onlyOwner {
        // Tolerance cannot be more than 20%
        require(_otcPriceTolerance <= MAX_OTC_PRICE_TOLERANCE, "N19");
        uint256 previousOtcTolerance = otcPriceTolerance;

        otcPriceTolerance = _otcPriceTolerance;

        emit SetOTCPriceTolerance(previousOtcTolerance, _otcPriceTolerance);
    }

    /**
     * @dev set nonce flag of the trader to true
     * @param _trader address of the signer
     * @param _nonce number that is to be traded only once
     */
    function _useNonce(address _trader, uint256 _nonce) internal {
        require(!nonces[_trader][_nonce], "N20");
        nonces[_trader][_nonce] = true;
    }

    /**
     * @notice check that the proposed sale price is within a tolerance of the current Uniswap twap
     * @param _price clearing price provided by manager
     * @param _isAuctionBuying is crab buying or selling oSQTH
     */
    function _checkOTCPrice(uint256 _price, bool _isAuctionBuying) internal view {
        // Get twap
        uint256 squeethEthPrice = IOracle(oracle).getTwap(ethSqueethPool, sqth, weth, auctionTwapPeriod, true);

        if (_isAuctionBuying) {
            require(_price <= (squeethEthPrice * (1e18 + otcPriceTolerance)) / 1e18, "N21");
        } else {
            require(_price >= (squeethEthPrice * (1e18 - otcPriceTolerance)) / 1e18, "N22");
        }
    }

    function _checkCrabPrice(uint256 _price) internal view {
        // Get twap
        uint256 squeethEthPrice = IOracle(oracle).getTwap(ethSqueethPool, sqth, weth, auctionTwapPeriod, true);
        uint256 usdcEthPrice = IOracle(oracle).getTwap(ethUsdcPool, weth, usdc, auctionTwapPeriod, true);
        (,, uint256 collateral, uint256 debt) = ICrabStrategyV2(crab).getVaultDetails();
        uint256 crabFairPrice =
            ((collateral - ((debt * squeethEthPrice) / 1e18)) * usdcEthPrice) / ICrabStrategyV2(crab).totalSupply();
        crabFairPrice = crabFairPrice / 1e12; //converting from units of 18 to 6
        require(_price <= (crabFairPrice * (1e18 + otcPriceTolerance)) / 1e18, "N23");
        require(_price >= (crabFairPrice * (1e18 - otcPriceTolerance)) / 1e18, "N24");
    }

    function _calcFeeAdjustment() internal view returns (uint256) {
        uint256 feeRate = IController(sqthController).feeRate();
        if (feeRate == 0) return 0;
        uint256 squeethEthPrice = IOracle(oracle).getTwap(ethSqueethPool, sqth, weth, sqthTwapPeriod, true);
        return (squeethEthPrice * feeRate) / 10000;
    }

    receive() external payable {
        require(msg.sender == weth || msg.sender == crab, "N25");
    }
}
