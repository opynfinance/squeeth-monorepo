// mainnet fork tests
// in 1 terminal: npx hardhat node --fork https://mainnet.infura.io/v3/infura_key --fork-block-number 14345140 --no-deploy --network hardhat
// in 2 terminal: MAINNET_FORK=true npx hardhat test ./test/e2e/periphery/controller-helper.ts
import { ethers, network} from "hardhat"
import { expect } from "chai";
import { Contract, BigNumber, providers, BytesLike, BigNumberish, constants } from "ethers";
import BigNumberJs from 'bignumber.js'

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { WETH9, MockErc20, ShortPowerPerp, Controller, Oracle, WPowerPerp, ControllerHelper, INonfungiblePositionManager, SqrtPriceMathPartial} from "../../../typechain";
import { deployUniswapV3, deploySqueethCoreContracts, deployWETHAndDai, addWethDaiLiquidity, addSqueethLiquidity } from '../../setup'
import { isSimilar, wmul, wdiv, one, oracleScaleFactor, getNow } from "../../utils"

import {
  abi as POSITION_MANAGER_ABI,
  bytecode as POSITION_MANAGER_BYTECODE,
} from '@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json'
import {
  abi as FACTORY_ABI,
  bytecode as FACTORY_BYTECODE,
} from '@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json'
import {
  abi as ROUTER_ABI,
  bytecode as ROUTER_BYTECODE,
} from '@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json'
import {
  abi as POOL_ABI,
  bytecode as POOL_BYTECODE,
} from '@uniswap/v3-core/artifacts/contracts/UniswapV3Pool.sol/UniswapV3Pool.json'

import {
  abi as QUOTER_ABI,
  bytecode as QUOTER_BYTECODE,
} from "@uniswap/v3-periphery/artifacts/contracts/lens/Quoter.sol/Quoter.json"


BigNumberJs.set({EXPONENTIAL_AT: 30})

const impersonateAddress = async (address: string) => {
  const hre = require('hardhat');
  await hre.network.provider.request({
    method: 'hardhat_impersonateAccount',
    params: [address],
  });
  let signer: any;
  signer = await ethers.provider.getSigner(address);
  signer.address = signer._address;
  signer._signer = signer;
  return signer;
};

