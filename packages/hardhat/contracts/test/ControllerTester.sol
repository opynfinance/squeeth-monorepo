//SPDX-License-Identifier: GPL-2.0-or-later

pragma solidity =0.7.6;

import {IController} from "../interfaces/IController.sol";

/**
* use this contract to confirm that funding is not charged twice if called in same block
 */
contract ControllerTester{

  IController controller;

  constructor(address _controller) {
    controller = IController(_controller);
  }

  function testDoubleFunding() external {
    controller.applyFunding();
    uint256 normalizationFactor1 = controller.getExpectedNormalizationFactor();
    controller.applyFunding();
    uint256 normalizationFactor2 = controller.getExpectedNormalizationFactor();
    require(normalizationFactor1==normalizationFactor2, "funding charged twice");
  }
}