import { task, types } from "hardhat/config";
import "@nomiclabs/hardhat-waffle";
import { BigNumber } from "ethers";
import { getUniswapDeployments, getUSDC, getWETH } from "./utils";
import {
    abi as POOL_ABI,
    bytecode as POOL_BYTECODE,
  } from '@uniswap/v3-core/artifacts/contracts/UniswapV3Pool.sol/UniswapV3Pool.json'
import { Oracle } from "../typechain";
export const one = BigNumber.from(10).pow(18)

// Example execution
/**
 npx hardhat addLiquidatableVault --input '50' --network ropsten
 */
task("addLiquidatableVault", "Add a short position with a 150% collateralization ratio")
  .addParam('input', 'amount squeeth to mint', '50', types.string)
  .setAction(async ({ input: squeethToMint }, hre) => {
    
    // ROPSTEN CONSTANTS
    const ORACLE = "0xBD9F4bE886653177D22fA9c79FD0DFc41407fC89"
    const ETH_USDC_POOL = "0x8356AbC730a218c24446C2c85708F373f354F0D8"
    // const WETH = "0xc778417e063141139fce010982780140aa0cd5ab"
    // const USDC = "0x27415c30d8c87437becbd4f98474f26e712047f4"

    const { getNamedAccounts, ethers, network } = hre;
    const { deployer } = await getNamedAccounts();
    const controller = await ethers.getContract("Controller", deployer);
    const oracle = (await ethers.getContractAt("Oracle", ORACLE)) as Oracle
    const ethUsdcPool = await ethers.getContractAt(POOL_ABI, ETH_USDC_POOL);
    // const weth = await ethers.getContractAt("WETH9", WETH);
    const weth = await getWETH(ethers, deployer, network.name)
    // const usdc = await ethers.getContractAt("MockErc20", USDC)
    const usdc = await getUSDC(ethers, deployer, network.name)
    const ethPrice = await oracle.getTwap(ethUsdcPool.address, weth.address, usdc.address, 420, true)
    const normFactor = await controller.normalizationFactor()
    const debtAmount = ethers.utils.parseUnits(squeethToMint)
    const mintRSqueethAmount = debtAmount.mul(normFactor).div(one)
    const scaledEthPrice = ethPrice.div(10000)
    const debtInEth = mintRSqueethAmount.mul(scaledEthPrice).div(one)
    const collateralToDeposit = debtInEth.mul(1.5)

    const tx = await controller.mintWPowerPerpAmount(0, debtAmount, 0, {value: collateralToDeposit}) 
    await ethers.provider.waitForTransaction(tx.hash, 1)
    console.log(`Added 150% collateralization vault with ID: `, tx.value)
  });
