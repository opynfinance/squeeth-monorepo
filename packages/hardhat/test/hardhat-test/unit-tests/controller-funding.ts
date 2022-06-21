import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { ethers } from "hardhat"
import { expect } from "chai";
import { BigNumber, providers, utils } from "ethers";
import { getNow, isSimilar, one, oracleScaleFactor } from "../utils";
import { Controller, MockWPowerPerp, MockShortPowerPerp, MockOracle, MockUniswapV3Pool, MockErc20, MockUniPositionManager, ABDKMath64x64} from "../../../typechain";

const squeethETHPrice = BigNumber.from('3030').mul(one).div(oracleScaleFactor)
const ethUSDPrice = BigNumber.from('3000').mul(one)
const scaledEthPrice = ethUSDPrice.div(oracleScaleFactor)

const mintAmount = BigNumber.from('100').mul(one)
const collateralAmount = BigNumber.from('50').mul(one)

describe("Controller Funding tests", function () {
  let squeeth: MockWPowerPerp;
  let shortSqueeth: MockShortPowerPerp;
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
    const MockSQUContract = await ethers.getContractFactory("MockWPowerPerp");
    squeeth = (await MockSQUContract.deploy()) as MockWPowerPerp;

    const NFTContract = await ethers.getContractFactory("MockShortPowerPerp");
    shortSqueeth = (await NFTContract.deploy()) as MockShortPowerPerp;

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

      const ABDK = await ethers.getContractFactory("ABDKMath64x64")
      const ABDKLibrary = (await ABDK.deploy()) as ABDKMath64x64;
    
      const TickMath = await ethers.getContractFactory("TickMathExternal")
      const TickMathLibrary = (await TickMath.deploy());
  
      const SqrtPriceExternal = await ethers.getContractFactory("SqrtPriceMathPartial")
      const SqrtPriceExternalLibrary = (await SqrtPriceExternal.deploy());
  
      const ControllerContract = await ethers.getContractFactory("Controller", {libraries: {ABDKMath64x64: ABDKLibrary.address, TickMathExternal: TickMathLibrary.address, SqrtPriceMathPartial: SqrtPriceExternalLibrary.address}});
        controller = (await ControllerContract.deploy(oracle.address, shortSqueeth.address, squeeth.address, weth.address, usdc.address, ethUSDPool.address, squeethEthPool.address, uniPositionManager.address, 3000)) as Controller;
    });
  });

  describe('Funding actions', async() => {
    describe('Normalization Factor tests', () => {
      let mark: BigNumber
      let index: BigNumber
      let fundingPeriod: BigNumber

      before(async () => {  
        fundingPeriod = await controller.FUNDING_PERIOD()

        await controller.applyFunding()
        mark = await controller.getDenormalizedMarkForFunding(1)
        index = await controller.getIndex(1)
      })
  
      it('should apply the correct normalization factor for funding', async() => {
        const now = await getNow(provider)
        const normalizationFactorBefore = await controller.normalizationFactor()
        const secondsElapsed = 10800 // 3hrs
        const multiplier = getNormFactorMultiplier(mark, index, secondsElapsed, fundingPeriod)
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
        mark = await controller.getDenormalizedMarkForFunding(1)
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
        const multiplier = getNormFactorMultiplier(expectedFloorMark, index, secondsElapsed, fundingPeriod)
        const expectedNormalizationFactor = normalizationFactorBefore.mul(multiplier).div(one)

        // use isSimilar because sometimes the expectedNormFactor will be a little bit off, 
        // maybe caused by inconsistent process time by hardhat
        expect(isSimilar(expectedNormalizationFactor.toString(), normalizationFactorAfter.toString(), 15)).to.be.true
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
        mark = await controller.getDenormalizedMarkForFunding(1)
        index = await controller.getIndex(1)  

        // + 3 hours
        const secondsElapsed = 10800 // 3hrs

        await provider.send("evm_setNextBlockTimestamp", [now + secondsElapsed]) 
        await controller.connect(seller1).applyFunding()   
        
        // Get new new norm factor
        const normalizationFactorAfter = await controller.normalizationFactor()

        // Mark should be bounded 4/5, 5/4
        const scaledEthUSDPrice = ethUSDPriceNew.div(oracleScaleFactor)
        const expectedCeilMark = scaledEthUSDPrice.mul(scaledEthUSDPrice).mul(14).div(10).div(one)

        // Expected bounded norm factor
        const multiplier = getNormFactorMultiplier(expectedCeilMark, index, secondsElapsed, fundingPeriod)
        const expectedNormalizationFactor = normalizationFactorBefore.mul(multiplier).div(one)

        expect(isSimilar(expectedNormalizationFactor.toString(), normalizationFactorAfter.toString(), 14)).to.be.true
      })
      it('calling apply funding with little time elapsed should not affect norm factor', async() => {
        await oracle.connect(random).setPrice(squeethEthPool.address , squeethETHPrice) // eth per 1 squeeth
        await oracle.connect(random).setPrice(ethUSDPool.address , ethUSDPrice)  // usdc per 1 eth
        
        await controller.applyFunding()
        const normFactor0 = await controller.normalizationFactor()
        const timestamp0 = await getNow(provider)
        
        const timestamp1 = await timestamp0 + 10
        await provider.send("evm_setNextBlockTimestamp", [timestamp1]) 
        await controller.applyFunding()
        const normFactor1 = await controller.normalizationFactor()

        const timestamp2 = await timestamp1 + 10
        await provider.send("evm_setNextBlockTimestamp", [timestamp2]) 
        await controller.applyFunding()
        const normFactor2 = await controller.normalizationFactor()

        // update should be < 1.0001
        expect(isSimilar(normFactor0.toString(), normFactor1.toString(), 4)).to.be.true
        expect(isSimilar(normFactor0.toString(), normFactor2.toString(), 4)).to.be.true
      })
    })

    describe('Funding collateralization tests', () => {
      const collatRatio = ethers.utils.parseUnits('1.5')
      let fundingPeriod: BigNumber

      describe('mint', async() => {
        let vaultId: BigNumber
        let maxSqueethToMint: BigNumber
        const secondsElapsed = 21600 // 6 hours

        before('prepare a vault', async() => {
          fundingPeriod = await controller.FUNDING_PERIOD()

          // set prices back
          await oracle.connect(random).setPrice(squeethEthPool.address , squeethETHPrice) // eth per 1 squeeth
          await oracle.connect(random).setPrice(ethUSDPool.address , ethUSDPrice)  // usdc per 1 eth
          await controller.applyFunding()
          
          vaultId = await shortSqueeth.nextId()
          // mint max amount of rSqueeth
          maxSqueethToMint = collateralAmount.mul(one).mul(one).div(collatRatio).div(scaledEthPrice)

          await controller.connect(seller1).mintPowerPerpAmount(0, maxSqueethToMint, 0, {value: collateralAmount})

          // advance time
        })
        it('should revert if minting too much squeeth after funding', async() => {
          const mark = await controller.getDenormalizedMarkForFunding(1)
          const index = await controller.getIndex(1)

          const now = await getNow(provider)
    
          const newVault = await controller.vaults(vaultId)
          const shortAmount = newVault.shortAmount
          const collateral = newVault.collateralAmount
  
          const normalizationFactorBefore = await controller.normalizationFactor()
  
          const multiplier = getNormFactorMultiplier(mark, index, secondsElapsed, fundingPeriod)
          const expectedNormalizationFactor = normalizationFactorBefore.mul(multiplier).div(one)

          const currentRSqueeth = shortAmount.mul(expectedNormalizationFactor).div(one)
          const maxShortRSqueeth = one.mul(one).mul(collateral).div(scaledEthPrice).div(collatRatio)

          const expectedAmountCanMint = maxShortRSqueeth.sub(currentRSqueeth)

          await provider.send("evm_setNextBlockTimestamp", [now + secondsElapsed])
          await expect(controller.connect(seller1).mintPowerPerpAmount(vaultId, expectedAmountCanMint.mul(10001).div(10000), 0, {value: 0})).to.be.revertedWith(
            'C24'
          )
        })

        it('should mint more wSqueeth after funding', async() => {
          const mark = await controller.getDenormalizedMarkForFunding(1)
          const index = await controller.getIndex(1)

  
          const multiplier = getNormFactorMultiplier(mark, index, secondsElapsed, fundingPeriod)

          // 1 squeeth - 1squeeth * 0.99

          const expectedAmountCanMint = maxSqueethToMint.sub(maxSqueethToMint.mul(multiplier).div(one))

          // set next block to be 1 seconds after last block, so the max we can mint is almost the same
          const now = await getNow(provider)
          await provider.send("evm_setNextBlockTimestamp", [now + 1])
          await controller.connect(seller1).mintPowerPerpAmount(vaultId, expectedAmountCanMint, 0 ,{value: 0}) 
        })
      })
      
      describe('withdraw', async () => {
        let vaultId: BigNumber
        let maxCollatToRemove: BigNumber

        before('prepare a vault and stimulate time passes', async() => {
          fundingPeriod = await controller.FUNDING_PERIOD()

          vaultId = await shortSqueeth.nextId()  
          // put vaultId as 0 to open vault
          await controller.connect(seller1).mintPowerPerpAmount(0, mintAmount,0, {value: collateralAmount})
          const now = await getNow(provider)
  
          const markPrice = await controller.getDenormalizedMarkForFunding(1)
          const indexPrice = await controller.getIndex(1)
          const newVault = await controller.vaults(vaultId)
          const shortAmount = newVault.shortAmount
          const collateral = newVault.collateralAmount

          const normalizationFactorBefore = await controller.normalizationFactor()

          const secondsElapsed = 10800
          const multiplier = getNormFactorMultiplier(markPrice, indexPrice, secondsElapsed, fundingPeriod)
          const expectedNormalizationFactor = normalizationFactorBefore.mul(multiplier).div(one)

          const collatRequired = shortAmount.mul(expectedNormalizationFactor).mul(scaledEthPrice).mul(collatRatio).div(one.mul(one).mul(one))
          maxCollatToRemove = collateral.sub(collatRequired)

          await provider.send("evm_setNextBlockTimestamp", [now + secondsElapsed])
        })
        it('should revert when trying to withdraw too much collateral', async() =>{
          await expect((controller.connect(seller1).withdraw(vaultId, maxCollatToRemove.mul(1001).div(1000)))).to.be.revertedWith(
            'C24'
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

    describe('Extreme cases for normalization factor', async() => {
      let fundingPeriod: BigNumber

      before('get funding period', async() => {
        fundingPeriod = await controller.FUNDING_PERIOD()
      })


      it('should get capped normalization factor when mark = 0 ', async() => {
        // Get norm factor
        const normalizationFactorBefore = await controller.normalizationFactor()
        const now = await getNow(provider)

        // Set very low mark price
        const squeethETHPriceNew = 0
        const ethUSDPriceNew = ethers.utils.parseUnits('3000')

        // Set prices
        await oracle.connect(random).setPrice(squeethEthPool.address , squeethETHPriceNew) // eth per 1 squeeth
        await oracle.connect(random).setPrice(ethUSDPool.address, ethUSDPriceNew)  // usdc per 1 eth
        const index = await controller.getIndex(1)

        // + 3 hours 
        const secondsElapsed = 10800
        await provider.send("evm_setNextBlockTimestamp", [now + secondsElapsed]) 
        await controller.connect(seller1).applyFunding()   

        // Get new new norm factor
        const normalizationFactorAfter = await controller.normalizationFactor()

        // Mark should be bounded 4/5, 5/4
        const scaledEthUSDPrice = ethUSDPriceNew.div(oracleScaleFactor)
        const expectedFloorMark = scaledEthUSDPrice.mul(scaledEthUSDPrice).mul(4).div(5).div(one)

        // Expected bounded norm factor
        const multiplier = getNormFactorMultiplier(expectedFloorMark, index, secondsElapsed, fundingPeriod)
        const expectedNormalizationFactor = normalizationFactorBefore.mul(multiplier).div(one)

        expect(isSimilar(expectedNormalizationFactor.toString(), normalizationFactorAfter.toString(), 15)).to.be.true
      })
      it('should get capped normalization factor if eth price crashes', async() => {
        // Get norm factor
        const normalizationFactorBefore = await controller.normalizationFactor()
        const now = await getNow(provider)

        // Set very low index price
        const squeethETHPriceNew = ethers.utils.parseUnits('3000').div(oracleScaleFactor)
        const ethUSDPriceNew = ethers.utils.parseUnits('0.0001')

        // Set prices
        await oracle.connect(random).setPrice(squeethEthPool.address , squeethETHPriceNew) // eth per 1 squeeth
        await oracle.connect(random).setPrice(ethUSDPool.address , ethUSDPriceNew)  // usdc per 1 eth

        const index = await controller.getIndex(1)  

        // + 3 hours
        const secondsElapsed = 10800 // 3hrs
        await provider.send("evm_setNextBlockTimestamp", [now + secondsElapsed]) 
        await controller.connect(random).applyFunding()   

        // Get new new norm factor
        const normalizationFactorAfter = await controller.normalizationFactor()

        // Mark should be bounded 4/5, 5/4
        const scaledEthUSDPrice = ethUSDPriceNew.div(oracleScaleFactor)
        const expectedCeilMark = scaledEthUSDPrice.mul(scaledEthUSDPrice).mul(14).div(10).div(one)
        

        // Expected bounded norm factor
        const multiplier = getNormFactorMultiplier(expectedCeilMark, index, secondsElapsed, fundingPeriod)
        const expectedNormalizationFactor = normalizationFactorBefore.mul(multiplier).div(one)

        expect(isSimilar(expectedNormalizationFactor.toString(), normalizationFactorAfter.toString(), 14)).to.be.true

        // norm factor after - norm factor before should be bounded, even now index is 0
        expect(normalizationFactorAfter.sub(normalizationFactorBefore).lt(one))        
      })
      it('calling applying funding every 12 hours * 2 times, should result in an equal norm factor vs calling 1 time after 24hours', async() => {
        const initialTime = await getNow(provider)
        const secsInOneDay  = 86400

        const day0Initial = await initialTime + secsInOneDay

        const normFactor = await controller.normalizationFactor()
        await oracle.connect(random).setPrice(squeethEthPool.address , squeethETHPrice.mul(normFactor).div(one))
        await oracle.connect(random).setPrice(ethUSDPool.address , ethUSDPrice)

        await provider.send("evm_setNextBlockTimestamp", [day0Initial]) 
        await provider.send("evm_mine", [])

        const expNormFactor0 = await controller.getExpectedNormalizationFactor()
        const expectedWsqueethPrice0 = squeethETHPrice.mul(expNormFactor0).div(one)
        
        await controller.applyFunding()
        await oracle.setPrice(squeethEthPool.address, expectedWsqueethPrice0)

        // norm0 => norm1 is applying funding once in 24 hr
        const normFactor0 = await controller.normalizationFactor()

        // update wsqueeth / eth price to make sure denorm mark is the same
        const day0 = await getNow(provider)
        
        const day1 = await day0 + secsInOneDay
        await provider.send("evm_setNextBlockTimestamp", [day1]) 
        await provider.send("evm_mine", []) 

        const expNormFactor1 = await controller.getExpectedNormalizationFactor()
        const expectedWsqueethPrice1 = squeethETHPrice.mul(expNormFactor1).div(one)
        
        await controller.applyFunding()
        await oracle.setPrice(squeethEthPool.address, expectedWsqueethPrice1)
        
        const normFactor1 = await controller.normalizationFactor()
        const day1ChangeRatio = normFactor1.mul(one).div(normFactor0)
        
        // norm1 => norm2 is applying funding twice in 24 hr
        const day1AndHalf = await day1 + secsInOneDay/2
        await provider.send("evm_setNextBlockTimestamp", [day1AndHalf]) 
        await provider.send("evm_mine", []) 

        const expNormFactor = await controller.getExpectedNormalizationFactor()
        const expectedWsqueethPrice2 = squeethETHPrice.mul(expNormFactor).div(one)
        
        await controller.applyFunding()
        await oracle.setPrice(squeethEthPool.address, expectedWsqueethPrice2)

        const day2 = await day1 + secsInOneDay
        await provider.send("evm_setNextBlockTimestamp", [day2])
        await provider.send("evm_mine", []) 
        const expNormFactor2 = await controller.getExpectedNormalizationFactor()
        const expectedWsqueethPrice3 = squeethETHPrice.mul(expNormFactor2).div(one)
        
        await controller.applyFunding()
        await oracle.setPrice(squeethEthPool.address, expectedWsqueethPrice3)

        const normFactor2 = await controller.normalizationFactor()
        const day2ChangeRatio = normFactor2.mul(one).div(normFactor1)
        
        expect(isSimilar(day2ChangeRatio.toString(),day1ChangeRatio.toString())).to.be.true
      })
    })
  })
  
});

function getNormFactorMultiplier(mark: BigNumber, index:BigNumber, secondsElapsed: number, fundingPeriod: BigNumber) {
  
  const ratio =   parseFloat(utils.formatEther(index.mul(one).div(mark)))
  const r = secondsElapsed/(fundingPeriod.toNumber())
  const exponent = Math.log2(ratio)*r

  return BigNumber.from(ethers.utils.parseUnits((2**exponent).toString()))
}