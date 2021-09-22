# `IOracle`

## Functions:

- `getTwap(address _pool, address _base, address _quote, uint32 _period) (external)`

- `getTwapSafe(address _pool, address _base, address _quote, uint32 _period) (external)`

- `getMaxPeriod(address _pool) (external)`

- `getTimeWeightedAverageTickSafe(address _pool, uint32 _period) (external)`

### Function `getTwap(address _pool, address _base, address _quote, uint32 _period) → uint256 external`

### Function `getTwapSafe(address _pool, address _base, address _quote, uint32 _period) → uint256 external`

### Function `getMaxPeriod(address _pool) → uint32 external`

### Function `getTimeWeightedAverageTickSafe(address _pool, uint32 _period) → int24 timeWeightedAverageTick external`
