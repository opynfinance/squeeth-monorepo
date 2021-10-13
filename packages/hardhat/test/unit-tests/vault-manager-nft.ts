import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers";
import { ethers } from "hardhat"
import { expect } from "chai";
import { VaultNFTManager} from "../../typechain";

describe("VaultNFTManager", function () {
  let vaultNftManager: VaultNFTManager;
  let random: SignerWithAddress
  let controller: SignerWithAddress
  let address1: SignerWithAddress

  this.beforeAll("Prepare accounts", async() => {
    const accounts = await ethers.getSigners();
    const [_address1, _controller, _random] = accounts;
    address1 = _address1
    controller = _controller
    random = _random
  });

  describe("Deployment", async () => {
    it("Deployment", async function () {
      const VaultNFTManagerContract = await ethers.getContractFactory("VaultNFTManager");
      vaultNftManager = (await VaultNFTManagerContract.deploy()) as VaultNFTManager;
    });
  });

  describe("Initialization", async () => {
    it("Should be able to init contract", async () => {
      await vaultNftManager.init(controller.address);
      const controllerAddress = await vaultNftManager.controller();
      expect(controllerAddress).to.be.eq(controller.address,"Controller address mismatch");
    });
  });

  describe("Access control", async () => {
    it("Should revert if mint called by an address other than controller ", async () => {
        await expect(vaultNftManager.connect(random).mintNFT(address1.address)).to.be.revertedWith("not controller")
    });
  });

});
