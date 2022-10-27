// SPDX-License-Identifier: GPL-2.0-or-later
// TODO is the contract license ok
pragma solidity ^0.8.13;

import {IERC20} from "openzeppelin/token/ERC20/IERC20.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "forge-std/console.sol";

import {IWETH} from "../src/interfaces/IWETH.sol";
import {ICrabStrategyV2} from "../src/interfaces/ICrabStrategyV2.sol";

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

contract CrabNetting {
    address usdc;
    address crab;
    address weth;
    address immutable sqth = 0xf1B99e3E573A1a9C5E6B2Ce818b617F0E664E86B;
    ISwapRouter public immutable swapRouter =
        ISwapRouter(0xE592427A0AEce92De3Edee1F18E0157C05861564);

    mapping(address => uint256) public usd_balance;
    mapping(address => uint256) public crab_balance;
    struct Receipt {
        address sender;
        uint256 amount;
    }
    Receipt[] public deposits;
    uint256 public depositsIndex;
    Receipt[] public withdraws;
    uint256 public withdrawsIndex;

    constructor(
        address _usdc,
        address _crab,
        address _weth
    ) {
        payable(0x0000000000000000000000000000000000000000).transfer(
            address(this).balance
        );
        console.log(address(this).balance, "balance at constructor");
        usdc = _usdc;
        crab = _crab;
        weth = _weth;
    }

    function depositUSDC(uint256 _amount) public {
        IERC20(usdc).transferFrom(msg.sender, address(this), _amount);
        usd_balance[msg.sender] = usd_balance[msg.sender] + _amount;
        deposits.push(Receipt(msg.sender, _amount));
    }

    function withdrawUSDC(uint256 _amount) public {
        // TODO ensure final version does not need this check
        //require(usd_balance[msg.sender] >= _amount, "Withdrawing more than balance");
        usd_balance[msg.sender] = usd_balance[msg.sender] - _amount;
        IERC20(usdc).transfer(msg.sender, _amount);
    }

    function depositCrab(uint256 _amount) public {
        IERC20(crab).transferFrom(msg.sender, address(this), _amount);
        crab_balance[msg.sender] = crab_balance[msg.sender] + _amount;
        withdraws.push(Receipt(msg.sender, _amount));
    }

    function withdrawCrab(uint256 _amount) public {
        // TODO ensure final version does not need this check
        // require(crab_balance[msg.sender] >= _amount);
        crab_balance[msg.sender] = crab_balance[msg.sender] - _amount;
        IERC20(crab).transfer(msg.sender, _amount);
    }

    function netAtPrice(uint256 _price, uint256 _quantity) public {
        // TODO make only owner
        uint256 forWithdraw = _quantity;
        require(
            _quantity <= IERC20(usdc).balanceOf(address(this)),
            "Not enough deposits to net"
        );
        // TODO DO we need to do the same check for crab withdrawals?
        // can we just do deposits alone and forget about withdrawals netting?

        // TODO make sure we dont need SafeMath in final version
        uint256 i = depositsIndex;
        while (_quantity > 0 && i < deposits.length) {
            Receipt memory deposit = deposits[i];
            if (deposit.amount <= _quantity) {
                _quantity = _quantity - deposit.amount;
                usd_balance[deposit.sender] =
                    usd_balance[deposit.sender] -
                    deposit.amount;
                IERC20(crab).transfer(deposit.sender, deposit.amount / _price);
                i++;
            } else {
                deposits[i].amount = deposit.amount - _quantity;
                usd_balance[deposit.sender] =
                    usd_balance[deposit.sender] -
                    _quantity;
                IERC20(crab).transfer(deposit.sender, _quantity / _price);
                _quantity = 0;
                delete deposit;
            }
        }
        depositsIndex = depositsIndex + i;
        uint256 j = withdrawsIndex;
        uint256 crab_quantity = forWithdraw / _price;
        while (crab_quantity > 0 && j < withdraws.length) {
            Receipt memory withdraw = withdraws[j];
            if (withdraw.amount <= crab_quantity) {
                crab_quantity = crab_quantity - withdraw.amount;
                crab_balance[withdraw.sender] =
                    crab_balance[withdraw.sender] -
                    withdraw.amount;
                IERC20(usdc).transfer(
                    withdraw.sender,
                    withdraw.amount * _price
                );
                j++;
            } else {
                withdraws[j].amount = withdraw.amount - crab_quantity;
                IERC20(usdc).transfer(withdraw.sender, crab_quantity * _price);
                crab_balance[withdraw.sender] =
                    crab_balance[withdraw.sender] -
                    crab_quantity;
                crab_quantity = 0;
                delete withdraw;
            }
        }
        withdrawsIndex = withdrawsIndex + j;
    }

    function depositsQueued() public view returns (uint256) {
        console.log(depositsIndex, "deposit index");
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

    function depositAuction(
        uint256 _depositsQueued,
        uint256 _minEth,
        uint256 _totalDeposit,
        Order[] calldata orders,
        uint256 _clearingPrice,
        uint256 _ethToFlashDeposit
    ) external {
        console.log(address(this).balance, "ETH balance start");
        // got all the eth in
        for (uint256 i = 0; i < orders.length; i++) {
            IWETH(weth).transferFrom(
                orders[i].trader,
                address(this),
                (orders[i].quantity * _clearingPrice) / 1e18
            );
        }
        uint256 ethBalance = IWETH(weth).balanceOf(address(this));
        IWETH(weth).withdraw(ethBalance);

        //convert usdc to eth
        uint256 usdBalance = IERC20(usdc).balanceOf(address(this));
        console.log(usdBalance, "usd");

        IERC20(usdc).approve(address(swapRouter), _depositsQueued);
        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter
            .ExactInputSingleParams({
                tokenIn: address(usdc),
                tokenOut: address(weth),
                fee: 500,
                recipient: address(this),
                deadline: block.timestamp,
                amountIn: _depositsQueued,
                amountOutMinimum: _minEth,
                sqrtPriceLimitX96: 0
            });

        // The call to `exactInputSingle` executes the swap.
        uint256 wethReceived = swapRouter.exactInputSingle(params);
        require(
            (ethBalance + wethReceived) >= _totalDeposit,
            "Need more ETH than Total deposit"
        );
        IWETH(weth).withdraw(wethReceived);
        ICrabStrategyV2(crab).deposit{value: _totalDeposit}();
        // todo think about adding 1 to the sqth to auction

        Portion memory to_send;
        to_send.sqth = IERC20(sqth).balanceOf(address(this));
        // TODO the left overs of the previous tx from the flashDeposit will be added here
        to_send.eth = address(this).balance;

        console.log("trying to flashDeposit");
        console.log(to_send.eth, "to send");
        ICrabStrategyV2(crab).flashDeposit{value: to_send.eth}(
            _ethToFlashDeposit,
            3000
        );
        console.log("ending to flashDeposit");

        to_send.crab = IERC20(crab).balanceOf(address(this));

        // send sqth to mms
        uint256 sqth_owed;
        for (uint256 i = 0; i < orders.length; i++) {
            sqth_owed += orders[i].quantity;
        }
        require(
            to_send.sqth >= sqth_owed,
            "Deposit did not get enough sqth to give MMs"
        );

        // send sqth to mms
        for (uint256 i = 0; i < orders.length; i++) {
            IERC20(sqth).transfer(orders[i].trader, orders[i].quantity);
        }

        // send crab to depositors
        uint256 remainingDeposits = _depositsQueued;
        while (remainingDeposits > 0) {
            uint256 queued_amount = deposits[depositsIndex].amount;
            Portion memory portion;
            if (queued_amount <= remainingDeposits) {
                remainingDeposits = remainingDeposits - queued_amount;
                usd_balance[deposits[depositsIndex].sender] -= queued_amount;

                portion.crab = ((deposits[depositsIndex].amount *
                    to_send.crab) / _depositsQueued);

                IERC20(crab).transfer(
                    deposits[depositsIndex].sender,
                    portion.crab
                );

                portion.eth = ((deposits[depositsIndex].amount * to_send.eth) /
                    _depositsQueued);
                //payable(deposits[depositsIndex].sender).transfer(portion.eth);

                deposits[depositsIndex].amount = 0;
                depositsIndex++;
            } else {
                remainingDeposits = 0;
                usd_balance[
                    deposits[depositsIndex].sender
                ] -= remainingDeposits;

                portion.crab = ((deposits[depositsIndex].amount *
                    to_send.crab) / _depositsQueued);
                IERC20(crab).transfer(
                    deposits[depositsIndex].sender,
                    portion.crab
                );

                portion.eth = ((deposits[depositsIndex].amount * to_send.eth) /
                    _depositsQueued);
                //payable(deposits[depositsIndex].sender).transfer(portion.eth);

                deposits[depositsIndex].amount -= remainingDeposits;
            }
        }

        console.log(address(this).balance, "ETH not deposited");
    }

    receive() external payable {}
}
