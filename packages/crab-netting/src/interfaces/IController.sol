// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.17;

interface IController {
    function feeRate() external view returns (uint256);

    function TWAP_PERIOD() external view returns (uint32);

    function quoteCurrency() external view returns (address);

    function ethQuoteCurrencyPool() external view returns (address);
}
