import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { ethers } from "hardhat"
import { expect } from "chai";
import { Controller, MockWPowerPerp, MockShortPowerPerp, MockOracle, MockUniswapV3Pool, MockErc20, MockUniPositionManager, WETH9, ABDKMath64x64 } from '../../../typechain'
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
  let owner: SignerWithAddress
  let random: SignerWithAddress

  this.beforeAll("Prepare accounts", async() => {
    const accounts = await ethers.getSigners();
    const [_owner, _random] = accounts;
    random = _random
    owner = _owner
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

    describe("Pause the system and then shutdown", async () => {
      it("Should allow owner to pause the system", async () => {
        await controller.connect(owner).pause()
        expect(await controller.isSystemPaused()).to.be.true;
      });
      it("Should allow the system to be shutdown when paused", async () => {
        const isPausedBefore = await controller.isSystemPaused();
        const ethPrice = ethers.utils.parseUnits(settlementPrice)
        expect(await controller.isSystemPaused()).to.be.true
        await oracle.connect(random).setPrice(ethUSDPool.address , ethPrice) // eth per 1 squeeth
        await controller.connect(owner).shutDown()
        const snapshot = await controller.indexForSettlement();
        expect(snapshot.toString()).to.be.eq(ethPrice.div(oracleScaleFactor))
        expect(isPausedBefore).to.be.true
        expect(await controller.isSystemPaused()).to.be.true
        expect(await controller.isShutDown()).to.be.true;
      });
    });
  });
});