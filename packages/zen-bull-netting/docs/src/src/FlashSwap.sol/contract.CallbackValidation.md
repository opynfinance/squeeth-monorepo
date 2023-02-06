# CallbackValidation
[Git Source](https://github.com/opynfinance/squeeth-monorepo/blob/334783aa87db73939fb00d5b133216b0033dfece/src/FlashSwap.sol)

Provides validation for callbacks from Uniswap V3 Pools


## Functions
### verifyCallback

Returns the address of a valid Uniswap V3 Pool


```solidity
function verifyCallback(address factory, address tokenA, address tokenB, uint24 fee)
    internal
    view
    returns (IUniswapV3Pool pool);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`factory`|`address`|The contract address of the Uniswap V3 factory|
|`tokenA`|`address`|The contract address of either token0 or token1|
|`tokenB`|`address`|The contract address of the other token|
|`fee`|`uint24`|The fee collected upon every swap in the pool, denominated in hundredths of a bip|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`pool`|`IUniswapV3Pool`|The V3 pool contract address|


