import { YourContract } from "../typechain";

const { ethers } = require("hardhat");
const { expect } = require("chai");

describe("My Dapp", function () {
    let myContract: YourContract;

    describe("YourContract", function () {
        it("Should deploy YourContract", async function () {
            const MyContract = await ethers.getContractFactory("YourContract");

            myContract = await MyContract.deploy();
        });

        describe("setPurpose()", function () {
            it("Should be able to set a new purpose", async function () {
                const newPurpose = "Test Purpose";

                await myContract.setPurpose(newPurpose);
                expect(await myContract.purpose()).to.equal(newPurpose);
            });
        });
    });
});
