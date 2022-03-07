// SPDX-License-Identifier: agpl-3.0
pragma solidity =0.7.6;
pragma abicoder v2;

// interface
import {IERC20Detailed} from "../interfaces/IERC20Detailed.sol";
import {IFlashLoanReceiver} from "../interfaces/IFlashLoanReceiver.sol";
import {ILendingPoolAddressesProvider} from "../interfaces/ILendingPoolAddressesProvider.sol";
import {ILendingPool} from "../interfaces/ILendingPool.sol";

// lib
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";

import "hardhat/console.sol";

contract AaveControllerHelper is IFlashLoanReceiver {
    using SafeMath for uint256;

    ILendingPoolAddressesProvider public immutable override ADDRESSES_PROVIDER;
    ILendingPool public immutable override LENDING_POOL;

    struct FlashloanCallbackData {
        uint8 callSource;
        bytes callData;
    }

    constructor(address _provider) {
        console.log("_provider", _provider);
        ADDRESSES_PROVIDER = ILendingPoolAddressesProvider(_provider);
        // make sure this work for tests file where _provider == 0x0
        // (_provider != address(0))
        //     ? LENDING_POOL = ILendingPool(ILendingPoolAddressesProvider(_provider).getLendingPool())
        //     : ILendingPool(address(0));

        LENDING_POOL = ILendingPool(0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9);
    }

    function _flashCallback(
        address _initiator,
        address _asset,
        uint256 _amount,
        uint256 _premium,
        uint8 _callSource,
        bytes memory _calldata
    ) internal virtual {}

    function executeOperation(
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata premiums,
        address initiator,
        bytes calldata params
    ) external override returns (bool) {
        console.log("initiator", initiator);

        FlashloanCallbackData memory data = abi.decode(params, (FlashloanCallbackData));

        _flashCallback(initiator, assets[0], amounts[0], premiums[0], data.callSource, data.callData);

        // Approve the LENDING_POOL contract allowance to *pull* the owed amount
        for (uint256 i = 0; i < assets.length; i++) {
            IERC20Detailed(assets[i]).approve(address(LENDING_POOL), amounts[i].add(premiums[i]));
        }

        return true;
    }

    /**
     */
    function _flashLoan(
        address _asset,
        uint256 _amount,
        uint8 _callSource,
        bytes memory _data
    ) public {
        address[] memory assets = new address[](1);
        assets[0] = _asset;

        uint256[] memory amounts = new uint256[](1);
        amounts[0] = _amount;

        uint256[] memory modes = new uint256[](0);

        LENDING_POOL.flashLoan(
            address(this),
            assets,
            amounts,
            modes,
            address(this),
            abi.encode(FlashloanCallbackData({callSource: _callSource, callData: _data})),
            0
        );
    }
}