describe("ControllerHelper: mainnet fork", function () {
  if (!process.env.MAINNET_FORK) return;

  let provider: providers.JsonRpcProvider;
  let owner: SignerWithAddress;
  let depositor: SignerWithAddress;
  let controllerSigner: SignerWithAddress;
  // let depositor: JsonRpcSigner
  let feeRecipient: SignerWithAddress;
  let usdc: Contract
  let weth: Contract
  let positionManager: Contract
  let uniswapFactory: Contract
  let uniswapRouter: Contract
  let oracle: Oracle
  let controller: Controller
  let wSqueethPool: Contract
  let wSqueeth: WPowerPerp
  let ethUsdcPool: Contract
  let controllerHelper: ControllerHelper
  let shortSqueeth: ShortPowerPerp
  let quoter: Contract

  this.beforeAll("Setup ropsten fork contracts", async () => {
    depositor = await impersonateAddress("0xeb1C15146E98E461252B98217FdCa25c6c1f3875");
    // owner = await impersonateAddress('0xeb1C15146E98E461252B98217FdCa25c6c1f3875');
    controllerSigner = await impersonateAddress('0x59F0c781a6eC387F09C40FAA22b7477a2950d209');
    // const usdcContract = await ethers.getContractFactory("MockErc20")
    usdc = await ethers.getContractAt("MockErc20", "0x27415c30d8c87437becbd4f98474f26e712047f4")
    // const wethContract = await ethers.getContractFactory("WETH9")
    // weth = await wethContract.attach("0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2")
    weth = await ethers.getContractAt("WETH9", "0xc778417e063141139fce010982780140aa0cd5ab");

    positionManager = await ethers.getContractAt(POSITION_MANAGER_ABI, "0x8c7c1f786da4dee7d4bb49697a9b0c0c8fb328e0");
    uniswapFactory = await ethers.getContractAt(FACTORY_ABI, "0xa9C2f675FF8290494675dF5CFc2733319EaeeFDc");
    uniswapRouter = await ethers.getContractAt(ROUTER_ABI, "0x528a19A3e88861E7298C86fE5490B8Ec007a4204");

    controller = (await ethers.getContractAt("Controller", "0x59F0c781a6eC387F09C40FAA22b7477a2950d209")) as Controller
    controllerHelper = (await ethers.getContractAt("ControllerHelper", "0x7e9C5490e91F93529c6480B46a59D738F6bcEa43")) as ControllerHelper
    wSqueeth = (await ethers.getContractAt("WPowerPerp", "0xa4222f78d23593e82Aa74742d25D06720DCa4ab7")) as WPowerPerp
    oracle = (await ethers.getContractAt("Oracle", "0xBD9F4bE886653177D22fA9c79FD0DFc41407fC89")) as Oracle
    shortSqueeth = (await ethers.getContractAt("ShortPowerPerp", "0x49721ED2d693F3653BC1216b8E330fA53CFC80eD")) as ShortPowerPerp
    wSqueethPool = await ethers.getContractAt(POOL_ABI, "0x921c384F79de1BAe96d6f33E3E5b8d0B2B34cb68")
    ethUsdcPool = await ethers.getContractAt(POOL_ABI, "0x8356AbC730a218c24446C2c85708F373f354F0D8");
    quoter = await ethers.getContractAt(QUOTER_ABI, "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6");

    const TickMathExternal = await ethers.getContractFactory("TickMathExternal")
    const TickMathExternalLib = (await TickMathExternal.deploy());

    const SqrtPriceMathPartial = await ethers.getContractFactory("SqrtPriceMathPartial")
    const SqrtPriceMathPartialLib = (await SqrtPriceMathPartial.deploy());

    const ControllerHelperUtil = await ethers.getContractFactory("ControllerHelperUtil", {libraries: {TickMathExternal: TickMathExternalLib.address, SqrtPriceMathPartial: SqrtPriceMathPartialLib.address}});
    const ControllerHelperUtilLib = (await ControllerHelperUtil.deploy());
    
    // const ControllerHelperContract = await ethers.getContractFactory("ControllerHelper", {libraries: {ControllerHelperUtil: ControllerHelperUtilLib.address}});
    // controllerHelper = (await ControllerHelperContract.deploy(controller.address, positionManager.address, uniswapFactory.address, "0xF7B8611008Ed073Ef348FE130671688BBb20409d", "0xfC3DD73e918b931be7DEfd0cc616508391bcc001", "0xc778417e063141139fce010982780140aa0cd5ab")) as ControllerHelper;
    // controllerHelper = await ethers.getContractAt("ControllerHelper", "0x7e9C5490e91F93529c6480B46a59D738F6bcEa43");

    // console.log(controllerHelper.address)
})

  describe("Rebalance LP in vault to just weth", async () => {

  it("Close vault LP and open new one-sided LP with just eth ", async () => {
    // Get vault and LP info

    //adddress = 0xeb1C15146E98E461252B98217FdCa25c6c1f3875
    //tokenId = 303
    //vaultId = 682

    const tokenId = 303
    const vaultId = 719
    // Range above current tick
    const newTickLower = -30000
    const newTickUpper = 0

    const depositorSqueethBalanceBefore = await wSqueeth.balanceOf(depositor.address)
    const depositorEthBalanceBefore = await ethers.provider.getBalance(depositor.address)

    const positionBefore = await (positionManager as INonfungiblePositionManager).positions(tokenId)

    const isWethToken0 : boolean = parseInt(weth.address, 16) < parseInt(wSqueeth.address, 16)
    // Get current LPpositions 
    await controller.connect(depositor).updateOperator(vaultId, controllerHelper.address)
    // console.log("updated operator")
    // const [amount0, amount1] = await (positionManager as INonfungiblePositionManager).connect(depositor).callStatic.decreaseLiquidity({
    //   tokenId: tokenId,
    //   liquidity: positionBefore.liquidity,
    //   amount0Min: 0,
    //   amount1Min: 0,
    //   deadline: Math.floor(await getNow(ethers.provider) + 8640000),
    // })
    console.log("after decrease liquidity")
    const wPowerPerpAmountInLPBefore = "50593076939278892537";
    const wethAmountInLPBefore = "10446040891938315491"

    console.log(wPowerPerpAmountInLPBefore.toString(), wethAmountInLPBefore.toString())

    const vaultBefore = await controller.vaults(vaultId);

    // Setup for mint of new LP
    //const isWethToken0 : boolean = parseInt(weth.address, 16) < parseInt(wSqueeth.address, 16) 
    const amount0Min = BigNumber.from(0);
    const amount1Min = BigNumber.from(0);
    // Estimate proceeds from liquidating squeeth in LP

    // Estimate of new LP with 0.01 weth safety margin
    const wethAmountToLP = "5316101261948031546"
    const wPowerPerpToLP = "27604006698038405753"
    const amountIn = "5129939629990283945"
    // Setup rebalanceVaultNft call
    const abiCoder = new ethers.utils.AbiCoder
    const rebalanceLpInVaultParams = [
      {
        // Liquidate LP
        rebalanceLpInVaultType: BigNumber.from(1), // DecreaseLpLiquidity:
        // DecreaseLpLiquidityParams: [tokenId, liquidity, liquidityPercentage, amount0Min, amount1Min]
        data: abiCoder.encode(["uint256", 'uint256', 'uint256', 'uint128', 'uint128'],
         [tokenId, positionBefore.liquidity, BigNumber.from(100).mul(BigNumber.from(10).pow(16)), BigNumber.from(0), BigNumber.from(0)])
        },
        {
        // Sell all oSQTH for ETH
        rebalanceLpInVaultType: BigNumber.from(5), // GeneralSwap:
          // GeneralSwap: [tokenIn, tokenOut, amountIn, limitPrice]
          data: abiCoder.encode(["address", 'address', 'uint256', 'uint256', 'uint24'],
           [weth.address, wSqueeth.address, amountIn, BigNumber.from(0), 3000])
          },
       {
         // Mint new LP 
         rebalanceLpInVaultType:  BigNumber.from(4), // MintNewLP
         // lpWPowerPerpPool: [recipient, wPowerPerpPool, vaultId, wPowerPerpAmount, collateralToDeposit, collateralToLP, amount0Min, amount1Min, lowerTick, upperTick ]
         data: abiCoder.encode(["address", "address", "uint256", 'uint256','uint256', 'uint256', 'uint256', 'uint256', 'int24', 'int24'],
          [controllerHelper.address, wSqueethPool.address, vaultId, wPowerPerpToLP, BigNumber.from(0), wethAmountToLP, amount0Min, amount1Min, newTickLower, newTickUpper])
       }
    ]
    // Flashloan to cover complete removal of LP (rearrange collateral ratio formula for 1.5 and add 0.01 ETH safety margin)
    const normFactor = await controller.getExpectedNormalizationFactor()
    const ethPrice = await oracle.getTwap(ethUsdcPool.address, weth.address, usdc.address, 420, true)
    console.log("beforecall")

    // flashloan amount to cover withdrawn LP
    const flashLoanAmount = (vaultBefore.shortAmount).mul(normFactor).mul(ethPrice).mul(3).div(one.mul(one).mul(10000).mul(2)).sub(vaultBefore.collateralAmount).add(ethers.utils.parseUnits('0.1'))
    console.log("flashLoanAmount", flashLoanAmount.toString())
    // Rebalance vault
    const tx = await controllerHelper.connect(depositor).rebalanceLpInVault(vaultId, flashLoanAmount, rebalanceLpInVaultParams)
    console.log("aftercall")

    const receipt = await tx.wait()
/*     const gasSpent = receipt.gasUsed.mul(receipt.effectiveGasPrice)
    const depositorSqueethBalanceAfter = await wSqueeth.balanceOf(depositor.address)
    const depositorEthBalanceAfter = await ethers.provider.getBalance(depositor.address)
    // Get new vault and LP info
    const vaultAfter = await controller.vaults(vaultId);
    const tokenIdAfter = vaultAfter.NftCollateralId;
    const positionAfter = await (positionManager as INonfungiblePositionManager).positions(tokenIdAfter)
    const [amount0After, amount1After] = await (positionManager as INonfungiblePositionManager).connect(controllerSigner).callStatic.decreaseLiquidity({
      tokenId: tokenIdAfter,
      liquidity: positionAfter.liquidity,
      amount0Min: 0,
      amount1Min: 0,
      deadline: Math.floor(await getNow(ethers.provider) + 8640000),
    })
    const wPowerPerpAmountInLPAfter = (isWethToken0) ? amount1After : amount0After;
    const wethAmountInLPAfter = (isWethToken0) ? amount0After : amount1After;
    // Changes
    const depositorEthDiff = depositorEthBalanceAfter.sub(depositorEthBalanceBefore)
    const depositorSqueethDiff = depositorSqueethBalanceAfter.sub(depositorSqueethBalanceBefore)
    const vaultEthDiff = vaultAfter.collateralAmount.sub(vaultBefore.collateralAmount)
    const vaultSqueethDiff = vaultAfter.shortAmount.sub(vaultBefore.shortAmount)
    const lpEthDiff = wethAmountInLPAfter.sub(wethAmountInLPBefore)
    const lpSqueethDiff = wPowerPerpAmountInLPAfter.sub(wPowerPerpAmountInLPBefore)
    // Assertions
    expect(flashLoanAmount.gt(0)).to.be.true
    expect(positionAfter.tickLower === newTickLower).to.be.true
    expect(positionAfter.tickUpper === newTickUpper).to.be.true
    expect(vaultAfter.shortAmount.eq(vaultBefore.shortAmount)).to.be.true
    expect(vaultAfter.collateralAmount.eq(vaultBefore.collateralAmount)).to.be.true
    expect(vaultAfter.NftCollateralId==vaultBefore.NftCollateralId).to.be.false
    expect(wPowerPerpAmountInLPAfter.eq(BigNumber.from(0))).to.be.true
    expect(lpEthDiff.sub(ethAmountOutFromSwap).add(safetyEth).abs().lte(10)).to.be.true
 */  })

})


})