# `StrategyBase`

Base contract for PowerToken strategy

StrategyBase contract

## Functions:

- `constructor(address _powerTokenController, address _weth) (public)`

- `getStrategyVaultId() (external)`

- `_openShortPosition() (internal)`

## Events:

- `OpenShortPosition(uint256 vaultId)`

### Function `constructor(address _powerTokenController, address _weth) public`

Strategy base constructor

this will open a vault in the power token contract and store vault ID

#### Parameters:

- `_powerTokenController`: power token controller address

- `_weth`: weth token address

### Function `getStrategyVaultId() → uint256 external`

Get strategy vault ID in Squeeth contract

#### Return Values:

- vauld ID

### Function `_openShortPosition() internal`

Open a short vault

Should only be called at constructor

### Event `OpenShortPosition(uint256 vaultId)`

emit when strategy open short position
