// SPDX-License-Identifier: MIT

pragma solidity =0.7.6;

pragma abicoder v2;

interface ICrabStrategyV2 {
    function wPowerPerp() external view returns (address);

    function weth() external view returns (address);

    function ethWSqueethPool() external view returns (address);

    function oracle() external view returns (address);

    function hedgingTwapPeriod() external view returns (uint32);

    function nonces(address _owner, uint256 nonce) external view returns (bool);

    function flashDeposit(uint256 _ethToDeposit, uint24 _poolFee) external payable;

    function flashWithdraw(
        uint256 _crabAmount,
        uint256 _maxEthToPay,
        uint24 _poolFee
    ) external;

    function getVaultDetails()
        external
        view
        returns (
            address,
            uint256,
            uint256,
            uint256
        );
}
