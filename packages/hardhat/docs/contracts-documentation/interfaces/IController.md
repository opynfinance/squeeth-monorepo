# `IController`

## Functions:

- `vaultNFT() (external)`

- `wPowerPerp() (external)`

- `mint(uint256 _vaultId, uint128 _mintAmount, uint256 _nftId) (external)`

- `deposit(uint256 _vaultId) (external)`

- `withdraw(uint256 _vaultId, uint256 _amount) (external)`

- `burn(uint256 _vaultId, uint256 _amount, uint256 _withdrawAmount) (external)`

- `applyFunding() (external)`

### Function `vaultNFT() → address external`

### Function `wPowerPerp() → address external`

### Function `mint(uint256 _vaultId, uint128 _mintAmount, uint256 _nftId) → uint256, uint256 external`

put down collateral and mint squeeth.

### Function `deposit(uint256 _vaultId) external`

Deposit collateral into a vault

### Function `withdraw(uint256 _vaultId, uint256 _amount) external`

Withdraw collateral from a vault.

### Function `burn(uint256 _vaultId, uint256 _amount, uint256 _withdrawAmount) external`

burn squueth and remove collateral from a vault.

### Function `applyFunding() external`

External function to update the normalized factor as a way to pay funding.
