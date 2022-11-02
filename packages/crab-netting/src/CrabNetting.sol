// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.13;

import {IERC20} from "openzeppelin/token/ERC20/IERC20.sol";
import {Ownable} from "openzeppelin/access/Ownable.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "forge-std/console.sol";

import {IWETH} from "../src/interfaces/IWETH.sol";
import {ICrabStrategyV2} from "../src/interfaces/ICrabStrategyV2.sol";

import {EIP712} from "openzeppelin/utils/cryptography/draft-EIP712.sol";
import {ECDSA} from "openzeppelin/utils/cryptography/ECDSA.sol";

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

struct Portion {
    uint256 usdc;
    uint256 crab;
    uint256 eth;
    uint256 sqth;
}

struct DepositAuctionParams {
    uint256 depositsQueued;
    uint256 minEth; // to get from converting usdc to converting eth to usd
    uint256 totalDeposit; // 2x the amount i.e flash depositing calc
    Order[] orders;
    uint256 clearingPrice;
    uint256 ethToFlashDeposit; // the remaining amount to flashDeposit
    uint24 usdEthFee;
    uint24 flashDepositFee;
}

struct WithdrawAuctionParams {
    uint256 crabToWithdraw;
    Order[] orders;
    uint256 clearingPrice;
    uint256 minUSDC;
}
struct Receipt {
    address sender;
    uint256 amount;
}

