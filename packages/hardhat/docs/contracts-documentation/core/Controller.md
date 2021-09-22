# `Controller`

## Modifiers:

- `notShutdown()`

## Functions:

- `init(address _oracle, address _vaultNFT, address _wPowerPerp, address _weth, address _dai, address _ethDaiPool, address _powerPerpPool, address _uniPositionManager) (public)`

- `mint(uint256 _vaultId, uint128 _mintAmount, uint256 _nftTokenId) (external)`

- `deposit(uint256 _vaultId) (external)`

- `depositUniNFT(uint256 _vaultId, uint256 _tokenId) (external)`

- `withdraw(uint256 _vaultId, uint256 _amount) (external)`

- `withdrawUniNFT(uint256 _vaultId) (external)`

- `burn(uint256 _vaultId, uint256 _amount, uint256 _withdrawAmount) (external)`

- `liquidate(uint256 _vaultId, uint256 _debtAmount) (external)`

- `getIndex(uint32 _period) (external)`

- `getDenormalizedMark(uint32 _period) (external)`

- `updateOperator(uint256 _vaultId, address _operator) (external)`

- `shutDown() (external)`

- `redeemLong(uint256 _wPerpAmount) (external)`

- `redeemShort(uint256 _vaultId) (external)`

- `applyFunding() (external)`

- `donate() (external)`

- `_canModifyVault(uint256 _vaultId, address _account) (internal)`

- `_openVault(address _recipient) (internal)`

- `_depositUniNFT(address _account, uint256 _vaultId, uint256 _tokenId) (internal)`

- `_addEthCollateral(uint256 _vaultId, uint256 _amount) (internal)`

- `_withdrawUniNFT(address _account, uint256 _vaultId) (internal)`

- `_withdrawCollateral(address _account, uint256 _vaultId, uint256 _amount) (internal)`

- `_addShort(address _account, uint256 _vaultId, uint256 _squeethAmount) (internal)`

- `_removeShort(address _account, uint256 _vaultId, uint256 _amount) (internal)`

- `_applyFunding() (internal)`

- `_checkUniNFT(uint256 _tokenId) (internal)`

- `_checkVault(uint256 _vaultId) (internal)`

- `_isVaultSafe(struct VaultLib.Vault _vault) (internal)`

- `_getFairPeriodForOracle(uint32 _period) (internal)`

- `_getMaxSafePeriod() (internal)`

## Events:

- `OpenVault(uint256 vaultId)`

- `CloseVault(uint256 vaultId)`

- `DepositCollateral(uint256 vaultId, uint128 amount, uint128 collateralId)`

- `DepositUniNftCollateral(uint256 vaultId, uint256 tokenId)`

- `WithdrawCollateral(uint256 vaultId, uint256 amount, uint128 collateralId)`

- `WithdrawUniNftCollateral(uint256 vaultId, uint256 tokenId)`

- `MintShort(uint256 amount, uint256 vaultId)`

- `BurnShort(uint256 amount, uint256 vaultId)`

- `UpdateOperator(uint256 vaultId, address operator)`

- `Liquidate(uint256 vaultId, uint256 debtAmount, uint256 collateralToSell)`

### Modifier `notShutdown()`

### Function `init(address _oracle, address _vaultNFT, address _wPowerPerp, address _weth, address _dai, address _ethDaiPool, address _powerPerpPool, address _uniPositionManager) public`

init controller with squeeth and short NFT address

### Function `mint(uint256 _vaultId, uint128 _mintAmount, uint256 _nftTokenId) → uint256, uint256 _wSqueethMinted external`

put down collateral and mint squeeth.

This mints an amount of rSqueeth.

### Function `deposit(uint256 _vaultId) external`

Deposit collateral into a vault

### Function `depositUniNFT(uint256 _vaultId, uint256 _tokenId) external`

Deposit Uni NFT as collateral

### Function `withdraw(uint256 _vaultId, uint256 _amount) external`

Withdraw collateral from a vault.

