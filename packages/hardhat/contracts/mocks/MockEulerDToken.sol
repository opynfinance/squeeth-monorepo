// SPDX-License-Identifier: GPL-3.0-only

pragma solidity =0.7.6;
pragma abicoder v2;

// interface
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockEulerDToken {
    ERC20 weth;

    constructor(address _weth) {
        weth = ERC20(_weth);
    }

    function borrow(uint256, uint256 amount) external {
        weth.transfer(msg.sender, amount);
    }

    function repay(uint256, uint256 amount) external {
        weth.transferFrom(msg.sender, address(this), amount);
    }

    function underlyingAsset() external view returns (address) {
        return address(weth);
    }
}