contract CrabNetting is Ownable, EIP712 {
    /// @dev typehash for signed orders
    bytes32 private constant _CRAB_NETTING_TYPEHASH =
        keccak256(
            "Order(uint256 bidId,address trader,uint256 quantity,uint256 price,bool isBuying,uint256 expiry,uint256 nonce)"
        );

    bool public isAuctionLive;
    address public usdc;
    address public crab;
    address public weth;
    address public sqth;
    ISwapRouter public swapRouter;

    uint256 public depositsIndex;
    uint256 public withdrawsIndex;
    Receipt[] public deposits;
    Receipt[] public withdraws;

    mapping(address => uint256) public usdBalance;
    mapping(address => uint256) public crabBalance;
    mapping(address => uint256[]) public userDepositsIndex;
    mapping(address => uint256[]) public userWithdrawsIndex;
    /// @dev store the used flag for a nonce for each address
    mapping(address => mapping(uint256 => bool)) public nonces;

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

    function toggleAuctionLive() external onlyOwner {
        isAuctionLive = !isAuctionLive;
    }

    /**
     * @dev view function to get the domain seperator used in signing
     */
    // solhint-disable-next-line func-name-mixedcase
    function DOMAIN_SEPARATOR() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    /**
     * @notice set nonce to true
     * @param _nonce the number to be set true
     */
    function setNonceTrue(uint256 _nonce) external {
        nonces[msg.sender][_nonce] = true;
    }

    function depositUSDC(uint256 _amount) public {
        IERC20(usdc).transferFrom(msg.sender, address(this), _amount);
        usdBalance[msg.sender] = usdBalance[msg.sender] + _amount;
        deposits.push(Receipt(msg.sender, _amount));
        userDepositsIndex[msg.sender].push(deposits.length - 1);
    }

    function withdrawUSDC(uint256 _amount) public {
        require(!isAuctionLive, "auction is live");
        // TODO ensure final version does not need this check
        //require(usdBalance[msg.sender] >= _amount, "Withdrawing more than balance");
        usdBalance[msg.sender] = usdBalance[msg.sender] - _amount;
        // remove that _amount the users last deposit
        uint256 toRemove = _amount;
        uint256 lastIndex = userDepositsIndex[msg.sender].length;
        for (uint256 i = lastIndex; i > 0; i--) {
            Receipt storage r = deposits[userDepositsIndex[msg.sender][i - 1]];
            if (r.amount > toRemove) {
                r.amount -= toRemove;
                toRemove = 0;
                break;
            } else {
                toRemove -= r.amount;
                r.amount = 0;
            }
        }
        IERC20(usdc).transfer(msg.sender, _amount);
    }

    function queueCrabForWithdrawal(uint256 _amount) public {
        IERC20(crab).transferFrom(msg.sender, address(this), _amount);
        crabBalance[msg.sender] = crabBalance[msg.sender] + _amount;
        withdraws.push(Receipt(msg.sender, _amount));
        userWithdrawsIndex[msg.sender].push(withdraws.length - 1);
    }

    function withdrawCrab(uint256 _amount) public {
        require(!isAuctionLive, "auction is live");
        // require(crabBalance[msg.sender] >= _amount);
        console.log(crabBalance[msg.sender], "crab balance");
        crabBalance[msg.sender] = crabBalance[msg.sender] - _amount;
        // remove that _amount the users last deposit
        uint256 toRemove = _amount;
        uint256 lastIndex = userWithdrawsIndex[msg.sender].length;
        for (uint256 i = lastIndex; i > 0; i--) {
            Receipt storage r = withdraws[
                userWithdrawsIndex[msg.sender][i - 1]
            ];
            console.log(toRemove);
            if (r.amount > toRemove) {
                r.amount -= toRemove;
                toRemove = 0;
                break;
            } else {
                toRemove -= r.amount;
                r.amount = 0;
            }
        }
        IERC20(crab).transfer(msg.sender, _amount);
    }

    function netAtPrice(uint256 _price, uint256 _quantity) public onlyOwner {
        uint256 crabQuantity = (_quantity * 1e18) / _price;
        // todo write tests for reverts and may = in branches
        require(
            _quantity <= IERC20(usdc).balanceOf(address(this)),
            "Not enough deposits to net"
        );
        require(
            ((_quantity * 1e18) / _price) <=
                IERC20(crab).balanceOf(address(this)),
            "Not enough withdrawals to net"
        );

        uint256 i = depositsIndex;
        while (_quantity > 0 && i < deposits.length) {
            Receipt memory deposit = deposits[i];
            if (deposit.amount <= _quantity) {
                _quantity = _quantity - deposit.amount;
                usdBalance[deposit.sender] =
                    usdBalance[deposit.sender] -
                    deposit.amount;
                IERC20(crab).transfer(
                    deposit.sender,
                    (deposit.amount * 1e18) / _price
                );
                delete deposits[i];
                i++;
            } else {
                deposits[i].amount = deposit.amount - _quantity;
                usdBalance[deposit.sender] =
                    usdBalance[deposit.sender] -
                    _quantity;
                IERC20(crab).transfer(
                    deposit.sender,
                    (_quantity * 1e18) / _price
                );
                _quantity = 0;
            }
        }
        depositsIndex = depositsIndex + i;
        uint256 j = withdrawsIndex;
        while (crabQuantity > 0 && j < withdraws.length) {
            Receipt memory withdraw = withdraws[j];
            if (withdraw.amount <= crabQuantity) {
                crabQuantity = crabQuantity - withdraw.amount;
                crabBalance[withdraw.sender] =
                    crabBalance[withdraw.sender] -
                    withdraw.amount;
                IERC20(usdc).transfer(
                    withdraw.sender,
                    (withdraw.amount * _price) / 1e18
                );
                delete withdraws[j];
                j++;
            } else {
                withdraws[j].amount = withdraw.amount - crabQuantity;
                IERC20(usdc).transfer(
                    withdraw.sender,
                    (crabQuantity * _price) / 1e18
                );
                crabBalance[withdraw.sender] =
                    crabBalance[withdraw.sender] -
                    crabQuantity;
                crabQuantity = 0;
            }
        }
        withdrawsIndex = withdrawsIndex + j;
    }

    function depositsQueued() public view returns (uint256) {
        uint256 j = depositsIndex;
        uint256 sum;
        while (j < deposits.length) {
            sum = sum + deposits[j].amount;
            j++;
        }
        return sum;
    }

    function withdrawsQueued() public view returns (uint256) {
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

    function depositAuction(DepositAuctionParams calldata _p) public onlyOwner {
        uint256 initCrabBalance = IERC20(crab).balanceOf(address(this));
        console.log(address(this).balance, "ETH not deposited");
        // got all the eth in
        for (uint256 i = 0; i < _p.orders.length; i++) {
            IWETH(weth).transferFrom(
                _p.orders[i].trader,
                address(this),
                (_p.orders[i].quantity * _p.clearingPrice) / 1e18
            );
        }
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
        for (uint256 i = 0; i < _p.orders.length; i++) {
            console.log(_p.orders[i].trader, _p.orders[i].quantity);
            IERC20(sqth).transfer(_p.orders[i].trader, _p.orders[i].quantity);
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
