# ICrabStrategyV2
[Git Source](https://github.com/opynfinance/squeeth-monorepo/blob/d9f476e77fa42301e16041672bb68b167162f81f/src/interface/ICrabStrategyV2.sol)

**Inherits:**
IERC20


## Functions
### getVaultDetails


```solidity
function getVaultDetails() external view returns (address, uint256, uint256, uint256);
```

### deposit


```solidity
function deposit() external payable;
```

### withdraw


```solidity
function withdraw(uint256 _crabAmount) external;
```

### flashDeposit


```solidity
function flashDeposit(uint256 _ethToDeposit, uint24 _poolFee) external payable;
```

### getWsqueethFromCrabAmount


```solidity
function getWsqueethFromCrabAmount(uint256 _crabAmount) external view returns (uint256);
```

### powerTokenController


```solidity
function powerTokenController() external view returns (address);
```

### weth


```solidity
function weth() external view returns (address);
```

### wPowerPerp


```solidity
function wPowerPerp() external view returns (address);
```

### oracle


```solidity
function oracle() external view returns (address);
```

### ethWSqueethPool


```solidity
function ethWSqueethPool() external view returns (address);
```

