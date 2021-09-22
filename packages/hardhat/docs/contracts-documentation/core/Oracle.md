# `Oracle`

## Functions:

- `getTwap(address _pool, address _base, address _quote, uint32 _period) (external)`

- `getTwapSafe(address _pool, address _base, address _quote, uint32 _period) (external)`

- `getMaxPeriod(address _pool) (external)`

- `getTimeWeightedAverageTickSafe(address _pool, uint32 _period) (external)`

- `_fetchTwapSafe(address _pool, address _base, address _quote, uint32 _period, uint256 _amountIn) (internal)`

- `_fetchTwap(address _pool, address _base, address _quote, uint32 _period, uint256 _amountIn) (internal)`

- `_getMaxPeriod(address _pool) (internal)`

- `toUint128(uint256 y) (internal)`

### Function `getTwap(address _pool, address _base, address _quote, uint32 _period) → uint256 external`

get twap from the uniswap pool

if period is longer than the current timestamp - first timestamp stored in the pool, this will revert with "OLD".

#### Parameters:

- `_pool`: uniswap pool address

- `_base`: base currency. to get eth/dai price, eth is base token

- `_quote`: quote currency. to get eth/dai price, dai is the quote currency

- `_period`: number of seconds in the past to start calculating time-weighted average

#### Return Values:

- price scaled by 1e18

### Function `getTwapSafe(address _pool, address _base, address _quote, uint32 _period) → uint256 external`

get twap from the uniswap pool, never revert

if period is larger than the max period stored by the pool, default to the max period.

#### Parameters:

- `_pool`: uniswap pool address

- `_base`: base currency. to get eth/dai price, eth is base token

- `_quote`: quote currency. to get eth/dai price, dai is the quote currency

- `_period`: number of seconds in the past to start calculating time-weighted average

#### Return Values:

- price scaled by 1e18

### Function `getMaxPeriod(address _pool) → uint32 external`

get the max period that can be used to request twap.

#### Parameters:

- `_pool`: uniswap pool address

#### Return Values:

- max period can be used to request twap

### Function `getTimeWeightedAverageTickSafe(address _pool, uint32 _period) → int24 timeWeightedAverageTick external`

get time weighed average tick, not converted to price

this function will not revert

#### Parameters:

- `_pool`: address of the pool

- `_period`: period in second that we want to calculate average on

#### Return Values:

- timeWeightedAverageTick the time weighted average tick

### Function `_fetchTwapSafe(address _pool, address _base, address _quote, uint32 _period, uint256 _amountIn) → uint256 amountOut internal`

get twap from the uniswap pool, never revert

if period is larger than the max period stored by the pool, default to the max period.

#### Parameters:

- `_pool`: uniswap pool address

- `_base`: base currency. to get eth/dai price, eth is base token

- `_quote`: quote currency. to get eth/dai price, dai is the quote currency

- `_period`: number of seconds in the past to start calculating time-weighted average

- `_amountIn`: Amount of token to be converted

#### Return Values:

- amountOut Amount of quoteToken received for baseAmount of baseToken

### Function `_fetchTwap(address _pool, address _base, address _quote, uint32 _period, uint256 _amountIn) → uint256 internal`

get twap from the uniswap pool

if period is longer than the current timestamp - first timestamp stored in the pool, this will revert with "OLD".

#### Parameters:

- `_pool`: uniswap pool address

- `_base`: base currency. to get eth/dai price, eth is base token

- `_quote`: quote currency. to get eth/dai price, dai is the quote currency

- `_period`: number of seconds in the past to start calculating time-weighted average

#### Return Values:

- price scaled by 1e18

### Function `_getMaxPeriod(address _pool) → uint32 internal`

get the max period that can be used to request twap.

#### Parameters:

- `_pool`: uniswap pool address

#### Return Values:

- max period can be used to request twap

### Function `toUint128(uint256 y) → uint128 z internal`

Cast a uint256 to a uint128, revert on overflow

#### Parameters:

- `y`: The uint256 to be downcasted

#### Return Values:

- z The downcasted integer, now type uint128
