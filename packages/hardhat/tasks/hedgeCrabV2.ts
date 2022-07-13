import { task, types } from "hardhat/config";
import "@nomiclabs/hardhat-waffle";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber } from "ethers";
import { getUniswapDeployments, getWETH } from "./utils";
import { CrabStrategyV2, Oracle, WETH9, WPowerPerp } from "../typechain";






/**
 npx hardhat increase-slots --network mainnet --slots 128
 */
task("hedgeOtc", "Hedges crab v2 strategy")
  .setAction(async ({ slots }, hre) => {

    const { getNamedAccounts, ethers, network } = hre;

    const { deployer } = await getNamedAccounts();

    const signer = await SignerWithAddress.create(ethers.provider.getSigner(deployer));



    console.log('HedgeOTC started', network.name)


    // const crabV2: CrabStrategyV2 = await ethers.getContract("CrabStrategyV2", deployer);
    const crabV2: CrabStrategyV2 = await ethers.getContractAt("CrabStrategyV2", "0xdD1e9c25115e0d6e531d9F9E6ab7dbbEd15158Ce", deployer);
    const weth: WETH9 = await ethers.getContractAt("WETH9", "0xc778417e063141139fce010982780140aa0cd5ab", deployer);
    const oSqth: WPowerPerp = await ethers.getContractAt("WPowerPerp", "0xa4222f78d23593e82aa74742d25d06720dca4ab7", deployer);

    // const oracle: CrabStrategyV2 = await ethers.getContract("CrabStrategyV2", deployer);

    const signTypedData = async (sig: SignerWithAddress, domainData: any, type: any, data: any) => {
      const signature2 = await sig._signTypedData(domainData, type, data);
      const { r: r1, s: s1, v: v1 } = ethers.utils.splitSignature(signature2);
      return {
        ...data,
        r: r1,
        s: s1,
        v: String(v1),
      };
    };

    const typeData = {
      Order: [
        { type: "uint256", name: "bidId" },
        { type: "address", name: "trader" },
        { type: "uint256", name: "quantity" },
        { type: "uint256", name: "price" },
        { type: "bool", name: "isBuying" },
        { type: "uint256", name: "expiry" },
        { type: "uint256", name: "nonce" },
      ],
    };
    const domainData = {
      name: "CrabOTC",
      version: "2",
      chainId: 3,
      verifyingContract: crabV2.address,
    };


    const one = BigNumber.from('1000000000000000000')
    const price = BigNumber.from('204885807681849200')

    const orderHash = {
      bidId: 0,
      trader: deployer,
      quantity: one.mul(4).toString(), // 1 sqth
      price: price.toString(),
      isBuying: false,
      expiry: ((Date.now() + 600000) / 1000).toFixed(0),
      nonce: 3
    };

    console.log(Object.values(orderHash))

    const signedOrder = await signTypedData(signer, domainData, typeData, orderHash);

    console.log(signedOrder)

    const txA = await oSqth.connect(signer).approve(crabV2.address, ethers.constants.MaxUint256, {
      gasLimit: 200000
    })
    txA.wait()

    // const limit = await crabV2.estimateGas.hedgeOTC(one, price, false, [signedOrder])
    const tx = await crabV2.connect(signer).hedgeOTC(one.mul(4), price, true, [signedOrder], {
      gasLimit: 500000
    });

    await tx.wait()

    const timeHedge = await crabV2.checkTimeHedge()


    console.log('Is time hedge: ', timeHedge.toString())
  });
