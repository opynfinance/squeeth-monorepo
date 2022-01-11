# `StrategyFlashSwap`

## All Functions:

- `constructor(address _factory)`

- `uniswapV3SwapCallback(int256 amount0Delta, int256 amount1Delta, bytes _data)`

# Functions

## `constructor(address _factory)`

constructor

### Parameters:

- `address _factory`: uniswap factory address

## `uniswapV3SwapCallback(int256 amount0Delta, int256 amount1Delta, bytes _data)`

uniswap swap callback function for flashes

### Parameters:

- `int256 amount0Delta`: amount of token0

- `int256 amount1Delta`: amount of token1

- `bytes _data`: callback data encoded as SwapCallbackData struct
