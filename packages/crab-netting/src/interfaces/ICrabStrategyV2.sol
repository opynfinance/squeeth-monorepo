// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {IERC20} from "openzeppelin/interfaces/IERC20.sol";

interface ICrabStrategyV2 is IERC20 {
    function getVaultDetails()
        external
        view
        returns (
            address,
            uint256,
            uint256,
            uint256
        );

    function deposit() external payable;

    function flashDeposit(uint256 _ethToDeposit, uint24 _poolFee)
        external
        payable;
}
