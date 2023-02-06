# IZenBullStrategy
[Git Source](https://github.com/opynfinance/squeeth-monorepo/blob/334783aa87db73939fb00d5b133216b0033dfece/src/interface/IZenBullStrategy.sol)

**Inherits:**
IERC20


## Functions
### powerTokenController


```solidity
function powerTokenController() external view returns (address);
```

### getCrabBalance


```solidity
function getCrabBalance() external view returns (uint256);
```

### getCrabVaultDetails


```solidity
function getCrabVaultDetails() external view returns (uint256, uint256);
```

### crab


```solidity
function crab() external view returns (address);
```

### withdraw


```solidity
function withdraw(uint256 _bullAmount) external;
```

### deposit


```solidity
function deposit(uint256 _crabAmount) external payable;
```

