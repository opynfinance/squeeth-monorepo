import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers";
import { ethers } from "hardhat"
import { expect } from "chai";
import { BigNumber, providers } from "ethers";
import { Controller, MockWSqueeth, MockVaultNFTManager, MockOracle, MockUniswapV3Pool, MockErc20 } from "../../typechain";

import { isEmptyVault, UNDERFLOW_ERROR } from '../vault-utils'

describe("Controller", function () {
  let squeeth: MockWSqueeth;
  let shortNFT: MockVaultNFTManager;
  let controller: Controller;
  let squeethEthPool: MockUniswapV3Pool;
  let ethUSDPool: MockUniswapV3Pool;
  let oracle: MockOracle;
  let weth: MockErc20;
  let usdc: MockErc20;
  let provider: providers.JsonRpcProvider;
  let seller1: SignerWithAddress
  let random: SignerWithAddress

  this.beforeAll("Prepare accounts", async() => {
    const accounts = await ethers.getSigners();
    const [,_seller1, _random] = accounts;
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
    weth = (await MockErc20Contract.deploy("WETH", "WETH")) as MockErc20;
    usdc = (await MockErc20Contract.deploy("USDC", "USDC")) as MockErc20;

    const MockUniswapV3PoolContract = await ethers.getContractFactory("MockUniswapV3Pool");
    squeethEthPool = (await MockUniswapV3PoolContract.deploy()) as MockUniswapV3Pool;
    ethUSDPool = (await MockUniswapV3PoolContract.deploy()) as MockUniswapV3Pool;

    await squeethEthPool.setPoolTokens(weth.address, squeeth.address);
    await ethUSDPool.setPoolTokens(weth.address, usdc.address);

    await oracle.connect(random).setPrice(squeethEthPool.address, "1" ,ethers.utils.parseUnits('3010')) // eth per 1 squeeth
    await oracle.connect(random).setPrice(ethUSDPool.address, "1" ,ethers.utils.parseUnits('3000'))  // usdc per 1 eth
  });

  describe("Deployment", async () => {
    it("Deployment", async function () {
      const ControllerContract = await ethers.getContractFactory("Controller");
      controller = (await ControllerContract.deploy()) as Controller;
    });
  });

  describe("Initialization", async () => {
    it("Should be able to init contract", async () => {
      await controller.init(oracle.address, shortNFT.address, squeeth.address, weth.address, usdc.address, ethUSDPool.address, squeethEthPool.address);
      const squeethAddr = await controller.squeeth();
      const nftAddr = await controller.vaultNFT();
      expect(squeethAddr).to.be.eq(
        squeeth.address,
        "squeeth address mismatch"
      );
      expect(nftAddr).to.be.eq(shortNFT.address, "nft address mismatch");
    });

    it("Should revert when init is called again", async () => {
      await expect(
        controller.init(oracle.address, shortNFT.address, squeeth.address, weth.address, usdc.address, ethUSDPool.address, squeethEthPool.address)
      ).to.be.revertedWith("Initializable: contract is already initialized");
    });
  });

  describe("Basic actions", function () {

    let vaultId: BigNumber;

    describe("#Mint: Open vault", async () => {
      it("Should be able to open vaults", async () => {
        vaultId = await shortNFT.nextId()
        const nftBalanceBefore = await shortNFT.balanceOf(seller1.address)
        await controller.connect(seller1).mint(0, 0) // putting vaultId = 0 to open vault

        // total short position nft should increase
        const nftBalanceAfter = await shortNFT.balanceOf(seller1.address)
        expect(nftBalanceAfter.eq(nftBalanceBefore.add(1))).is.true;

        // the newly created vault should be empty
        const vault = await controller.vaults(vaultId)
        expect(isEmptyVault(vault)).to.be.true
      });
    });

    describe("#Deposit: Deposit collateral", async () => {
      it("Should be able to deposit collateral", async () => {
        const depositAmount = ethers.utils.parseUnits('45')
        const controllerBalanceBefore = await provider.getBalance(controller.address)
        const vaultBefore = await controller.vaults(vaultId)
        
        await controller.connect(seller1).deposit(vaultId,{value: depositAmount})
        
        const controllerBalanceAfter = await provider.getBalance(controller.address)
        const vaultAfter = await controller.vaults(vaultId)
        
        expect(controllerBalanceBefore.add(depositAmount).eq(controllerBalanceAfter)).to.be.true
        expect(vaultBefore.collateralAmount.add(depositAmount).eq(vaultAfter.collateralAmount)).to.be.true
      });
    });

    describe("#Mint: Mint Squeeth", async () => {
      it("Should revert if not called by owner", async () => {
        const mintAmount = ethers.utils.parseUnits('0.01')
        
        await expect(controller.connect(random).mint(vaultId, mintAmount)).to.be.revertedWith(
          'not allowed'
        )
      });
      it("Should be able to mint squeeth", async () => {
        const mintAmount = ethers.utils.parseUnits('0.01')
        
        const vaultBefore = await controller.vaults(vaultId)
        const squeethBalanceBefore = await squeeth.balanceOf(seller1.address)
        
        await controller.connect(seller1).mint(vaultId, mintAmount)

        const squeethBalanceAfter = await squeeth.balanceOf(seller1.address)
        const vaultAfter = await controller.vaults(vaultId)
        const normFactor = await controller.normalizationFactor()

        expect(vaultBefore.shortAmount.add(mintAmount.mul(ethers.utils.parseUnits('1')).div(normFactor)).eq(vaultAfter.shortAmount)).to.be.true
        expect(squeethBalanceBefore.add(mintAmount.mul(ethers.utils.parseUnits('1')).div(normFactor)).eq(squeethBalanceAfter)).to.be.true
      });
    });

    describe("#Burn: Burn Squeeth", async () => {
      it("Should revert if trying to burn more than minted", async () => {
        const vault = await controller.vaults(vaultId)
        await expect(controller.connect(seller1).burn(vaultId, vault.shortAmount.add(1), 0)).to.be.revertedWith(UNDERFLOW_ERROR)
      });
      it("Should revert if trying to burn without having squeeth", async () => {
        const vault = await controller.vaults(vaultId)
        // address random has no squeeth in his wallet - this is really testing not that 0 balance can be burned but more that a person isnt allowed to burn cant, right?
        // update test to note that it reverts based on burn amount exceeding balance
        // I think this should really be split into 2 tests:
        // 1. test someone that has squeeth trying to burn someone else's vault
        // 2. test someone that doesn't have squeeth trying to burn their own vault
        await expect(controller.connect(random).burn(vaultId, vault.shortAmount, 0)).to.be.revertedWith(
          'ERC20: burn amount exceeds balance'
        )
      });
      it("Should be able to burn squeeth", async () => {
        const vaultBefore = await controller.vaults(vaultId)
        const burnAmount = vaultBefore.shortAmount;
        const squeethBalanceBefore = await squeeth.balanceOf(seller1.address)
        const withdrawAmount = 0

        await controller.connect(seller1).burn(vaultId, burnAmount, withdrawAmount)

        const squeethBalanceAfter = await squeeth.balanceOf(seller1.address)
        const vaultAfter = await controller.vaults(vaultId)

        expect(vaultBefore.shortAmount.sub(burnAmount).eq(vaultAfter.shortAmount)).to.be.true
        expect(squeethBalanceBefore.sub(burnAmount).eq(squeethBalanceAfter)).to.be.true
      });
    });

    describe("#Withdraw: Remove Collateral", async () => {
      it("Should revert if caller is not the owner", async () => {
        const vault = await controller.vaults(vaultId)
        await expect(controller.connect(random).withdraw(vaultId, vault.collateralAmount)).to.be.revertedWith(
          'not allowed'
        )
      })
      it("Should revert if trying to remove more collateral than deposited", async () => {
        const vault = await controller.vaults(vaultId)
        await expect(controller.connect(seller1).burn(vaultId, 0, vault.collateralAmount.add(1))).to.be.revertedWith(UNDERFLOW_ERROR)
      })
      it("Should be able to remove collateral", async () => {
        const vaultBefore = await controller.vaults(vaultId)
        const withdrawAmount = vaultBefore.collateralAmount.div(2)
        const burnAmount = 0
        const controllerBalanceBefore = await provider.getBalance(controller.address)
        
        await controller.connect(seller1).burn(vaultId, burnAmount, withdrawAmount)
        
        const controllerBalanceAfter = await provider.getBalance(controller.address)
        const vaultAfter = await controller.vaults(vaultId)

        expect(controllerBalanceBefore.sub(withdrawAmount).eq(controllerBalanceAfter)).to.be.true
        expect(vaultBefore.collateralAmount.sub(withdrawAmount).eq(vaultAfter.collateralAmount)).to.be.true
      });
      it("Should close the vault when it's empty", async () => {
        const vaultBefore = await controller.vaults(vaultId)
        const withdrawAmount = vaultBefore.collateralAmount
        const nftBalanceBefore = await shortNFT.balanceOf(seller1.address)
        const burnAmount = vaultBefore.shortAmount
        const controllerBalanceBefore = await provider.getBalance(controller.address)
        
        await controller.connect(seller1).burn(vaultId, burnAmount, withdrawAmount)
        
        const controllerBalanceAfter = await provider.getBalance(controller.address)
        const nftBalanceAfter = await shortNFT.balanceOf(seller1.address)

        expect(controllerBalanceBefore.sub(withdrawAmount).eq(controllerBalanceAfter)).to.be.true
        expect(nftBalanceAfter.eq(nftBalanceBefore)).to.be.true // nft is not burned
      });
    });
  });

  describe('Combined actions', async() => {

    let vaultId: BigNumber

    describe('Open, deposit and mint', () => {
      it('should open vault, deposit and mint in the same tx', async() => {
        vaultId = await shortNFT.nextId()
        const mintAmount = ethers.utils.parseUnits('0.01')
        const collateralAmount = ethers.utils.parseUnits('45') 

        const controllerBalanceBefore = await provider.getBalance(controller.address)
        const nftBalanceBefore = await shortNFT.balanceOf(seller1.address)
        const squeethBalanceBefore = await squeeth.balanceOf(seller1.address)

        // put vaultId as 0 to open vault
        await controller.connect(seller1).mint(0, mintAmount, {value: collateralAmount})

        const normFactor = await controller.normalizationFactor()
        const controllerBalanceAfter = await provider.getBalance(controller.address)
        const nftBalanceAfter = await shortNFT.balanceOf(seller1.address)
        const squeethBalanceAfter = await squeeth.balanceOf(seller1.address)
        const newVault = await controller.vaults(vaultId)

        expect(nftBalanceBefore.add(1).eq(nftBalanceAfter)).to.be.true
        expect(controllerBalanceBefore.add(collateralAmount).eq(controllerBalanceAfter)).to.be.true
        expect(squeethBalanceBefore.add(mintAmount.mul(ethers.utils.parseUnits('1')).div(normFactor)).eq(squeethBalanceAfter)).to.be.true

        expect(newVault.collateralAmount.eq(collateralAmount)).to.be.true
        expect(newVault.shortAmount.eq(mintAmount.mul(ethers.utils.parseUnits('1')).div(normFactor))).to.be.true
      })
    })

    describe('Deposit and mint', () => {
      it('should deposit and mint in the same tx', async() => {
        // mint some other squeeth in vault 2.
        const mintAmount = ethers.utils.parseUnits('0.01')
        const collateralAmount = ethers.utils.parseUnits('45')

        const controllerBalanceBefore = await provider.getBalance(controller.address)
        const squeethBalanceBefore = await squeeth.balanceOf(seller1.address)
        const vaultBefore = await controller.vaults(vaultId)

        await controller.connect(seller1).mint(vaultId, mintAmount, {value: collateralAmount})

        const normFactor = await controller.normalizationFactor()
        const controllerBalanceAfter = await provider.getBalance(controller.address)
        const squeethBalanceAfter = await squeeth.balanceOf(seller1.address)
        const vaultAfter = await controller.vaults(vaultId)

        expect(controllerBalanceBefore.add(collateralAmount).eq(controllerBalanceAfter)).to.be.true
        expect(squeethBalanceBefore.add(mintAmount.mul(ethers.utils.parseUnits('1')).div(normFactor)).eq(squeethBalanceAfter)).to.be.true

        expect(vaultBefore.collateralAmount.add(collateralAmount).eq(vaultAfter.collateralAmount)).to.be.true
        expect(vaultBefore.shortAmount.add(mintAmount.mul(ethers.utils.parseUnits('1')).div(normFactor)).eq(vaultAfter.shortAmount)).to.be.true
      })
    })

    describe('Deposit and mint By operator', () => {
      it('should add an operator', async () => {
        await controller.connect(seller1).updateOperator(vaultId, random.address)
        const vault = await controller.vaults(vaultId)
        expect(vault.operator).to.be.eq(random.address)
      })
      it('should deposit and mint in the same tx', async() => {
        // mint some other squeeth in vault 2.
        const mintAmount = ethers.utils.parseUnits('0.01')
        const collateralAmount = ethers.utils.parseUnits('45')

        const controllerBalanceBefore = await provider.getBalance(controller.address)
        const squeethBalanceBefore = await squeeth.balanceOf(random.address)
        const vaultBefore = await controller.vaults(vaultId)

        await controller.connect(random).mint(vaultId, mintAmount, {value: collateralAmount})

        const controllerBalanceAfter = await provider.getBalance(controller.address)
        const squeethBalanceAfter = await squeeth.balanceOf(random.address)
        const vaultAfter = await controller.vaults(vaultId)

        expect(controllerBalanceBefore.add(collateralAmount).eq(controllerBalanceAfter)).to.be.true
        expect(squeethBalanceBefore.add(mintAmount).eq(squeethBalanceAfter)).to.be.true

        expect(vaultBefore.collateralAmount.add(collateralAmount).eq(vaultAfter.collateralAmount)).to.be.true
        expect(vaultBefore.shortAmount.add(mintAmount).eq(vaultAfter.shortAmount)).to.be.true
      })
    })
  })
  
 /*  describe('Funding actions', async() => {

    let vaultId: BigNumber

    const squeethPrice = 3010
    const ethPrice = 3000

    const sqPx=squeethPrice.toString()
    const ethPx=squeethPrice.toString()

    await oracle.connect(random).setPrice(squeethEthPool.address, "1" ,ethers.utils.parseUnits(sqPx))
    await oracle.connect(random).setPrice(ethUSDPool.address, "1" ,ethers.utils.parseUnits(ethPx))

    describe('Normalization Factor tests', () => {
      it('should apply the correct normalization factor for funding', async() => {

        const normalizationFactorBefore = await controller.connect(seller1).normalizationFactor()

        const fractionalDayElapsed = 1/24 //1 hour
        await provider.send("evm_increaseTime", [fractionalDayElapsed * 60*60*24]) // 60*60 = 3600s = 1 hour

        const index = ethPrice
        const mark = squeethPrice

        const expectedNormFactor = mark / ((1+fractionalDayElapsed)*mark-index*fractionalDayElapsed)

        const expectedNormalizationFactor = normalizationFactorBefore.mul(expectedNormFactor)

        await controller.connect(seller1).applyFunding()
        const normalizationFactorAfter = await controller.connect(seller1).normalizationFactor()

        expect(expectedNormalizationFactor.eq(normalizationFactorAfter)).to.be.true


      }) */

      /* describe('Vault collateralization after funding', () => {
      it('should be able to mint more wSqueeth after funding', async() => {
        vaultId = await shortNFT.nextId()
        const mintAmount = ethers.utils.parseUnits('1')
        const collateralAmount = ethers.utils.parseUnits('4500')

        const controllerBalanceBefore = await provider.getBalance(controller.address)
        const nftBalanceBefore = await shortNFT.balanceOf(seller1.address)
        const squeethBalanceBefore = await squeeth.balanceOf(seller1.address)

        // put vaultId as 0 to open vault
        await controller.connect(seller1).mint(0, mintAmount, {value: collateralAmount})

        const controllerBalanceAfter = await provider.getBalance(controller.address)
        const nftBalanceAfter = await shortNFT.balanceOf(seller1.address)
        const squeethBalanceAfter = await squeeth.balanceOf(seller1.address)
        const newVault = await controller.vaults(vaultId)

        expect(nftBalanceBefore.add(1).eq(nftBalanceAfter)).to.be.true
        expect(controllerBalanceBefore.add(collateralAmount).eq(controllerBalanceAfter)).to.be.true
        expect(squeethBalanceBefore.add(mintAmount).eq(squeethBalanceAfter)).to.be.true

        expect(newVault.collateralAmount.eq(collateralAmount)).to.be.true
        expect(newVault.shortAmount.eq(mintAmount)).to.be.true

        const fractionalDayElapsed = 1/24 //1 hour
        await provider.send("evm_increaseTime", [fractionalDayElapsed * 60*60*24]) // 60*60 = 3600s = 1 hour

        const index = ethPrice
        const mark = squeethPrice

        expectedNormFactor = mark / ((1+fractionlDayElapsed)*mark-index*fractionalDayElapsed)


        await controller.connect(seller1).applyFunding()
        const normalizationFactor = await controller.connect(seller1).normalizationFactor()
        const additionalMintAmount = 
        await controller.connect(seller1).mint(vaultId, mintAmount, {value: 0})




      })
 
    
      it('should be able to withdraw collateral after funding', async() => {
        vaultId = await shortNFT.nextId()
        const mintAmount = ethers.utils.parseUnits('0.1')
        const collateralAmount = ethers.utils.parseUnits('1')

        const controllerBalanceBefore = await provider.getBalance(controller.address)
        const nftBalanceBefore = await shortNFT.balanceOf(seller1.address)
        const squeethBalanceBefore = await squeeth.balanceOf(seller1.address)

        // put vaultId as 0 to open vault
        await controller.connect(seller1).mint(0, mintAmount, {value: collateralAmount})

        const controllerBalanceAfter = await provider.getBalance(controller.address)
        const nftBalanceAfter = await shortNFT.balanceOf(seller1.address)
        const squeethBalanceAfter = await squeeth.balanceOf(seller1.address)
        const newVault = await controller.vaults(vaultId)

        expect(nftBalanceBefore.add(1).eq(nftBalanceAfter)).to.be.true
        expect(controllerBalanceBefore.add(collateralAmount).eq(controllerBalanceAfter)).to.be.true
        expect(squeethBalanceBefore.add(mintAmount).eq(squeethBalanceAfter)).to.be.true

        expect(newVault.collateralAmount.eq(collateralAmount)).to.be.true
        expect(newVault.shortAmount.eq(mintAmount)).to.be.true
      })

      describe('Vault collateralization after funding', () => {
      it('should be able to mint more wSqueeth after funding', async() => {
        vaultId = await shortNFT.nextId()
        const mintAmount = ethers.utils.parseUnits('1')
        const collateralAmount = ethers.utils.parseUnits('4500')

        const controllerBalanceBefore = await provider.getBalance(controller.address)
        const nftBalanceBefore = await shortNFT.balanceOf(seller1.address)
        const squeethBalanceBefore = await squeeth.balanceOf(seller1.address)

        // put vaultId as 0 to open vault
        await controller.connect(seller1).mint(0, mintAmount, {value: collateralAmount})

        const controllerBalanceAfter = await provider.getBalance(controller.address)
        const nftBalanceAfter = await shortNFT.balanceOf(seller1.address)
        const squeethBalanceAfter = await squeeth.balanceOf(seller1.address)
        const newVault = await controller.vaults(vaultId)

        expect(nftBalanceBefore.add(1).eq(nftBalanceAfter)).to.be.true
        expect(controllerBalanceBefore.add(collateralAmount).eq(controllerBalanceAfter)).to.be.true
        expect(squeethBalanceBefore.add(mintAmount).eq(squeethBalanceAfter)).to.be.true

        expect(newVault.collateralAmount.eq(collateralAmount)).to.be.true
        expect(newVault.shortAmount.eq(mintAmount)).to.be.true

        await provider.send("evm_increaseTime", [3600]) // 60*60 = 3600s = 1 hour

        await controller.connect(seller1).applyFunding()
        const normalizationFactor = await controller.connect(seller1).normalizationFactor()



        await controller.connect(seller1).mint(0, mintAmount, {value: collateralAmount})
        
      }) */
 //   })
//  })
});
