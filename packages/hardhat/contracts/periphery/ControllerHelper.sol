//SPDX-License-Identifier: BUSL-1.1

pragma solidity =0.7.6;
pragma abicoder v2;

import {IWETH9} from "../interfaces/IWETH9.sol";
import {IWPowerPerp} from "../interfaces/IWPowerPerp.sol";
import {IShortPowerPerp} from "../interfaces/IShortPowerPerp.sol";
import {IOracle} from "../interfaces/IOracle.sol";
import {IController} from "../interfaces/IController.sol";

import {FlashControllerHelper} from "./FlashControllerHelper.sol";

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";

contract ControllerHelper is FlashControllerHelper {
    address public immutable controller;
    address public immutable oracle;
    address public immutable wPowerPerpPool;

    constructor(
        address _controller,
        address _oracle,
        address _wPowerPerpPool,
        address _uniswapFactory
    ) FlashControllerHelper(_uniswapFactory) {
        controller = _controller;
        oracle = _oracle;
        wPowerPerpPool = _wPowerPerpPool;
    }
}
