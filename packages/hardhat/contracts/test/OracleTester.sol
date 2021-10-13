//SPDX-License-Identifier: MIT

pragma solidity =0.7.6;

import {IOracle} from "../interfaces/IOracle.sol";
import {Oracle} from "../core/Oracle.sol";

/**
 * use this contract to test how to get twap from exactly 1 timestamp
 * Since we can't access block.timestamp offchain before sending the tx
 */
contract OracleTester is Oracle{

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
    return oracle.getTwap(_pool, _base, _quote, period);
  }

  function testGetTwapSafeSince(
    uint256 _sinceTimestamp, 
    address _pool, 
    address _base, 
    address _quote
  ) view external returns (uint256) {
    uint32 period = uint32(block.timestamp - _sinceTimestamp);
    return oracle.getTwapSafe(_pool, _base, _quote, period);
  }

  function testToUint128(uint256 y) external returns (uint128 z) {
      toUint128(y);
  }
}