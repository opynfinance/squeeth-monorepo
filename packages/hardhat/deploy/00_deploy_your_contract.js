// deploy/00_deploy_your_contract.js

const { ethers } = require("hardhat");

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  await deploy("Controller", {
    from: deployer,
    log: true,
  });

  await deploy("VaultNFTManager", {
    from: deployer,
    // args: [ "Hello", ethers.utils.parseEther("1.5") ],
    log: true,
  });

  await deploy("WSqueeth", {
    from: deployer,
    // args: [ "Hello", ethers.utils.parseEther("1.5") ],
    log: true,
  });

  const controller = await ethers.getContract("Controller", deployer);
  const vaultNft = await ethers.getContract("VaultNFTManager", deployer);
  const squeeth = await ethers.getContract("WSqueeth", deployer);

  await controller.init(vaultNft.address, squeeth.address, { from: deployer });
  console.log(`Controller init done`);

  await squeeth.init(controller.address, { from: deployer });
  console.log(`Squeeth init done`);

  await vaultNft.init(controller.address, { from: deployer });
  console.log(`NFT init done`);

  /*
    // Getting a previously deployed contract
    const YourContract = await ethers.getContract("YourContract", deployer);
    await YourContract.setPurpose("Hello");

    //const yourContract = await ethers.getContractAt('YourContract', "0xaAC799eC2d00C013f1F11c37E654e59B0429DF6A") //<-- if you want to instantiate a version of a contract at a specific address!
  */
};
module.exports.tags = ["YourContract"];
