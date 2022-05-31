import { task, types } from "hardhat/config";
import "@nomiclabs/hardhat-waffle";
import { BigNumber } from "ethers";
import { getController, getEthUSDCPool, getOracle, getUSDC, getWETH } from "./utils";
export const one = BigNumber.from(10).pow(18)

// Example execution
/**
 npx hardhat addLiquidatableVault --input 50 --network ropsten
 */
task("addLiquidatableVault", "Add a short position with a 150% collateralization ratio")
  .addParam('input', 'amount squeeth to mint', 50, types.string)
  .setAction(async ({ input: squeethToMint }, hre) => {

    const { getNamedAccounts, ethers, network } = hre;
    const { deployer } = await getNamedAccounts();
    const controller = await getController(ethers, deployer, network.name)
    const oracle = await getOracle(ethers, deployer, network.name)
    const ethUsdcPool = await getEthUSDCPool(ethers, deployer, network.name)
    const weth = await getWETH(ethers, deployer, network.name)
    const usdc = await getUSDC(ethers, deployer, network.name)
    const ethPrice = await oracle.getTwap(ethUsdcPool.address, weth.address, usdc.address, 420, true)
    const normFactor = await controller.normalizationFactor()
    const debtAmount = ethers.utils.parseUnits(squeethToMint)
    const mintRSqueethAmount = debtAmount.mul(normFactor).div(one)
    const scaledEthPrice = ethPrice.div(10000)
    const debtInEth = mintRSqueethAmount.mul(scaledEthPrice).div(one)
    const collateralToDeposit = debtInEth.mul(3).div(2)

    const shortPowerPerp = await ethers.getContractAt("ShortPowerPerp", (await controller.shortPowerPerp()))
    const oldVaultId = shortPowerPerp.nextId()
    let oldVaultIdInt;
    oldVaultId.then((value: any) => {
        oldVaultIdInt = value.toNumber()
      }).catch((err: any) => {
        console.log(err);
      });
    const newVaultId = oldVaultIdInt ? (oldVaultId + 1): null
    const tx = await controller.mintWPowerPerpAmount(0, debtAmount, 0, {value: collateralToDeposit}) 
    await ethers.provider.waitForTransaction(tx.hash, 1)
    console.log(`Added 150% collateralization vault with ID: `, newVaultId)
  });
