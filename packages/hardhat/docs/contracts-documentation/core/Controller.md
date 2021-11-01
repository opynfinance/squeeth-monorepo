# `Controller`

## All Functions:

- `constructor(address _oracle, address _shortPowerPerp, address _wPowerPerp, address _weth, address _quoteCurrency, address _ethQuoteCurrencyPool, address _wPowerPerpPool, address _uniPositionManager)`

- `getExpectedNormalizationFactor()`

- `getIndex(uint32 _period)`

- `getUnscaledIndex(uint32 _period)`

- `getDenormalizedMark(uint32 _period)`

- `getDenormalizedMarkForFunding(uint32 _period)`

- `isVaultSafe(uint256 _vaultId)`

- `mintPowerPerpAmount(uint256 _vaultId, uint128 _powerPerpAmount, uint256 _uniTokenId)`

- `mintWPowerPerpAmount(uint256 _vaultId, uint128 _wPowerPerpAmount, uint256 _uniTokenId)`

- `deposit(uint256 _vaultId)`

- `depositUniPositionToken(uint256 _vaultId, uint256 _uniTokenId)`

- `withdraw(uint256 _vaultId, uint256 _amount)`

- `withdrawUniPositionToken(uint256 _vaultId)`

- `burnWPowerPerpAmount(uint256 _vaultId, uint256 _wPowerPerpAmount, uint256 _withdrawAmount)`

- `burnPowerPerpAmount(uint256 _vaultId, uint256 _powerPerpAmount, uint256 _withdrawAmount)`

- `reduceDebtShutdown(uint256 _vaultId)`

- `reduceDebt(uint256 _vaultId)`

- `liquidate(uint256 _vaultId, uint256 _maxDebtAmount)`

- `updateOperator(uint256 _vaultId, address _operator)`

- `setFeeRecipient(address _newFeeRecipient)`

- `setFeeRate(uint256 _newFeeRate)`

- `pauseAndShutDown()`

- `shutDown()`

- `pause()`

- `unPauseAnyone()`

- `unPauseOwner()`

- `redeemLong(uint256 _wPerpAmount)`

- `redeemShort(uint256 _vaultId)`

- `applyFunding()`

- `donate()`

- `receive()`

## All Events:

- `OpenVault(uint256 vaultId)`

- `CloseVault(uint256 vaultId)`

- `DepositCollateral(uint256 vaultId, uint256 amount, uint128 collateralId)`

- `DepositUniPositionToken(uint256 vaultId, uint256 tokenId)`

- `WithdrawCollateral(uint256 vaultId, uint256 amount, uint128 collateralId)`

- `WithdrawUniPositionToken(uint256 vaultId, uint256 tokenId)`

- `MintShort(uint256 amount, uint256 vaultId)`

- `BurnShort(uint256 amount, uint256 vaultId)`

- `UpdateOperator(uint256 vaultId, address operator)`

- `FeeRateUpdated(uint256 oldFee, uint256 newFee)`

- `FeeRecipientUpdated(address oldFeeRecipient, address newFeeRecipient)`

- `Liquidate(uint256 vaultId, uint256 debtAmount, uint256 collateralPaid)`

- `NormalizationFactorUpdated(uint256 oldNormFactor, uint256 newNormFactor, uint256 timestamp)`

# Functions

## `constructor(address _oracle, address _shortPowerPerp, address _wPowerPerp, address _weth, address _quoteCurrency, address _ethQuoteCurrencyPool, address _wPowerPerpPool, address _uniPositionManager)`

constructor

### Parameters:

- `address _oracle`: oracle address

- `address _shortPowerPerp`: ERC721 token address representing the short position

- `address _wPowerPerp`: ERC20 token address representing the long position

- `address _weth`: weth address

- `address _quoteCurrency`: quoteCurrency address

- `address _ethQuoteCurrencyPool`: uniswap v3 pool for weth / quoteCurrency

