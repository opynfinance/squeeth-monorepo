// SPDX-License-Identifier: MIT

pragma solidity =0.7.6;

import {IERC20} from "openzeppelin/token/ERC20/IERC20.sol";

interface ICrabStrategyV2 is IERC20 {
    function deposit() external payable;
    function weth() external view returns (address);
    function wPowerPerp() external view returns (address);
    function vaultId() external view returns (uint256);
    function withdraw(uint256 _crabAmount) external;
}
