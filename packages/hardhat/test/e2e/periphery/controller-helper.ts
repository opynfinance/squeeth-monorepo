// // mainnet fork tests
// import { ethers } from "hardhat"
// import { expect } from "chai";
// import { Contract, BigNumber, providers } from "ethers";
// import BigNumberJs from 'bignumber.js'

// import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers";
// import { WETH9, MockErc20, ShortPowerPerp, Controller, Oracle, WPowerPerp, ControllerHelper, INonfungiblePositionManager} from "../../../typechain";
// import { deployUniswapV3, deploySqueethCoreContracts, deployWETHAndDai, addWethDaiLiquidity, addSqueethLiquidity } from '../../setup'
// import { isSimilar, wmul, wdiv, one, oracleScaleFactor, getNow } from "../../utils"

// BigNumberJs.set({EXPONENTIAL_AT: 30})

// describe("ControllerHelper: mainnet fork", function () {
//   const startingEthPrice = 3000
//   const startingEthPrice1e18 = BigNumber.from(startingEthPrice).mul(one) // 3000 * 1e18
//   const scaledStartingSqueethPrice1e18 = startingEthPrice1e18.div(oracleScaleFactor) // 0.3 * 1e18
//   const scaledStartingSqueethPrice = startingEthPrice / oracleScaleFactor.toNumber() // 0.3


//   let provider: providers.JsonRpcProvider;
//   let owner: SignerWithAddress;
//   let depositor: SignerWithAddress;
//   let feeRecipient: SignerWithAddress;
//   let dai: MockErc20
//   let weth: WETH9
//   let positionManager: Contract
//   let uniswapFactory: Contract
//   let uniswapRouter: Contract
//   let oracle: Oracle
//   let controller: Controller
//   let wSqueethPool: Contract
//   let wSqueeth: WPowerPerp
//   let ethDaiPool: Contract
//   let controllerHelper: ControllerHelper
//   let shortSqueeth: ShortPowerPerp
// }