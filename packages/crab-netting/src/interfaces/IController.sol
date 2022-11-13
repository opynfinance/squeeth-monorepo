// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.17;

interface IController {
    function feeRate() external view returns (uint256);

    function TWAP_PERIOD() external view returns (uint32);
}