- `address _wPowerPerpPool`: uniswap v3 pool for wPowerPerp / weth

- `address _uniPositionManager`: uniswap v3 position manager address

## `getExpectedNormalizationFactor() → uint256`

returns the expected normalization factor, if the funding is paid right now

can be used for on-chain and off-chain calculations

## `getIndex(uint32 _period) → uint256`

get the index price of the powerPerp, scaled down

the index price is scaled down by INDEX_SCALE in the associated PowerXBase library

this is the index price used when calculating funding and for collateralization

### Parameters:

- `uint32 _period`: period which you want to calculate twap with

### Return Values:

- `uint32` index price denominated in $USD, scaled by 1e18

## `getUnscaledIndex(uint32 _period) → uint256`

get the expected mark price of powerPerp after funding has been applied

this is the mark that would be be used for future funding after a new normalization factor is applied

### Parameters:

- `uint32 _period`: period which you want to calculate twap with

### Return Values:

- `uint32` index price denominated in $USD, scaled by 1e18

## `getDenormalizedMark(uint32 _period) → uint256`

get the mark price (after funding) of powerPerp as the twap divided by the normalization factor

### Parameters:

- `uint32 _period`: period of time for the twap in seconds

### Return Values:

- `uint32` mark price denominated in $USD, scaled by 1e18

## `getDenormalizedMarkForFunding(uint32 _period) → uint256`

get the mark price of powerPerp before funding has been applied

this is the mark that would be used to calculate a new normalization factor if funding was calculated now

### Parameters:

- `uint32 _period`: period which you want to calculate twap with

### Return Values:

- `uint32` mark price denominated in $USD, scaled by 1e18

## `isVaultSafe(uint256 _vaultId) → bool`

return if the vault is properly collateralized

### Parameters:

- `uint256 _vaultId`: id of the vault

### Return Values:

- `uint256` true if the vault is properly collateralized

## `mintPowerPerpAmount(uint256 _vaultId, uint128 _powerPerpAmount, uint256 _uniTokenId) → uint256, uint256`

deposit collateral and mint wPowerPerp (non-rebasing) for specified powerPerp (rebasing) amount

### Parameters:

- `uint256 _vaultId`: vault to mint wPowerPerp in

- `uint128 _powerPerpAmount`: amount of powerPerp to mint

- `uint256 _uniTokenId`: uniswap v3 position token id (additional collateral)

### Return Values:

- `uint256` amount of wPowerPerp minted

## `mintWPowerPerpAmount(uint256 _vaultId, uint128 _wPowerPerpAmount, uint256 _uniTokenId) → uint256`

deposit collateral and mint wPowerPerp

### Parameters:

- `uint256 _vaultId`: vault to mint wPowerPerp in

- `uint128 _wPowerPerpAmount`: amount of wPowerPerp to mint

- `uint256 _uniTokenId`: uniswap v3 position token id (additional collateral)

## `deposit(uint256 _vaultId)`

deposit collateral into a vault

### Parameters:

- `uint256 _vaultId`: id of the vault

## `depositUniPositionToken(uint256 _vaultId, uint256 _uniTokenId)`

deposit uniswap position token into a vault to increase collateral ratio

### Parameters:

- `uint256 _vaultId`: id of the vault

- `uint256 _uniTokenId`: uniswap position token id

## `withdraw(uint256 _vaultId, uint256 _amount)`

withdraw collateral from a vault

### Parameters:

- `uint256 _vaultId`: id of the vault

- `uint256 _amount`: amount of eth to withdraw

## `withdrawUniPositionToken(uint256 _vaultId)`

withdraw uniswap v3 position token from a vault

### Parameters:

- `uint256 _vaultId`: id of the vault

## `burnWPowerPerpAmount(uint256 _vaultId, uint256 _wPowerPerpAmount, uint256 _withdrawAmount)`

burn wPowerPerp and remove collateral from a vault

### Parameters:

- `uint256 _vaultId`: id of the vault

