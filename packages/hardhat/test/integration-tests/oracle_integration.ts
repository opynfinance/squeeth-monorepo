import { ethers } from "hardhat"
import { expect } from "chai";
import { Contract } from "ethers";
import { Oracle } from "../../typechain";
import { isSimilar } from '../utils'
import { deployUniswapV3, deploySqueethCoreContracts } from '../setup'

describe("Oracle Integration Test", function () {
  let oracle: Oracle;
  let dai: Contract
  let weth: Contract
  let squeeth: Contract
  let squeethPool: Contract
  let ethDaiPool: Contract
  const startingPrice = 3000
  const provider = ethers.provider

  this.beforeAll("Deploy uniswap protocol & setup uniswap pool", async() => {
  
    const uniDeployments = await deployUniswapV3()

    // this will not deploy a new pool, only reuse old onces
    const coreDeployments = await deploySqueethCoreContracts(
      uniDeployments.weth, 
      uniDeployments.positionManager, 
      uniDeployments.uniswapFactory,
      startingPrice,
      startingPrice
    )

    weth = uniDeployments.weth
    dai = coreDeployments.dai
    squeeth = coreDeployments.squeeth
    

    squeethPool = coreDeployments.wsqueethEthPool
    ethDaiPool = coreDeployments.ethUsdPool

    // deploy oracle
    oracle = (await (await ethers.getContractFactory("Oracle")).deploy()) as Oracle;
  })

  describe('Get TWAP right after setup', async( )=> {
    describe("TWAP for squeeth/eth", async () => {
      this.beforeEach(async () => {
        // increase storage slot to store observations
        await squeethPool.increaseObservationCardinalityNext(512);
      })
  
      it("fetch initial price", async () => {
        const price = await oracle.getTwaPrice(squeethPool.address, squeeth.address, weth.address, 1)
        // console.log(price.div().div(startingPrice))
        expect(isSimilar(price.toString(), (startingPrice * 1e18).toString())).to.be.true
      })
      it("fetch price twap for last 10 seconds", async () => {
        const price = await oracle.getTwaPrice(squeethPool.address, squeeth.address, weth.address, 10)
        expect(isSimilar(price.toString(), (startingPrice * 1e18).toString())).to.be.true
      })
      it("should revert while requesting twap with price too old", async () => {
        await expect(
          oracle.getTwaPrice(squeethPool.address, squeeth.address, weth.address, 600)
        ).to.be.revertedWith("OLD");
      })  
    })
  
    describe("TWAP for eth/dai", async () => {
      this.beforeEach(async () => {
        // increase storage slot to store observations
        await ethDaiPool.increaseObservationCardinalityNext(512);
      })
  
      it("fetch initial price", async () => {
        const price = await oracle.getTwaPrice(ethDaiPool.address, weth.address, dai.address, 1)
        expect(isSimilar(price.toString(), (startingPrice * 1e18).toString())).to.be.true
      })
      it("fetch price twap for last 10 seconds", async () => {
        const price = await oracle.getTwaPrice(ethDaiPool.address, weth.address, dai.address, 10)
        expect(isSimilar(price.toString(), (startingPrice * 1e18).toString())).to.be.true
      })  
      it("should revert while requesting twap with price too old", async () => {
        await expect(
          oracle.getTwaPrice(ethDaiPool.address, weth.address, dai.address, 600)
        ).to.be.revertedWith("OLD");
      })  
    })
  })

  describe('Get TWAP right after 10 mins', async( )=> {
    it('go 10 mins', async() => {
      await provider.send("evm_increaseTime", [600]) // go 10 minutes
    })
    it("fetch squeeth twap for last 10 mins", async () => {
      const price = await oracle.getTwaPrice(squeethPool.address, squeeth.address, weth.address, 600)
      expect(isSimilar(price.toString(), (startingPrice * 1e18).toString())).to.be.true
    })  
    it("fetch eth twap for last 10 mins", async () => {
      const price = await oracle.getTwaPrice(ethDaiPool.address, weth.address, dai.address, 600)
      expect(isSimilar(price.toString(), (startingPrice * 1e18).toString())).to.be.true
    })  
  })
})
