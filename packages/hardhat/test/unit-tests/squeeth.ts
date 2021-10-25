import { ethers } from "hardhat"
import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers";
import { WPowerPerp } from "../../typechain";

describe("WPowerPerp", function () {
  let wsqueeth: WPowerPerp;
  let controller: SignerWithAddress
  let random: SignerWithAddress
  
  this.beforeAll("Deploy uniswap protocol & setup uniswap pool", async() => {
    wsqueeth = (await (await ethers.getContractFactory("WPowerPerp")).deploy('Wrapped Squeeth', 'WSQU')) as WPowerPerp;

    const accounts = await ethers.getSigners();
    const [_controller, _random] = accounts;
    controller = _controller
    random = _random
  })

  describe("Initialization", async () => {
    it("should return initial with controller address", async () => {
      await wsqueeth.init(controller.address)
      expect(await wsqueeth.controller()).to.be.eq(controller.address)
    })
    it('should revert when trying to init again', async() => {
      await expect(wsqueeth.init(controller.address)).to.be.revertedWith('Initializable: contract is already initialized')
    })
    it("should have decimals 18", async () => {
      expect(await wsqueeth.decimals()).to.be.eq(18)
    })
  })
  describe("Minting and burning", async () => {
    it("should mint with controller", async () => {
    const mintAmount = 10
      await wsqueeth.connect(controller).mint(random.address, mintAmount)
      expect((await wsqueeth.balanceOf(random.address)).eq(mintAmount)).to.be.true
    })
    it("should revert when minted from non-controller", async () => {
      const mintAmount = 10
      await expect(wsqueeth.connect(random).mint(random.address, mintAmount)).to.be.revertedWith('Not controller');
    })
    it("should revert when burned from non-controller", async () => {
        const burnAmount = 10
        await expect(wsqueeth.connect(random).burn(random.address, burnAmount)).to.be.revertedWith('Not controller');
    })
      
    it("should burn from controler", async () => {
      const burnAmount = 10
      await wsqueeth.connect(controller).burn(random.address, burnAmount);
      expect((await wsqueeth.balanceOf(random.address)).eq(0)).to.be.true
    })
  }) 
})
