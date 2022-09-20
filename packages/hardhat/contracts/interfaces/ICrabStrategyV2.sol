// SPDX-License-Identifier: MIT

pragma solidity =0.7.6;

pragma abicoder v2;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface ICrabStrategyV2 is IERC20 {
    function wPowerPerp() external view returns (address);

    function weth() external view returns (address);

    function powerTokenController() external view returns (address);

    function getVaultDetails()
        external
        view
        returns (
            address,
            uint256,
            uint256,
            uint256
        );

    function flashDeposit(uint256 _ethToDeposit, uint24 _poolFee) external payable;

    function flashWithdraw(
        uint256 _crabAmount,
        uint256 _maxEthToPay,
        uint24 _poolFee
    ) external;

    function deposit() external payable;

    function withdraw(uint256 _crabAmount) external;
}
