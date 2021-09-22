# `VaultLibTester`

## Functions:

- `getUniPositionBalances(address _positionManager, uint256 _tokenId, int24 _squeethPoolTick, bool _isWethToken0) (external)`

- `getLiquidity(uint160 sqrtRatioX96, int24 tickA, int24 tickB, uint256 amount0Desired, uint256 amount1Desired) (external)`

- `getLiquidityForAmount0(uint160 sqrtRatioAX96, uint160 sqrtRatioBX96, uint256 amount0) (external)`

- `getLiquidityForAmount1(uint160 sqrtRatioAX96, uint160 sqrtRatioBX96, uint256 amount1) (external)`

- `getAmountsForLiquidity(uint160 sqrtRatioX96, uint160 sqrtRatioAX96, uint160 sqrtRatioBX96, uint128 liquidity) (external)`

### Function `getUniPositionBalances(address _positionManager, uint256 _tokenId, int24 _squeethPoolTick, bool _isWethToken0) → uint256 ethAmount, uint256 squeethAmount external`

### Function `getLiquidity(uint160 sqrtRatioX96, int24 tickA, int24 tickB, uint256 amount0Desired, uint256 amount1Desired) → uint128 liquidity external`

expose this function so it's easier to test vault lib.

### Function `getLiquidityForAmount0(uint160 sqrtRatioAX96, uint160 sqrtRatioBX96, uint256 amount0) → uint128 liquidity external`

### Function `getLiquidityForAmount1(uint160 sqrtRatioAX96, uint160 sqrtRatioBX96, uint256 amount1) → uint128 liquidity external`

### Function `getAmountsForLiquidity(uint160 sqrtRatioX96, uint160 sqrtRatioAX96, uint160 sqrtRatioBX96, uint128 liquidity) → uint256 amount0, uint256 amount1 external`
