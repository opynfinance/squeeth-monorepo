pragma solidity ^0.8.13;

import {IERC20} from "openzeppelin/token/ERC20/IERC20.sol";
import "forge-std/console.sol";

contract CrabNetting {
    address usdc;
    address crab;

    mapping(address => uint256) usd_balance;
    mapping(address => uint256) crab_balance;
    struct Receipt {
        address depositor;
        uint256 amount;
    }
    Receipt[] deposits;
    Receipt[] crab_deposits;

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
        require(usd_balance[msg.sender] >= _amount);
        usd_balance[msg.sender] = usd_balance[msg.sender] - _amount;
        IERC20(usdc).transfer(msg.sender, _amount);
    }

    function depositCrab(uint256 _amount) public {
        IERC20(crab).transferFrom(msg.sender, address(this), _amount);
        crab_balance[msg.sender] = crab_balance[msg.sender] + _amount;
        crab_deposits.push(Receipt(msg.sender, _amount));
    }

    function withdrawCrab(uint256 _amount) public {
        require(crab_balance[msg.sender] >= _amount);
        crab_balance[msg.sender] = crab_balance[msg.sender] - _amount;
        IERC20(crab).transfer(msg.sender, _amount);
    }

    function balanceOf(address _account) public view returns (uint256) {
        return usd_balance[_account];
    }

    function crabBalanceOf(address _account) public view returns (uint256) {
        return crab_balance[_account];
    }
}
