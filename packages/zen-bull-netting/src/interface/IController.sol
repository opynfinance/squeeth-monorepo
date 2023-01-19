// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.17;

interface IController {
    function weth() external view returns (address);
    function quoteCurrency() external view returns (address);
    function ethQuoteCurrencyPool() external view returns (address);
    function wPowerPerp() external view returns (address);
    function wPowerPerpPool() external view returns (address);
    function oracle() external view returns (address);
}
