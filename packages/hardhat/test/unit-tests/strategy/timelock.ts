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
  let signature = 'setDelay(uint256)';
  const abi = new ethers.utils.AbiCoder();

  const threeDays = 259200
  const newDelay = threeDays + 600
  let data = abi.encode(['uint256'], [newDelay]);

  this.beforeAll("Prepare accounts", async () => {
    const accounts = await ethers.getSigners();
    [owner, nonAdmin, newAdmin] = accounts;
    provider = ethers.provider
  })

  this.beforeEach("Setup environment", async () => {
    const timelockContract = await ethers.getContractFactory("MockTimelock")
    timelock = (await timelockContract.deploy(owner.address, threeDays)) as MockTimelock
  })

  describe("Deployment", async () => {
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
      await expect(timelock.setDelay(newDelay)).to.be.revertedWith("Timelock::setDelay: Call must come from Timelock.")
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
      await expect(timelock.connect(nonAdmin).queueTransaction(timelock.address, 0, signature, data, newDelay)).to.be.revertedWith('Timelock::queueTransaction: Call must come from admin.')
    })

    it("Should revert if eta is smaller than the delay", async () => {
      await expect(timelock.connect(owner).queueTransaction(timelock.address, 0, signature, data, newDelay)).to.be.revertedWith('Timelock::queueTransaction: Estimated execution block must satisfy delay.')
    })

    it("Should queue properly", async () => {
      const currentBlockNumber = await provider.getBlockNumber()
      const currentBlock = await provider.getBlock(currentBlockNumber)
      const eta = currentBlock.timestamp + newDelay
      const txHash = ethers.utils.keccak256(abi.encode(['address', 'uint256', 'string', 'bytes', 'uint256'],
        [timelock.address, '0', signature, data, eta.toString()]))

      expect(await timelock.queuedTransactions(txHash)).to.be.false

      await expect(timelock.connect(owner).queueTransaction(timelock.address, 0, signature, data, eta)).to.emit(timelock, "QueueTransaction")

      expect(await timelock.queuedTransactions(txHash)).to.be.true
    })
  })

  describe("cancelTransaction", () => {
    let txHash = ''
    let eta = 0

    beforeEach(async () => {
      const currentBlockNumber = await provider.getBlockNumber()
      const currentBlock = await provider.getBlock(currentBlockNumber)
      eta = currentBlock.timestamp + newDelay
      txHash = ethers.utils.keccak256(abi.encode(['address', 'uint256', 'string', 'bytes', 'uint256'],
        [timelock.address, '0', signature, data, eta.toString()]))
      await timelock.connect(owner).queueTransaction(timelock.address, 0, signature, data, eta)
    });

    it('Should revert if sender is not admin', async () => {
      await expect(timelock.connect(nonAdmin).cancelTransaction(timelock.address, 0, signature, data, eta)).to.be.revertedWith('Timelock::cancelTransaction: Call must come from admin.')
    });

    it('Should mark the tx as canceled if called by admin', async () => {
      expect(await timelock.queuedTransactions(txHash)).to.be.true

      await expect(timelock.connect(owner).cancelTransaction(timelock.address, 0, signature, data, eta)).to.emit(timelock, "CancelTransaction")

      expect(await timelock.queuedTransactions(txHash)).to.be.false
    });
  })

  describe("executeTransaction (setDelay)", () => {
    let txHash = ''
    let eta = 0
    let currentBlockNumber = 0
    let currentBlockTimestamp = 0

    beforeEach(async () => {
      currentBlockNumber = await provider.getBlockNumber()
      const currentBlock = await provider.getBlock(currentBlockNumber)
      eta = currentBlock.timestamp + threeDays + 1
      currentBlockTimestamp = currentBlock.timestamp
      txHash = ethers.utils.keccak256(abi.encode(['address', 'uint256', 'string', 'bytes', 'uint256'],
        [timelock.address, '0', signature, data, eta.toString()]))
      await timelock.connect(owner).queueTransaction(timelock.address, 0, signature, data, eta)
    });

    it('Should revert if sender is not admin', async () => {
      await expect(timelock.connect(nonAdmin).executeTransaction(timelock.address, 0, signature, data, eta)).to.be.revertedWith('Timelock::executeTransaction: Call must come from admin.')
    });

    it('Should revert if tx is not queued', async () => {
      await expect(timelock.connect(owner).executeTransaction(timelock.address, 0, signature, data, eta + 1)).to.be.revertedWith("Timelock::executeTransaction: Transaction hasn't been queued.")
    });

    it('Should revert if called before timelock', async () => {
      await expect(timelock.connect(owner).executeTransaction(timelock.address, 0, signature, data, eta)).to.be.revertedWith("Timelock::executeTransaction: Transaction hasn't surpassed time lock.")
    });

    it('Should revert if the execution is reverted', async () => {
      const wrongData = abi.encode(['uint256'], [1]);
      txHash = ethers.utils.keccak256(abi.encode(['address', 'uint256', 'string', 'bytes', 'uint256'],
        [timelock.address, '0', signature, wrongData, eta + 500]))

      await timelock.connect(owner).queueTransaction(timelock.address, 0, signature, wrongData, eta + 500)

      await provider.send("evm_setNextBlockTimestamp", [eta + 700])

      await expect(timelock.connect(owner).executeTransaction(timelock.address, 0, signature, wrongData, eta + 500)).to.be.revertedWith("Timelock::executeTransaction: Transaction execution reverted.")
    });

    it('Should execute the tx if called after eta', async () => {
      await provider.send("evm_setNextBlockTimestamp", [currentBlockTimestamp + threeDays + 2])
      expect((await timelock.delay()).eq(threeDays)).to.be.true
      expect(await timelock.queuedTransactions(txHash)).to.be.true

      await expect(timelock.connect(owner).executeTransaction(timelock.address, 0, signature, data, eta)).to.emit(timelock, "ExecuteTransaction")

      expect((await timelock.delay()).eq(newDelay)).to.be.true
      expect(await timelock.queuedTransactions(txHash)).to.be.false

    });
  })

  describe("executeTransaction (setPendingAdmin)", () => {
    let txHash = ''
    let eta = 0
    let currentBlockNumber = 0
    let currentBlockTimestamp = 0

    beforeEach(async () => {
      currentBlockNumber = await provider.getBlockNumber()
      const currentBlock = await provider.getBlock(currentBlockNumber)
      eta = currentBlock.timestamp + threeDays + 1
      currentBlockTimestamp = currentBlock.timestamp

      signature = 'setPendingAdmin(address)';
      data = abi.encode(['address'], [newAdmin.address]);

      txHash = ethers.utils.keccak256(abi.encode(['address', 'uint256', 'string', 'bytes', 'uint256'],
        [timelock.address, '0', signature, data, eta.toString()]))
      await timelock.connect(owner).queueTransaction(timelock.address, 0, signature, data, eta)
    });

    it('Should revert if sender is not admin', async () => {
      await expect(timelock.connect(nonAdmin).executeTransaction(timelock.address, 0, signature, data, eta)).to.be.revertedWith('Timelock::executeTransaction: Call must come from admin.')
    });

    it('Should revert if tx is not queued', async () => {
      await expect(timelock.connect(owner).executeTransaction(timelock.address, 0, signature, data, eta + 1)).to.be.revertedWith("Timelock::executeTransaction: Transaction hasn't been queued.")
    });

    it('Should revert if called before timelock', async () => {
      await expect(timelock.connect(owner).executeTransaction(timelock.address, 0, signature, data, eta)).to.be.revertedWith("Timelock::executeTransaction: Transaction hasn't surpassed time lock.")
    });

    it('Should execute the tx if called after eta', async () => {
      await provider.send("evm_setNextBlockTimestamp", [currentBlockTimestamp + threeDays + 2])
      expect(await timelock.queuedTransactions(txHash)).to.be.true
      expect((await timelock.pendingAdmin())).to.be.equal(ethers.constants.AddressZero)

      await expect(timelock.connect(owner).executeTransaction(timelock.address, 0, signature, data, eta)).to.emit(timelock, "NewPendingAdmin")

      expect(await timelock.queuedTransactions(txHash)).to.be.false
      expect((await timelock.pendingAdmin())).to.be.equal(newAdmin.address)
    });
  })
})