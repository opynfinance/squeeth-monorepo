// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

interface IFlashZen {
    struct FlashDepositParams {
        uint256 ethToCrab;
        uint256 minEthFromSqth;
        uint256 minEthFromUsdc;
        uint24 wPowerPerpPoolFee;
        uint24 usdcPoolFee;
    }

    function flashDeposit(FlashDepositParams calldata _params) external payable;
}
