import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers";
import { ethers } from "hardhat"
import { expect } from "chai";
import { constants } from "ethers";
import { ShortPowerPerp} from "../../typechain";

describe("ShortPowerPerp", function () {
  let shortSqueeth: ShortPowerPerp;
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
      shortSqueeth = (await ShortPowerPerpContract.deploy('Short Squeeth', 'sSQU')) as ShortPowerPerp;
    });
  });

  describe("Initialization", async () => {
    it("should revert when calling init with invalid address", async () => {
      await expect(shortSqueeth.init(constants.AddressZero)).to.be.revertedWith('Invalid controller address')
    })
    it("Should be able to init contract", async () => {
      await shortSqueeth.init(controller.address);
      const controllerAddress = await shortSqueeth.controller();
      expect(controllerAddress).to.be.eq(controller.address,"Controller address mismatch");
    });
  });

  describe("Access control", async () => {
    it("Should revert if mint called by an address other than controller ", async () => {
        await expect(shortSqueeth.connect(random).mintNFT(address1.address)).to.be.revertedWith("Not controller")
    });
    it('Should mint nft with expected id if mint is called by controller', async() => {
      const expectedId = await shortSqueeth.nextId()
      await shortSqueeth.connect(controller).mintNFT(random.address)
      expect(await shortSqueeth.ownerOf(expectedId) === random.address).to.be.true
    })
  });

});
