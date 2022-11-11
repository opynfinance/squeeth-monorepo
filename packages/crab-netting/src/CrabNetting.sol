// SPDX-License-Identifier: GPL-3.0-only
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
    /// @dev fee to pay uniswap for usdETH swap
    uint24 usdEthFee;
    /// @dev fee to pay uniswap for sqthETH swap
    uint24 flashDepositFee;
}

/// @dev params for withdraw auction
struct WithdrawAuctionParams {
    uint256 crabToWithdraw;
    Order[] orders;
    uint256 clearingPrice;
    /// @dev minUSDC to receive from swapping the ETH obtained by withdrawing
    uint256 minUSDC;
    uint24 ethUSDFee;
}

/// @dev receipt used to store deposits and withdraws
struct Receipt {
    address sender;
    uint256 amount;
}

/**
 * @dev CrabNetting contract
 * @notice Contract for Netting Deposits and Withdrawals
 * @author Opyn team
 */
contract CrabNetting is Ownable, EIP712 {
    /// @dev typehash for signed orders
    bytes32 private constant _CRAB_NETTING_TYPEHASH =
        keccak256(
            "Order(uint256 bidId,address trader,uint256 quantity,uint256 price,bool isBuying,uint256 expiry,uint256 nonce)"
        );

    /// @dev owner sets to true when starting auction
    bool public isAuctionLive;

    /// @dev min USDC amounts to withdraw or deposit via netting
    uint256 public minUSDCAmount;

    /// @dev min CRAB amounts to withdraw or deposit via netting
    uint256 public minCrabAmount;

    /// @dev twap period to use for auction calculations
    uint32 public auctionTwapPeriod = 420 seconds;
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
        address indexed depositor,
        uint256 amount,
        uint256 depositorsBalance,
        uint256 indexed receiptIndex
    );

    event USDCDeQueued(
        address indexed depositor,
        uint256 amount,
        uint256 depositorsBalance
    );

    event CrabQueued(
        address indexed withdrawer,
        uint256 amount,
        uint256 withdrawersBalance,
        uint256 indexed receiptIndex
    );

    event CrabDeQueued(
        address indexed withdrawer,
        uint256 amount,
        uint256 withdrawersBalance
    );

    event USDCDeposited(
        address indexed depositor,
        uint256 usdcAmount,
        uint256 crabAmount,
        uint256 indexed receiptIndex,
        uint256 refundedETH
    );

    event CrabWithdrawn(
        address indexed withdrawer,
        uint256 crabAmount,
        uint256 usdcAmount,
        uint256 indexed receiptIndex
    );

    event BidTraded(
        uint256 indexed bidId,
        address indexed trader,
        uint256 quantity,
        uint256 price
    );

    event SetAuctionTwapPeriod(uint32 _auctionTwapPeriod);
    event SetOTCPriceTolerance(uint256 otcPriceTolerance);

    /**
     * @notice netting contract constructor
     * @dev initializes the erc20 address, uniswap router and approves them
     * @param _usdc address of usdc token
     * @param _weth address of weth token
     * @param _sqth address of sqth token
     * @param _crab address of crab contract token
     * @param _swapRouter address of uniswap swap router
     */
    constructor(
        address _usdc,
        address _crab,
        address _weth,
        address _sqth,
        address _ethSqueethPool,
        address _ethUsdcPool,
        address _swapRouter,
        address _oracle,
        address _sqthController
    ) EIP712("CRABNetting", "1") {
        usdc = _usdc;
        crab = _crab;
        weth = _weth;
        sqth = _sqth;
        swapRouter = ISwapRouter(_swapRouter);
        oracle = _oracle;
        ethSqueethPool = _ethSqueethPool;
        ethUsdcPool = _ethUsdcPool;
        sqthController = _sqthController;

        // approve crab and sqth so withdraw can happen
        IERC20(sqth).approve(crab, 10e36);

        IERC20(weth).approve(address(swapRouter), 10e36);
        IERC20(usdc).approve(address(swapRouter), 10e36);
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
    }

    /**
     * @notice set nonce to true
     * @param _nonce the number to be set true
     */
    function setNonceTrue(uint256 _nonce) external {
        nonces[msg.sender][_nonce] = true;
    }

    /**
     * @notice set minUSDCAmount
     * @param _amount the number to be set as minUSDC
     */
    function setMinUSDC(uint256 _amount) external onlyOwner {
        minUSDCAmount = _amount;
    }

    /**
     * @notice set minCrabAmount
     * @param _amount the number to be set as minCrab
     */
    function setMinCrab(uint256 _amount) external onlyOwner {
        minCrabAmount = _amount;
    }

    /**
     * @notice queue USDC for deposit into crab strategy
     * @param _amount USDC amount to deposit
     */
    function depositUSDC(uint256 _amount) external {
        require(
            _amount >= minUSDCAmount,
            "deposit amount smaller than minimum OTC amount"
        );

        IERC20(usdc).transferFrom(msg.sender, address(this), _amount);

        // update usd balance of user, add their receipt, and receipt index to user deposits index
        usdBalance[msg.sender] = usdBalance[msg.sender] + _amount;
        deposits.push(Receipt(msg.sender, _amount));
        userDepositsIndex[msg.sender].push(deposits.length - 1);

        emit USDCQueued(
            msg.sender,
            _amount,
            usdBalance[msg.sender],
            deposits.length - 1
        );
    }

    /**
     * @notice withdraw USDC from queue
     * @param _amount USDC amount to dequeue
     */
    function withdrawUSDC(uint256 _amount) external {
        require(!isAuctionLive, "auction is live");

        usdBalance[msg.sender] = usdBalance[msg.sender] - _amount;
        require(
            usdBalance[msg.sender] >= minUSDCAmount ||
                usdBalance[msg.sender] == 0,
            "remaining amount smaller than minimum, consider removing full balance"
        );

        // remove that _amount the users last deposit
        uint256 toRemove = _amount;
        uint256 lastIndexP1 = userDepositsIndex[msg.sender].length;
        for (uint256 i = lastIndexP1; i > 0; i--) {
            Receipt storage r = deposits[userDepositsIndex[msg.sender][i - 1]];
            if (r.amount > toRemove) {
                r.amount -= toRemove;
                toRemove = 0;
                break;
            } else {
                toRemove -= r.amount;
                delete deposits[userDepositsIndex[msg.sender][i - 1]];
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
        require(
            _amount >= minCrabAmount,
            "withdraw amount smaller than minimum OTC amount"
        );
        IERC20(crab).transferFrom(msg.sender, address(this), _amount);
        crabBalance[msg.sender] = crabBalance[msg.sender] + _amount;
        withdraws.push(Receipt(msg.sender, _amount));
        userWithdrawsIndex[msg.sender].push(withdraws.length - 1);
        emit CrabQueued(
            msg.sender,
            _amount,
            crabBalance[msg.sender],
            withdraws.length - 1
        );
    }

    /**
     * @notice withdraw Crab from queue
     * @param _amount Crab amount to dequeue
     */
    function withdrawCrab(uint256 _amount) external {
        require(!isAuctionLive, "auction is live");
        crabBalance[msg.sender] = crabBalance[msg.sender] - _amount;
        require(
            crabBalance[msg.sender] >= minCrabAmount ||
                crabBalance[msg.sender] == 0,
            "remaining amount smaller than minimum, consider removing full balance"
        );
        // remove that _amount the users last deposit
        uint256 toRemove = _amount;
        uint256 lastIndexP1 = userWithdrawsIndex[msg.sender].length;
        for (uint256 i = lastIndexP1; i > 0; i--) {
            Receipt storage r = withdraws[
                userWithdrawsIndex[msg.sender][i - 1]
            ];
            if (r.amount > toRemove) {
                r.amount -= toRemove;
                toRemove = 0;
                break;
            } else {
                toRemove -= r.amount;
                delete withdraws[userWithdrawsIndex[msg.sender][i - 1]];
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
        require(
            _quantity <= IERC20(usdc).balanceOf(address(this)),
            "Not enough deposits to net"
        );
        require(
            crabQuantity <= IERC20(crab).balanceOf(address(this)),
            "Not enough withdrawals to net"
        );

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
                emit USDCDeposited(
                    deposit.sender,
                    deposit.amount,
                    amountToSend,
                    i,
                    0
                );
                delete deposits[i];
                i++;
            } else {
                // deposit amount is greater than quantity; use it partially
                deposits[i].amount = deposit.amount - _quantity;
                usdBalance[deposit.sender] -= _quantity;
                amountToSend = (_quantity * 1e18) / _price;
                IERC20(crab).transfer(deposit.sender, amountToSend);
                emit USDCDeposited(
                    deposit.sender,
                    _quantity,
                    amountToSend,
                    i,
                    0
                );
                _quantity = 0;
            }
        }
        depositsIndex = i;

        // process withdraws and send usdc
        uint256 j = withdrawsIndex;
        while (crabQuantity > 0) {
            Receipt memory withdraw = withdraws[j];
            if (withdraw.amount == 0) {
                j++;
                continue;
            }
            if (withdraw.amount <= crabQuantity) {
                crabQuantity = crabQuantity - withdraw.amount;
                crabBalance[withdraw.sender] -= withdraw.amount;
                amountToSend = (withdraw.amount * _price) / 1e18;
                IERC20(usdc).transfer(withdraw.sender, amountToSend);

                emit CrabWithdrawn(
                    withdraw.sender,
                    withdraw.amount,
                    amountToSend,
                    j
                );

                delete withdraws[j];
                j++;
            } else {
                withdraws[j].amount = withdraw.amount - crabQuantity;
                crabBalance[withdraw.sender] -= crabQuantity;
                amountToSend = (crabQuantity * _price) / 1e18;
                IERC20(usdc).transfer(withdraw.sender, amountToSend);

                emit CrabWithdrawn(
                    withdraw.sender,
                    withdraw.amount,
                    amountToSend,
                    j
                );

                crabQuantity = 0;
            }
        }
        withdrawsIndex = j;
    }

    /// @dev @return sum usdc amount in queue
    function depositsQueued() external view returns (uint256) {
        uint256 j = depositsIndex;
        uint256 sum;
        while (j < deposits.length) {
            sum = sum + deposits[j].amount;
            j++;
        }
        return sum;
    }

    /// @dev @return sum crab amount in queue
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
     * @dev checks the expiry nonce and signer of an order
     * @param _order is the Order struct
     */
    function checkOrder(Order memory _order) internal {
        _useNonce(_order.trader, _order.nonce);
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
        require(offerSigner == _order.trader, "Signature not correct");
        require(_order.expiry >= block.timestamp, "order expired");
    }

    /**
     * @dev calculates wSqueeth minted when amount is deposited
     * @param _amount to deposit into crab
     */
    function _debtToMint(uint256 _amount) internal view returns (uint256) {
        uint256 feeAdjustment = _calcFeeAdjustment();
        (, , uint256 collateral, uint256 debt) = ICrabStrategyV2(crab)
            .getVaultDetails();
        uint256 wSqueethToMint = (_amount * debt) /
            (collateral + (debt * feeAdjustment));
        return wSqueethToMint;
    }

    /**
     * @dev takes in orders from mm's to buy sqth and deposits the usd amount in q to crab long with eth from selling sqth
     * @param _p DepositAuction Params that contain orders, usdToDeposit, uniswap min amount and fee
     */
    function depositAuction(DepositAuctionParams calldata _p)
        external
        onlyOwner
    {
        _checkOTCPrice(_p.clearingPrice, false);
        /**
        step 1: get eth from mm
        step 2: get eth from deposit usdc
        step 3: crab deposit
        step 4: flash deposit
        step 5: send sqth to mms
        step 6: send crab to depositors
         */
        uint256 initCrabBalance = IERC20(crab).balanceOf(address(this));
        uint256 initEthBalance = address(this).balance;

        uint256 sqthToSell = _debtToMint(_p.totalDeposit);
        // step 1 get all the eth in
        uint256 remainingToSell = sqthToSell;
        for (uint256 i = 0; i < _p.orders.length && remainingToSell > 0; i++) {
            require(
                _p.orders[i].isBuying && _p.orders[i].price >= _p.clearingPrice,
                "buy order price less than clearing"
            );
            checkOrder(_p.orders[i]);
            if (_p.orders[i].quantity >= remainingToSell) {
                IWETH(weth).transferFrom(
                    _p.orders[i].trader,
                    address(this),
                    (remainingToSell * _p.clearingPrice) / 1e18
                );
                remainingToSell = 0;
            } else {
                IWETH(weth).transferFrom(
                    _p.orders[i].trader,
                    address(this),
                    (_p.orders[i].quantity * _p.clearingPrice) / 1e18
                );
                remainingToSell -= _p.orders[i].quantity;
            }
        }
        require(remainingToSell == 0, "not enough buy orders for sqth");

        // step 2
        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter
            .ExactInputSingleParams({
                tokenIn: address(usdc),
                tokenOut: address(weth),
                fee: _p.usdEthFee,
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
                ICrabStrategyV2(crab).flashDeposit{value: to_send.eth}(
                    _p.ethToFlashDeposit,
                    _p.flashDepositFee
                );
            } else {
                ICrabStrategyV2(crab).flashDeposit{value: to_send.eth}(
                    to_send.eth,
                    _p.flashDepositFee
                );
            }
        }

        // step 5
        to_send.sqth = IERC20(sqth).balanceOf(address(this));
        remainingToSell = to_send.sqth;
        for (uint256 j = 0; j < _p.orders.length && remainingToSell > 0; j++) {
            if (_p.orders[j].quantity < remainingToSell) {
                IERC20(sqth).transfer(
                    _p.orders[j].trader,
                    _p.orders[j].quantity
                );
                emit BidTraded(
                    _p.orders[j].bidId,
                    _p.orders[j].trader,
                    _p.orders[j].quantity,
                    _p.clearingPrice
                );
                remainingToSell -= _p.orders[j].quantity;
            } else {
                IERC20(sqth).transfer(_p.orders[j].trader, remainingToSell);
                emit BidTraded(
                    _p.orders[j].bidId,
                    _p.orders[j].trader,
                    remainingToSell,
                    _p.clearingPrice
                );
                remainingToSell = 0;
            }
        }

        // step 6 send crab to depositors
        uint256 remainingDeposits = _p.depositsQueued;
        uint256 k = depositsIndex;

        to_send.crab = IERC20(crab).balanceOf(address(this)) - initCrabBalance;
        // get the balance between start and now
        to_send.eth = address(this).balance - initEthBalance;
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

                portion.crab = ((queuedAmount * to_send.crab) /
                    _p.depositsQueued);

                IERC20(crab).transfer(deposits[k].sender, portion.crab);

                portion.eth = ((queuedAmount * to_send.eth) /
                    _p.depositsQueued);
                if (portion.eth > 1e12) {
                    payable(deposits[k].sender).transfer(portion.eth);
                } else {
                    portion.eth = 0;
                }
                emit USDCDeposited(
                    deposits[k].sender,
                    queuedAmount,
                    portion.crab,
                    k,
                    portion.eth
                );

                delete deposits[k];
                k++;
            } else {
                usdBalance[deposits[k].sender] -= remainingDeposits;

                portion.crab = ((remainingDeposits * to_send.crab) /
                    _p.depositsQueued);
                IERC20(crab).transfer(deposits[k].sender, portion.crab);

                portion.eth = ((remainingDeposits * to_send.eth) /
                    _p.depositsQueued);
                if (portion.eth > 1e12) {
                    payable(deposits[k].sender).transfer(portion.eth);
                } else {
                    portion.eth = 0;
                }
                emit USDCDeposited(
                    deposits[k].sender,
                    remainingDeposits,
                    portion.crab,
                    k,
                    portion.eth
                );

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
    function withdrawAuction(WithdrawAuctionParams calldata _p)
        public
        onlyOwner
    {
        _checkOTCPrice(_p.clearingPrice, true);
        uint256 initWethBalance = IERC20(weth).balanceOf(address(this));
        uint256 initEthBalance = address(this).balance;
        /**
        step 1: get sqth from mms
        step 2: withdraw from crab
        step 3: send eth to mms
        step 4: convert eth to usdc
        step 5: send usdc to withdrawers
         */

        // step 1 get sqth from mms
        uint256 sqthRequired = ICrabStrategyV2(crab).getWsqueethFromCrabAmount(
            _p.crabToWithdraw
        );
        uint256 toPull = sqthRequired;
        for (uint256 i = 0; i < _p.orders.length && toPull > 0; i++) {
            checkOrder(_p.orders[i]);
            require(
                !_p.orders[i].isBuying &&
                    _p.orders[i].price <= _p.clearingPrice,
                "sell order price greater than clearing"
            );
            if (_p.orders[i].quantity < toPull) {
                toPull -= _p.orders[i].quantity;
                IERC20(sqth).transferFrom(
                    _p.orders[i].trader,
                    address(this),
                    _p.orders[i].quantity
                );
            } else {
                IERC20(sqth).transferFrom(
                    _p.orders[i].trader,
                    address(this),
                    toPull
                );
                toPull = 0;
            }
        }

        // step 2 withdraw from crab
        ICrabStrategyV2(crab).withdraw(_p.crabToWithdraw);

        // step 3 pay all mms
        IWETH(weth).deposit{value: address(this).balance - initEthBalance}();
        toPull = sqthRequired;
        uint256 quantity;
        for (uint256 i = 0; i < _p.orders.length && toPull > 0; i++) {
            if (_p.orders[i].quantity < toPull) {
                quantity = _p.orders[i].quantity;
            } else {
                quantity = toPull;
            }
            IERC20(weth).transfer(
                _p.orders[i].trader,
                (quantity * _p.clearingPrice) / 1e18
            );
            toPull -= quantity;
            emit BidTraded(
                _p.orders[i].bidId,
                _p.orders[i].trader,
                quantity,
                _p.clearingPrice
            );
        }

        // step 4 convert to USDC
        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter
            .ExactInputSingleParams({
                tokenIn: address(weth),
                tokenOut: address(usdc),
                fee: _p.ethUSDFee,
                recipient: address(this),
                deadline: block.timestamp,
                amountIn: (IERC20(weth).balanceOf(address(this)) -
                    initWethBalance),
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
                usdcAmount =
                    (withdraw.amount * usdcReceived) /
                    _p.crabToWithdraw;
                IERC20(usdc).transfer(withdraw.sender, usdcAmount);
                emit CrabWithdrawn(
                    withdraw.sender,
                    withdraw.amount,
                    usdcAmount,
                    j
                );
                delete withdraws[j];
                j++;
            } else {
                withdraws[j].amount -= remainingWithdraws;
                crabBalance[withdraw.sender] -= remainingWithdraws;

                // send proportional usdc
                usdcAmount =
                    (remainingWithdraws * usdcReceived) /
                    _p.crabToWithdraw;
                IERC20(usdc).transfer(withdraw.sender, usdcAmount);
                emit CrabWithdrawn(
                    withdraw.sender,
                    remainingWithdraws,
                    usdcAmount,
                    j
                );

                remainingWithdraws = 0;
            }
        }
        withdrawsIndex = j;
        isAuctionLive = false;
        // check if all balances are zero
    }

    /**
     * @notice owner can set the twap period in seconds that is used for calculating twaps for hedging
     * @param _auctionTwapPeriod the twap period, in seconds
     */
    function setAuctionTwapPeriod(uint32 _auctionTwapPeriod)
        external
        onlyOwner
    {
        require(
            _auctionTwapPeriod >= 180,
            "twap period cannot be less than 180"
        );

        auctionTwapPeriod = _auctionTwapPeriod;

        emit SetAuctionTwapPeriod(_auctionTwapPeriod);
    }

    /**
     * @notice owner can set a threshold, scaled by 1e18 that determines the maximum discount of a clearing sale price to the current uniswap twap price
     * @param _otcPriceTolerance the OTC price tolerance, in percent, scaled by 1e18
     */
    function setOTCPriceTolerance(uint256 _otcPriceTolerance)
        external
        onlyOwner
    {
        // Tolerance cannot be more than 20%
        require(
            _otcPriceTolerance <= MAX_OTC_PRICE_TOLERANCE,
            "Price tolerance has to be less than 20%"
        );

        otcPriceTolerance = _otcPriceTolerance;

        emit SetOTCPriceTolerance(_otcPriceTolerance);
    }

    /**
     * @dev set nonce flag of the trader to true
     * @param _trader address of the signer
     * @param _nonce number that is to be traded only once
     */
    function _useNonce(address _trader, uint256 _nonce) internal {
        require(!nonces[_trader][_nonce], "Nonce already used");
        nonces[_trader][_nonce] = true;
    }

    /**
     * @notice check that the proposed sale price is within a tolerance of the current Uniswap twap
     * @param _price clearing price provided by manager
     * @param _isAuctionBuying is crab buying or selling oSQTH
     */
    function _checkOTCPrice(uint256 _price, bool _isAuctionBuying)
        internal
        view
    {
        // Get twap
        uint256 squeethEthPrice = IOracle(oracle).getTwap(
            ethSqueethPool,
            sqth,
            weth,
            auctionTwapPeriod,
            true
        );

        if (_isAuctionBuying) {
            require(
                _price <= (squeethEthPrice * (1e18 + otcPriceTolerance)) / 1e18,
                "Price too high relative to Uniswap twap."
            );
        } else {
            require(
                _price >= (squeethEthPrice * (1e18 - otcPriceTolerance)) / 1e18,
                "Price too low relative to Uniswap twap."
            );
        }
    }

    function _checkCrabPrice(uint256 _price) internal view {
        // Get twap
        uint256 squeethEthPrice = IOracle(oracle).getTwap(
            ethSqueethPool,
            sqth,
            weth,
            auctionTwapPeriod,
            true
        );
        uint256 usdcEthPrice = IOracle(oracle).getTwap(
            ethUsdcPool,
            weth,
            usdc,
            auctionTwapPeriod,
            true
        );
        (, , uint256 collateral, uint256 debt) = ICrabStrategyV2(crab)
            .getVaultDetails();
        uint256 crabFairPrice = ((collateral -
            ((debt * squeethEthPrice) / 1e18)) * usdcEthPrice) /
            ICrabStrategyV2(crab).totalSupply();
        crabFairPrice = crabFairPrice / 1e12; //converting from units of 18 to 6
        require(
            _price <= (crabFairPrice * (1e18 + otcPriceTolerance)) / 1e18,
            "Crab Price too high"
        );
        require(
            _price >= (crabFairPrice * (1e18 - otcPriceTolerance)) / 1e18,
            "Crab Price too low"
        );
    }

    function _calcFeeAdjustment() internal view returns (uint256) {
        uint256 squeethEthPrice = IOracle(oracle).getTwap(
            ethSqueethPool,
            sqth,
            weth,
            auctionTwapPeriod,
            true
        );
        uint256 feeRate = IController(sqthController).feeRate();
        return (squeethEthPrice * feeRate) / 10000;
    }

    receive() external payable {}
}
