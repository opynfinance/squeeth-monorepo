// SPDX-License-Identifier: GPL-2.0-or-later
// TODO is the contract license ok
pragma solidity ^0.8.13;

import {IERC20} from "openzeppelin/token/ERC20/IERC20.sol";
import "forge-std/console.sol";

contract CrabNetting {
    address usdc;
    address crab;

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

    constructor(address _usdc, address _crab) {
        usdc = _usdc;
        crab = _crab;
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
            if (deposit.amount < _quantity) {
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
            if (withdraw.amount < crab_quantity) {
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
        uint256 j = depositsIndex;
        uint256 sum;
        while (j < deposits.length) {
            sum = sum + deposits[j].amount;
            console.log(deposits[j].amount);
            j++;
        }
        return sum;
    }

    function withdrawsQueued() public view returns (uint256) {
        uint256 j = withdrawsIndex;
        uint256 sum;
        while (j < withdraws.length) {
            sum = sum + withdraws[j].amount;
            console.log(withdraws[j].amount);
            j++;
        }
        return sum;
    }
}
