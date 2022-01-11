# `OracleTester`

use this contract to test how to get twap from exactly 1 timestamp

Since we can't access block.timestamp offchain before sending the tx

## All Functions:

- `constructor(address _oracle)`

- `testGetTwapSince(uint256 _sinceTimestamp, address _pool, address _base, address _quote)`

- `testGetTwapSafeSince(uint256 _sinceTimestamp, address _pool, address _base, address _quote)`

- `testGetWeightedTickSafe(uint256 _sinceTimestamp, address _pool)`

- `testGetHistoricalTwapToNow(uint256 _startTimestamp, address _pool, address _base, address _quote)`

- `testGetHistoricalTwap(uint256 _startTimestamp, uint256 _endTimestamp, address _pool, address _base, address _quote)`

- `testToUint128(uint256 y)`

# Functions

## `constructor(address _oracle)`

## `testGetTwapSince(uint256 _sinceTimestamp, address _pool, address _base, address _quote) → uint256`

## `testGetTwapSafeSince(uint256 _sinceTimestamp, address _pool, address _base, address _quote) → uint256`

## `testGetWeightedTickSafe(uint256 _sinceTimestamp, address _pool) → int24`

## `testGetHistoricalTwapToNow(uint256 _startTimestamp, address _pool, address _base, address _quote) → uint256`

## `testGetHistoricalTwap(uint256 _startTimestamp, uint256 _endTimestamp, address _pool, address _base, address _quote) → uint256`

## `testToUint128(uint256 y) → uint128 z`
