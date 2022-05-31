import { task, types } from "hardhat/config";
import "@nomiclabs/hardhat-waffle";

// Example execution
/**
 npx hardhat checkVaultStatus --input '0' --network ropsten
 */
task("checkVaultStatus", "Check if vault is liquidatable")
  .addParam('input', 'vault id', 0, types.string)
  .setAction(async ({ input: vaultId }, hre) => {
    
    const { getNamedAccounts, ethers, network } = hre;
    const { deployer } = await getNamedAccounts();
    const controller = await ethers.getContract("Controller", deployer);

    const isVaultSafe = await controller.isVaultSafe(vaultId) 
    console.log(`Whether inputted vault is safe: `, isVaultSafe)
  });