### Function `withdrawUniNFT(uint256 _vaultId) external`

Withdraw Uni NFT from a vault

### Function `burn(uint256 _vaultId, uint256 _amount, uint256 _withdrawAmount) external`

burn squueth and remove collateral from a vault.

This burns an amount of wSqueeth.

### Function `liquidate(uint256 _vaultId, uint256 _debtAmount) external`

if a vault is under the 150% collateral ratio, anyone can liquidate the vault by burning wPowerPerp

liquidator can get back (powerPerp burned) * (index price) * 110% in collateral

#### Parameters:

- `_vaultId`: the vault you want to liquidate

- `_debtAmount`: amount of wPowerPerpetual you want to repay.

### Function `getIndex(uint32 _period) → uint256 external`

### Function `getDenormalizedMark(uint32 _period) → uint256 external`

### Function `updateOperator(uint256 _vaultId, address _operator) external`

Authorize an address to modify the vault. Can be revoke by setting address to 0.

### Function `shutDown() external`

shutdown the system and enable redeeming long and short

### Function `redeemLong(uint256 _wPerpAmount) external`

redeem wPowerPerp for its index value when the system is shutdown

#### Parameters:

- `_wPerpAmount`: amount of wPowerPerp to burn

### Function `redeemShort(uint256 _vaultId) external`

redeem additional collateral from the vault when the system is shutdown

#### Parameters:

- `_vaultId`: vauld id

### Function `applyFunding() external`

Update the normalized factor as a way to pay funding.

### Function `donate() external`

a function to add eth into a contract, in case it got insolvent and have ensufficient eth to pay out.

### Function `_canModifyVault(uint256 _vaultId, address _account) → bool internal`

### Function `_openVault(address _recipient) → uint256 vaultId internal`

create a new vault and bind it with a new NFT id.

### Function `_depositUniNFT(address _account, uint256 _vaultId, uint256 _tokenId) internal`

### Function `_addEthCollateral(uint256 _vaultId, uint256 _amount) internal`

add collateral to a vault

### Function `_withdrawUniNFT(address _account, uint256 _vaultId) internal`

withdraw uni nft

### Function `_withdrawCollateral(address _account, uint256 _vaultId, uint256 _amount) internal`

remove collateral from the vault

### Function `_addShort(address _account, uint256 _vaultId, uint256 _squeethAmount) → uint256 amountToMint internal`

mint wsqueeth (ERC20) to an account

### Function `_removeShort(address _account, uint256 _vaultId, uint256 _amount) internal`

burn wsqueeth (ERC20) from an account.

### Function `_applyFunding() internal`

Update the normalized factor as a way to pay funding.

funding is calculated as mark - index.

### Function `_checkUniNFT(uint256 _tokenId) internal`

check that the specified tokenId is a valid squeeth/weth lp token.

### Function `_checkVault(uint256 _vaultId) internal`

check that the vault is solvent and has enough collateral.

### Function `_isVaultSafe(struct VaultLib.Vault _vault) → bool internal`

### Function `_getFairPeriodForOracle(uint32 _period) → uint32 internal`

### Function `_getMaxSafePeriod() → uint32 internal`

return the smaller of the max periods of 2 pools

### Event `OpenVault(uint256 vaultId)`

Events

### Event `CloseVault(uint256 vaultId)`

### Event `DepositCollateral(uint256 vaultId, uint128 amount, uint128 collateralId)`

### Event `DepositUniNftCollateral(uint256 vaultId, uint256 tokenId)`

### Event `WithdrawCollateral(uint256 vaultId, uint256 amount, uint128 collateralId)`

### Event `WithdrawUniNftCollateral(uint256 vaultId, uint256 tokenId)`

### Event `MintShort(uint256 amount, uint256 vaultId)`

### Event `BurnShort(uint256 amount, uint256 vaultId)`

### Event `UpdateOperator(uint256 vaultId, address operator)`

### Event `Liquidate(uint256 vaultId, uint256 debtAmount, uint256 collateralToSell)`
