import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers";
import { ethers } from "hardhat"
import { expect } from "chai";
import { BigNumber, providers } from "ethers";
import { Controller, MockWSqueeth, MockVaultNFTManager } from "../../typechain";

import { isEmptyVault, UNDERFLOW_ERROR } from '../utils'

describe("Controller", function () {
  let squeeth: MockWSqueeth;
  let shortNFT: MockVaultNFTManager;
  let controller: Controller;
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
  });

  describe("Deployment", async () => {
    it("Deployment", async function () {
      const ControllerContract = await ethers.getContractFactory("Controller");
      controller = (await ControllerContract.deploy()) as Controller;
    });
  });

  describe("Initialization", async () => {
    it("Should be able to init contract", async () => {
      await controller.init(shortNFT.address, squeeth.address);
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
        controller.init(shortNFT.address, squeeth.address)
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
        const depositAmount = ethers.utils.parseUnits('1')
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
      it("Should revert if not called by", async () => {
        const mintAmount = ethers.utils.parseUnits('0.1')
        
        await expect(controller.connect(random).mint(vaultId, mintAmount)).to.be.revertedWith(
          'not allowed'
        )
      });
      it("Should be able to mint squeeth", async () => {
        const mintAmount = ethers.utils.parseUnits('0.1')
        
        const vaultBefore = await controller.vaults(vaultId)
        const squeethBalanceBefore = await squeeth.balanceOf(seller1.address)
        
        await controller.connect(seller1).mint(vaultId, mintAmount)

        const squeethBalanceAfter = await squeeth.balanceOf(seller1.address)
        const vaultAfter = await controller.vaults(vaultId)

        expect(vaultBefore.shortAmount.add(mintAmount).eq(vaultAfter.shortAmount)).to.be.true
        expect(squeethBalanceBefore.add(mintAmount).eq(squeethBalanceAfter)).to.be.true
      });
    });

    describe("#Burn: Burn Squeeth", async () => {
      it("Should revert if trying to burn more than minted", async () => {
        const vault = await controller.vaults(vaultId)
        await expect(controller.connect(seller1).burn(vaultId, vault.shortAmount.add(1), 0)).to.be.revertedWith(UNDERFLOW_ERROR)
      });
      it("Should revert if trying to burn without having squeeth", async () => {
        const vault = await controller.vaults(vaultId)
        // address random has no squeeth in his wallet
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
        // const vaultAfter = await controller.vaults(vaultId)
        const nftBalanceAfter = await shortNFT.balanceOf(seller1.address)

        expect(controllerBalanceBefore.sub(withdrawAmount).eq(controllerBalanceAfter)).to.be.true
        // expect(vaultBefore.collateralAmount.sub(withdrawAmount).eq(vaultAfter.collateralAmount)).to.be.true
        expect(nftBalanceAfter.eq(nftBalanceBefore.sub(1)), "vault not closed!").to.be.true
      });
    });
  });

  describe('Combined actions', async() => {

    let vaultId: BigNumber

    describe('Open, deposit and mint', () => {
      it('should open vault, deposit and mint in the same tx', async() => {
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
    })

    describe('Deposit and mint', () => {
      it('should deposit and mint in the same tx', async() => {
        // mint some other squeeth in vault 2.
        const mintAmount = ethers.utils.parseUnits('0.2')
        const collateralAmount = ethers.utils.parseUnits('2')

        const controllerBalanceBefore = await provider.getBalance(controller.address)
        const squeethBalanceBefore = await squeeth.balanceOf(seller1.address)
        const vaultBefore = await controller.vaults(vaultId)

        await controller.connect(seller1).mint(vaultId, mintAmount, {value: collateralAmount})

        const controllerBalanceAfter = await provider.getBalance(controller.address)
        const squeethBalanceAfter = await squeeth.balanceOf(seller1.address)
        const vaultAfter = await controller.vaults(vaultId)

        expect(controllerBalanceBefore.add(collateralAmount).eq(controllerBalanceAfter)).to.be.true
        expect(squeethBalanceBefore.add(mintAmount).eq(squeethBalanceAfter)).to.be.true

        expect(vaultBefore.collateralAmount.add(collateralAmount).eq(vaultAfter.collateralAmount)).to.be.true
        expect(vaultBefore.shortAmount.add(mintAmount).eq(vaultAfter.shortAmount)).to.be.true
      })
    })
  })
});
