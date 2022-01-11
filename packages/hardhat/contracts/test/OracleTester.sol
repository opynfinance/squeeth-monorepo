//SPDX-License-Identifier: GPL-2.0-or-later

pragma solidity =0.7.6;

import {IOracle} from "../interfaces/IOracle.sol";
import {Oracle} from "../core/Oracle.sol";
import {Uint256Casting} from "../libs/Uint256Casting.sol";

/**
 * use this contract to test how to get twap from exactly 1 timestamp
 * Since we can't access block.timestamp offchain before sending the tx
 */
contract OracleTester is Oracle{

  using Uint256Casting for uint256;

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
    return oracle.getTwap(_pool, _base, _quote, period, false);
  }

  function testGetTwapSafeSince(
    uint256 _sinceTimestamp, 
    address _pool, 
    address _base, 
    address _quote
  ) view external returns (uint256) {
    uint32 period = uint32(block.timestamp - _sinceTimestamp);
    return oracle.getTwap(_pool, _base, _quote, period, true);
  }

  function testGetWeightedTickSafe(
    uint256 _sinceTimestamp,
    address _pool
  ) view external returns (int24) {
    uint32 period = uint32(block.timestamp - _sinceTimestamp);
    return oracle.getTimeWeightedAverageTickSafe(_pool, period);
  }

  function testGetHistoricalTwapToNow(
    uint256 _startTimestamp,
    address _pool,
    address _base,
    address _quote
  ) view external returns (uint256) {
    uint32 secondsAgoToStartOfTwap = uint32(block.timestamp - _startTimestamp);  
    uint32 secondsAgoToEndOfTwap=0;
    
    return oracle.getHistoricalTwap(_pool, _base, _quote, secondsAgoToStartOfTwap, secondsAgoToEndOfTwap);
  }

  function testGetHistoricalTwap(
    uint256 _startTimestamp,
    uint256 _endTimestamp,
    address _pool,
    address _base,
    address _quote
  ) view external returns (uint256) {
    uint32 secondsAgoToStartOfTwap = uint32(block.timestamp - _startTimestamp);  
    uint32 secondsAgoToEndOfTwap=uint32(block.timestamp - _endTimestamp); 
        
    return oracle.getHistoricalTwap(_pool, _base, _quote, secondsAgoToStartOfTwap, secondsAgoToEndOfTwap);
  }

  function testToUint128(uint256 y) external pure returns (uint128 z) {
      return y.toUint128();
  }
}