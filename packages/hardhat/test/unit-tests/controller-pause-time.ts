import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { ethers } from "hardhat"
import { expect } from "chai";
import {providers } from "ethers";
import { Controller, MockWPowerPerp, MockShortPowerPerp, MockOracle, MockUniswapV3Pool, MockErc20, MockUniPositionManager, WETH9, ABDKMath64x64 } from '../../typechain'
import { oracleScaleFactor } from "../utils";

const squeethETHPrice = ethers.utils.parseUnits('3010')
const ethUSDPrice = ethers.utils.parseUnits('3000')


describe("Controller", function () {
  let squeeth: MockWPowerPerp;
  let shortSqueeth: MockShortPowerPerp;
  let controller: Controller;
  let squeethEthPool: MockUniswapV3Pool;
  let ethUSDPool: MockUniswapV3Pool;
  let uniPositionManager: MockUniPositionManager
  let oracle: MockOracle;
  let weth: WETH9;
  let usdc: MockErc20;
  let provider: providers.JsonRpcProvider;
  let owner: SignerWithAddress
  let random: SignerWithAddress

  this.beforeAll("Prepare accounts", async() => {
    const accounts = await ethers.getSigners();
    const [_owner, _random] = accounts;
    random = _random
    owner = _owner
    provider = ethers.provider
  })

  this.beforeAll("Setup environment", async () => {
    const MockSQUContract = await ethers.getContractFactory("MockWPowerPerp");
    squeeth = (await MockSQUContract.deploy()) as MockWPowerPerp;

    const NFTContract = await ethers.getContractFactory("MockShortPowerPerp");
    shortSqueeth = (await NFTContract.deploy()) as MockShortPowerPerp;

    const OracleContract = await ethers.getContractFactory("MockOracle");
    oracle = (await OracleContract.deploy()) as MockOracle;

    const MockErc20Contract = await ethers.getContractFactory("MockErc20");
    usdc = (await MockErc20Contract.deploy("USDC", "USDC", 6)) as MockErc20;

    const WETHContract = await ethers.getContractFactory("WETH9");
    weth = (await WETHContract.deploy()) as WETH9;

    const MockUniswapV3PoolContract = await ethers.getContractFactory("MockUniswapV3Pool");
    squeethEthPool = (await MockUniswapV3PoolContract.deploy()) as MockUniswapV3Pool;
    ethUSDPool = (await MockUniswapV3PoolContract.deploy()) as MockUniswapV3Pool;

    const MockPositionManager = await ethers.getContractFactory("MockUniPositionManager");
    uniPositionManager = (await MockPositionManager.deploy()) as MockUniPositionManager;

    await squeethEthPool.setPoolTokens(weth.address, squeeth.address);
    await ethUSDPool.setPoolTokens(weth.address, usdc.address);

    await oracle.connect(random).setPrice(squeethEthPool.address , squeethETHPrice) // eth per 1 squeeth
    await oracle.connect(random).setPrice(ethUSDPool.address , ethUSDPrice)  // usdc per 1 eth
    
    const ABDK = await ethers.getContractFactory("ABDKMath64x64")
    const ABDKLibrary = (await ABDK.deploy()) as ABDKMath64x64;
  
    const TickMath = await ethers.getContractFactory("TickMathExternal")
    const TickMathLibrary = (await TickMath.deploy());

    const SqrtPriceExternal = await ethers.getContractFactory("SqrtPriceMathPartial")
    const SqrtPriceExternalLibrary = (await SqrtPriceExternal.deploy());

    const ControllerContract = await ethers.getContractFactory("Controller", {libraries: {ABDKMath64x64: ABDKLibrary.address, TickMathExternal: TickMathLibrary.address, SqrtPriceMathPartial: SqrtPriceExternalLibrary.address}});
  controller = (await ControllerContract.deploy(oracle.address, shortSqueeth.address, squeeth.address, weth.address, usdc.address, ethUSDPool.address, squeethEthPool.address, uniPositionManager.address, 3000)) as Controller;
  });
  
  describe("Time bound pausing", function () {
    const settlementPrice = '6500';

    describe("Pause the system", async () => {
      let pausesLeft = 4;
      it("Should allow owner to pause the system", async () => {
        await controller.connect(owner).pause()
        pausesLeft-=1;
        expect(await controller.isSystemPaused()).to.be.true;
        expect((await controller.pausesLeft()).eq(pausesLeft)).to.be.true 

        // how to ensure that all variables are updated ie lastPauseTime, need block.timestamp here
      });
      it("Should allow the owner to un-pause", async () => {
        await controller.connect(owner).unPauseOwner()
        expect(await controller.isSystemPaused()).to.be.false 
        expect((await controller.pausesLeft()).eq(pausesLeft)).to.be.true 

      });
      it("Should revert when the owner tries to re-pause after 183 days", async () => {
        await provider.send("evm_increaseTime", [86400*183])
        await provider.send("evm_mine", [])
        await expect(
          controller.connect(owner).pause()
        ).to.be.revertedWith("C17");
      });

    });  
    describe("Shut down the system", async () => {
      it("Should allow the system to be shutdown and paused atomically even after 183 days", async () => {
        const ethPrice = ethers.utils.parseUnits(settlementPrice)
        await oracle.connect(random).setPrice(ethUSDPool.address , ethPrice) // eth per 1 squeeth
        await controller.connect(owner).shutDown()
        const snapshot = await controller.indexForSettlement();
        expect(snapshot.toString()).to.be.eq(ethPrice.div(oracleScaleFactor))
        expect(await controller.isShutDown()).to.be.true;
      });
    });
  });
});
