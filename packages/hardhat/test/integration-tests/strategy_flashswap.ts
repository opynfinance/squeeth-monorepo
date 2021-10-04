import { ethers } from "hardhat"
import { expect } from "chai";
import { Contract, BigNumber } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers";
import { WETH9, StrategyFlashSwapTester, MockErc20 } from "../../typechain";
import { deployUniswapV3, deploySqueethCoreContracts, deployWETHAndDai, addWethDaiLiquidity } from '../setup'

describe("Flashswap test", function () {
  const startingPrice = 3000

  let owner: SignerWithAddress;
  let dai: MockErc20
  let weth: WETH9
  let positionManager: Contract
  let uniswapFactory: Contract
  let strategyFlashswap: StrategyFlashSwapTester

  this.beforeAll("Deploy uniswap protocol & setup uniswap pool", async() => {
    const accounts = await ethers.getSigners();
    const [_owner, ] = accounts;
    owner = _owner;

    const { dai: daiToken, weth: wethToken } = await deployWETHAndDai()

    dai = daiToken
    weth = wethToken

    const uniDeployments = await deployUniswapV3(weth)

    // this will not deploy a new pool, only reuse old onces
    await deploySqueethCoreContracts(
      weth,
      dai, 
      uniDeployments.positionManager, 
      uniDeployments.uniswapFactory,
      startingPrice,
      startingPrice
    )

    positionManager = uniDeployments.positionManager
    uniswapFactory = uniDeployments.uniswapFactory

    // add liquidity
    await addWethDaiLiquidity(
      startingPrice,
      ethers.utils.parseUnits('10'), // eth amount
      owner.address,
      dai,
      weth,
      positionManager
    )

    // deploy strategy flashswap
    const StrategyFlashswap = await ethers.getContractFactory("StrategyFlashSwapTester");
    strategyFlashswap = (await StrategyFlashswap.deploy(uniswapFactory.address, weth.address)) as StrategyFlashSwapTester;
  })

  describe("Flashswap call", async () => {
    it("test flashswap call", async () => {
      await strategyFlashswap.connect(owner).flashLoan(weth.address, dai.address, BigNumber.from(0), BigNumber.from(0), 3000)
      expect(BigNumber.from(await strategyFlashswap.callbackData()).eq(BigNumber.from(0))).to.be.true
    })
  })
})