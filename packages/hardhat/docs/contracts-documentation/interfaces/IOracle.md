# `IOracle`

## All Functions:

- `getHistoricalTwap(address _pool, address _base, address _quote, uint32 _period, uint32 _periodToHistoricPrice)`

- `getTwap(address _pool, address _base, address _quote, uint32 _period)`

- `getTwapSafe(address _pool, address _base, address _quote, uint32 _period)`

- `getMaxPeriod(address _pool)`

- `getTimeWeightedAverageTickSafe(address _pool, uint32 _period)`

# Functions

## `getHistoricalTwap(address _pool, address _base, address _quote, uint32 _period, uint32 _periodToHistoricPrice) → uint256`

## `getTwap(address _pool, address _base, address _quote, uint32 _period) → uint256`

## `getTwapSafe(address _pool, address _base, address _quote, uint32 _period) → uint256`

## `getMaxPeriod(address _pool) → uint32`

## `getTimeWeightedAverageTickSafe(address _pool, uint32 _period) → int24 timeWeightedAverageTick`
