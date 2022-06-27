// SPDX-License-Identifier: MIT

pragma solidity =0.7.6;

pragma abicoder v2;

interface ICrabStrategyV2 {
    function wPowerPerp() external view returns (address);

    function weth() external view returns (address);

    function ethWSqueethPool() external view returns (address);

    function oracle() external view returns (address);

    function hedgingTwapPeriod() external view returns (uint32);


    function flashDeposit(uint256 _ethToDeposit) external payable;

    function flashWithdraw(uint256 _crabAmount, uint256 _maxEthToPay) external;

    function nonces(address _owner) external view returns (uint256);

    function syncStrategyState() external view returns (uint256, uint256); 


}
