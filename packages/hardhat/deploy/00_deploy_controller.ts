import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, ethers } = hre;
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  console.log(`Deployer: ${deployer}`)

  await deploy("Oracle", {
    from: deployer,
    log: true,
  });

  await deploy("Controller", {
    from: deployer,
    log: true,
  });

  await deploy("VaultNFTManager", {
    from: deployer,
    log: true,
  });

  await deploy("WSqueeth", {
    from: deployer,
    log: true,
  });

  const oracle = await ethers.getContract("Oracle", deployer);
  const controller = await ethers.getContract("Controller", deployer);
  const vaultNft = await ethers.getContract("VaultNFTManager", deployer);
  const squeeth = await ethers.getContract("WSqueeth", deployer);

  await controller.init(oracle.address, vaultNft.address, squeeth.address, { from: deployer });
  console.log(`Controller init done 🥝`);

  await squeeth.init(controller.address, { from: deployer });
  console.log(`Squeeth init done 🍋`);

  await vaultNft.init(controller.address, { from: deployer });
  console.log(`VaultNFTManager init done 🥭`);
}

export default func;