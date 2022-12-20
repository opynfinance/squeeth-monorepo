// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.7.6;

interface IZenBullStrategy {
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
    function auctionRepayAndWithdrawFromLeverage(uint256 _usdcToRepay, uint256 _wethToWithdraw)
        external;
    function auctionDepositAndRepayFromLeverage(uint256 _wethToDeposit, uint256 _usdcToRepay)
        external;
    function shutdownRepayAndWithdraw(uint256 wethToUniswap, uint256 shareToUnwind) external;
    function hasRedeemedInShutdown() external view returns (bool);
    function depositAndBorrowFromLeverage(uint256 _wethToDeposit, uint256 _usdcToBorrow) external;
    function TARGET_CR() external view returns (uint256);
    function depositEthIntoCrab(uint256 _ethToDeposit) external;
    function redeemCrabAndWithdrawWEth(uint256 _crabToRedeem, uint256 _wPowerPerpToRedeem)
        external
        returns (uint256);
}
