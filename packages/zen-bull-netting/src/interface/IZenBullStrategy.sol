// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import { IERC20 } from "openzeppelin/token/ERC20/IERC20.sol";

interface IZenBullStrategy is IERC20 {
    function powerTokenController() external view returns (address);
    function getCrabBalance() external view returns (uint256);
    function getCrabVaultDetails() external view returns (uint256, uint256);
    function crab() external view returns (address);
    function withdraw(uint256 _bullAmount) external;
    function deposit(uint256 _crabAmount) external payable;
}
