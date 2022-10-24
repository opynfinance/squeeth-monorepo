// SPDX-License-Identifier: MIT

pragma solidity =0.7.6;

interface IBullStrategy {
    function deposit(uint256 _crabAmount) external payable;
    function crab() external view returns (address);
    function powerTokenController() external view returns (address);
    function getCrabVaultDetails() external view returns (uint256, uint256);
    function calcLeverageEthUsdc(uint256 _crabAmount, uint256 _bullShare, uint256 _crabPrice, uint256 _ethUsdPrice)
        external view
        returns (uint256, uint256);
}
