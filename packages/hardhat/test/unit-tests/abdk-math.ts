import { ethers } from "hardhat"
import { expect } from "chai";
import { BigNumber } from "ethers";
import { ABDKTester, ABDKMath64x64 } from "../../typechain";
import { isSimilar } from "../utils";



describe("ABDKMath64x64 testing", function () {

  let abdkTester: ABDKTester
  const two = BigNumber.from(2)


  before('deploy contract', async() => {
    const abtkContract = await ethers.getContractFactory("ABDKMath64x64")
    const ABDKLibrary = (await abtkContract.deploy()) as ABDKMath64x64;
  
    const abdkTesterContract = await ethers.getContractFactory("ABDKTester", {libraries: {ABDKMath64x64: ABDKLibrary.address}});
    abdkTester = (await abdkTesterContract.deploy()) as ABDKTester;

  })

  describe("ABDK reverts and underflow results as expected", async () => {
    
    it("mul should revert if x * y is above MAX_64x64 due to overflow", async () => {
        // max = 2^127 - 1
        await expect(abdkTester.testMul(two.pow(96),two.pow(96))).to.be.revertedWith("MUL-OVUF")
    })

    it("mul should revert if x * y below MIN_64x64 from underflow", async () => {
        // min = -2^127
        await expect(abdkTester.testNegMul(two.pow(96),two.pow(96))).to.be.revertedWith("MUL-OVUF")
    })
    
    it("mulu should revert if x<0", async () => {
        const x = two.mul(-1)
        await expect(abdkTester.testMulu(x,two)).to.be.revertedWith("MULU-X0")
    })

    // it("mulu should revert if overflows uint128", async () => {
    //     const x = two.pow(65)
    //     const y = two.pow(256).sub(1)
    //     await expect(abdkTester.testMulu(x,y)).to.be.revertedWith("MULU-OF2")
    // })

    it("mulu should revert if overflows int128", async () => {
        const x = two.pow(100)
        const y = two.pow(240)
        await expect(abdkTester.testMulu(x,y)).to.be.revertedWith("MULU-OF1")
    })

    it("divu should revert if y = 0", async () => {
        await expect(abdkTester.testDivu(1,0)).to.be.revertedWith("DIVU-INF")
    })

    it("divu should revert when result x>2^128 and result > 2^128", async () => {
        const x = two.pow(255)
        const y = two.pow(1)

        await expect(abdkTester.testDivu(x,y)).to.be.revertedWith("DIVUU-OF1")
    })

    it("divu should revert when calculating division for x=2^127 with y=2^64, reverting when casting uint128 to int128 above MAX_64x64", async () => {
        const x = two.pow(127)
        const y = two.pow(64)

        await expect(abdkTester.testDivu(x,y)).to.be.revertedWith("DIVU-OF")
    })

    it("divu should revert when calculating division for x=2^127 with y=2^64, reverting when overflowing uint128", async () => {
        const x = two.pow(128)
        const y = two.pow(64)

        await expect(abdkTester.testDivu(x,y)).to.be.revertedWith("DIVUU-OF2")
    })

    it("log_2 should revert when calling with a negative x", async () => {
        await expect(abdkTester.testLog_2(-1)).to.be.revertedWith("LOG_2-X0")
    })

    it("exp_2 should revert when calling with larger than 2^70", async () => {
        const x = two.pow(70).add(1)
        
        await expect(abdkTester.testExp_2(x)).to.be.revertedWith("EXP_2-OF")
    })

    it("exp_2 should return 0 when calling with less than -2^70", async () => {
        const x = two.pow(70).add(1)
        
        const result = await abdkTester.testExp_2(x.mul(-1))
        expect(result.eq(0)).to.be.true
    })

  })

  describe("ABDK calculates as expected", async () => {    
    it("mulu should return 0 if y = 0", async () => {
        const result = await abdkTester.testMulu(1,0)
        expect(result.eq(0)).to.be.true
    })

    it("mulu should correctly calculate multiplication for 1.1 fixed and uint256 1e18, returing 1.1e18", async () => {
        const x64 = two.pow(64)
        const x = x64.mul(11).div(10) // 1.1 in fixed point
        const y = ethers.utils.parseUnits("1")

        const expectedResult = y.mul(11).div(10)

        const result = await abdkTester.testMulu(x,y)

        expect(isSimilar(result.toString(),expectedResult.toString())).to.be.true
    })

    it("divu should correctly calculate division for x=2^75 with y=2^50, returing 2^25 * 2^64", async () => {
        const x = two.pow(75)
        const y = two.pow(50)
        const x64 = two.pow(64)
        const expectedResult = x.mul(x64).div(y)

        const result = await abdkTester.testDivu(x,y)
        expect(result.eq(expectedResult)).to.be.true
    })

    it("divu should correctly calculate division for x=2^129 with y=2^128, returing 2^1 * 2^64", async () => {
        const x = two.pow(129)
        const y = two.pow(128)
        const x64 = two.pow(64)
        const expectedResult = x.mul(x64).div(y)

        const result = await abdkTester.testDivu(x,y)
        expect(result.eq(expectedResult)).to.be.true
    })

    it("divu should correctly calculate division for x=2^127-1 with y=2^64", async () => {
        const x = two.pow(127).sub(1)
        const y = two.pow(64)
        const x64 = two.pow(64)
        const expectedResult = x.mul(x64).div(y)

        const result = await abdkTester.testDivu(x,y)
        expect(result.eq(expectedResult)).to.be.true
    })

    it("divu should correctly calculate division for x=2^255 with y=2^230", async () => {
        const x = two.pow(255)
        const y = two.pow(230)
        const x64 = two.pow(64)
        const expectedResult = x.mul(x64).div(y)

        const result = await abdkTester.testDivu(x,y)
        expect(result.eq(expectedResult)).to.be.true
    })

    it("divu should correctly calculate division for x=2^255 with y=2^5", async () => {
        const x = two.pow(194)
        const y = two.pow(135)
        const x64 = two.pow(64)
        const expectedResult = x.mul(x64).div(y)

        const result = await abdkTester.testDivu(x,y)
        expect(result.eq(expectedResult)).to.be.true
    })

    it("divu should correctly calculate log2 for x=5*2^5", async () => {
        const x = two.pow(70).mul(5)
        const x64 = two.pow(64)
        const xInHuman = x.div(x64)
        const expectedResult = (Math.log2(xInHuman.toNumber())).toString()
        const expectedResultIn1e18 = ethers.utils.parseUnits(expectedResult)
        const expectedResulInX64 = expectedResultIn1e18.mul(two.pow(64)).div(ethers.utils.parseUnits("1"))

        const result = await abdkTester.testLog_2(x)        
        
        expect(isSimilar(result.toString(),expectedResulInX64.toString())).to.be.true
    })

  })
})