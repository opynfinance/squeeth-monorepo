import { ethers, getNamedAccounts } from "hardhat"
import { expect } from "chai";
import { Contract } from "ethers";
import { Controller, Oracle, WETH9, WSqueeth } from "../../typechain";
import { isSimilar } from '../utils'
import { deployUniswapV3, deploySqueethCoreContracts, addLiquidity } from '../setup'

describe("Oracle Integration Test", function () {
  let oracle: Oracle;
  let dai: Contract
  let weth: WETH9
  let squeeth: WSqueeth
  let squeethPool: Contract
  let ethDaiPool: Contract
  let positionManager: Contract
  let controller: Controller
  let uniFactory: Contract
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
    positionManager = uniDeployments.positionManager
    uniFactory = uniDeployments.uniswapFactory
    controller = coreDeployments.controller

    squeethPool = coreDeployments.wsqueethEthPool
    ethDaiPool = coreDeployments.ethUsdPool

    // deploy oracle
    oracle = (await (await ethers.getContractFactory("Oracle")).deploy()) as Oracle;
  })

  describe('Get TWAP right after setup', async( )=> {
    describe("TWAP for squeeth/eth", async () => {
      this.beforeEach(async () => {
        await provider.send("evm_increaseTime", [10]) // go 10 seconds minutes
        await provider.send("evm_mine", [])
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

  describe('Adding liquidity mess up things', async() => {
    it('add liquidity', async() => {
      const { deployer } = await getNamedAccounts();
      
      await addLiquidity(3000, '0.001', '10', deployer, squeeth, weth, positionManager, controller, uniFactory)
    })
    it("fetch squeeth twap for last 10 mins", async () => {
      const price = await oracle.getTwaPrice(squeethPool.address, squeeth.address, weth.address, 605)
      expect(isSimilar(price.toString(), (startingPrice * 1e18).toString())).to.be.true
    })
  })
})
