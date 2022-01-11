# `IController`

## All Functions:

- `vaults(uint256 _vaultId)`

- `shortPowerPerp()`

- `wPowerPerp()`

- `getExpectedNormalizationFactor()`

- `mintPowerPerpAmount(uint256 _vaultId, uint128 _powerPerpAmount, uint256 _uniTokenId)`

- `mintWPowerPerpAmount(uint256 _vaultId, uint128 _wPowerPerpAmount, uint256 _uniTokenId)`

- `deposit(uint256 _vaultId)`

- `withdraw(uint256 _vaultId, uint256 _amount)`

- `burnWPowerPerpAmount(uint256 _vaultId, uint256 _wPowerPerpAmount, uint256 _withdrawAmount)`

- `burnOnPowerPerpAmount(uint256 _vaultId, uint256 _powerPerpAmount, uint256 _withdrawAmount)`

- `applyFunding()`

- `reduceDebtShutdown(uint256 _vaultId)`

# Functions

## `vaults(uint256 _vaultId) → struct VaultLib.Vault`

## `shortPowerPerp() → address`

## `wPowerPerp() → address`

## `getExpectedNormalizationFactor() → uint256`

## `mintPowerPerpAmount(uint256 _vaultId, uint128 _powerPerpAmount, uint256 _uniTokenId) → uint256 vaultId, uint256 wPowerPerpAmount`

## `mintWPowerPerpAmount(uint256 _vaultId, uint128 _wPowerPerpAmount, uint256 _uniTokenId) → uint256 vaultId`

## `deposit(uint256 _vaultId)`

Deposit collateral into a vault

## `withdraw(uint256 _vaultId, uint256 _amount)`

Withdraw collateral from a vault.

## `burnWPowerPerpAmount(uint256 _vaultId, uint256 _wPowerPerpAmount, uint256 _withdrawAmount)`

## `burnOnPowerPerpAmount(uint256 _vaultId, uint256 _powerPerpAmount, uint256 _withdrawAmount) → uint256 wPowerPerpAmount`

## `applyFunding()`

External function to update the normalized factor as a way to pay funding.

## `reduceDebtShutdown(uint256 _vaultId)`
