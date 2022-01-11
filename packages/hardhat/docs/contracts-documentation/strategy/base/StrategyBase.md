# `StrategyBase`

base contract for PowerToken strategy

StrategyBase contract

## All Functions:

- `constructor(address _powerTokenController, address _weth, string _name, string _symbol)`

- `getStrategyVaultId()`

- `getStrategyDebt()`

- `getStrategyCollateral()`

# Functions

## `constructor(address _powerTokenController, address _weth, string _name, string _symbol)`

constructor for StrategyBase

this will open a vault in the power token contract and store the vault ID

### Parameters:

- `address _powerTokenController`: power token controller address

- `address _weth`: weth token address

- `string _name`: token name for strategy ERC20 token

- `string _symbol`: token symbol for strategy ERC20 token

## `getStrategyVaultId() → uint256`

get power token strategy vault ID 

### Return Values:

- `` vault ID

## `getStrategyDebt() → uint256`

get strategy debt amount

### Return Values:

- `` debt amount

## `getStrategyCollateral() → uint256`

get strategy collateral amount

### Return Values:

- `` collateral amount
