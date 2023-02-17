# FlashSwap
[Git Source](https://github.com/opynfinance/squeeth-monorepo/blob/d9f476e77fa42301e16041672bb68b167162f81f/src/FlashSwap.sol)

**Inherits:**
IUniswapV3SwapCallback

**Author:**
opyn team

FlashSwap contract

*contract that interacts with Uniswap pool*


## State Variables
### factory
*Uniswap factory address*


```solidity
address internal immutable factory;
```


## Functions
### constructor

*constructor*


```solidity
constructor(address _factory);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_factory`|`address`|uniswap factory address|


### uniswapV3SwapCallback

uniswap swap callback function for flashes


```solidity
function uniswapV3SwapCallback(int256 amount0Delta, int256 amount1Delta, bytes calldata _data) external override;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`amount0Delta`|`int256`|amount of token0|
|`amount1Delta`|`int256`|amount of token1|
|`_data`|`bytes`|callback data encoded as SwapCallbackData struct|


### _uniFlashSwap


```solidity
function _uniFlashSwap(address pool, uint256 amountToPay, bytes memory callData, uint8 callSource) internal virtual;
```

### _exactInFlashSwap

execute an exact-in flash swap (specify an exact amount to pay)


```solidity
function _exactInFlashSwap(
    address _tokenIn,
    address _tokenOut,
    uint24 _fee,
    uint256 _amountIn,
    uint256 _amountOutMinimum,
    uint8 _callSource,
    bytes memory _data
) internal returns (uint256);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_tokenIn`|`address`|token address to sell|
|`_tokenOut`|`address`|token address to receive|
|`_fee`|`uint24`|pool fee|
|`_amountIn`|`uint256`|amount to sell|
|`_amountOutMinimum`|`uint256`|minimum amount to receive|
|`_callSource`|`uint8`|function call source|
|`_data`|`bytes`|arbitrary data assigned with the call|


### _exactOutFlashSwap

execute an exact-out flash swap (specify an exact amount to receive)


```solidity
function _exactOutFlashSwap(
    address _tokenIn,
    address _tokenOut,
    uint24 _fee,
    uint256 _amountOut,
    uint256 _amountInMaximum,
    uint8 _callSource,
    bytes memory _data
) internal;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_tokenIn`|`address`|token address to sell|
|`_tokenOut`|`address`|token address to receive|
|`_fee`|`uint24`|pool fee|
|`_amountOut`|`uint256`|exact amount to receive|
|`_amountInMaximum`|`uint256`|maximum amount to sell|
|`_callSource`|`uint8`|function call source|
|`_data`|`bytes`|arbitrary data assigned with the call|


### _exactInputInternal

internal function for exact-in swap on uniswap (specify exact amount to pay)


```solidity
function _exactInputInternal(
    uint256 _amountIn,
    address _recipient,
    uint160 _sqrtPriceLimitX96,
    SwapCallbackData memory data
) private returns (uint256);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_amountIn`|`uint256`|amount of token to pay|
|`_recipient`|`address`|recipient for receive|
|`_sqrtPriceLimitX96`|`uint160`|sqrt price limit|
|`data`|`SwapCallbackData`||

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|amount of token bought (amountOut)|


### _exactOutputInternal

internal function for exact-out swap on uniswap (specify exact amount to receive)


```solidity
function _exactOutputInternal(
    uint256 _amountOut,
    address _recipient,
    uint160 _sqrtPriceLimitX96,
    SwapCallbackData memory data
) private returns (uint256);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_amountOut`|`uint256`|amount of token to receive|
|`_recipient`|`address`|recipient for receive|
|`_sqrtPriceLimitX96`|`uint160`|price limit|
|`data`|`SwapCallbackData`||

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|amount of token sold (amountIn)|


### _getPool

returns the uniswap pool for the given token pair and fee

*the pool contract may or may not exist*


```solidity
function _getPool(address tokenA, address tokenB, uint24 fee) internal view returns (IUniswapV3Pool);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`tokenA`|`address`|address of first token|
|`tokenB`|`address`|address of second token|
|`fee`|`uint24`|fee tier for pool|


## Structs
### SwapCallbackData

```solidity
struct SwapCallbackData {
    bytes path;
    address caller;
    uint8 callSource;
    bytes callData;
}
```

