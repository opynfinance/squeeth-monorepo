import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers";
import { ethers } from "hardhat"
import { expect } from "chai";
import { BigNumber, providers } from "ethers";
import { Controller, MockWSqueeth, MockVaultNFTManager, MockOracle, MockUniswapV3Pool, MockErc20, MockUniPositionManager } from "../../typechain";
import { getNow, isSimilar, one, oracleScaleFactor } from "../utils";

const squeethETHPrice = BigNumber.from('3030').mul(one).div(oracleScaleFactor)

const ethUSDPrice = BigNumber.from('3000').mul(one)

const scaledEthPrice = ethUSDPrice.div(oracleScaleFactor)

const mintAmount = BigNumber.from('100').mul(one)
const collateralAmount = BigNumber.from('50').mul(one)

const secondsInDay = 86400

describe("Controller Funding tests", function () {
  let squeeth: MockWSqueeth;
  let shortNFT: MockVaultNFTManager;
  let controller: Controller;
  let squeethEthPool: MockUniswapV3Pool;
  let ethUSDPool: MockUniswapV3Pool;
  let uniPositionManager: MockUniPositionManager
  let oracle: MockOracle;
  let weth: MockErc20;
  let usdc: MockErc20;
  let provider: providers.JsonRpcProvider;
  let seller1: SignerWithAddress
  let random: SignerWithAddress

  this.beforeAll("Prepare accounts", async() => {
    const accounts = await ethers.getSigners();
    const [_seller1, _random] = accounts;
    seller1 = _seller1
    random = _random
    provider = ethers.provider

    await provider.send("evm_setAutomine", [true]);
  })

  this.beforeAll("Setup environment", async () => {
    const MockSQUContract = await ethers.getContractFactory("MockWSqueeth");
    squeeth = (await MockSQUContract.deploy()) as MockWSqueeth;

    const NFTContract = await ethers.getContractFactory("MockVaultNFTManager");
    shortNFT = (await NFTContract.deploy()) as MockVaultNFTManager;

    const OracleContract = await ethers.getContractFactory("MockOracle");
    oracle = (await OracleContract.deploy()) as MockOracle;

    const MockErc20Contract = await ethers.getContractFactory("MockErc20");
    weth = (await MockErc20Contract.deploy("WETH", "WETH", 18)) as MockErc20;
    usdc = (await MockErc20Contract.deploy("USDC", "USDC", 6)) as MockErc20;

    const MockUniswapV3PoolContract = await ethers.getContractFactory("MockUniswapV3Pool");
    squeethEthPool = (await MockUniswapV3PoolContract.deploy()) as MockUniswapV3Pool;
    ethUSDPool = (await MockUniswapV3PoolContract.deploy()) as MockUniswapV3Pool;

    const MockPositionManager = await ethers.getContractFactory("MockUniPositionManager");
    uniPositionManager = (await MockPositionManager.deploy()) as MockUniPositionManager;

    await squeethEthPool.setPoolTokens(weth.address, squeeth.address);
    await ethUSDPool.setPoolTokens(weth.address, usdc.address);


    await oracle.connect(random).setPrice(squeethEthPool.address , squeethETHPrice) // eth per 1 squeeth
    await oracle.connect(random).setPrice(ethUSDPool.address , ethUSDPrice)  // usdc per 1 eth
  });

  describe("Deployment", async () => {
    it("Deployment", async function () {
      const ControllerContract = await ethers.getContractFactory("Controller");
      controller = (await ControllerContract.deploy()) as Controller;
      await controller.init(oracle.address, shortNFT.address, squeeth.address, weth.address, usdc.address, ethUSDPool.address, squeethEthPool.address, uniPositionManager.address);
    });
  });

  describe('Funding actions', async() => {
    describe('Normalization Factor tests', () => {
      let mark: BigNumber
      let index: BigNumber
  
      before(async () => {  
        await controller.applyFunding()
        mark = await controller.getDenormalizedMark(1)
        index = await controller.getIndex(1)
      })
  
      it('should apply the correct normalization factor for funding', async() => {
        const now = await getNow(provider)
        const normalizationFactorBefore = await controller.normalizationFactor()
        const secondsElapsed = 10800 // 3hrs
        const multiplier = getNormFactorMultiplier(mark, index, secondsElapsed)
        const expectedNormalizationFactor = normalizationFactorBefore.mul(multiplier).div(one)

        await provider.send("evm_setNextBlockTimestamp", [now + secondsElapsed]) 

        await controller.connect(seller1).applyFunding()       
        const normalizationFactorAfter = await controller.normalizationFactor()
        // use isSimilar because sometimes the expectedNormFactor will be a little bit off, 
        // maybe caused by inconsistent process time by hardhat
        expect(isSimilar(expectedNormalizationFactor.toString(), normalizationFactorAfter.toString(), 14)).to.be.true
      })
      it('normalization factor changes should be bounded above', async() => {

        // Get norm factor
        const normalizationFactorBefore = await controller.normalizationFactor()
        const now = await getNow(provider)

        // Set very low mark price
        const squeethETHPriceNew = ethers.utils.parseUnits('2000').div(oracleScaleFactor)
        const ethUSDPriceNew = ethers.utils.parseUnits('3000')

        // Set prices
        await oracle.connect(random).setPrice(squeethEthPool.address , squeethETHPriceNew) // eth per 1 squeeth
        await oracle.connect(random).setPrice(ethUSDPool.address, ethUSDPriceNew)  // usdc per 1 eth

        // Get new mark and index
        mark = await controller.getDenormalizedMark(1)
        index = await controller.getIndex(1)

        // + 3 hours 
        const secondsElapsed = 10800

        await provider.send("evm_setNextBlockTimestamp", [now + secondsElapsed]) // (3/24) * 60*60 = 3600s = 3 hour
        await controller.connect(seller1).applyFunding()   
        
        // Get new new norm factor
        const normalizationFactorAfter = await controller.normalizationFactor()

        // Mark should be bounded 4/5, 5/4
        const scaledEthUSDPrice = ethUSDPriceNew.div(oracleScaleFactor)
        const expectedFloorMark = scaledEthUSDPrice.mul(scaledEthUSDPrice).mul(4).div(5).div(one)

        // Expected bounded norm factor
        const multiplier = getNormFactorMultiplier(expectedFloorMark, index, secondsElapsed)
        const expectedNormalizationFactor = normalizationFactorBefore.mul(multiplier).div(one)

        // use isSimilar because sometimes the expectedNormFactor will be a little bit off, 
        // maybe caused by inconsistent process time by hardhat
        expect(isSimilar(expectedNormalizationFactor.toString(), normalizationFactorAfter.toString(), 15)).to.be.true

        // set prices back
        await oracle.connect(random).setPrice(squeethEthPool.address , squeethETHPrice) // eth per 1 squeeth
        await oracle.connect(random).setPrice(ethUSDPool.address , ethUSDPrice)  // usdc per 1 eth

      })
      it('normalization factor changes should be bounded below', async() => {

        // Get norm factor
        const normalizationFactorBefore = await controller.normalizationFactor()
        const now = await getNow(provider)

        // Set very high mark price
        const squeethETHPriceNew = ethers.utils.parseUnits('6000').div(oracleScaleFactor)
        const ethUSDPriceNew = ethers.utils.parseUnits('3000')

        // Set prices
        await oracle.connect(random).setPrice(squeethEthPool.address , squeethETHPriceNew) // eth per 1 squeeth
        await oracle.connect(random).setPrice(ethUSDPool.address , ethUSDPriceNew)  // usdc per 1 eth

        // Get new mark and index
        mark = await controller.getDenormalizedMark(1)
        index = await controller.getIndex(1)  

        // + 3 hours
        const secondsElapsed = 10800 // 3hrs

        await provider.send("evm_setNextBlockTimestamp", [now + secondsElapsed - 2]) 
        await controller.connect(seller1).applyFunding()   
        
        // Get new new norm factor
        const normalizationFactorAfter = await controller.normalizationFactor()

        // Mark should be bounded 4/5, 5/4
        const scaledEthUSDPrice = ethUSDPriceNew.div(oracleScaleFactor)
        const expectedCeilMark = scaledEthUSDPrice.mul(scaledEthUSDPrice).mul(5).div(4).div(one)

        // Expected bounded norm factor
        const multiplier = getNormFactorMultiplier(expectedCeilMark, index, secondsElapsed)
        const expectedNormalizationFactor = normalizationFactorBefore.mul(multiplier).div(one)

        // use isSimilar because sometimes the expectedNormFactor will be a little bit off, 
        // maybe caused by inconsistent process time by hardhat
        expect(isSimilar(expectedNormalizationFactor.toString(), normalizationFactorAfter.toString(), 14)).to.be.true
      })

    })

    describe('Funding collateralization tests', () => {
      const collatRatio = ethers.utils.parseUnits('1.5')

      describe('mint', async() => {
        let vaultId: BigNumber
        let maxSqueethToMint: BigNumber
        const secondsElapsed = 21600 // 6 hours

        before('prepare a vault', async() => {
          // set prices back
          await oracle.connect(random).setPrice(squeethEthPool.address , squeethETHPrice) // eth per 1 squeeth
          await oracle.connect(random).setPrice(ethUSDPool.address , ethUSDPrice)  // usdc per 1 eth
          await controller.applyFunding()
          
          vaultId = await shortNFT.nextId()
          // mint max amount of rSqueeth
          maxSqueethToMint = collateralAmount.mul(one).mul(one).div(collatRatio).div(scaledEthPrice)

          await controller.connect(seller1).mintPowerPerpAmount(0, maxSqueethToMint, 0, {value: collateralAmount})
        })
        it('should revert if minting too much squeeth after funding', async() => {
          const mark = await controller.getDenormalizedMark(1)
          const index = await controller.getIndex(1)

          const now = await getNow(provider)
    
          const newVault = await controller.vaults(vaultId)
          const shortAmount = newVault.shortAmount
          const collateral = newVault.collateralAmount
  
          const normalizationFactorBefore = await controller.normalizationFactor()
  
          const multiplier = getNormFactorMultiplier(mark, index, secondsElapsed)
          const expectedNormalizationFactor = normalizationFactorBefore.mul(multiplier).div(one)

          const currentRSqueeth = shortAmount.mul(expectedNormalizationFactor).div(one)
          const maxShortRSqueeth = one.mul(one).mul(collateral).div(scaledEthPrice).div(collatRatio)

          const expectedAmountCanMint = maxShortRSqueeth.sub(currentRSqueeth)
  
          await provider.send("evm_setNextBlockTimestamp", [now + secondsElapsed])  
          await expect(controller.connect(seller1).mintPowerPerpAmount(vaultId, expectedAmountCanMint.mul(1001).div(1000), 0, {value: 0})).to.be.revertedWith(
            'Invalid state'
          )
        })
        it('should mint more wSqueeth after funding', async() => {
          const mark = await controller.getDenormalizedMark(1)
          const index = await controller.getIndex(1)
  
          const multiplier = getNormFactorMultiplier(mark, index, secondsElapsed)
          const expectedAmountCanMint = maxSqueethToMint.sub(maxSqueethToMint.div(multiplier).mul(one))

          // set next block to be 1 seconds after last block, so the max we can mint is almost the same
          const now = await getNow(provider)
          await provider.send("evm_setNextBlockTimestamp", [now + 1])
          await controller.connect(seller1).mintPowerPerpAmount(vaultId, expectedAmountCanMint, 0) 
        })
      })
      
      describe('withdraw', async () => {
        let vaultId: BigNumber
        let maxCollatToRemove: BigNumber
        before('prepare a vault and stimulate time passes', async() => {
          vaultId = await shortNFT.nextId()  
          // put vaultId as 0 to open vault
          await controller.connect(seller1).mintPowerPerpAmount(0, mintAmount,0, {value: collateralAmount})
          const now = await getNow(provider)
  
          const markPrice = await controller.getDenormalizedMark(1)
          const indexPrice = await controller.getIndex(1)
          const newVault = await controller.vaults(vaultId)
          const shortAmount = newVault.shortAmount
          const collateral = newVault.collateralAmount

          const normalizationFactorBefore = await controller.normalizationFactor()

          const secondsElapsed = 10800
          const multiplier = getNormFactorMultiplier(markPrice, indexPrice, secondsElapsed)
          const expectedNormalizationFactor = normalizationFactorBefore.mul(multiplier).div(one)

          const collatRequired = shortAmount.mul(expectedNormalizationFactor).mul(scaledEthPrice).mul(collatRatio).div(one.mul(one).mul(one))
          maxCollatToRemove = collateral.sub(collatRequired)

          await provider.send("evm_setNextBlockTimestamp", [now + secondsElapsed])
        })
        it('should revert when trying to withdraw too much collateral', async() =>{
          await expect((controller.connect(seller1).withdraw(vaultId, maxCollatToRemove.mul(1001).div(1000)))).to.be.revertedWith(
            'Invalid state'
          )
        })

        it('should be able to withdraw more collateral after funding', async() => {
          const userEthBalanceBefore = await provider.getBalance(seller1.address)
          
          // set next block to be 1 seconds after last block, so the max we can withdraw is almost the same
          const now = await getNow(provider)
          await provider.send("evm_setNextBlockTimestamp", [now + 1])

          await controller.connect(seller1).withdraw(vaultId, maxCollatToRemove) 
  
          const newAfterVault = await controller.vaults(vaultId)
          const newCollateralAmount = newAfterVault.collateralAmount
          const userEthBalanceAfter = await provider.getBalance(seller1.address)
          
          expect(maxCollatToRemove.eq(collateralAmount.sub(newCollateralAmount))).to.be.true
          expect(userEthBalanceAfter.eq(userEthBalanceBefore.add(maxCollatToRemove)))      
        })
      })
    })

  })
  
});

function getNormFactorMultiplier(mark: BigNumber, index:BigNumber, secondsElapsed: number) {
  const top = one.mul(one).mul(mark)
  const fractionalDayElapsed = one.mul(secondsElapsed).div(secondsInDay)
  const bot = one.add(fractionalDayElapsed).mul(mark).sub(index.mul(fractionalDayElapsed))
  return top.div(bot)
}