# PoolAddress
[Git Source](https://github.com/opynfinance/squeeth-monorepo/blob/334783aa87db73939fb00d5b133216b0033dfece/src/FlashSwap.sol)


## State Variables
### POOL_INIT_CODE_HASH

```solidity
bytes32 internal constant POOL_INIT_CODE_HASH = 0xe34f199b19b2b4f47f68442619d555527d244f78a3297ea89325f843f87b8b54;
```


## Functions
### getPoolKey

Returns PoolKey: the ordered tokens with the matched fee levels


```solidity
function getPoolKey(address tokenA, address tokenB, uint24 fee) internal pure returns (PoolKey memory);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`tokenA`|`address`|The first token of a pool, unsorted|
|`tokenB`|`address`|The second token of a pool, unsorted|
|`fee`|`uint24`|The fee level of the pool|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`PoolKey`|Poolkey The pool details with ordered token0 and token1 assignments|


### computeAddress

Deterministically computes the pool address given the factory and PoolKey


```solidity
function computeAddress(address factory, PoolKey memory key) internal pure returns (address pool);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`factory`|`address`|The Uniswap V3 factory contract address|
|`key`|`PoolKey`|The PoolKey|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`pool`|`address`|The contract address of the V3 pool|


## Structs
### PoolKey
The identifying key of the pool


```solidity
struct PoolKey {
    address token0;
    address token1;
    uint24 fee;
}
```

