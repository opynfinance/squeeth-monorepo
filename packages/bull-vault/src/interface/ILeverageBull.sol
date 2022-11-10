// SPDX-License-Identifier: MIT

pragma solidity =0.7.6;

interface ILeverageBull {
    function calcLeverageEthUsdc(
        uint256 _crabAmount,
        uint256 _bullShare,
        uint256 _ethInCrab,
        uint256 _squeethInCrab,
        uint256 _totalCrabSupply
    ) external view returns (uint256, uint256);

    function calcUsdcToRepay(uint256 _bullShare) external view returns (uint256);

    function calcWethToWithdraw(uint256 _bullShare) external view returns (uint256);

}
