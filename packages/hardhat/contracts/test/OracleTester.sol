//SPDX-License-Identifier: MIT

pragma solidity =0.7.6;

import {IOracle} from "../interfaces/IOracle.sol";

/**
 * use this contract to test how to get twap from exactly 1 timestamp
 * Since we can't access block.timestamp offchain before sending the tx
 */
contract OracleTester {

  IOracle oracle;

  constructor(address _oracle) {
    oracle = IOracle(_oracle);
  }

  function testGetTwapSince(
    uint256 _sinceTimestamp, 
    address _pool, 
    address _base, 
    address _quote
  ) view external returns (uint256) {
    uint32 period = uint32(block.timestamp - _sinceTimestamp);
    return oracle.getTwaPrice(_pool, _base, _quote, period);
  }

  function testGetTwapSafeSince(
    uint256 _sinceTimestamp, 
    address _pool, 
    address _base, 
    address _quote
  ) view external returns (uint256) {
    uint32 period = uint32(block.timestamp - _sinceTimestamp);
    return oracle.getTwaPriceSafe(_pool, _base, _quote, period);
  }
}