- `uint256 _wPowerPerpAmount`: amount of wPowerPerp to burn

- `uint256 _withdrawAmount`: amount of eth to withdraw

## `burnPowerPerpAmount(uint256 _vaultId, uint256 _powerPerpAmount, uint256 _withdrawAmount) → uint256`

burn powerPerp and remove collateral from a vault

### Parameters:

- `uint256 _vaultId`: id of the vault

- `uint256 _powerPerpAmount`: amount of powerPerp to burn

- `uint256 _withdrawAmount`: amount of eth to withdraw

### Return Values:

- `uint256` amount of wPowerPerp burned

## `reduceDebtShutdown(uint256 _vaultId)`

after the system is shutdown, insolvent vaults need to be have their uniswap v3 token assets withdrawn by force

if a vault has a uniswap v3 position in it, anyone can call to withdraw uniswap v3 token assets, reducing debt and increasing collateral in the vault

the caller won't get any bounty. this is expected to be used for insolvent vaults in shutdown

### Parameters:

- `uint256 _vaultId`: vault containing uniswap v3 position to liquidate

## `reduceDebt(uint256 _vaultId)`

withdraw assets from uniswap v3 position, reducing debt and increasing collateral in the vault

the caller won't get any bounty. this is expected to be used by vault owner

### Parameters:

- `uint256 _vaultId`: target vault

## `liquidate(uint256 _vaultId, uint256 _maxDebtAmount) → uint256`

if a vault is under the 150% collateral ratio, anyone can liquidate the vault by burning wPowerPerp

liquidator can get back (wPowerPerp burned) * (index price) * (normalizationFactor)  * 110% in collateral

normally can only liquidate 50% of a vault's debt

if a vault is under dust limit after a liquidation can fully liquidate

will attempt to reduceDebt first, and can earn a bounty if sucessful

### Parameters:

- `uint256 _vaultId`: vault to liquidate

- `uint256 _maxDebtAmount`: max amount of wPowerPerpetual to repay

### Return Values:

- `uint256` amount of wPowerPerp repaid

## `updateOperator(uint256 _vaultId, address _operator)`

authorize an address to modify the vault

can be revoke by setting address to 0

### Parameters:

- `uint256 _vaultId`: id of the vault

- `address _operator`: new operator address

## `setFeeRecipient(address _newFeeRecipient)`

set the recipient who will receive the fee

this should be a contract handling insurance

### Parameters:

- `address _newFeeRecipient`: new fee recipient

## `setFeeRate(uint256 _newFeeRate)`

set the fee rate when user mints

this function cannot be called if the feeRecipient is still un-set

### Parameters:

- `uint256 _newFeeRate`: new fee rate in basis points. can't be higher than 1%

## `pauseAndShutDown()`

pause and then immediately shutdown the system

this bypasses the check on number of pauses or time based checks, but is irreversible and enables emergency settlement

## `shutDown()`

shutdown the system and enable system settlement

## `pause()`

pause the system for up to 24 hours after which any one can unpause

can only be called for 365 days since the contract was launched or 4 times

## `unPauseAnyone()`

unpause the contract

anyone can unpause the contract after 24 hours

## `unPauseOwner()`

unpause the contract

owner can unpause at any time

## `redeemLong(uint256 _wPerpAmount)`

redeem wPowerPerp for (settlement index value) * normalizationFactor when the system is shutdown

### Parameters:

- `uint256 _wPerpAmount`: amount of wPowerPerp to burn

## `redeemShort(uint256 _vaultId)`

redeem short position when the system is shutdown

short position is redeemed by valuing the debt at the (settlement index value) * normalizationFactor

### Parameters:

- `uint256 _vaultId`: vault id

## `applyFunding()`

update the normalization factor as a way to pay funding

## `donate()`

add eth into a contract. used in case contract has insufficient eth to pay for settlement transactions

## `receive()`

fallback function to accept eth
