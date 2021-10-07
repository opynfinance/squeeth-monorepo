import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers";
import { ethers } from "hardhat"
import { expect } from "chai";
import { BigNumber, providers } from "ethers";
import { Controller, MockWSqueeth, MockVaultNFTManager, MockOracle, MockUniswapV3Pool, MockErc20, MockUniPositionManager } from "../../typechain";

import { isEmptyVault } from '../vault-utils'

const squeethETHPrice = ethers.utils.parseUnits('3010')
const ethUSDPrice = ethers.utils.parseUnits('3000')


describe("Controller", function () {
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
  let owner: SignerWithAddress
  let seller1: SignerWithAddress
  let seller2: SignerWithAddress
  let seller3: SignerWithAddress
  let seller4: SignerWithAddress // use for burnRSqueeth tests
  let random: SignerWithAddress

  this.beforeAll("Prepare accounts", async() => {
    const accounts = await ethers.getSigners();
    const [_owner,_seller1, _seller2, _seller3, _seller4, _random] = accounts;
    seller1 = _seller1
    seller2 = _seller2
    seller3 = _seller3
    seller4 = _seller4
    random = _random
    owner = _owner
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

    it("Should revert when init is called again", async () => {
      await expect(
        controller.init(oracle.address, shortNFT.address, squeeth.address, weth.address, usdc.address, ethUSDPool.address, squeethEthPool.address, uniPositionManager.address)
      ).to.be.revertedWith("Initializable: contract is already initialized");
    });
  });

  describe("Basic actions", function () {

    let vaultId: BigNumber;

    describe('#Read basic properties', async() => {
      
      const one = ethers.utils.parseUnits('1')

      it('should be able to get normalization factor', async() => {
        const normFactor = await controller.normalizationFactor()
        const expectedNormFactor = await controller.getExpectedNormalizationFactor()
        // norm factor should be init as 1e18
        expect(normFactor.eq(one)).to.be.true
        // expected norm factor should be smaller than 1, cuz time has pass since function started
        expect(expectedNormFactor.lt(normFactor)).to.be.true


        // update block.timestamp in solidity
        await provider.send("evm_increaseTime", [30])
        await provider.send("evm_mine", [])
        // expected norm factor should go down again
        const expectedNormFactorAfter = await controller.getExpectedNormalizationFactor()
        expect(expectedNormFactorAfter.lt(expectedNormFactor)).to.be.true
      })
      
      it('should be able to get index and mark price', async() => {
        const markPrice = await controller.getDenormalizedMark(30)
        expect(markPrice.eq(squeethETHPrice.mul(ethUSDPrice).div(one))).to.be.true

        const index = await controller.getIndex(30)
        expect(index.eq(ethUSDPrice.mul(ethUSDPrice).div(one))).to.be.true
      })

      it('should revert when sending eth to controller from an EOA', async() => {
        await expect(random.sendTransaction({to: controller.address, value:1})).to.be.revertedWith('Cannot receive eth')
      })
    })

    describe("#Mint: Open vault", async () => {
      it("Should be able to open vaults", async () => {
        vaultId = await shortNFT.nextId()
        const nftBalanceBefore = await shortNFT.balanceOf(seller1.address)
        await controller.connect(seller1).mintPowerPerpAmount(0, 0, 0) // putting vaultId = 0 to open vault

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
        
        await expect(controller.connect(random).mintPowerPerpAmount(vaultId, mintAmount, 0)).to.be.revertedWith(
          'not allowed'
        )
      });
      it("Should be able to mint squeeth", async () => {
        const mintAmount = ethers.utils.parseUnits('0.01')
        
        const vaultBefore = await controller.vaults(vaultId)
        const squeethBalanceBefore = await squeeth.balanceOf(seller1.address)
        
        await controller.connect(seller1).mintPowerPerpAmount(vaultId, mintAmount, 0)

        const squeethBalanceAfter = await squeeth.balanceOf(seller1.address)
        const vaultAfter = await controller.vaults(vaultId)
        const normFactor = await controller.normalizationFactor()

        expect(vaultBefore.shortAmount.add(mintAmount.mul(ethers.utils.parseUnits('1')).div(normFactor)).eq(vaultAfter.shortAmount)).to.be.true
        expect(squeethBalanceBefore.add(mintAmount.mul(ethers.utils.parseUnits('1')).div(normFactor)).eq(squeethBalanceAfter)).to.be.true
      });
      
      it("Should revert when minting more than allowed", async () => {
        const mintAmount = ethers.utils.parseUnits('0.01')
                
        await expect(controller.connect(seller1).mintPowerPerpAmount(vaultId, mintAmount, 0)).to.be.revertedWith(
          'Invalid state'
        )
      });

    });

    describe("#Burn: Burn Squeeth", async () => {
      it("Should revert if trying to burn more than minted", async () => {
        const vault = await controller.vaults(vaultId)
        await expect(controller.connect(seller1).burnWPowerPerpAmount(vaultId, vault.shortAmount.add(1), 0)).to.be.revertedWith('SafeMath: subtraction overflow')
      });
      // todo: add another case to test burning someone else squeeth while being a seller
      it("Should revert if trying to burn without having squeeth", async () => {
        const vault = await controller.vaults(vaultId)
        await expect(controller.connect(random).burnWPowerPerpAmount(vaultId, vault.shortAmount, 0)).to.be.revertedWith(
          'ERC20: burn amount exceeds balance'
        )
      });
      it("Should be able to burn squeeth", async () => {
        const vaultBefore = await controller.vaults(vaultId)
        const burnAmount = vaultBefore.shortAmount;
        const squeethBalanceBefore = await squeeth.balanceOf(seller1.address)
        const withdrawAmount = 0

        await controller.connect(seller1).burnWPowerPerpAmount(vaultId, burnAmount, withdrawAmount)

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
        await expect(controller.connect(seller1).burnWPowerPerpAmount(vaultId, 0, vault.collateralAmount.add(1))).to.be.revertedWith('SafeMath: subtraction overflow')
      })
      it("Should be able to remove collateral", async () => {
        const vaultBefore = await controller.vaults(vaultId)
        const withdrawAmount = vaultBefore.collateralAmount.div(2)
        const burnAmount = 0
        const controllerBalanceBefore = await provider.getBalance(controller.address)
        
        await controller.connect(seller1).burnWPowerPerpAmount(vaultId, burnAmount, withdrawAmount)
        
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
        
        await controller.connect(seller1).burnWPowerPerpAmount(vaultId, burnAmount, withdrawAmount)
        
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
        await controller.connect(seller1).mintPowerPerpAmount(0, mintAmount, 0, {value: collateralAmount})

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

    describe('Deposit and mint with mintWPowerPerpAmount', () => {
      it('should deposit and mint in the same tx', async() => {
        // mint some other squeeth in vault 2.
        const normFactor = await controller.normalizationFactor()
        const mintRSqueethAmount = ethers.utils.parseUnits('0.001')
        const mintWSqueethAmount = mintRSqueethAmount.mul(ethers.utils.parseUnits('1')).div(normFactor)
        const collateralAmount = ethers.utils.parseUnits('4.5')

        const controllerBalanceBefore = await provider.getBalance(controller.address)
        const squeethBalanceBefore = await squeeth.balanceOf(seller1.address)
        const vaultBefore = await controller.vaults(vaultId)

        await controller.connect(seller1).mintWPowerPerpAmount(vaultId, mintWSqueethAmount, 0, {value: collateralAmount})

        const controllerBalanceAfter = await provider.getBalance(controller.address)
        const squeethBalanceAfter = await squeeth.balanceOf(seller1.address)
        const vaultAfter = await controller.vaults(vaultId)

        expect(controllerBalanceBefore.add(collateralAmount).eq(controllerBalanceAfter)).to.be.true
        expect(squeethBalanceBefore.add(mintWSqueethAmount).eq(squeethBalanceAfter)).to.be.true

        expect(vaultBefore.collateralAmount.add(collateralAmount).eq(vaultAfter.collateralAmount)).to.be.true
        expect(vaultBefore.shortAmount.add(mintWSqueethAmount).eq(vaultAfter.shortAmount)).to.be.true
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

        await controller.connect(random).mintPowerPerpAmount(vaultId, mintAmount, 0, {value: collateralAmount})

        const controllerBalanceAfter = await provider.getBalance(controller.address)
        const squeethBalanceAfter = await squeeth.balanceOf(random.address)
        const vaultAfter = await controller.vaults(vaultId)
        const normFactor = await controller.normalizationFactor()

        expect(controllerBalanceBefore.add(collateralAmount).eq(controllerBalanceAfter)).to.be.true
        expect(squeethBalanceBefore.add(mintAmount.mul(ethers.utils.parseUnits('1')).div(normFactor)).eq(squeethBalanceAfter)).to.be.true

        expect(vaultBefore.collateralAmount.add(collateralAmount).eq(vaultAfter.collateralAmount)).to.be.true
        expect(vaultBefore.shortAmount.add(mintAmount.mul(ethers.utils.parseUnits('1')).div(normFactor)).eq(vaultAfter.shortAmount)).to.be.true
      })
    })

    describe('Burn and withdraw', () => {
      let seller4VaultId: BigNumber
      before('mint squeeth for seller4 to withdraw', async() => {
        seller4VaultId = await shortNFT.nextId()
        const mintRAmount = ethers.utils.parseUnits('0.01')
        const collateralAmount = ethers.utils.parseUnits('45')
        await controller.connect(seller4).mintPowerPerpAmount(0, mintRAmount, 0, {value: collateralAmount})
      })

      it('should burn and withdraw with burnRPowerPerp', async() => {
        const vaultBefore = await controller.vaults(seller4VaultId)
        
        // the real rSqueeth amount will decrease after funding.
        const burnRSqueethAmount = ethers.utils.parseUnits('0.01').mul(99).div(100)
        const collateralAmount = ethers.utils.parseUnits('45').mul(99).div(100)

        const controllerBalanceBefore = await provider.getBalance(controller.address)
        const wsqueethBalanceBefore = await squeeth.balanceOf(seller4.address)

        await controller.connect(seller4).burnOnPowerPerpAmount(seller4VaultId, burnRSqueethAmount, collateralAmount)

        const controllerBalanceAfter = await provider.getBalance(controller.address)
        const wsqueethBalanceAfter = await squeeth.balanceOf(seller4.address)
        const vaultAfter = await controller.vaults(seller4VaultId)        
        const normFactor = await controller.normalizationFactor()

        expect(controllerBalanceBefore.sub(collateralAmount).eq(controllerBalanceAfter)).to.be.true
        expect(wsqueethBalanceBefore.sub(burnRSqueethAmount.mul(ethers.utils.parseUnits('1')).div(normFactor)).eq(wsqueethBalanceAfter)).to.be.true

        expect(vaultBefore.collateralAmount.sub(collateralAmount).eq(vaultAfter.collateralAmount)).to.be.true
        expect(vaultBefore.shortAmount.sub(burnRSqueethAmount.mul(ethers.utils.parseUnits('1')).div(normFactor)).eq(vaultAfter.shortAmount)).to.be.true
      })
    })
  })

  describe("Settlement operations should be banned", async () => {
    it("Should revert when calling redeemLong", async () => {
      await expect(
        controller.connect(seller1).redeemLong(0)
      ).to.be.revertedWith("!shutdown");
    });
    it("Should revert when calling redeemShort", async () => {
      await expect(
        controller.connect(seller1).redeemShort(1)
      ).to.be.revertedWith("!shutdown");
    });
  });
  
  describe("Emergency Shutdown", function () {
    const settlementPrice = '6500';
    let seller2VaultId: BigNumber;
    let seller3VaultId: BigNumber;
    let seller3TotalSqueeth: BigNumber

    let normalizationFactor: BigNumber
  
    const collateralAmount = ethers.utils.parseEther('50')
    
    this.beforeAll('Prepare a new vault for this test set', async() => {

      // prepare a vault that's gonna go underwater
      seller2VaultId = await shortNFT.nextId()
      const mintAmount = ethers.utils.parseUnits('0.01')
      await controller.connect(seller2).mintPowerPerpAmount(0, mintAmount, 0, { value: collateralAmount })

      // prepare a vault that's not gonna go insolvent
      seller3VaultId = await shortNFT.nextId()
      const s3MintAmount = ethers.utils.parseUnits('0.004')
      await controller.connect(seller3).mintPowerPerpAmount(0, s3MintAmount, 0, { value: collateralAmount })
      seller3TotalSqueeth = await squeeth.balanceOf(seller3.address)

      // mint a lot of squeeth from seller1 that system can't payout to.
      const collateral = ethers.utils.parseUnits('450')
      await controller.connect(seller1).mintPowerPerpAmount(0, ethers.utils.parseUnits('0.1'), 0, {value: collateral})

      normalizationFactor = await controller.normalizationFactor()
    })
  
    describe("Shut down the system", async () => {
      it("Should revert when called by non-owner", async () => {
        await expect(
          controller.connect(random).shutDown()
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });
      it("Should shutdown the system at a price that it will go insolvent", async () => {
        const ethPrice = ethers.utils.parseUnits(settlementPrice)
        await oracle.connect(random).setPrice(ethUSDPool.address , ethPrice) // eth per 1 squeeth
        await controller.connect(owner).shutDown()
        const snapshot = await controller.shutDownEthPriceSnapshot();
        expect(snapshot.toString()).to.be.eq(ethPrice)
        expect(await controller.isShutDown()).to.be.true;
      });
      it("Should revert when called again after system is shutdown", async () => {
        await expect(
          controller.connect(owner).shutDown()
        ).to.be.revertedWith("shutdown");
      });
    });
  
    describe("Basic operations should be banned", async () => {
      it("Should revert when calling mint", async () => {
        await expect(
          controller.connect(seller1).mintPowerPerpAmount(0, 0, 0)
        ).to.be.revertedWith("shutdown");
      });
      it("Should revert when calling deposit", async () => {
        await expect(
          controller.connect(seller1).deposit(1, { value: 1})
        ).to.be.revertedWith("shutdown");
      });
      it("Should revert when calling burn", async () => {
        await expect(
          controller.connect(seller1).burnWPowerPerpAmount(1, 1, 1)
        ).to.be.revertedWith("shutdown");
      });
      it("Should revert when calling withdraw", async () => {
        await expect(
          controller.connect(seller1).withdraw(1, 1)
        ).to.be.revertedWith("shutdown");
      });
    });
  
    describe("Settlement: redeemLong", async () => {
      it("should go insolvent while trying to redeem fair value for seller1 (big holder)", async () => {
        const seller1Amount = await squeeth.balanceOf(seller1.address)
        await expect(
          controller.connect(seller1).redeemLong(seller1Amount, {gasPrice: 0})
        ).to.be.revertedWith("Address: insufficient balance");
      });
      it("should accept donation from random address", async() => {
        const settleAmount = await squeeth.totalSupply()
        const expectedPayout = settleAmount.mul(normalizationFactor).mul(settlementPrice).div(BigNumber.from(10).pow(18))
        const controllerEthBalance = await provider.getBalance(controller.address)
        const ethNeeded =  expectedPayout.sub(controllerEthBalance)  
        await controller.connect(random).donate({value: ethNeeded})
      })
      it("should be able to redeem long value for seller2", async () => {
        const controllerEthBefore = await provider.getBalance(controller.address)
        const sellerEthBefore = await provider.getBalance(seller2.address)
        const redeemAmount = await squeeth.balanceOf(seller2.address)
        await controller.connect(seller2).redeemLong(redeemAmount, {gasPrice: 0})
        
        // this test works because ES doesn't apply funding, so normalizationFactor won't change after shutdown
        const expectedPayout = redeemAmount.mul(normalizationFactor).mul(settlementPrice).div(BigNumber.from(10).pow(18))
        const sellerEthAfter = await provider.getBalance(seller2.address)
        const controllerEthAfter = await provider.getBalance(controller.address)
        const squeethBalanceAfter = await squeeth.balanceOf(seller2.address)
        expect(squeethBalanceAfter.isZero()).to.be.true
        expect(controllerEthBefore.sub(controllerEthAfter).eq(expectedPayout)).to.be.true
        expect(sellerEthAfter.sub(sellerEthBefore).eq(expectedPayout)).to.be.true
      });
      it("should be able to redeem long value for seller3", async () => {
        const controllerEthBefore = await provider.getBalance(controller.address)
        const sellerEthBefore = await provider.getBalance(seller3.address)
        const redeemAmount = await squeeth.balanceOf(seller3.address)
        await controller.connect(seller3).redeemLong(redeemAmount, {gasPrice: 0})
        
        // this test works because ES doesn't apply funding, so normalizationFactor won't change after shutdown
        const expectedPayout = redeemAmount.mul(normalizationFactor).mul(settlementPrice).div(BigNumber.from(10).pow(18))
        const sellerEthAfter = await provider.getBalance(seller3.address)
        const controllerEthAfter = await provider.getBalance(controller.address)
        const squeethBalanceAfter = await squeeth.balanceOf(seller3.address)
        expect(squeethBalanceAfter.isZero()).to.be.true
        expect(controllerEthBefore.sub(controllerEthAfter).eq(expectedPayout)).to.be.true
        expect(sellerEthAfter.sub(sellerEthBefore).eq(expectedPayout)).to.be.true
      });
    })

    describe('Settlement: redeemShort', async() => {

      it('should revert when a underwater vault (seller2) is trying to redeem', async() => {
        await expect(
          controller.connect(seller2).redeemShort(seller2VaultId)
        ).to.be.revertedWith('SafeMath: subtraction overflow')
      })
      it("should redeem fair value for short side (seller 3)", async () => {
        const vaultBefore = await controller.vaults(seller3VaultId)
        const sellerEthBefore = await provider.getBalance(seller3.address)
        const controllerEthBefore = await provider.getBalance(controller.address)

        await controller.connect(seller3).redeemShort(seller3VaultId, {gasPrice: 0})
        const vaultAfter = await controller.vaults(seller3VaultId)
        
        const squeethDebt = seller3TotalSqueeth.mul(normalizationFactor).mul(settlementPrice).div(BigNumber.from(10).pow(18))
        const shortPayout = vaultBefore.collateralAmount.sub(squeethDebt)
        const sellerEthAfter = await provider.getBalance(seller3.address)
        const controllerEthAfter = await provider.getBalance(controller.address)
        expect(controllerEthBefore.sub(controllerEthAfter).eq(shortPayout)).to.be.true
        expect(sellerEthAfter.sub(sellerEthBefore).eq(shortPayout)).to.be.true
        expect(isEmptyVault(vaultAfter)).to.be.true;
      });
    });
  });
});
