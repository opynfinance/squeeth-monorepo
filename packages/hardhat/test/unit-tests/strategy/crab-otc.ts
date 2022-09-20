import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { ethers } from "hardhat"
import { expect } from "chai";
import { BigNumber, providers } from "ethers";
import { Address } from "ethereumjs-util";
import { MockCrab, CrabMigration, MockErc20, WETH9, MockEulerDToken, MockEuler} from "../../../typechain";
import { isSimilar, wmul, wdiv, one, oracleScaleFactor } from "../../utils"

describe("Crab OTC", function () {
 
    let crabStrategyV2: MockCrab;

    this.beforeAll("Setup Mock Crabs", async () => {
        const CrabContract = await ethers.getContractFactory("MockCrab");
        crabStrategyV2 = (await CrabContract.deploy("CrabV2", "CrabV2", 18)) as MockCrab;
    })

    describe("Deployment tests", async() => { 
        it("should revert if wrong address is given", async () => { 
          const CrabOTCContract = await ethers.getContractFactory("CrabOTC");
          await expect(CrabOTCContract.deploy(ethers.constants.AddressZero)).to.be.revertedWith('Invalid crab address')
        })
    })
})