// SPDX-License-Identifier: MIT

pragma solidity =0.7.6;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IWETH9 is IERC20 {
    function deposit() external payable;

    function withdraw(uint256 wad) external;
}
