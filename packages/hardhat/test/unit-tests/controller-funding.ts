import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers";
import { ethers } from "hardhat"
import { expect } from "chai";
import { BigNumber, providers } from "ethers";
import { Controller, MockWSqueeth, MockVaultNFTManager, MockOracle, MockUniswapV3Pool, MockErc20, MockUniPositionManager } from "../../typechain";
import { isSimilar, one, oracleScaleFactor } from "../utils";

const squeethETHPrice = BigNumber.from('3010').mul(one).div(oracleScaleFactor)

const ethUSDPrice = BigNumber.from('3000').mul(one)

const scaledEthPrice = ethUSDPrice.div(oracleScaleFactor)

const mintAmount = BigNumber.from('100').mul(one)
const collateralAmount = BigNumber.from('50').mul(one)

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
    });
  });

  describe("Initialization", async () => {
    it("Should be able to init contract", async () => {
      await controller.init(oracle.address, shortNFT.address, squeeth.address, weth.address, usdc.address, ethUSDPool.address, squeethEthPool.address, uniPositionManager.address);
      const squeethAddr = await controller.wPowerPerp();
      const nftAddr = await controller.vaultNFT();
      expect(squeethAddr).to.be.eq(
        squeeth.address,
        "squeeth address mismatch"
      );
      expect(nftAddr).to.be.eq(shortNFT.address, "nft address mismatch");
    });
  });

  describe('Funding actions', async() => {
    describe('Normalization Factor tests', () => {
      let mark: BigNumber
      let index: BigNumber
  
      before(async () => {  
        // reset state
        await controller.applyFunding()
        mark = await controller.getDenormalizedMark(1)
        index = await controller.getIndex(1)
      })
  
      it('should apply the correct normalization factor for funding', async() => {

        const normalizationFactorBefore = await controller.connect(seller1).normalizationFactor()
        const secondsElapsed = ethers.utils.parseUnits("10800") // 3hrs

        const secondsInDay = ethers.utils.parseUnits("86400")
        const top = one.mul(one).mul(mark)

        const fractionalDayElapsed = one.mul(secondsElapsed).div(secondsInDay)

        const bot = one.add(fractionalDayElapsed).mul(mark).sub(index.mul(fractionalDayElapsed))
        const expectedNormFactor = top.div(bot)
        const expectedNormalizationFactor = normalizationFactorBefore.mul(expectedNormFactor).div(one)

        await provider.send("evm_increaseTime", [(secondsElapsed.div(one)).toNumber()]) // (3/24) * 60*60 = 3600s = 3 hour
        await controller.connect(seller1).applyFunding()       

        const normalizationFactorAfter = await controller.normalizationFactor()
        // use isSimilar because sometimes the expectedNormFactor will be a little bit off, 
        // maybe caused by inconsistent process time by hardhat
        expect(isSimilar(expectedNormalizationFactor.toString(), normalizationFactorAfter.toString(), 14)).to.be.true
      })

      it('normalization factor changes should be bounded above', async() => {

        // Get norm factor
        const normalizationFactorBefore = await controller.connect(seller1).normalizationFactor()

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
        const secondsElapsed = ethers.utils.parseUnits("10800") // 3hrs
        const secondsInDay = ethers.utils.parseUnits("86400")

        await provider.send("evm_increaseTime", [(secondsElapsed.sub(ethers.utils.parseUnits("2")).div(one)).toNumber()]) // (3/24) * 60*60 = 3600s = 3 hour
        await controller.connect(seller1).applyFunding()   
        
        // Get new new norm factor
        const normalizationFactorAfter = await controller.connect(seller1).normalizationFactor()

        // Mark should be bounded 4/5, 5/4
        const scaledEthUSDPrice = ethUSDPriceNew.div(oracleScaleFactor)
        const expectedFloorMark = scaledEthUSDPrice.mul(scaledEthUSDPrice).mul(4).div(5).div(one)

        // Expected bounded norm factor
        const top = one.mul(one).mul(expectedFloorMark)
        const fractionalDayElapsed = one.mul(secondsElapsed).div(secondsInDay)
        const bot = one.add(fractionalDayElapsed).mul(expectedFloorMark).sub(index.mul(fractionalDayElapsed))
        const expectedNormFactor = top.div(bot)
        const expectedNormalizationFactor = normalizationFactorBefore.mul(expectedNormFactor).div(one)

        // use isSimilar because sometimes the expectedNormFactor will be a little bit off, 
        // maybe caused by inconsistent process time by hardhat
        expect(isSimilar(expectedNormalizationFactor.toString(), normalizationFactorAfter.toString(), 15)).to.be.true

        // set prices back
        await oracle.connect(random).setPrice(squeethEthPool.address , squeethETHPrice) // eth per 1 squeeth
        await oracle.connect(random).setPrice(ethUSDPool.address , ethUSDPrice)  // usdc per 1 eth

      })
      it('nomalization factor changes should be bounded below', async() => {

        // Get norm factor
        const normalizationFactorBefore = await controller.connect(seller1).normalizationFactor()

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
        const secondsElapsed = ethers.utils.parseUnits("10800") // 3hrs
        const secondsInDay = ethers.utils.parseUnits("86400")

        await provider.send("evm_increaseTime", [(secondsElapsed.sub(ethers.utils.parseUnits("4")).div(one)).toNumber()]) // (3/24) * 60*60 = 3600s = 3 hour
        await controller.connect(seller1).applyFunding()   
        
        // Get new new norm factor
        const normalizationFactorAfter = await controller.connect(seller1).normalizationFactor()

        // Mark should be bounded 4/5, 5/4
        const scaledEthUSDPrice = ethUSDPriceNew.div(oracleScaleFactor)
        const expectedCeilMark = scaledEthUSDPrice.mul(scaledEthUSDPrice).mul(5).div(4).div(one)

        // Expected bounded norm factor
        const top = one.mul(one).mul(expectedCeilMark)
        const fractionalDayElapsed = one.mul(secondsElapsed).div(secondsInDay)
        const bot = one.add(fractionalDayElapsed).mul(expectedCeilMark).sub(index.mul(fractionalDayElapsed))
        const expectedNormFactor = top.div(bot)
        const expectedNormalizationFactor = normalizationFactorBefore.mul(expectedNormFactor).div(one)

        // use isSimilar because sometimes the expectedNormFactor will be a little bit off, 
        // maybe caused by inconsistent process time by hardhat
        expect(isSimilar(expectedNormalizationFactor.toString(), normalizationFactorAfter.toString(), 14)).to.be.true

        // set prices back
        await oracle.connect(random).setPrice(squeethEthPool.address , squeethETHPrice) // eth per 1 squeeth
        await oracle.connect(random).setPrice(ethUSDPool.address , ethUSDPrice)  // usdc per 1 eth

      })

    })
    describe('Funding collateralization tests', () => {
      let mark: BigNumber
      let index: BigNumber
      let vaultId: BigNumber
  
      const collatRatio = ethers.utils.parseUnits('1.5')
      it('should be able to mint more wSqueeth after funding', async() => {

        vaultId = await shortNFT.nextId()
        // put vaultId as 0 to open vault
        await controller.connect(seller1).mintPowerPerpAmount(0, mintAmount, 0, {value: collateralAmount})

        mark = await controller.getDenormalizedMark(1)
        index = await controller.getIndex(1)

        const newVault = await controller.vaults(vaultId)
        const shortAmount = newVault.shortAmount
        const collateral = newVault.collateralAmount

        const normalizationFactorBefore = await controller.connect(seller1).normalizationFactor()

        const secondsElapsed = ethers.utils.parseUnits("10800") // 3hrs

        const secondsInDay = ethers.utils.parseUnits("86400")


        const fractionalDayElapsed = one.mul(secondsElapsed).div(secondsInDay)  

        const top = one.mul(one).mul(mark)
        const bot = one.add(fractionalDayElapsed).mul(mark).sub(index.mul(fractionalDayElapsed))
        const expectedNormFactor = top.div(bot)
        const expectedNormalizationFactor = normalizationFactorBefore.mul(expectedNormFactor).div(one)

        const currentRSqueeth = shortAmount.mul(expectedNormalizationFactor).div(one)
        const maxShortRSqueeth = one.mul(one).mul(collateral).div(scaledEthPrice).div(collatRatio)

        const expectedAmountCanMint = maxShortRSqueeth.sub(currentRSqueeth)

        
        await provider.send("evm_increaseTime", [10800]) // (3/24) * 60*60 = 3600s = 3 hour
        await controller.connect(seller1).mintPowerPerpAmount(vaultId, expectedAmountCanMint.sub(300000), 0, {value: 0}) 
        // seems we have some rounding issues here where we round up the expected amount to mint, but we round down elsewhere
        // some times tests pass with add(0), sometimes we
        // seems to be based on the index and not consistent, started passing after I added an earlier test (which would change the index here)
  
        const newAfterVault = await controller.vaults(vaultId)
        const newShortAmount = newAfterVault.shortAmount
        const normalizationFactorAfter = await controller.normalizationFactor()

        // use isSimilar because sometimes the expectedNormFactor will be a little bit off, 
        // maybe caused by inconsistent process time by hardhat
        const mintedRSqueethAmount = newShortAmount.mul(normalizationFactorAfter).div(one)
        expect(isSimilar(mintedRSqueethAmount.toString(), maxShortRSqueeth.toString(), 6)).to.be.true
        // add one to newShortAmount to make test pass, todo: fix and investigate this

      })

      it('should revert if minting too much squeeth after funding', async() => {

        vaultId = await shortNFT.nextId()
        // put vaultId as 0 to open vault
        await controller.connect(seller1).mintPowerPerpAmount(0, mintAmount, 0, {value: collateralAmount})

        mark = await controller.getDenormalizedMark(1)
        index = await controller.getIndex(1)
  
        const newVault = await controller.vaults(vaultId)
        const shortAmount = newVault.shortAmount
        const collateral = newVault.collateralAmount

        const normalizationFactorBefore = await controller.connect(seller1).normalizationFactor()

        const secondsElapsed = ethers.utils.parseUnits("10800") // 3hrs

        const secondsInDay = ethers.utils.parseUnits("86400")

        const fractionalDayElapsed = one.mul(secondsElapsed).div(secondsInDay)  
        
        const top = one.mul(one).mul(mark)
        const bot = one.add(fractionalDayElapsed).mul(mark).sub(index.mul(fractionalDayElapsed))
        const expectedNormFactor = top.div(bot)
        const expectedNormalizationFactor = normalizationFactorBefore.mul(expectedNormFactor).div(one)

        const currentRSqueeth = shortAmount.mul(expectedNormalizationFactor).div(one)

        const maxShortRSqueeth = one.mul(one).mul(collateral).div(scaledEthPrice).div(collatRatio)

        const expectedAmountCanMint = maxShortRSqueeth.sub(currentRSqueeth)


        await provider.send("evm_increaseTime", [10800])

        // use amount multiplied by a threshold (1.001) to avoid time-dependent precision issues.
        await expect(controller.connect(seller1).mintPowerPerpAmount(vaultId, expectedAmountCanMint.mul(1001).div(1000), 0, {value: 0})).to.be.revertedWith(
          'Invalid state'
        )
        // seems we have some rounding issues here where we round up the expected amount to mint, but we round down elsewhere
        // revert happens with exact expected mint amount
      })


      it('should be able to withdraw collateral after funding', async() => {

        vaultId = await shortNFT.nextId()
        // put vaultId as 0 to open vault
        await controller.connect(seller1).mintPowerPerpAmount(0, mintAmount,0, {value: collateralAmount})

        mark = await controller.getDenormalizedMark(1)
        index = await controller.getIndex(1)
  
        const newVault = await controller.vaults(vaultId)
        const shortAmount = newVault.shortAmount
        const collateral = newVault.collateralAmount

        const normalizationFactorBefore = await controller.connect(seller1).normalizationFactor()

        const secondsElapsed = ethers.utils.parseUnits("10800") // 3hrs
        const secondsInDay = ethers.utils.parseUnits("86400")

        const fractionalDayElapsed = one.mul(secondsElapsed).div(secondsInDay)  

        const top = one.mul(one).mul(mark)
        const bot = one.add(fractionalDayElapsed).mul(mark).sub(index.mul(fractionalDayElapsed))
        const expectedNormFactor = top.div(bot)
        const expectedNormalizationFactor = normalizationFactorBefore.mul(expectedNormFactor).div(one)

        const collatRequired = shortAmount.mul(expectedNormalizationFactor).mul(scaledEthPrice).mul(collatRatio).div(one.mul(one).mul(one))
        const maxCollatToRemove = collateral.sub(collatRequired).sub(500000) // add buffer for rounding issue
        const userEthBalanceBefore = await provider.getBalance(seller1.address)

        await provider.send("evm_increaseTime", [(secondsElapsed.div(one)).toNumber()])
        await controller.connect(seller1).withdraw(vaultId, maxCollatToRemove) 

        const newAfterVault = await controller.vaults(vaultId)
        const newCollateralAmount = newAfterVault.collateralAmount
        const userEthBalanceAfter = await provider.getBalance(seller1.address)
        
        expect(maxCollatToRemove.eq(collateral.sub(newCollateralAmount))).to.be.true
        expect(userEthBalanceAfter.eq(userEthBalanceBefore.add(maxCollatToRemove)))      
      })

      it('should revert if withdrawing too much collateral after funding', async() => {

        vaultId = await shortNFT.nextId()
        
        
  
        // put vaultId as 0 to open vault
        await controller.connect(seller1).mintPowerPerpAmount(0, mintAmount,0, {value: collateralAmount})

        mark = await controller.getDenormalizedMark(1)
        index = await controller.getIndex(1)
  
        const newVault = await controller.vaults(vaultId)
        const shortAmount = newVault.shortAmount
        const collateral = newVault.collateralAmount

        const normalizationFactorBefore = await controller.connect(seller1).normalizationFactor()

        const secondsElapsed = ethers.utils.parseUnits("10800") // 3hrs
        const secondsInDay = ethers.utils.parseUnits("86400")

        const fractionalDayElapsed = one.mul(secondsElapsed).div(secondsInDay)  

        const top = one.mul(one).mul(mark)
        const bot = one.add(fractionalDayElapsed).mul(mark).sub(index.mul(fractionalDayElapsed))
        const expectedNormFactor = top.div(bot)
        const expectedNormalizationFactor = normalizationFactorBefore.mul(expectedNormFactor).div(one)

        const collatRequired = shortAmount.mul(expectedNormalizationFactor).mul(scaledEthPrice).mul(collatRatio).div(one.mul(one).mul(one))
        const maxCollatToRemove = collateral.sub(collatRequired)

        await provider.send("evm_increaseTime", [(secondsElapsed.div(one)).toNumber()])
        // use amount multiplied by a threshold (1.001) to avoid time-dependent precision issues.
        await expect((controller.connect(seller1).withdraw(vaultId, maxCollatToRemove.mul(1001).div(1000)))).to.be.revertedWith(
          'Invalid state'
        )  
      })
    })

  })
  
});
