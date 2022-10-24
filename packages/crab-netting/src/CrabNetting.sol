pragma solidity ^0.8.13;

import {IERC20} from "openzeppelin/token/ERC20/IERC20.sol";
import "forge-std/console.sol";

contract CrabNetting {
    address usdc;
    mapping(address => uint256) usd_balance;
    struct Receipt {
        address depositor;
        uint256 amount;
    }
    Receipt[] deposits;

    constructor(address _usdc) {
        usdc = _usdc;
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

    function balanceOf(address account) public view returns (uint256) {
        return usd_balance[account];
    }
}
