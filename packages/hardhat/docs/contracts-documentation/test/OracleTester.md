# `OracleTester`

use this contract to test how to get twap from exactly 1 timestamp

Since we can't access block.timestamp offchain before sending the tx

## Functions:

- `constructor(address _oracle) (public)`

- `testGetTwapSince(uint256 _sinceTimestamp, address _pool, address _base, address _quote) (external)`

- `testGetTwapSafeSince(uint256 _sinceTimestamp, address _pool, address _base, address _quote) (external)`

### Function `constructor(address _oracle) public`

### Function `testGetTwapSince(uint256 _sinceTimestamp, address _pool, address _base, address _quote) → uint256 external`

### Function `testGetTwapSafeSince(uint256 _sinceTimestamp, address _pool, address _base, address _quote) → uint256 external`
