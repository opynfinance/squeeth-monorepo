// SPDX-License-Identifier: agpl-3.0
pragma solidity =0.7.6;
pragma abicoder v2;

import "hardhat/console.sol";

// interface
import {IERC20Detailed} from "../interfaces/IERC20Detailed.sol";

// lib
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";

/// @notice Definition of callback method that deferLiquidityCheck will invoke on your contract
interface IDeferredLiquidityCheck {
    function onDeferredLiquidityCheck(bytes memory data) external;
}

interface IExec {
    function deferLiquidityCheck(address account, bytes memory data) external;
}

interface IEulerDToken {
    function borrow(uint subAccountId, uint amount) external;
    function repay(uint subAccountId, uint amount) external;
}

contract EulerControllerHelper is IDeferredLiquidityCheck {
    using SafeMath for uint256;

    address public immutable exec;

    struct FlashloanCallbackData {
        address caller;
        address assetToBorrow;
        uint256 amountToBorrow;
        uint8 callSource;
        bytes callData;
    }

    constructor(address _exec) {
        exec = _exec;
    }

    function _flashCallback(
        address _initiator,
        address _asset,
        uint256 _amount,
        uint256 _premium,
        uint8 _callSource,
        bytes memory _calldata
    ) internal virtual {}

    function onDeferredLiquidityCheck(bytes memory encodedData) external override {
        // sanity checks
        require(msg.sender == exec);

        FlashloanCallbackData memory data = abi.decode(encodedData, (FlashloanCallbackData));

        IEulerDToken(data.assetToBorrow).borrow(0, data.amountToBorrow);

        _flashCallback(data.caller, data.assetToBorrow, data.amountToBorrow, 0, data.callSource, data.callData);

        IERC20Detailed(data.assetToBorrow).approve(data.assetToBorrow, data.amountToBorrow);
        IEulerDToken(data.assetToBorrow).repay(0, data.amountToBorrow);
    }

    /**
     */
    function _flashLoan(
        address _asset,
        uint256 _amount,
        uint8 _callSource,
        bytes memory _data
    ) internal {
        // Disable the liquidity check for "this" and call-back into onDeferredLiquidityCheck:
        IExec(exec).deferLiquidityCheck(address(this), abi.encode(FlashloanCallbackData({caller: msg.sender, assetToBorrow: _asset, amountToBorrow: _amount, callSource: _callSource, callData: _data})));
    }
}
