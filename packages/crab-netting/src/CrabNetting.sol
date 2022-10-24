pragma solidity ^0.8.13;

import {IERC20} from "openzeppelin/token/ERC20/IERC20.sol";
import "forge-std/console.sol";

contract CrabNetting {
    address usdc;
<<<<<<< HEAD
    address crab;

    mapping(address => uint256) usd_balance;
    mapping(address => uint256) crab_balance;
=======
    mapping(address => uint256) usd_balance;
>>>>>>> 3342065f (deposit for crab netting)
    struct Receipt {
        address depositor;
        uint256 amount;
    }
    Receipt[] deposits;
<<<<<<< HEAD
    Receipt[] crab_deposits;

    constructor(address _usdc, address _crab) {
        usdc = _usdc;
        crab = _crab;
=======

    constructor(address _usdc) {
        usdc = _usdc;
>>>>>>> 3342065f (deposit for crab netting)
    }

    function depositUSDC(uint256 amount) public {
        IERC20(usdc).transferFrom(msg.sender, address(this), amount);
        usd_balance[msg.sender] = usd_balance[msg.sender] + amount;
        deposits.push(Receipt(msg.sender, amount));
    }

    function withdrawUSDC(uint256 amount) public {
        require(usd_balance[msg.sender] >= amount);
        usd_balance[msg.sender] = usd_balance[msg.sender] - amount;
        IERC20(usdc).transfer(msg.sender, amount);
    }

<<<<<<< HEAD
    function depositCrab(uint256 amount) public {
        IERC20(crab).transferFrom(msg.sender, address(this), amount);
        crab_balance[msg.sender] = crab_balance[msg.sender] + amount;
        crab_deposits.push(Receipt(msg.sender, amount));
    }

    function withdrawCrab(uint256 amount) public {
        require(crab_balance[msg.sender] >= amount);
        crab_balance[msg.sender] = crab_balance[msg.sender] - amount;
        IERC20(crab).transfer(msg.sender, amount);
    }

    function balanceOf(address account) public view returns (uint256) {
        return usd_balance[account];
    }

    function crabBalanceOf(address account) public view returns (uint256) {
        return crab_balance[account];
    }
=======
    function balanceOf(address account) public view returns (uint256) {
        return usd_balance[account];
    }
>>>>>>> 3342065f (deposit for crab netting)
}
