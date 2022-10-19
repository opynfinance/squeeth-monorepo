// SPDX-License-Identifier: MIT

pragma solidity =0.7.6;

interface ICrabStrategyV2 {
    function weth() external view returns (address);
    function wPowerPerp() external view returns (address);
    function vaultId() external view returns (uint256);
}
