# `VaultLib`

## Functions:

- `addEthCollateral(struct VaultLib.Vault _vault, uint256 _amount) (internal)`

- `addUniNftCollateral(struct VaultLib.Vault _vault, uint256 _tokenId) (internal)`

- `removeEthCollateral(struct VaultLib.Vault _vault, uint256 _amount) (internal)`

- `removeUniNftCollateral(struct VaultLib.Vault _vault) (internal)`

- `addShort(struct VaultLib.Vault _vault, uint256 _amount) (internal)`

- `removeShort(struct VaultLib.Vault _vault, uint256 _amount) (internal)`

- `isProperlyCollateralized(struct VaultLib.Vault _vault, address _positionManager, uint256 _normalizationFactor, uint256 _ethDaiPrice, int24 _wsqueethPoolTick, bool _isWethToken0) (internal)`

- `_isProperlyCollateralized(struct VaultLib.Vault _vault, address _positionManager, uint256 _normalizationFactor, uint256 _ethDaiPrice, int24 _wsqueethPoolTick, bool _isWethToken0) (internal)`

- `_getUniPositionBalances(address _positionManager, uint256 _tokenId, int24 _wsqueethPoolTick, bool _isWethToken0) (internal)`

- `_getToken0Token1Balances(address _positionManager, uint256 _tokenId, int24 _tick) (internal)`

### Function `addEthCollateral(struct VaultLib.Vault _vault, uint256 _amount) internal`

### Function `addUniNftCollateral(struct VaultLib.Vault _vault, uint256 _tokenId) internal`

### Function `removeEthCollateral(struct VaultLib.Vault _vault, uint256 _amount) internal`

### Function `removeUniNftCollateral(struct VaultLib.Vault _vault) → uint256 tokenId internal`

### Function `addShort(struct VaultLib.Vault _vault, uint256 _amount) internal`

### Function `removeShort(struct VaultLib.Vault _vault, uint256 _amount) internal`

### Function `isProperlyCollateralized(struct VaultLib.Vault _vault, address _positionManager, uint256 _normalizationFactor, uint256 _ethDaiPrice, int24 _wsqueethPoolTick, bool _isWethToken0) → bool internal`

see if a vault is properly collateralized

#### Parameters:

- `_vault`: the vault we want to check

- `_positionManager`: address of the uni v3 position manager

- `_normalizationFactor`: current _normalizationFactor

- `_ethDaiPrice`: current eth price scaled by 1e18

- `_wsqueethPoolTick`: current price tick for wsqueeth pool

- `_isWethToken0`: whether weth is token0 in the wsqueeth pool

#### Return Values:

- true if the vault is above water.

### Function `_isProperlyCollateralized(struct VaultLib.Vault _vault, address _positionManager, uint256 _normalizationFactor, uint256 _ethDaiPrice, int24 _wsqueethPoolTick, bool _isWethToken0) → bool internal`

see if a vault is properly collateralized

#### Parameters:

- `_vault`: the vault we want to check

- `_positionManager`: address of the uni v3 position manager

- `_normalizationFactor`: current _normalizationFactor

- `_ethDaiPrice`: current eth price scaled by 1e18

- `_wsqueethPoolTick`: current price tick for wsqueeth pool

- `_isWethToken0`: whether weth is token0 in the wsqueeth pool

#### Return Values:

- true if the vault is above water.

### Function `_getUniPositionBalances(address _positionManager, uint256 _tokenId, int24 _wsqueethPoolTick, bool _isWethToken0) → uint256 ethAmount, uint256 squeethAmount internal`

get how much eth / squeeth the LP position is worth.

#### Parameters:

- `_positionManager`: address of the uni v3 position manager

- `_tokenId`: lp token id

- `_wsqueethPoolTick`: current price tick

- `_isWethToken0`: whether weth is token0 in the pool

#### Return Values:

- ethAmount the eth amount thie LP token is worth

- squeethAmount the squeeth amount this LP token is worth

### Function `_getToken0Token1Balances(address _positionManager, uint256 _tokenId, int24 _tick) → uint256 amount0, uint256 amount1 internal`

get how much token0 / token1 a LP position is worth.

#### Parameters:

- `_positionManager`: address of the uni v3 position manager

- `_tokenId`: LP token id

- `_tick`: current price tick used for calculation

#### Return Values:

- amount0 the amount of token0 this LP token is worth

- amount1 the amount of token1 this LP token is worth
