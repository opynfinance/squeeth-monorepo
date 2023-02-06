# IFlashZen
[Git Source](https://github.com/opynfinance/squeeth-monorepo/blob/334783aa87db73939fb00d5b133216b0033dfece/src/interface/IFlashZen.sol)


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

