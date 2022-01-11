# `Oracle`

read UniswapV3 pool TWAP prices, and convert to human readable term with (18 decimals)

if ETH price is $3000, both ETH/USDC price and ETH/DAI price will be reported as 3000 * 1e18 by this oracle

## All Functions:

- `getTwap(address _pool, address _base, address _quote, uint32 _period)`

- `getHistoricalTwap(address _pool, address _base, address _quote, uint32 _secondsAgoToStartOfTwap, uint32 _secondsAgoToEndOfTwap)`

- `getTwapSafe(address _pool, address _base, address _quote, uint32 _period)`

- `getMaxPeriod(address _pool)`

- `getTimeWeightedAverageTickSafe(address _pool, uint32 _period)`

# Functions

## `getTwap(address _pool, address _base, address _quote, uint32 _period) → uint256`

get twap converted with base & quote token decimals

if period is longer than the current timestamp - first timestamp stored in the pool, this will revert with "OLD"

### Parameters:

- `address _pool`: uniswap pool address

- `address _base`: base currency. to get eth/usd price, eth is base token

- `address _quote`: quote currency. to get eth/usd price, usd is the quote currency

- `uint32 _period`: number of seconds in the past to start calculating time-weighted average

### Return Values:

- `address` price of 1 base currency in quote currency. scaled by 1e18

## `getHistoricalTwap(address _pool, address _base, address _quote, uint32 _secondsAgoToStartOfTwap, uint32 _secondsAgoToEndOfTwap) → uint256`

## `getTwapSafe(address _pool, address _base, address _quote, uint32 _period) → uint256`

get twap converted with base & quote token decimals, never reverts

### Parameters:

- `address _pool`: uniswap pool address

- `address _base`: base currency. to get eth/usd price, eth is base token

- `address _quote`: quote currency. to get eth/usd price, usd is the quote currency

- `uint32 _period`: number of seconds in the past to start calculating time-weighted average

### Return Values:

- `address` price of 1 base currency in quote currency. scaled by 1e18

## `getMaxPeriod(address _pool) → uint32`

get the max period that can be used to request twap

### Parameters:

- `address _pool`: uniswap pool address

### Return Values:

- `address` max period can be used to request twap

## `getTimeWeightedAverageTickSafe(address _pool, uint32 _period) → int24 timeWeightedAverageTick`

get time weighed average tick, not converted to price

this function will not revert

### Parameters:

- `address _pool`: address of the pool

- `uint32 _period`: period in second that we want to calculate average on

### Return Values:

- `address` timeWeightedAverageTick the time weighted average tick
