// SPDX-License-Identifier: MIT

pragma solidity =0.7.6;

pragma abicoder v2;

interface ICrabStrategyV2 {

    function wPowerPerp() external view returns (address);

    function weth() external view returns (address);

    function flashDeposit(uint256 _ethToDeposit) external payable;

    function flashWithdraw(uint256 _crabAmount, uint256 _maxEthToPay) external;
}
