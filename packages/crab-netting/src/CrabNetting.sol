// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.13;

// interface
import {IERC20} from "openzeppelin/token/ERC20/IERC20.sol";
import {IWETH} from "../src/interfaces/IWETH.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import {ICrabStrategyV2} from "../src/interfaces/ICrabStrategyV2.sol";

// contract
import {Ownable} from "openzeppelin/access/Ownable.sol";
import {EIP712} from "openzeppelin/utils/cryptography/draft-EIP712.sol";
import {ECDSA} from "openzeppelin/utils/cryptography/ECDSA.sol";
import "forge-std/console.sol";

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
    uint256 usdc;
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

    /// @dev address for ERC20 tokens
    address public usdc;
    address public crab;
    address public weth;
    address public sqth;

    /// @dev address for uniswap router
    ISwapRouter public swapRouter;

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
        address depositor,
        uint256 amount,
        uint256 depositorsBalance,
        uint256 receiptIndex
    );

    event USDCDeQueued(
        address depositor,
        uint256 amount,
        uint256 depositorsBalance
    );

    event CrabQueued(
        address withdrawer,
        uint256 amount,
        uint256 withdrawersBalance,
        uint256 receiptIndex
    );

    event CrabDeQueued(
        address withdrawer,
        uint256 amount,
        uint256 withdrawersBalance
    );

    event USDCDeposited(
        address depositor,
        uint256 usdcAmount,
        uint256 crabAmount,
        uint256 receiptIndex
    );

    event CrabWithdrawn(
        address withdrawer,
        uint256 crabAmount,
        uint256 usdcAmount,
        uint256 receiptIndex
    );

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
        address _swapRouter
    ) EIP712("CRABNetting", "1") {
        usdc = _usdc;
        crab = _crab;
        weth = _weth;
        sqth = _sqth;
        swapRouter = ISwapRouter(_swapRouter);

        // approve crab and sqth so withdraw can happen
        IERC20(crab).approve(crab, 10e36);
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
    function setMinUSDC(uint256 _amount) external {
        minUSDCAmount = _amount;
    }

    /**
     * @notice set minCrabAmount
     * @param _amount the number to be set as minCrab
     */
    function setMinCrab(uint256 _amount) external {
        minCrabAmount = _amount;
    }

    /**
     * @notice queue USDC for deposit into crab strategy
     * @param _amount USDC amount to deposit
     */
    function depositUSDC(uint256 _amount) external {
        require(_amount >= minUSDCAmount);

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
        require(_amount >= minUSDCAmount);
        require(!isAuctionLive, "auction is live");

        // TODO ensure final version does not need this check
        //require(usdBalance[msg.sender] >= _amount, "Withdrawing more than balance");
        usdBalance[msg.sender] = usdBalance[msg.sender] - _amount;

        // remove that _amount the users last deposit
        uint256 toRemove = _amount;
        uint256 lastIndexP1 = userDepositsIndex[msg.sender].length;
        for (uint256 i = lastIndexP1; i > 0; i--) {
            // todo check gas optimization here by changing to memory
            Receipt storage r = deposits[userDepositsIndex[msg.sender][i - 1]];
            if (r.amount > toRemove) {
                r.amount -= toRemove;
                toRemove = 0;
                break;
            } else {
                toRemove -= r.amount;
                r.amount = 0;
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
        require(_amount >= minCrabAmount);
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
        require(_amount >= minCrabAmount);
        require(!isAuctionLive, "auction is live");
        // require(crabBalance[msg.sender] >= _amount);
        crabBalance[msg.sender] = crabBalance[msg.sender] - _amount;
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
                r.amount = 0;
                delete userWithdrawsIndex[msg.sender][i - 1];
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
        uint256 crabQuantity = (_quantity * 1e18) / _price;
        // todo write tests for reverts and may = in branches
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
        while (_quantity > 0 && i < deposits.length) {
            Receipt memory deposit = deposits[i];
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
                    i
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
                    deposit.amount,
                    amountToSend,
                    i
                );
                _quantity = 0;
            }
        }
        depositsIndex = depositsIndex + i;

        // process withdraws and send usdc
        uint256 j = withdrawsIndex;
        while (crabQuantity > 0 && j < withdraws.length) {
            Receipt memory withdraw = withdraws[j];
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
        withdrawsIndex = withdrawsIndex + j;
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

    function _debtToMint(uint256 _amount) internal view returns (uint256) {
        // todo add fee adjustment
        (, , uint256 collateral, uint256 debt) = ICrabStrategyV2(crab)
            .getVaultDetails();
        uint256 wSqueethToMint = (_amount * (debt)) / collateral;
        return wSqueethToMint;
    }

    // todo fix for ETH price going up, so less ETH to deposit, so less sqth used; not full sqth
    function depositAuction(DepositAuctionParams calldata _p) public onlyOwner {
        uint256 sqthToSell = _debtToMint(_p.totalDeposit);
        uint256 initCrabBalance = IERC20(crab).balanceOf(address(this));
        console.log(address(this).balance, "ETH not deposited");

        // get all the eth in
        uint256 remainingToSell = sqthToSell;
        for (uint256 i = 0; i < _p.orders.length && remainingToSell > 0; i++) {
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

        uint256 ethBalance = IWETH(weth).balanceOf(address(this));
        IWETH(weth).withdraw(ethBalance);

        IERC20(usdc).approve(address(swapRouter), _p.depositsQueued); // TODO move all approves to constructor
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

        // The call to `exactInputSingle` executes the swap.
        uint256 wethReceived = swapRouter.exactInputSingle(params);
        require(
            (ethBalance + wethReceived) >= _p.totalDeposit,
            "Need more ETH than Total deposit"
        );
        IWETH(weth).withdraw(wethReceived);
        ICrabStrategyV2(crab).deposit{value: _p.totalDeposit}();
        // todo think about adding 1 to the sqth to auction

        Portion memory to_send;
        to_send.sqth = IERC20(sqth).balanceOf(address(this));
        // TODO the left overs of the previous tx from the flashDeposit will be added here
        to_send.eth = address(this).balance;

        // todo remove console logs
        console.log("trying to flashDeposit");
        console.log(to_send.eth, "to send");

        if (to_send.eth > 0 && _p.ethToFlashDeposit > 0) {
            ICrabStrategyV2(crab).flashDeposit{value: to_send.eth}(
                _p.ethToFlashDeposit,
                _p.flashDepositFee
            );
        }
        console.log("ending to flashDeposit");

        to_send.crab = IERC20(crab).balanceOf(address(this)) - initCrabBalance;
        console.log("total crab to send", to_send.crab);
        // get the balance between start and now

        // send sqth to mms
        uint256 sqth_owed;
        for (uint256 i = 0; i < _p.orders.length; i++) {
            require(_p.orders[i].isBuying);
            checkOrder(_p.orders[i]);
            sqth_owed = _p.orders[i].quantity;
        }
        require(
            to_send.sqth >= sqth_owed,
            "Deposit did not get enough sqth to give MMs"
        );

        // send sqth to mms
        remainingToSell = sqthToSell;
        for (uint256 i = 0; i < _p.orders.length && remainingToSell > 0; i++) {
            console.log(_p.orders[i].trader, _p.orders[i].quantity);
            if (_p.orders[i].quantity < remainingToSell) {
                IERC20(sqth).transfer(
                    _p.orders[i].trader,
                    _p.orders[i].quantity
                );
                remainingToSell -= _p.orders[i].quantity;
            } else {
                IERC20(sqth).transfer(_p.orders[i].trader, remainingToSell);
                remainingToSell -= 0;
            }
        }

        // send crab to depositors
        uint256 remainingDeposits = _p.depositsQueued;
        while (remainingDeposits > 0) {
            uint256 queuedAmount = deposits[depositsIndex].amount;
            Portion memory portion;
            if (queuedAmount <= remainingDeposits) {
                remainingDeposits = remainingDeposits - queuedAmount;
                usdBalance[deposits[depositsIndex].sender] -= queuedAmount;

                portion.crab = ((deposits[depositsIndex].amount *
                    to_send.crab) / _p.depositsQueued);

                IERC20(crab).transfer(
                    deposits[depositsIndex].sender,
                    portion.crab
                );

                portion.eth = ((deposits[depositsIndex].amount * to_send.eth) /
                    _p.depositsQueued);
                //payable(deposits[depositsIndex].sender).transfer(portion.eth);

                deposits[depositsIndex].amount = 0;
                to_send.crab -= portion.crab;
                depositsIndex++;
            } else {
                usdBalance[deposits[depositsIndex].sender] -= remainingDeposits;

                portion.crab = ((deposits[depositsIndex].amount *
                    to_send.crab) / _p.depositsQueued);
                IERC20(crab).transfer(
                    deposits[depositsIndex].sender,
                    portion.crab
                );

                portion.eth = ((deposits[depositsIndex].amount * to_send.eth) /
                    _p.depositsQueued);
                //payable(deposits[depositsIndex].sender).transfer(portion.eth);

                deposits[depositsIndex].amount -= remainingDeposits;
                to_send.crab -= portion.crab;
                remainingDeposits = 0;
            }
        }

        isAuctionLive = false;
        console.log(address(this).balance, "ETH not deposited");
    }

    function withdrawAuction(WithdrawAuctionParams calldata _p)
        public
        onlyOwner
    {
        // get all the sqth in
        for (uint256 i = 0; i < _p.orders.length; i++) {
            checkOrder(_p.orders[i]);
            require(!_p.orders[i].isBuying);
            IERC20(sqth).transferFrom(
                _p.orders[i].trader,
                address(this),
                _p.orders[i].quantity
            );
        }
        ICrabStrategyV2(crab).withdraw(_p.crabToWithdraw);
        IWETH(weth).deposit{value: address(this).balance}();

        // pay all mms
        for (uint256 i = 0; i < _p.orders.length; i++) {
            IERC20(weth).transfer(
                _p.orders[i].trader,
                (_p.orders[i].quantity * _p.clearingPrice) / 1e18
            );
        }

        //convert WETH to USDC and send to withdrawers proportionally
        // convert to USDC
        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter
            .ExactInputSingleParams({
                tokenIn: address(weth),
                tokenOut: address(usdc),
                fee: 500,
                recipient: address(this),
                deadline: block.timestamp,
                amountIn: IERC20(weth).balanceOf(address(this)),
                amountOutMinimum: _p.minUSDC,
                sqrtPriceLimitX96: 0
            });

        // The call to `exactInputSingle` executes the swap.
        uint256 usdcReceived = swapRouter.exactInputSingle(params);

        // pay all withdrawers and mark their withdraws as done
        uint256 remainingWithdraws = _p.crabToWithdraw;
        while (remainingWithdraws > 0) {
            Receipt storage withdraw = withdraws[withdrawsIndex];
            if (withdraw.amount <= remainingWithdraws) {
                remainingWithdraws -= withdraw.amount;
                crabBalance[withdraw.sender] -= withdraw.amount;
                withdrawsIndex++;

                // send proportional usdc
                uint256 usdcAmount = (withdraw.amount * usdcReceived) /
                    _p.crabToWithdraw;
                IERC20(usdc).transfer(withdraw.sender, usdcAmount);
                withdraw.amount = 0;
            } else {
                withdraw.amount -= remainingWithdraws;
                crabBalance[withdraw.sender] -= withdraw.amount;

                // send proportional usdc
                uint256 usdcAmount = (remainingWithdraws * usdcReceived) /
                    _p.crabToWithdraw;
                IERC20(usdc).transfer(withdraw.sender, usdcAmount);

                remainingWithdraws = 0;
            }
        }

        isAuctionLive = false;
        // check if all balances are zero
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

    receive() external payable {}
}
