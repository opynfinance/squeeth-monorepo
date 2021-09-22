# `Power2Base`

## Functions:

- `_getIndex(uint32 _period, address _oracle, address _ethDaiPool, address _weth, address _dai) (internal)`

- `_getDenormalizedMark(uint32 _period, address _oracle, address _squeethEthPool, address _ethDaiPool, address _weth, address _dai, address _wsqueeth, uint256 _normalizationFactor) (internal)`

- `_getCollateralToSell(uint256 _debtAmount, address _oracle, address _ethDaiPool, address _weth, address _dai, uint256 _normalizationFactor) (internal)`

- `_getTwap(address _oracle, address _pool, address _base, address _quote, uint32 _period) (internal)`

- `_getLongSettlementValue(uint256 _wsqueethAmount, uint256 _ethSettlementPrice, uint256 _normalizationFactor) (internal)`

### Function `_getIndex(uint32 _period, address _oracle, address _ethDaiPool, address _weth, address _dai) → uint256 internal`

return the index of the power perp

#### Return Values:

- for squeeth, return ethPrice^2

### Function `_getDenormalizedMark(uint32 _period, address _oracle, address _squeethEthPool, address _ethDaiPool, address _weth, address _dai, address _wsqueeth, uint256 _normalizationFactor) → uint256 internal`

return the mark price of the power perp

#### Return Values:

- for squeeth, return ethPrice * squeethPriceInEth

### Function `_getCollateralToSell(uint256 _debtAmount, address _oracle, address _ethDaiPool, address _weth, address _dai, uint256 _normalizationFactor) → uint256 collateralToSell internal`

get how much collateral can be given out to the liquidator

#### Parameters:

- `_debtAmount`: wSqueeth amount paid by liquidator

#### Return Values:

- collateralToSell amount the liquidator can get.

### Function `_getTwap(address _oracle, address _pool, address _base, address _quote, uint32 _period) → uint256 internal`

request twap from our oracle.

#### Return Values:

- price scaled by 1e18

### Function `_getLongSettlementValue(uint256 _wsqueethAmount, uint256 _ethSettlementPrice, uint256 _normalizationFactor) → uint256 internal`

get the index value of wsqueeth when system settles

the index of squeeth is ethPrice^2, so each squeeth will need to pay out {ethPrice} eth

#### Parameters:

- `_wsqueethAmount`: amount of wsqueeth used in settlement

- `_ethSettlementPrice`: eth price used for settlement. scaled with 1e18

#### Return Values:

- amount in wei that should be paid to the token holder
