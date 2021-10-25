import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers";
import { ethers } from "hardhat"
import { expect } from "chai";
import { ShortPowerPerp} from "../../typechain";

describe("ShortPowerPerp", function () {
  let shortSqueethManager: ShortPowerPerp;
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
      const ShortPowerPerpContract = await ethers.getContractFactory("ShortPowerPerp");
      shortSqueethManager = (await ShortPowerPerpContract.deploy('Short Squeeth', 'sSQU')) as ShortPowerPerp;
    });
  });

  describe("Initialization", async () => {
    it("Should be able to init contract", async () => {
      await shortSqueethManager.init(controller.address);
      const controllerAddress = await shortSqueethManager.controller();
      expect(controllerAddress).to.be.eq(controller.address,"Controller address mismatch");
    });
  });

  describe("Access control", async () => {
    it("Should revert if mint called by an address other than controller ", async () => {
        await expect(shortSqueethManager.connect(random).mintNFT(address1.address)).to.be.revertedWith("Not controller")
    });
  });

});
