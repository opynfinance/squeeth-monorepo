# IFlashZen
[Git Source](https://github.com/opynfinance/squeeth-monorepo/blob/d9f476e77fa42301e16041672bb68b167162f81f/src/interface/IFlashZen.sol)


## Functions
### flashDeposit


```solidity
function flashDeposit(FlashDepositParams calldata _params) external payable;
```

## Structs
### FlashDepositParams

```solidity
struct FlashDepositParams {
    uint256 ethToCrab;
    uint256 minEthFromSqth;
    uint256 minEthFromUsdc;
    uint24 wPowerPerpPoolFee;
    uint24 usdcPoolFee;
}
```

