// SPDX-License-Identifier: MIT

pragma solidity =0.7.6;

interface IBullStrategy {
    function deposit(uint256 _crabAmount) external payable;
    function withdraw(uint256 _bullAmount) external;
    function crab() external view returns (address);
    function powerTokenController() external view returns (address);
    function getCrabVaultDetails() external view returns (uint256, uint256);
    function calcLeverageEthUsdc(
        uint256 _crabAmount,
        uint256 _bullShare,
        uint256 _ethInCrab,
        uint256 _squeethInCrab,
        uint256 _crabTotalSupply
    ) external view returns (uint256, uint256);
    function calcUsdcToRepay(uint256 _bullShare) external view returns (uint256);
    function getCrabBalance() external view returns (uint256);
    function withdrawWethFromEuler(uint256 _ethToWithdraw) external;
    function repayUsdcToEuler(uint256 _usdcToRepay) external;
    function borrowUsdcFromEuler(uint256 _usdcToBorrow) external;
    function depositWethInEuler(uint256 _ethToDeposit, bool _wrapEth) external;
    function getCrabBalance() external view returns (uint256);
}
