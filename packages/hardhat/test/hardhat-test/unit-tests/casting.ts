import { ethers } from "hardhat"
import { expect } from "chai";
import { CastingTester } from "../../../typechain";

describe("Casting Library tests", function () {

  let tester: CastingTester

  before('deploy contract', async() => {
    const CastingTesterFactory = await ethers.getContractFactory("CastingTester");
    tester = (await CastingTesterFactory.deploy()) as CastingTester;
  })

  describe("Math checks for overflow", async () => {
    it("should revert if casting oversize uint256 to uint128 overflows", async () => {
      await expect(tester.testToUint128(ethers.constants.MaxUint256)).to.be.revertedWith("OF128")
    })

    it("should revert if casting oversize uint256 to uint96 overflows", async () => {
      await expect(tester.testToUint96(ethers.constants.MaxUint256)).to.be.revertedWith("OF96")
    })

    it("should revert if casting oversize uint256 to uint32 overflows", async () => {
      await expect(tester.testToUint32(ethers.constants.MaxUint256)).to.be.revertedWith("OF32")
    })
  })
})