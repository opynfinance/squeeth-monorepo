import { ethers } from "hardhat"
import { BigNumber as BigNumberJs } from "bignumber.js"
import { expect } from "chai";
import { BigNumber } from "ethers";
import { Oracle} from "../../typechain";

import { deployUniswapV3, deploySqueethCoreContracts } from '../setup'


describe("Oracle", function () {
  let oracle: Oracle;

  let squeethPool: string

  this.beforeAll("Deploy uniswap protocol & setup uniswap pool", async() => {
  
    const uniDeployments = await deployUniswapV3()
    const { wsqueethEthPool } = await deploySqueethCoreContracts(
      uniDeployments.weth, 
      uniDeployments.positionManager, 
      uniDeployments.uniswapFactory,
      0.3,
      2000
    )

    squeethPool = wsqueethEthPool

    // deploy oracle
    oracle = (await (await ethers.getContractFactory("Oracle")).deploy()) as Oracle;
  })

  describe("TWAP", async () => {
    it("fetch initial price", async () => {
      const price = new BigNumberJs((await oracle.getTwaPrice(squeethPool, BigNumber.from("1"))).toString())

      const expectedPrice = new BigNumberJs(0.3)

      expect(price.div(1e18).toFixed(1)).to.be.eq(
        expectedPrice.toFixed(1),
        "initial pool price mismatch"
      );
    })    
  })
})
