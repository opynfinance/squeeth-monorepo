## Sūrya's Description Report

### Files Description Table


|  File Name  |  SHA-1 Hash  |
|-------------|--------------|
| src/FlashBull.sol | 8498f69dac8c8ab83647b18f6e77f759bd38178f |


### Contracts Description Table


|  Contract  |         Type        |       Bases      |                  |                 |
|:----------:|:-------------------:|:----------------:|:----------------:|:---------------:|
|     └      |  **Function Name**  |  **Visibility**  |  **Mutability**  |  **Modifiers**  |
||||||
| **FlashBull** | Implementation | UniFlash |||
| └ | <Constructor> | Public ❗️ | 🛑  | UniFlash |
| └ | <Receive Ether> | External ❗️ |  💵 |NO❗️ |
| └ | flashDeposit | External ❗️ |  💵 |NO❗️ |
| └ | flashWithdraw | External ❗️ | 🛑  |NO❗️ |
| └ | _uniFlashSwap | Internal 🔒 | 🛑  | |
| └ | _calcwPowerPerpToMintAndFee | Internal 🔒 |   | |
| └ | _calcSharesToMint | Internal 🔒 |   | |
| └ | _getCrabVaultDetails | Internal 🔒 |   | |


### Legend

|  Symbol  |  Meaning  |
|:--------:|-----------|
|    🛑    | Function can modify state |
|    💵    | Function is payable |
