import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { ethers } from "hardhat"
import { expect } from "chai";
import { BigNumber, providers } from "ethers";
import { MockTimelock, Timelock } from "../../../typechain";

describe("Timelock", async function () {
  let owner: SignerWithAddress;
  let nonAdmin: SignerWithAddress;
  let newAdmin: SignerWithAddress;
  let provider: providers.JsonRpcProvider;
  let timelock: MockTimelock
  let blockTimeStamp;
  const signature = 'setDelay(uint256)';
  const abi = new ethers.utils.AbiCoder();

  const threeDays = 259200
  const data = abi.encode(['uint256'], [(threeDays + 600)]);
  const eta = 0;

  this.beforeAll("Prepare accounts", async () => {
    const accounts = await ethers.getSigners();
    [owner, nonAdmin, newAdmin] = accounts;
    provider = ethers.provider
  })

  this.beforeAll("Setup environment", async () => {
    const timelockContract = await ethers.getContractFactory("MockTimelock")
    timelock = (await timelockContract.deploy(owner.address, threeDays)) as MockTimelock
  })

  // this.beforeEach(async () => {
  //   blockTimeStamp = BigNumber.from(100)
  //   await provider.send("evm_freezeTime", [blockTimeStamp])
  //   eta = blockTimeStamp.add(threeDays).toNumber()
  // })

  describe("Deployment", async () => {
    it("Should revert if admin is 0", async () => {
      const timelockContract = await ethers.getContractFactory("MockTimelock")
      await expect(timelockContract.deploy(ethers.constants.AddressZero, threeDays)).to.be.revertedWith("Timelock::constructor: Address can't be 0")
    })

    it("Should revert if delay is less than minimum delay", async () => {
      const timelockContract = await ethers.getContractFactory("MockTimelock")
      await expect(timelockContract.deploy(owner.address, 24 * 60 * 60)).to.be.revertedWith("Timelock::constructor: Delay must exceed minimum delay.")
    })

    it("Should revert if delay is greater maximum delay", async () => {
      const timelockContract = await ethers.getContractFactory("MockTimelock")
      await expect(timelockContract.deploy(owner.address, 31 * 24 * 60 * 60)).to.be.revertedWith("Timelock::setDelay: Delay must not exceed maximum delay.")
    })

    it("Should deploy with correct params", async () => {
      const timelockContract = await ethers.getContractFactory("MockTimelock")
      timelock = (await timelockContract.deploy(owner.address, threeDays)) as MockTimelock
      const admin = await timelock.admin()
      const delay = await timelock.delay()

      expect(admin).to.be.equal(owner.address)
      expect(delay.eq(threeDays)).to.be.true
    })
  })

  describe("setDelay", async () => {
    it("Should revert if not called by timelock", async () => {
      await expect(timelock.setDelay(threeDays + 600)).to.be.revertedWith("Timelock::setDelay: Call must come from Timelock.")
    })
  })

  describe("setPendingAdmin", async () => {
    it("Should revert if not called by timelock", async () => {
      await expect(timelock.setPendingAdmin(newAdmin.address)).to.be.revertedWith("Timelock::setPendingAdmin: Call must come from Timelock.")
    })
  })

  describe("acceptAdmin", async () => {
    afterEach(async () => {
      await timelock.mockSetAdmin(owner.address)
    })

    it("Should revert if not called by pending admin", async () => {
      await timelock.mockSetPendingAdmin(newAdmin.address)
      await expect(timelock.connect(owner).acceptAdmin()).to.be.revertedWith("Timelock::acceptAdmin: Call must come from pendingAdmin.")
    })

    it("Should be accepted if called by pending admin", async () => {
      await timelock.mockSetPendingAdmin(newAdmin.address)
      await timelock.connect(newAdmin).acceptAdmin()
      const admin = await timelock.admin()
      expect(admin).to.be.equal(newAdmin.address)
    })
  })

  describe("queueTransaction", () => {
    it("Should revert if sender is not admin", async () => {
      await expect(timelock.connect(nonAdmin).queueTransaction(timelock.address, 0, signature, data, threeDays + 600)).to.be.revertedWith('Timelock::queueTransaction: Call must come from admin.')
    })

    it("Should revert if eta is smaller than the delay", async () => {
      await expect(timelock.connect(owner).queueTransaction(timelock.address, 0, signature, data, threeDays + 600)).to.be.revertedWith('Timelock::queueTransaction: Estimated execution block must satisfy delay.')
    })

    // Need to be implemented
    it("Should queue properly", async () => {
      const blockNumber = await provider.getBlockNumber()
      const block = await provider.getBlock(blockNumber)
    })
  })
})