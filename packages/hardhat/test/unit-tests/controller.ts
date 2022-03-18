import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { ethers } from "hardhat"
import { expect } from "chai";
import { BigNumber, providers, constants } from "ethers";
import { Controller, MockWPowerPerp, MockShortPowerPerp, MockOracle, MockUniswapV3Pool, MockErc20, MockUniPositionManager, VaultLibTester, WETH9, ControllerTester, ABDKMath64x64} from '../../typechain'
import { isEmptyVault } from '../vault-utils'
import { isSimilar, oracleScaleFactor, one, getNow } from "../utils";
import { getSqrtPriceAndTickBySqueethPrice } from "../calculator";

const squeethETHPrice = BigNumber.from('3010').mul(one)
const scaledSqueethPrice = squeethETHPrice.div(oracleScaleFactor)

const ethUSDPrice = BigNumber.from('3000').mul(one)
const scaledEthPrice = ethUSDPrice.div(oracleScaleFactor)

describe("Controller", function () {
  let squeeth: MockWPowerPerp;
  let shortSqueeth: MockShortPowerPerp;
  let controller: Controller;
  let controllerTester: ControllerTester
  let squeethEthPool: MockUniswapV3Pool;
  let ethUSDPool: MockUniswapV3Pool;
  let uniPositionManager: MockUniPositionManager
  let oracle: MockOracle;
  let weth: WETH9;
  let usdc: MockErc20;
  let vaultLib: VaultLibTester
  let provider: providers.JsonRpcProvider;
  let owner: SignerWithAddress
  let seller1: SignerWithAddress
  let seller2: SignerWithAddress
  let seller3: SignerWithAddress
  let seller4: SignerWithAddress // use for burnRSqueeth tests
  let seller5: SignerWithAddress // settle short vault with nft in it
  let seller6: SignerWithAddress // settle short vault with one-sided nft in it
  let seller7: SignerWithAddress // settle short vault with 0 short
  let seller8: SignerWithAddress // fail to settle short vault with nft in it, but able to reduceDebt
  let random: SignerWithAddress
  let feeRecipient: SignerWithAddress

  this.beforeAll("Prepare accounts", async() => {
    const accounts = await ethers.getSigners();
    const [_owner,_seller1, _seller2, _seller3, _seller4, _seller5, _seller6, _seller7, _seller8, _random, _feeRecipient] = accounts;
    
    seller1 = _seller1
    seller2 = _seller2
    seller3 = _seller3
    seller4 = _seller4
    seller5 = _seller5
    seller6 = _seller6
    seller7 = _seller7
    seller8 = _seller8
    
    random = _random
    owner = _owner
    feeRecipient = _feeRecipient
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


    await oracle.connect(random).setPrice(squeethEthPool.address , scaledSqueethPrice) // eth per 1 squeeth

    // the oracle should return the exact ETH / USDC price (without scale)
    await oracle.connect(random).setPrice(ethUSDPool.address , ethUSDPrice)  // usdc per 1 eth

    const ABDK = await ethers.getContractFactory("ABDKMath64x64")
    const ABDKLibrary = (await ABDK.deploy()) as ABDKMath64x64;

    const SqrtPriceExternal = await ethers.getContractFactory("SqrtPriceMathPartial")
    const SqrtPriceExternalLibrary = (await SqrtPriceExternal.deploy());

    const TickMathExternal = await ethers.getContractFactory("TickMathExternal")
    const TickMathLibrary = (await TickMathExternal.deploy());

    const VaultTester = await ethers.getContractFactory("VaultLibTester", {libraries: {TickMathExternal: TickMathLibrary.address, SqrtPriceMathPartial: SqrtPriceExternalLibrary.address}});
    vaultLib = (await VaultTester.deploy()) as VaultLibTester;

    const ControllerContract = await ethers.getContractFactory("Controller", {libraries: {ABDKMath64x64: ABDKLibrary.address, TickMathExternal: TickMathLibrary.address, SqrtPriceMathPartial: SqrtPriceExternalLibrary.address}});
    
    controller = (await ControllerContract.deploy(oracle.address, shortSqueeth.address, squeeth.address, weth.address, usdc.address, ethUSDPool.address, squeethEthPool.address, uniPositionManager.address, 3000)) as Controller;
  });

  it("Should revert when oracle is address(0)", async () => {
    const ABDK = await ethers.getContractFactory("ABDKMath64x64")
    const ABDKLibrary = (await ABDK.deploy()) as ABDKMath64x64;

    const TickMath = await ethers.getContractFactory("TickMathExternal")
    const TickMathLibrary = (await TickMath.deploy());

    const SqrtPriceExternal = await ethers.getContractFactory("SqrtPriceMathPartial")
    const SqrtPriceExternalLibrary = (await SqrtPriceExternal.deploy());

    const ControllerContract = await ethers.getContractFactory("Controller", {libraries: {ABDKMath64x64: ABDKLibrary.address, TickMathExternal: TickMathLibrary.address, SqrtPriceMathPartial: SqrtPriceExternalLibrary.address}});

    await expect(
      ControllerContract.deploy(ethers.constants.AddressZero, shortSqueeth.address, squeeth.address, weth.address, usdc.address, ethUSDPool.address, squeethEthPool.address, uniPositionManager.address, 3000)
    ).to.be.revertedWith("C4");
  });

  it("Should revert when shortSqueeth is address(0)", async () => {
    const ABDK = await ethers.getContractFactory("ABDKMath64x64")
    const ABDKLibrary = (await ABDK.deploy()) as ABDKMath64x64;

    const TickMath = await ethers.getContractFactory("TickMathExternal")
    const TickMathLibrary = (await TickMath.deploy());

    const SqrtPriceExternal = await ethers.getContractFactory("SqrtPriceMathPartial")
    const SqrtPriceExternalLibrary = (await SqrtPriceExternal.deploy());

    const ControllerContract = await ethers.getContractFactory("Controller", {libraries: {ABDKMath64x64: ABDKLibrary.address, TickMathExternal: TickMathLibrary.address, SqrtPriceMathPartial: SqrtPriceExternalLibrary.address}});

    await expect(
      ControllerContract.deploy(oracle.address, ethers.constants.AddressZero, squeeth.address, weth.address, usdc.address, ethUSDPool.address, squeethEthPool.address, uniPositionManager.address, 3000)
    ).to.be.revertedWith("C5");
  });

  it("Should revert when powerperp is address(0)", async () => {
    const ABDK = await ethers.getContractFactory("ABDKMath64x64")
    const ABDKLibrary = (await ABDK.deploy()) as ABDKMath64x64;

    const TickMath = await ethers.getContractFactory("TickMathExternal")
    const TickMathLibrary = (await TickMath.deploy());

    const SqrtPriceExternal = await ethers.getContractFactory("SqrtPriceMathPartial")
    const SqrtPriceExternalLibrary = (await SqrtPriceExternal.deploy());

    const ControllerContract = await ethers.getContractFactory("Controller", {libraries: {ABDKMath64x64: ABDKLibrary.address, TickMathExternal: TickMathLibrary.address, SqrtPriceMathPartial: SqrtPriceExternalLibrary.address}});

    await expect(
      ControllerContract.deploy(oracle.address, shortSqueeth.address, ethers.constants.AddressZero, weth.address, usdc.address, ethUSDPool.address, squeethEthPool.address, uniPositionManager.address, 3000)
    ).to.be.revertedWith("C6");
  });

  it("Should revert when weth is address(0)", async () => {
    const ABDK = await ethers.getContractFactory("ABDKMath64x64")
    const ABDKLibrary = (await ABDK.deploy()) as ABDKMath64x64;

    const TickMath = await ethers.getContractFactory("TickMathExternal")
    const TickMathLibrary = (await TickMath.deploy());

    const SqrtPriceExternal = await ethers.getContractFactory("SqrtPriceMathPartial")
    const SqrtPriceExternalLibrary = (await SqrtPriceExternal.deploy());

    const ControllerContract = await ethers.getContractFactory("Controller", {libraries: {ABDKMath64x64: ABDKLibrary.address, TickMathExternal: TickMathLibrary.address, SqrtPriceMathPartial: SqrtPriceExternalLibrary.address}});

    await expect(
      ControllerContract.deploy(oracle.address, shortSqueeth.address, squeeth.address, ethers.constants.AddressZero, usdc.address, ethUSDPool.address, squeethEthPool.address, uniPositionManager.address, 3000)
    ).to.be.revertedWith("C7");
  });
  
  it("Should revert when quote currency is address(0)", async () => {
    const ABDK = await ethers.getContractFactory("ABDKMath64x64")
    const ABDKLibrary = (await ABDK.deploy()) as ABDKMath64x64;

    const TickMath = await ethers.getContractFactory("TickMathExternal")
    const TickMathLibrary = (await TickMath.deploy());

    const SqrtPriceExternal = await ethers.getContractFactory("SqrtPriceMathPartial")
    const SqrtPriceExternalLibrary = (await SqrtPriceExternal.deploy());

    const ControllerContract = await ethers.getContractFactory("Controller", {libraries: {ABDKMath64x64: ABDKLibrary.address, TickMathExternal: TickMathLibrary.address, SqrtPriceMathPartial: SqrtPriceExternalLibrary.address}});

    await expect(
      ControllerContract.deploy(oracle.address, shortSqueeth.address, squeeth.address, weth.address, ethers.constants.AddressZero, ethUSDPool.address, squeethEthPool.address, uniPositionManager.address, 3000)
    ).to.be.revertedWith("C8");
  });

  it("Should revert when ethUSDPool is address(0)", async () => {
    const ABDK = await ethers.getContractFactory("ABDKMath64x64")
    const ABDKLibrary = (await ABDK.deploy()) as ABDKMath64x64;

    const TickMath = await ethers.getContractFactory("TickMathExternal")
    const TickMathLibrary = (await TickMath.deploy());

    const SqrtPriceExternal = await ethers.getContractFactory("SqrtPriceMathPartial")
    const SqrtPriceExternalLibrary = (await SqrtPriceExternal.deploy());

    const ControllerContract = await ethers.getContractFactory("Controller", {libraries: {ABDKMath64x64: ABDKLibrary.address, TickMathExternal: TickMathLibrary.address, SqrtPriceMathPartial: SqrtPriceExternalLibrary.address}});

    await expect(
      ControllerContract.deploy(oracle.address, shortSqueeth.address, squeeth.address, weth.address, usdc.address, ethers.constants.AddressZero, squeethEthPool.address, uniPositionManager.address, 3000)
    ).to.be.revertedWith("C9");
  });

  it("Should revert when squeethEthPool is address(0)", async () => {
    const ABDK = await ethers.getContractFactory("ABDKMath64x64")
    const ABDKLibrary = (await ABDK.deploy()) as ABDKMath64x64;

    const TickMath = await ethers.getContractFactory("TickMathExternal")
    const TickMathLibrary = (await TickMath.deploy());

    const SqrtPriceExternal = await ethers.getContractFactory("SqrtPriceMathPartial")
    const SqrtPriceExternalLibrary = (await SqrtPriceExternal.deploy());

    const ControllerContract = await ethers.getContractFactory("Controller", {libraries: {ABDKMath64x64: ABDKLibrary.address, TickMathExternal: TickMathLibrary.address, SqrtPriceMathPartial: SqrtPriceExternalLibrary.address}});

    await expect(
      ControllerContract.deploy(oracle.address, shortSqueeth.address, squeeth.address, weth.address, usdc.address, ethUSDPool.address, ethers.constants.AddressZero, uniPositionManager.address, 3000)
    ).to.be.revertedWith("C10");
  });

  it("Should revert when uniPositionManager is address(0)", async () => {
    const ABDK = await ethers.getContractFactory("ABDKMath64x64")
    const ABDKLibrary = (await ABDK.deploy()) as ABDKMath64x64;

    const TickMath = await ethers.getContractFactory("TickMathExternal")
    const TickMathLibrary = (await TickMath.deploy());

    const SqrtPriceExternal = await ethers.getContractFactory("SqrtPriceMathPartial")
    const SqrtPriceExternalLibrary = (await SqrtPriceExternal.deploy());

    const ControllerContract = await ethers.getContractFactory("Controller", {libraries: {ABDKMath64x64: ABDKLibrary.address, TickMathExternal: TickMathLibrary.address, SqrtPriceMathPartial: SqrtPriceExternalLibrary.address}});

    await expect(
      ControllerContract.deploy(oracle.address, shortSqueeth.address, squeeth.address, weth.address, usdc.address, ethUSDPool.address, squeethEthPool.address, ethers.constants.AddressZero, 3000)
    ).to.be.revertedWith("C11");
  });

  describe("Deployment", async () => {
    it("Check controller deployment", async () => {
      const squeethAddr = await controller.wPowerPerp();
      const nftAddr = await controller.shortPowerPerp();

      expect(squeethAddr).to.be.eq(
        squeeth.address,
        "squeeth address mismatch"
      );
      expect(nftAddr).to.be.eq(shortSqueeth.address, "nft address mismatch");
    });

    it("Controller tester deployment", async function () {
      const ControllerTesterContract = await ethers.getContractFactory("ControllerTester");
      controllerTester = (await ControllerTesterContract.deploy(controller.address)) as ControllerTester;
    });
  });

  describe("Owner only functions", async () => {
    it("Should revert if trying to set fee rate before setting fee recipient", async () => {
      await expect(controller.connect(owner).setFeeRate(100)).to.be.revertedWith('C14')
    });

    it("Should revert if trying to set address(0) as fee recipient", async () => {
      await expect(controller.connect(owner).setFeeRecipient(constants.AddressZero)).to.be.revertedWith("C13");
    });

    it("Should set the fee recipient", async () => {
      await controller.connect(owner).setFeeRecipient(feeRecipient.address);
      expect((await controller.feeRecipient()) === feeRecipient.address).to.be.true
    });

    it("Should revert if trying to set fee rate that is too high", async () => {
      await expect(controller.connect(owner).setFeeRate(500)).to.be.revertedWith("C15")
    });

    it("Should revert if set fee rate is call by random address", async () => {
      await expect(controller.connect(random).setFeeRate(500)).to.be.revertedWith("Ownable: caller is not the owner")
    });

    it("Should revert if set fee recipient is call by random address", async () => {
      await expect(controller.connect(random).setFeeRecipient(constants.AddressZero)).to.be.revertedWith("Ownable: caller is not the owner")
    });
  });

  describe("Basic actions", function () {

    let vaultId: BigNumber;

    describe('#Read basic properties', async() => {
      
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
      
      it('should allow anyone to call applyFunding and update funding', async()=>{
        const normFactor = await controller.normalizationFactor()
        const expectedNormFactor = await controller.getExpectedNormalizationFactor()
        
        await controller.connect(random).applyFunding()

        const normFactorAfterFunding = await controller.normalizationFactor()
        expect(isSimilar(expectedNormFactor.toString(),normFactorAfterFunding.toString())).to.be.true
        expect(normFactor.gt(normFactorAfterFunding)).to.be.true
        
      })

      it('should not update funding two times in one block', async()=>{        
        await controllerTester.connect(random).testDoubleFunding()
      })

      it('should be able to get index and mark price and mark price used for funding', async() => {
        // update block.timestamp in solidity
        await provider.send("evm_increaseTime", [30])
        await provider.send("evm_mine", [])
        
        const markPrice = await controller.getDenormalizedMark(30)
        const markPriceForFunding = await controller.getDenormalizedMarkForFunding(30)

        expect(isSimilar(markPrice.toString(), scaledSqueethPrice.mul(scaledEthPrice).div(one).toString())).to.be.true
        expect(isSimilar(markPriceForFunding.toString(), scaledSqueethPrice.mul(scaledEthPrice).div(one).toString())).to.be.true
        expect(markPrice.gt(markPriceForFunding)).to.be.true

        const index = await controller.getIndex(30)
        expect(index.eq(scaledEthPrice.mul(scaledEthPrice).div(one))).to.be.true
      })

      it('should be able to get unscaled index price', async() => {

        const index = await controller.getUnscaledIndex(30)
        expect(index.eq(ethUSDPrice.mul(ethUSDPrice).div(one))).to.be.true
      })


      it('should revert when sending eth to controller from an EOA', async() => {
        await expect(random.sendTransaction({to: controller.address, value:1})).to.be.revertedWith('C19')
      })
    })

    describe("#Mint: Open vault", async () => {
      it("Should be able to open vaults", async () => {
        vaultId = await shortSqueeth.nextId()
        const nftBalanceBefore = await shortSqueeth.balanceOf(seller1.address)
        await controller.connect(seller1).mintPowerPerpAmount(0, 0, 0) // putting vaultId = 0 to open vault

        // total short position nft should increase
        const nftBalanceAfter = await shortSqueeth.balanceOf(seller1.address)
        expect(nftBalanceAfter.eq(nftBalanceBefore.add(1))).is.true;

        // the newly created vault should be empty
        const vault = await controller.vaults(vaultId)
        expect(isEmptyVault(vault)).to.be.true
      });
    });

    describe("#Deposit: Deposit collateral", async () => {
      it("Should revert when trying to deposit to vault 0", async() => {
        await expect(controller.connect(seller1).deposit(0)).to.be.revertedWith(
          'ERC721: owner query for nonexistent token'
        )
      })
      it("Should revert when trying to access non-existent vault", async() => {
        await expect(controller.connect(seller1).deposit(100, {value: 100})).to.be.revertedWith(
          'ERC721: owner query for nonexistent token'
        )
      })
      it("Should revert when trying to use mint to deposit to non-existent vault", async() => {
        await expect(controller.connect(seller1).mintPowerPerpAmount(999, 0, 0, {value: 100})).to.be.revertedWith(
          'ERC721: owner query for nonexistent token'
        )
      })

      it("Should revert when trying to use mint to deposit to a vault where msg.sender is not owner or operator", async() => {
        const depositAmount = ethers.utils.parseUnits('45')

        await expect(controller.connect(random).deposit(vaultId,{value: depositAmount})).to.be.revertedWith(
          'C20'
        )
      })

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
      it("Should be able to deposit 0 collateral", async () => {
        const vaultBefore = await controller.vaults(vaultId)
        await controller.connect(seller1).deposit(vaultId)
        const vaultAfter = await controller.vaults(vaultId)
        
        expect(vaultBefore.collateralAmount.eq(vaultAfter.collateralAmount)).to.be.true
      });
    });

    describe("#Mint: Mint Squeeth", async () => {
      it("Should revert if not called by owner", async () => {
        const mintAmount = ethers.utils.parseUnits('100')
        
        await expect(controller.connect(random).mintPowerPerpAmount(vaultId, mintAmount, 0)).to.be.revertedWith(
          'C20'
        )
      });
      it("Should revert when trying to mint to non-existent vault", async() => {
        await expect(controller.connect(seller1).mintPowerPerpAmount(999, 10, 0)).to.be.revertedWith(
          'ERC721: owner query for nonexistent token'
        )
      })
      it("Should be able to mint squeeth", async () => {
        const mintAmount = ethers.utils.parseUnits('100')
        
        const vaultBefore = await controller.vaults(vaultId)
        const squeethBalanceBefore = await squeeth.balanceOf(seller1.address)
        
        await controller.connect(seller1).mintPowerPerpAmount(vaultId, mintAmount, 0)

        const squeethBalanceAfter = await squeeth.balanceOf(seller1.address)
        const vaultAfter = await controller.vaults(vaultId)
        const normFactor = await controller.normalizationFactor()

        expect(vaultBefore.shortAmount.add(mintAmount.mul(one).div(normFactor)).eq(vaultAfter.shortAmount)).to.be.true
        expect(squeethBalanceBefore.add(mintAmount.mul(one).div(normFactor)).eq(squeethBalanceAfter)).to.be.true
      });
      
      it("Should revert when minting more than allowed", async () => {
        const mintAmount = ethers.utils.parseUnits('100')        
        await expect(controller.connect(seller1).mintPowerPerpAmount(vaultId, mintAmount, 0)).to.be.revertedWith(
          'C24'
        )
      });

    });

    describe("#Burn: Burn Squeeth", async () => {
      it("Should revert when trying to burn for vault 0", async() => {
        await expect(controller.connect(seller1).burnPowerPerpAmount(0, 0, 0)).to.be.revertedWith(
          'ERC721: owner query for nonexistent token'
        )
      })
      it("Should revert when trying to burn wrapped amount for vault 0", async() => {
        await expect(controller.connect(seller1).burnWPowerPerpAmount(0, 0, 0)).to.be.revertedWith(
          'ERC721: owner query for nonexistent token'
        )
      })

      it("Should revert when trying to burn for non-existent vault", async() => {
        await expect(controller.connect(seller1).burnPowerPerpAmount(100, 0, 0)).to.be.revertedWith(
          'ERC721: owner query for nonexistent token'
        )
      })
      it("Should revert when trying to burn wrapped amount for non-existent vault", async() => {
        await expect(controller.connect(seller1).burnWPowerPerpAmount(100, 0, 0)).to.be.revertedWith(
          'ERC721: owner query for nonexistent token'
        )
      })
      it("Should revert if trying to burn more than minted", async () => {
        const vault = await controller.vaults(vaultId)
        await expect(controller.connect(seller1).burnWPowerPerpAmount(vaultId, vault.shortAmount.add(1), 0)).to.be.revertedWith('SafeMath: subtraction overflow')
      });
      // todo: add another case to test burning someone else squeeth while being a seller
      it("Should revert if trying to burn without having squeeth", async () => {
        const vault = await controller.vaults(vaultId)
        await squeeth.connect(seller1).transfer(random.address, 1)
        await expect(controller.connect(seller1).burnWPowerPerpAmount(vaultId, vault.shortAmount, 0)).to.be.revertedWith(
          'ERC20: burn amount exceeds balance'
        )
        await squeeth.mint(seller1.address, 1)
      });
      it('should revert if vault after burning is underwater', async() => {
        const vault = await controller.vaults(vaultId)
        await expect(controller.connect(seller1).burnWPowerPerpAmount(vaultId, vault.shortAmount.div(2), vault.collateralAmount)).to.be.revertedWith('C24')
      })
      it('should revert if vault after burning is dust', async() => {
        const vault = await controller.vaults(vaultId)
        await expect(controller.connect(seller1).burnWPowerPerpAmount(vaultId, vault.shortAmount.sub(1), vault.collateralAmount.sub(1))).to.be.revertedWith('C22')
      })

      it("Should revert if trying to withdraw and put make vault underwater", async () => {
        const vault = await controller.vaults(vaultId)
        await expect(controller.connect(seller1).withdraw(vaultId, vault.collateralAmount)).to.be.revertedWith('C24')
      })

      it('Should revert if a random account tries to burn squeeth for vault1', async() => {
        await squeeth.mint(random.address, 1000)
        await expect(controller.connect(random).burnWPowerPerpAmount(vaultId, 1000, 0)).to.be.revertedWith("C20")
      })

      it('should revert when non-owner try to burn and withdraw from vault', async() => {
        await expect(controller.connect(random).burnWPowerPerpAmount(vaultId, 0, 1000)).to.be.revertedWith('C20')
      })
      
      it("Should be able to burn squeeth", async () => {
        const vaultBefore = await controller.vaults(vaultId)
        const burnAmount = vaultBefore.shortAmount;
        const squeethBalanceBefore = await squeeth.balanceOf(seller1.address)
        const withdrawAmount = 5

        await controller.connect(seller1).burnWPowerPerpAmount(vaultId, burnAmount, withdrawAmount)

        const squeethBalanceAfter = await squeeth.balanceOf(seller1.address)
        const vaultAfter = await controller.vaults(vaultId)

        expect(vaultBefore.shortAmount.sub(burnAmount).eq(vaultAfter.shortAmount)).to.be.true
        expect(vaultBefore.collateralAmount.sub(withdrawAmount).eq(vaultAfter.collateralAmount)).to.be.true
        expect(squeethBalanceBefore.sub(burnAmount).eq(squeethBalanceAfter)).to.be.true
      });
    });

    describe("#Withdraw: Remove Collateral", async () => {
      it("Should revert when trying to remove from vault 0", async() => {
        await expect(controller.connect(seller1).withdraw(0, 0)).to.be.revertedWith(
          'ERC721: owner query for nonexistent token'
        )
      })
      it("Should revert if caller is not the owner", async () => {
        const vault = await controller.vaults(vaultId)
        await expect(controller.connect(random).withdraw(vaultId, vault.collateralAmount)).to.be.revertedWith(
          'C20'
        )
      })
      it("Should revert if trying to remove more collateral than deposited", async () => {
        const vault = await controller.vaults(vaultId)
        await expect(controller.connect(seller1).burnWPowerPerpAmount(vaultId, 0, vault.collateralAmount.add(1))).to.be.revertedWith('SafeMath: subtraction overflow')
      })

      it('should revert if trying to remove collateral which produce a vault dust', async() => {
        // mint little wsqueeth
        const mintAmount = 1000
        await controller.connect(seller1).mintWPowerPerpAmount(vaultId, mintAmount, 0)

        const vault = await controller.vaults(vaultId)
        await expect(controller.connect(seller1).burnWPowerPerpAmount(vaultId, 0, vault.collateralAmount.sub(2))).to.be.revertedWith('C24')
        
        // burn the minted amount
        await controller.connect(seller1).burnWPowerPerpAmount(vaultId, mintAmount, 0)
      })
      
      it("Should be able to remove collateral", async () => {
        const vaultBefore = await controller.vaults(vaultId)
        const withdrawAmount = vaultBefore.collateralAmount.div(2)
        const userBalanceBefore = await provider.getBalance(seller1.address)
        const controllerBalanceBefore = await provider.getBalance(controller.address)
        
        await controller.connect(seller1).withdraw(vaultId, withdrawAmount)
        
        const userBalanceAfter = await provider.getBalance(seller1.address)
        const controllerBalanceAfter = await provider.getBalance(controller.address)
        const vaultAfter = await controller.vaults(vaultId)

        expect(controllerBalanceBefore.sub(withdrawAmount).eq(controllerBalanceAfter)).to.be.true
        // expect(userBalanceAfter.sub(userBalanceBefore).eq(withdrawAmount)).to.be.true
        expect(vaultBefore.collateralAmount.sub(withdrawAmount).eq(vaultAfter.collateralAmount)).to.be.true
      });
      it("Should close the vault when it's empty", async () => {
        const vaultBefore = await controller.vaults(vaultId)
        const withdrawAmount = vaultBefore.collateralAmount
        const nftBalanceBefore = await shortSqueeth.balanceOf(seller1.address)
        const burnAmount = vaultBefore.shortAmount
        const controllerBalanceBefore = await provider.getBalance(controller.address)
        
        await controller.connect(seller1).burnWPowerPerpAmount(vaultId, burnAmount, withdrawAmount)
        
        const controllerBalanceAfter = await provider.getBalance(controller.address)
        const nftBalanceAfter = await shortSqueeth.balanceOf(seller1.address)

        expect(controllerBalanceBefore.sub(withdrawAmount).eq(controllerBalanceAfter)).to.be.true
        expect(nftBalanceAfter.eq(nftBalanceBefore)).to.be.true // nft is not burned
      });
    });
  });

  describe('Combined actions', async() => {

    let vaultId: BigNumber

    describe('Open, deposit and mint', () => {
      it('should revert if the vault has too little collateral', async() => {
        const mintAmount = ethers.utils.parseUnits('0.1')
        const collateralAmount = ethers.utils.parseUnits('0.45')
        await expect(controller.connect(random).mintPowerPerpAmount(0, mintAmount, 0, {value: collateralAmount}))
          .to.be.revertedWith('C22')
      })
      it('should open vault, deposit and mint in the same tx', async() => {
        vaultId = await shortSqueeth.nextId()
        const mintAmount = ethers.utils.parseUnits('100')
        const collateralAmount = ethers.utils.parseUnits('45') 

        const controllerBalanceBefore = await provider.getBalance(controller.address)
        const nftBalanceBefore = await shortSqueeth.balanceOf(seller1.address)
        const squeethBalanceBefore = await squeeth.balanceOf(seller1.address)

        // put vaultId as 0 to open vault
        await controller.connect(seller1).mintPowerPerpAmount(0, mintAmount, 0, {value: collateralAmount})

        const normFactor = await controller.normalizationFactor()
        const controllerBalanceAfter = await provider.getBalance(controller.address)
        const nftBalanceAfter = await shortSqueeth.balanceOf(seller1.address)
        const squeethBalanceAfter = await squeeth.balanceOf(seller1.address)
        const newVault = await controller.vaults(vaultId)

        expect(nftBalanceBefore.add(1).eq(nftBalanceAfter)).to.be.true
        expect(controllerBalanceBefore.add(collateralAmount).eq(controllerBalanceAfter)).to.be.true
        expect(squeethBalanceBefore.add(mintAmount.mul(one).div(normFactor)).eq(squeethBalanceAfter)).to.be.true

        expect(newVault.collateralAmount.eq(collateralAmount)).to.be.true
        expect(newVault.shortAmount.eq(mintAmount.mul(one).div(normFactor))).to.be.true
      })
    })

    describe('Deposit and mint with mintWPowerPerpAmount', () => {
      
      it('Should revert if a random address tries to deposit collateral using mintWPowerPerpAmount', async() => {
        // mint some other squeeth in vault 2.
        const collateralAmount = ethers.utils.parseUnits('4.5')

        await expect(controller.connect(random).mintWPowerPerpAmount(vaultId, 0, 0, {value: collateralAmount})).to.be.revertedWith("C20")
      })

      it('Should revert if a random address tries to deposit a Uni NFT using mintWPowerPerpAmount', async() => {
        // mint some other squeeth in vault 2.
        const uniTokenId = 100
        
        await expect(controller.connect(random).mintWPowerPerpAmount(vaultId, 0, uniTokenId)).to.be.revertedWith("C20")
      })
      
      it('should deposit and mint in the same tx', async() => {
        // mint some other squeeth in vault 2.
        const normFactor = await controller.normalizationFactor()
        const mintRSqueethAmount = ethers.utils.parseUnits('1')
        const mintWSqueethAmount = mintRSqueethAmount.mul(one).div(normFactor)
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

      it('should just mint if deposit amount is 0', async() => {
        const testMintWAmount = ethers.utils.parseUnits('0.001')
        const vaultBefore = await controller.vaults(vaultId)        
        await controller.connect(seller1).mintWPowerPerpAmount(vaultId, testMintWAmount, 0)
        const vaultAfter = await controller.vaults(vaultId)

        expect(vaultAfter.collateralAmount.sub(vaultBefore.collateralAmount).isZero()).to.be.true
        expect(vaultAfter.shortAmount.sub(vaultBefore.shortAmount).eq(testMintWAmount)).to.be.true
      })
      it('should just deposit if mint amount is 0', async() => {
        
        const testDepositAmount = ethers.utils.parseUnits('0.1')
        const vaultBefore = await controller.vaults(vaultId)        
        await controller.connect(seller1).mintWPowerPerpAmount(vaultId, 0, 0, {value: testDepositAmount})
        const vaultAfter = await controller.vaults(vaultId)

        expect(vaultAfter.collateralAmount.sub(vaultBefore.collateralAmount).eq(testDepositAmount)).to.be.true
        expect(vaultAfter.shortAmount.sub(vaultBefore.shortAmount).isZero()).to.be.true
      })
      it('should do nothing if both deposit and mint amount are 0', async() => {
        const vaultBefore = await controller.vaults(vaultId)        
        await controller.connect(seller1).mintWPowerPerpAmount(vaultId, 0, 0)
        const vaultAfter = await controller.vaults(vaultId)

        expect(vaultAfter.collateralAmount.sub(vaultBefore.collateralAmount).isZero()).to.be.true
        expect(vaultAfter.shortAmount.sub(vaultBefore.shortAmount).isZero()).to.be.true
      })
    })

    describe('Deposit and mint By operator', () => {
      it('should not allow a non owner to update an operator', async () => {        
        await expect(controller.connect(seller2).updateOperator(vaultId, random.address)).to.be.revertedWith("C20")
      })      
      it('should add an operator', async () => {
        await controller.connect(seller1).updateOperator(vaultId, random.address)
        const vault = await controller.vaults(vaultId)
        expect(vault.operator).to.be.eq(random.address)
      })
      it('should deposit and mint in the same tx', async() => {
        // mint some other squeeth in vault 2.
        const mintAmount = ethers.utils.parseUnits('100')
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
        expect(squeethBalanceBefore.add(mintAmount.mul(one).div(normFactor)).eq(squeethBalanceAfter)).to.be.true

        expect(vaultBefore.collateralAmount.add(collateralAmount).eq(vaultAfter.collateralAmount)).to.be.true
        expect(vaultBefore.shortAmount.add(mintAmount.mul(one).div(normFactor)).eq(vaultAfter.shortAmount)).to.be.true
      })
      it('should not allow an operator to update the operator associated with an account', async () => {
        const vault = await controller.vaults(vaultId)
        expect(vault.operator).to.be.eq(random.address)
        await expect(controller.connect(random).updateOperator(vaultId, seller2.address)).to.be.revertedWith("C20")
      })
    })

    describe('Burn and withdraw', () => {
      let seller4VaultId: BigNumber
      before('mint squeeth for seller4 to withdraw', async() => {
        seller4VaultId = await shortSqueeth.nextId()
        const mintRAmount = ethers.utils.parseUnits('100')
        const collateralAmount = ethers.utils.parseUnits('45')
        await controller.connect(seller4).mintPowerPerpAmount(0, mintRAmount, 0, {value: collateralAmount})
      })

      it('should burn and withdraw with burnRPowerPerp', async() => {
        const vaultBefore = await controller.vaults(seller4VaultId)
        
        // the real rSqueeth amount will decrease after funding.
        const burnRSqueethAmount = ethers.utils.parseUnits('100').div(2)
        const withdrawCollateralAmount = ethers.utils.parseUnits('45').div(2)

        const controllerBalanceBefore = await provider.getBalance(controller.address)
        const wsqueethBalanceBefore = await squeeth.balanceOf(seller4.address)

        await controller.connect(seller4).burnPowerPerpAmount(seller4VaultId, burnRSqueethAmount, withdrawCollateralAmount)

        const controllerBalanceAfter = await provider.getBalance(controller.address)
        const wsqueethBalanceAfter = await squeeth.balanceOf(seller4.address)
        const vaultAfter = await controller.vaults(seller4VaultId)        
        const normFactor = await controller.normalizationFactor()

        expect(controllerBalanceBefore.sub(withdrawCollateralAmount).eq(controllerBalanceAfter)).to.be.true
        expect(wsqueethBalanceBefore.sub(burnRSqueethAmount.mul(one).div(normFactor)).eq(wsqueethBalanceAfter)).to.be.true

        expect(vaultBefore.collateralAmount.sub(withdrawCollateralAmount).eq(vaultAfter.collateralAmount)).to.be.true
        expect(vaultBefore.shortAmount.sub(burnRSqueethAmount.mul(one).div(normFactor)).eq(vaultAfter.shortAmount)).to.be.true
      })
      after('clean up vault4', async() => {
        const vault = await controller.vaults(seller4VaultId)
        await controller.connect(seller4).burnWPowerPerpAmount(seller4VaultId, vault.shortAmount, vault.collateralAmount)
      })
    })
  })

  describe('Deposit and withdraw with Fee', async() => {
    let vaultId: BigNumber
    it('should be able to set fee rate', async() => {
      // set 1% fee
      await controller.connect(owner).setFeeRate(100)
      expect((await controller.feeRate()).eq(100)).to.be.true
    })
    it('should revert if vault is unable to pay fee amount from attach amount or vault collateral', async() => {
      vaultId = await shortSqueeth.nextId()
      const powerPerpToMint = ethers.utils.parseUnits('0.5')
      await expect(controller.connect(random).mintPowerPerpAmount(0, powerPerpToMint, 0)).to.be.revertedWith('SafeMath: subtraction overflow')

    })
    it('should charge fee on mintPowerPerpAmount from deposit amount', async() => {
      vaultId = await shortSqueeth.nextId()

      const normFactor = await controller.normalizationFactor()

      const powerPerpToMint = ethers.utils.parseUnits('0.5')
      const collateralDeposited = ethers.utils.parseUnits('0.55')
      const powerPerpInEth =  scaledSqueethPrice.mul(powerPerpToMint).mul(normFactor).div(one).div(one)
      const expectedFee = powerPerpInEth.div(100)
      const totalEthAttached = expectedFee.add(collateralDeposited)
    
      const feeRecipientBalanceBefore = await provider.getBalance(feeRecipient.address)

      await controller.connect(random).mintPowerPerpAmount(0, powerPerpToMint, 0, { value: totalEthAttached })

      const feeRecipientBalanceAfter = await provider.getBalance(feeRecipient.address)
      const vault = await controller.vaults(vaultId)

      expect(isSimilar(vault.collateralAmount.toString(),collateralDeposited.toString())).to.be.true
      expect(isSimilar((feeRecipientBalanceAfter.sub(feeRecipientBalanceBefore)).toString(),(expectedFee.toString()))).to.be.true

    })

    it('should charge fee on mintPowerPerpAmount from vault collateral', async() => {

      const vaultBefore = await controller.vaults(vaultId)
      const normFactor = await controller.normalizationFactor()

      const powerPerpToMint = ethers.utils.parseUnits('0.5')
      const powerPerpInEth =  scaledSqueethPrice.mul(powerPerpToMint).mul(normFactor).div(one).div(one)
      const expectedFee = powerPerpInEth.div(100)
    
      const feeRecipientBalanceBefore = await provider.getBalance(feeRecipient.address)

      await controller.connect(random).mintPowerPerpAmount(vaultId, powerPerpToMint, 0)

      const feeRecipientBalanceAfter = await provider.getBalance(feeRecipient.address)
      const vaultAfter = await controller.vaults(vaultId)

      expect(isSimilar(vaultAfter.collateralAmount.toString(),((vaultBefore.collateralAmount).sub(expectedFee)).toString())).to.be.true
      expect(isSimilar((feeRecipientBalanceAfter.sub(feeRecipientBalanceBefore)).toString(),(expectedFee.toString()))).to.be.true

    })

    it('should charge fee on mintWPowerPerpAmount from deposit amount', async() => {
      vaultId = await shortSqueeth.nextId()

      const wSqueethToMint = ethers.utils.parseUnits('0.1')
      const collateralDeposited = ethers.utils.parseUnits('0.55')
      
      const feeRecipientBalanceBefore = await provider.getBalance(feeRecipient.address)

      const powerPerpInEth =  scaledSqueethPrice.mul(wSqueethToMint).div(one)
      const expectedFee = powerPerpInEth.div(100)
      const totalEthAttached = expectedFee.add(collateralDeposited)

      const now = await getNow(provider)
      await provider.send("evm_setNextBlockTimestamp", [now+1]) 

      await controller.connect(random).mintWPowerPerpAmount(0, wSqueethToMint, 0, { value: totalEthAttached })
      

      const feeRecipientBalanceAfter = await provider.getBalance(feeRecipient.address)
      const vault = await controller.vaults(vaultId)

      expect(isSimilar(vault.collateralAmount.toString(),collateralDeposited.toString())).to.be.true
      expect(isSimilar((feeRecipientBalanceAfter.sub(feeRecipientBalanceBefore)).toString(),(expectedFee.toString()))).to.be.true

    })

    it('should charge fee on mintWPowerPerpAmount from vault collateral', async() => {

      const vaultBefore = await controller.vaults(vaultId)
      const wSqueethToMint = ethers.utils.parseUnits('0.1')
    
      const feeRecipientBalanceBefore = await provider.getBalance(feeRecipient.address)

      await controller.connect(random).mintWPowerPerpAmount(vaultId, wSqueethToMint, 0)
      
      const powerPerpInEth =  scaledSqueethPrice.mul(wSqueethToMint).div(one)
      const expectedFee = powerPerpInEth.div(100)

      const feeRecipientBalanceAfter = await provider.getBalance(feeRecipient.address)
      const vaultAfter = await controller.vaults(vaultId)

      expect(isSimilar(vaultAfter.collateralAmount.toString(),((vaultBefore.collateralAmount).sub(expectedFee)).toString())).to.be.true
      expect(isSimilar((feeRecipientBalanceAfter.sub(feeRecipientBalanceBefore)).toString(),(expectedFee.toString()))).to.be.true

    })
    after('set the fee back to 0', async() => {
      await controller.connect(owner).setFeeRate(0)
    })
  })

  describe("Settlement operations should be banned", async () => {
    it("Should revert when calling redeemLong", async () => {
      await expect(
        controller.connect(seller1).redeemLong(0)
      ).to.be.revertedWith("C3");
    });
    it("Should revert when calling redeemShort", async () => {
      await expect(
        controller.connect(seller1).redeemShort(1)
      ).to.be.revertedWith("C3");
    });
    it("Should revert when calling donate", async () => {
      await expect(
        controller.connect(random).donate({value: 1})
      ).to.be.revertedWith("C3");
    });
  });
  
  describe("Emergency Shutdown and pausing", function () {
    const settlementPrice = BigNumber.from('10500').mul(one);
    const scaledSettlementPrice = settlementPrice.div(oracleScaleFactor)
    let seller2VaultId: BigNumber;
    let seller3VaultId: BigNumber;

    // seller 5 is the seller with nft as collateral
    let seller5VaultId: BigNumber
    const seller5NFTId = 1
    
    let seller3TotalSqueeth: BigNumber

    let initialTick: string

    const ethLiquidityAmount = ethers.utils.parseUnits('30')
    const squeethLiquidityAmount = ethers.utils.parseUnits('100')
    
    let normalizationFactor: BigNumber
    let wethIsToken0: boolean  
    const collateralAmount = ethers.utils.parseEther('50')
    

    // seller 6 is the seller with nft with all squeeth
    let seller6VaultId: BigNumber
    const seller6NFTId = 2
    const s6MintAmount = ethers.utils.parseUnits('0.0001')
    const seller6Collateral = ethers.utils.parseEther('0.5')
    
    // seller 7 is the seller with no short
    let seller7VaultId: BigNumber
    const vault7Collateral = ethers.utils.parseEther('0.5')

    // seller8 fail to settle short vault with nft in it, but able to reduceDebt
    let seller8VaultId: BigNumber
    const seller8NFTId = 3
    

    before('set LP token properties', async() => {
      wethIsToken0 = parseInt(weth.address, 16) < parseInt(squeeth.address, 16)
      const token0 = wethIsToken0 ? weth.address : squeeth.address
      const token1 = wethIsToken0 ? squeeth.address : weth.address
      const { sqrtPrice: sqrtX96Price, tick } = getSqrtPriceAndTickBySqueethPrice(scaledSqueethPrice, wethIsToken0)
      initialTick = tick
      await oracle.setAverageTick(squeethEthPool.address, tick)

      
      // infinite price range
      const nftTickUpper = 887220
      const nftTickLower = -887220
      const liquidity = await vaultLib.getLiquidity(
        sqrtX96Price,
        nftTickLower,
        nftTickUpper,
        wethIsToken0 ? ethLiquidityAmount : squeethLiquidityAmount,
        wethIsToken0 ? squeethLiquidityAmount: ethLiquidityAmount,
      )
      
      await squeethEthPool.setSlot0Data(sqrtX96Price, initialTick)
      await uniPositionManager.setMockedProperties(token0, token1, nftTickLower, nftTickUpper, liquidity)

      // set amount getting out from position manager
      const { ethAmount, wPowerPerpAmount } = await vaultLib.getUniPositionBalances(uniPositionManager.address, seller5NFTId, initialTick, wethIsToken0)
      const token0ToSet = wethIsToken0 ? ethAmount : wPowerPerpAmount
      const token1ToSet = wethIsToken0 ? wPowerPerpAmount : ethAmount
      await uniPositionManager.setAmount0Amount1ToDecrease(token0ToSet, token1ToSet)

      // minting 2x the amount of eth and squeeth as we have 2 nfts to test
      await squeeth.mint(uniPositionManager.address, wPowerPerpAmount.mul(2));
      await weth.deposit({value: ethAmount.mul(2)});
      await weth.transfer(uniPositionManager.address, ethAmount.mul(2));

      



    })
    
    before('Prepare a new vault for this test set', async() => {
      // prepare a vault that's gonna go underwater
      seller2VaultId = await shortSqueeth.nextId()
      const mintAmount = ethers.utils.parseUnits('100')
      await controller.connect(seller2).mintPowerPerpAmount(0, mintAmount, 0, { value: collateralAmount })

      // prepare a vault that's not gonna go insolvent
      seller3VaultId = await shortSqueeth.nextId()
      const s3MintAmount = ethers.utils.parseUnits('4')
      await controller.connect(seller3).mintPowerPerpAmount(0, s3MintAmount, 0, { value: collateralAmount })
      seller3TotalSqueeth = await squeeth.balanceOf(seller3.address)

      // mint a lot of squeeth from seller1 that system can't payout to.
      const collateral = ethers.utils.parseUnits('450')
      await controller.connect(seller1).mintPowerPerpAmount(0, ethers.utils.parseUnits('1000'), 0, {value: collateral})

      seller5VaultId = await shortSqueeth.nextId()
      const s5MintAmount = ethers.utils.parseUnits('1')
      // mint fake nft for seller5
      await uniPositionManager.mint(seller5.address, seller5NFTId)
      await uniPositionManager.connect(seller5).approve(controller.address, seller5NFTId)
      await controller.connect(seller5).mintPowerPerpAmount(0, s5MintAmount, seller5NFTId, { value: collateralAmount })   

      // prepare a vault with nft for seller 6
      seller6VaultId = await shortSqueeth.nextId()

      await uniPositionManager.mint(seller6.address, seller6NFTId)
      await uniPositionManager.connect(seller6).approve(controller.address, seller6NFTId)
      await controller.connect(seller6).mintWPowerPerpAmount(0, s6MintAmount, seller6NFTId, { value: seller6Collateral })      

      // prepare a vault with no short for seller 7
      seller7VaultId = await shortSqueeth.nextId()
      await controller.connect(seller7).mintPowerPerpAmount(0, 0, 0, { value: vault7Collateral })      

      // prepare an insolvent vault with nft (seller8)
      seller8VaultId = await shortSqueeth.nextId()
      const s8MintAmount = ethers.utils.parseUnits('133')
      await uniPositionManager.mint(seller8.address, seller8NFTId)
      await uniPositionManager.connect(seller8).approve(controller.address, seller8NFTId)
      await controller.connect(seller8).mintPowerPerpAmount(0, s8MintAmount, seller8NFTId, { value: 0 })   
      

      normalizationFactor = await controller.normalizationFactor()
    })

    describe("Pause the system", async () => {
      let pausesLeft = 4;
      it("Should revert when called by non-owner", async () => {
        await expect(
          controller.connect(random).pause()
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });
      it("Should revert when calling unpause before system is paused", async () => {
        await expect(
          controller.connect(random).unPauseAnyone()
        ).to.be.revertedWith("C1");
        await expect(
          controller.connect(owner).unPauseOwner()
        ).to.be.revertedWith("C1");
      });
      it("Should allow owner to pause the system", async () => {
        await controller.connect(owner).pause()
        pausesLeft-=1;
        expect(await controller.isSystemPaused()).to.be.true;
        expect((await controller.pausesLeft()).eq(pausesLeft)).to.be.true 
      })
        // how to ensure that all variables are updated ie lastPauseTime, need block.timestamp here
      it("Should revert when a random person tries to unpause immediately afterwards", async () => {
        await expect(
          controller.connect(random).unPauseAnyone()
        ).to.be.revertedWith("C18");
      });
      it("Should allow the owner to un-pause", async () => {
        await controller.connect(owner).unPauseOwner()
        expect(await controller.isSystemPaused()).to.be.false 
        expect((await controller.pausesLeft()).eq(pausesLeft)).to.be.true 

      });
      it("Should allow the owner to re-pause", async () => {
        await controller.connect(owner).pause()
        pausesLeft-=1;
        expect(await controller.isSystemPaused()).to.be.true 
        expect((await controller.pausesLeft()).eq(pausesLeft)).to.be.true 

      });
      it("Should allow the anyone to unpause after sufficient time has passed", async () => {
        await provider.send("evm_increaseTime", [86400])
        await provider.send("evm_mine", [])
        await controller.connect(random).unPauseAnyone()
        expect(await controller.isSystemPaused()).to.be.false 
      });
      it("Should allow the owner to re-pause", async () => {
        await controller.connect(owner).pause()
        pausesLeft-=1;
        expect(await controller.isSystemPaused()).to.be.true 
        expect((await controller.pausesLeft()).eq(pausesLeft)).to.be.true 
      });
      it("Should revert when calling mintPowerPerpAmount", async () => {
        await expect(
          controller.connect(seller1).mintPowerPerpAmount(0, 0, 0)
        ).to.be.revertedWith("C0");
      });
      it("Should revert when calling mintWPowerPerpAmount", async () => {
        await expect(
          controller.connect(seller1).mintWPowerPerpAmount(0, 0, 0)
        ).to.be.revertedWith("C0");
      });
      it("Should revert when calling deposit", async () => {
        await expect(
          controller.connect(seller1).deposit(1, { value: 1})
        ).to.be.revertedWith("C0");
      });
      it("Should revert when calling depositUniPositionToken", async () => {
        await expect(
          controller.connect(seller1).depositUniPositionToken(1, 1,)
        ).to.be.revertedWith("C0");
      });
      it("Should revert when calling burnWPowerPerpAmount", async () => {
        await expect(
          controller.connect(seller1).burnWPowerPerpAmount(1, 1, 1)
        ).to.be.revertedWith("C0");
      });
      it("Should revert when calling burnPowerPerpAmount", async () => {
        await expect(
          controller.connect(seller1).burnPowerPerpAmount(1, 1, 1)
        ).to.be.revertedWith("C0");
      });
      it("Should revert when calling withdraw", async () => {
        await expect(
          controller.connect(seller1).withdraw(1, 1)
        ).to.be.revertedWith("C0");
      });
      it("Should revert when calling withdrawUniPositionToken", async () => {
        await expect(
          controller.connect(seller1).withdrawUniPositionToken(1)
        ).to.be.revertedWith("C0");
      });
      it("Should revert when calling reduceDebt", async () => {
        await expect(
          controller.connect(seller1).reduceDebt(1)
        ).to.be.revertedWith("C0");
      });
      it("Should revert when calling applyFunding", async () => {
        await expect(
          controller.connect(seller1).applyFunding()
        ).to.be.revertedWith("C0");
      });
      it("Should revert when calling liquidate", async () => {
        await expect(
          controller.connect(seller1).liquidate(0, 0)
        ).to.be.revertedWith("C0");
      });
      it("Should revert when calling reduceDebt", async () => {
        await expect(
          controller.connect(seller1).reduceDebt(0)
        ).to.be.revertedWith("C0");
      });
      
      
      it("Should allow the owner to un-pause", async () => {
        await controller.connect(owner).unPauseOwner()
        expect(await controller.isSystemPaused()).to.be.false 
      });

      it("Should revert when a random address tries to reduce debt on a NFT containing vault and the system isnt shut down", async () => {
        await expect(
          controller.connect(random).reduceDebtShutdown(seller8NFTId)
        ).to.be.revertedWith("C3");
      });
      
      it("Should allow the owner to re-pause", async () => {
        await controller.connect(owner).pause()
        pausesLeft-=1;
        expect(await controller.isSystemPaused()).to.be.true 
        expect((await controller.pausesLeft()).eq(pausesLeft)).to.be.true 
      });

      it("Should revert if shutdown is called by non-owner", async () => {
        await expect(
          controller.connect(random).shutDown()
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });

      it("Should allow the owner to un-pause", async () => {
        await controller.connect(owner).unPauseOwner()
        expect(await controller.isSystemPaused()).to.be.false 
      });

      it("Should revert when a owner tries to pause the system after it has been paused 4 times before", async () => {
        await expect(
          controller.connect(owner).pause()
        ).to.be.revertedWith("C16");
      });
    });
    describe("Shut down the system using shutdown when it is unpaused", async () => {
      it("Should revert when called by non-owner", async () => {
        await expect(
          controller.connect(random).shutDown()
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });
      it("Should shutdown the system at a price that it will go insolvent", async () => {
        const ethPrice = settlementPrice

        const { tick, sqrtPrice: newSqrtPrice } = getSqrtPriceAndTickBySqueethPrice(scaledSettlementPrice, wethIsToken0)
        // update prices in pool and oracle.
        const newTick = tick

        const { ethAmount, wPowerPerpAmount } = await vaultLib.getUniPositionBalances(uniPositionManager.address, seller8NFTId, newTick, wethIsToken0)
        const token0ToSet = wethIsToken0 ? ethAmount : wPowerPerpAmount
        const token1ToSet = wethIsToken0 ? wPowerPerpAmount : ethAmount
        await uniPositionManager.setAmount0Amount1ToDecrease(token0ToSet, token1ToSet)

        await oracle.connect(random).setPrice(ethUSDPool.address , ethPrice) // eth per 1 squeeth

        await squeethEthPool.setSlot0Data(newSqrtPrice, newTick)
        await oracle.setPrice(squeethEthPool.address, scaledSettlementPrice)
        await oracle.setAverageTick(squeethEthPool.address, newTick)
        await oracle.setPrice(ethUSDPool.address, settlementPrice)

        await controller.connect(owner).shutDown()
        const snapshot = await controller.indexForSettlement();
        expect(snapshot.toString()).to.be.eq(ethPrice.div(oracleScaleFactor))
        expect(await controller.isShutDown()).to.be.true;
        expect(await controller.isSystemPaused()).to.be.true;
      });
      it("Should revert when calling shutdown after system is shutdown", async () => {
        await expect(
          controller.connect(owner).shutDown()
        ).to.be.revertedWith("C2");
      });
      it("Should revert when calling pause after system is shutdown", async () => {
        await expect(
          controller.connect(owner).pause()
        ).to.be.revertedWith("C2");
      });
      it("Should revert when calling unPause after system is shutdown", async () => {
        await expect(
          controller.connect(random).unPauseAnyone()
        ).to.be.revertedWith("C2");
        await expect(
          controller.connect(owner).unPauseOwner()
        ).to.be.revertedWith("C2");
      });
    });
    describe("Settlement: redeemLong", async () => {
      it("should go insolvent while trying to redeem fair value for seller1 (big holder)", async () => {
        const seller1Amount = await squeeth.balanceOf(seller1.address)
        await expect(
          controller.connect(seller1).redeemLong(seller1Amount)
        ).to.be.revertedWith("Address: insufficient balance");
      });
      it("should accept donation from random address", async() => {
        const settleAmount = await squeeth.totalSupply()
        const expectedPayout = settleAmount.mul(normalizationFactor).mul(settlementPrice).div(one).div(one)
        const controllerEthBalance = await provider.getBalance(controller.address)
        const donorBalance = await provider.getBalance(random.address)
        const ethNeeded = expectedPayout.sub(controllerEthBalance) 
        const donateAmount = donorBalance.gt(ethNeeded) ?  ethNeeded : donorBalance 
        await controller.connect(random).donate({value: donateAmount})
      })
      it("should be able to redeem long value for seller2", async () => {
        const controllerEthBefore = await provider.getBalance(controller.address)
        const sellerEthBefore = await provider.getBalance(seller2.address)
        const redeemAmount = await squeeth.balanceOf(seller2.address)
        await controller.connect(seller2).redeemLong(redeemAmount)
        
        // this test works because ES doesn't apply funding, so normalizationFactor won't change after shutdown
        const expectedPayout = redeemAmount.mul(normalizationFactor).mul(settlementPrice).div(one).div(one).div(oracleScaleFactor)
        const sellerEthAfter = await provider.getBalance(seller2.address)
        const controllerEthAfter = await provider.getBalance(controller.address)
        const squeethBalanceAfter = await squeeth.balanceOf(seller2.address)
        expect(squeethBalanceAfter.isZero()).to.be.true
        expect(controllerEthBefore.sub(controllerEthAfter).eq(expectedPayout)).to.be.true
        // expect(sellerEthAfter.sub(sellerEthBefore).eq(expectedPayout)).to.be.true
      });
      it("should be able to redeem long value for seller3", async () => {
        const controllerEthBefore = await provider.getBalance(controller.address)
        const sellerEthBefore = await provider.getBalance(seller3.address)
        const redeemAmount = await squeeth.balanceOf(seller3.address)
        await controller.connect(seller3).redeemLong(redeemAmount)
        
        // this test works because ES doesn't apply funding, so normalizationFactor won't change after shutdown
        const expectedPayout = redeemAmount.mul(normalizationFactor).mul(settlementPrice).div(one).div(one).div(oracleScaleFactor)
        const sellerEthAfter = await provider.getBalance(seller3.address)
        const controllerEthAfter = await provider.getBalance(controller.address)
        const squeethBalanceAfter = await squeeth.balanceOf(seller3.address)
        expect(squeethBalanceAfter.isZero()).to.be.true
        expect(controllerEthBefore.sub(controllerEthAfter).eq(expectedPayout)).to.be.true
        // expect(sellerEthAfter.sub(sellerEthBefore).eq(expectedPayout)).to.be.true
      });
    })
    describe('Settlement: redeemShort', async() => {
      // stimulated LP deposits
      let currentTick: string

      before('set oracle prices', async() => {
        wethIsToken0 = parseInt(weth.address, 16) < parseInt(squeeth.address, 16)
        const { sqrtPrice: sqrtX96Price, tick } = getSqrtPriceAndTickBySqueethPrice(scaledSettlementPrice, wethIsToken0)
        currentTick = tick
        
        await oracle.setAverageTick(squeethEthPool.address, currentTick)
        await oracle.connect(random).setPrice(squeethEthPool.address, scaledSqueethPrice)

        await oracle.connect(random).setPrice(ethUSDPool.address, scaledSettlementPrice)
    
        await squeethEthPool.setSlot0Data(sqrtX96Price, currentTick)

        // set amount getting out from position manager
        const { ethAmount, wPowerPerpAmount } = await vaultLib.getUniPositionBalances(uniPositionManager.address, seller5NFTId, currentTick, wethIsToken0)
        const token0ToSet = wethIsToken0 ? ethAmount : wPowerPerpAmount
        const token1ToSet = wethIsToken0 ? wPowerPerpAmount : ethAmount
        await uniPositionManager.setAmount0Amount1ToDecrease(token0ToSet, token1ToSet)

        // minting 2x the amount of eth and squeeth as we have 2 nfts to test
        await squeeth.mint(uniPositionManager.address, wPowerPerpAmount.mul(5));
        await weth.deposit({value: ethAmount.mul(5)});
        await weth.transfer(uniPositionManager.address, ethAmount.mul(5));

      })

      it('should revert when a underwater vault (seller2) is trying to redeem', async() => {
        await expect(
          controller.connect(seller2).redeemShort(seller2VaultId)
        ).to.be.revertedWith('SafeMath: subtraction overflow')
      })

      it('should revert when a underwater vault with nft (seller8) is trying to redeem', async() => {
        await expect(
          controller.connect(seller8).redeemShort(seller8VaultId)
        ).to.be.revertedWith('SafeMath: subtraction overflow')
      })


      it("should allow anyone to reduceDebt in the insolvent vault", async () => {
        const vaultBefore = await controller.vaults(seller8VaultId)
        const sellerEthBefore = await provider.getBalance(seller6.address)
        const controllerEthBefore = await provider.getBalance(controller.address)
        const { ethAmount, wPowerPerpAmount } = await vaultLib.getUniPositionBalances(uniPositionManager.address, seller8NFTId, currentTick, wethIsToken0)

        await controller.connect(random).reduceDebtShutdown(seller8VaultId)
        const vaultAfter = await controller.vaults(seller8VaultId)
        const sellerEthAfter = await provider.getBalance(seller6.address)

        const controllerEthAfter = await provider.getBalance(controller.address)
        expect(vaultAfter.collateralAmount.sub(ethAmount).eq(vaultBefore.collateralAmount)).to.be.true
        expect(vaultBefore.shortAmount.sub(wPowerPerpAmount).eq(vaultAfter.shortAmount)).to.be.true
        expect(controllerEthAfter.sub(ethAmount).eq(controllerEthBefore)).to.be.true
        expect(sellerEthBefore.eq(sellerEthAfter)).to.be.true
      });

      it('should still revert when a underwater vault with nft (seller8) is trying to redeem', async() => {
        await expect(
          controller.connect(seller8).redeemShort(seller8VaultId)
        ).to.be.revertedWith('SafeMath: subtraction overflow')
      })

      it('should revert when a random user is trying to redeem', async() => {
        await expect(
          controller.connect(random).redeemShort(seller3VaultId)
        ).to.be.revertedWith('C20')
      })

      it("should redeem fair value for normal vault (seller 3)", async () => {
        const vaultBefore = await controller.vaults(seller3VaultId)
        const sellerEthBefore = await provider.getBalance(seller3.address)
        const controllerEthBefore = await provider.getBalance(controller.address)

        await controller.connect(seller3).redeemShort(seller3VaultId)
        const vaultAfter = await controller.vaults(seller3VaultId)
        
        const squeethDebt = seller3TotalSqueeth.mul(normalizationFactor).mul(settlementPrice).div(one).div(one).div(oracleScaleFactor)
        const shortPayout = vaultBefore.collateralAmount.sub(squeethDebt)
        const sellerEthAfter = await provider.getBalance(seller3.address)
        const controllerEthAfter = await provider.getBalance(controller.address)
        expect(controllerEthBefore.sub(controllerEthAfter).eq(shortPayout)).to.be.true
        // expect(sellerEthAfter.sub(sellerEthBefore).eq(shortPayout)).to.be.true
        expect(isEmptyVault(vaultAfter)).to.be.true;
      });

      it("should redeem fair value for short side with uni v3 nft (seller 5)", async () => {
        const { ethAmount: nftEthAmount, wPowerPerpAmount: nftWSqueethAmount } = await vaultLib.getUniPositionBalances(uniPositionManager.address, seller5NFTId, currentTick, wethIsToken0)
        const token0ToSet = wethIsToken0 ? nftEthAmount : nftWSqueethAmount
        const token1ToSet = wethIsToken0 ? nftWSqueethAmount : nftEthAmount
        await uniPositionManager.setAmount0Amount1ToDecrease(token0ToSet, token1ToSet)

        const vaultBefore = await controller.vaults(seller5VaultId)
        const sellerEthBefore = await provider.getBalance(seller5.address)
        const squeethBalanceBefore = await squeeth.balanceOf(seller5.address)

        await controller.connect(seller5).redeemShort(seller5VaultId)
        const vaultAfter = await controller.vaults(seller5VaultId)
        
        const amountToReduceDebtBy = (vaultBefore.shortAmount < nftWSqueethAmount) ? vaultBefore.shortAmount : nftWSqueethAmount 
        const squeethDebt = vaultBefore.shortAmount.sub(amountToReduceDebtBy).mul(normalizationFactor).mul(settlementPrice).div(oracleScaleFactor).div(one).div(one)
        const shortPayout = vaultBefore.collateralAmount.add(nftEthAmount).sub(squeethDebt)
        const sellerEthAfter = await provider.getBalance(seller5.address)
        
        const squeethBalanceAfter = await squeeth.balanceOf(seller5.address)
        
        expect(squeethBalanceAfter.sub(squeethBalanceBefore).eq(nftWSqueethAmount.sub(amountToReduceDebtBy))).to.be.true
        // expect(sellerEthAfter.sub(sellerEthBefore).eq(shortPayout)).to.be.true
        expect(isEmptyVault(vaultAfter)).to.be.true;
      });

      it('set seller6 LP token properties', async() => {
        // amount of wsqueeth worth is now 3x of amount needed
        const lpWSqueethAmount = s6MintAmount.mul(3)
        const lpWethAmount = BigNumber.from(0)
        const token0ToSet = wethIsToken0 ? lpWethAmount : lpWSqueethAmount
        const token1ToSet = wethIsToken0 ? lpWSqueethAmount : lpWethAmount
        await uniPositionManager.setAmount0Amount1ToDecrease(token0ToSet, token1ToSet)

        await squeeth.mint(uniPositionManager.address, lpWSqueethAmount);
      })

      it("should redeem fair value for seller 6 with one-sided nft", async () => {
        // nft has 3x wsqueeth minted
        // redeemShort should remove the whole debt in vault
        // and send the amount left (2/3) back to seller6 in wsqueeth
        const vaultBefore = await controller.vaults(seller6VaultId)
        const sellerEthBefore = await provider.getBalance(seller6.address)
        const sellerWsqueethBefore = await squeeth.balanceOf(seller6.address)

        await controller.connect(seller6).redeemShort(seller6VaultId)
        const vaultAfter = await controller.vaults(seller6VaultId)
        
        const sellerEthAfter = await provider.getBalance(seller6.address)
        const sellerWsqueethAfter = await squeeth.balanceOf(seller6.address)

        // expect(sellerEthAfter.sub(sellerEthBefore).eq(vaultBefore.collateralAmount)).to.be.true
        // get the remaining 2/3 (2x the initial minted amount) in wsqueeth
        expect(sellerWsqueethAfter.sub(sellerWsqueethBefore).eq(s6MintAmount.mul(2))).to.be.true
        expect(isEmptyVault(vaultAfter)).to.be.true;
      });

      it("should redeem fair value for short vault with no debt (seller7)", async () => {
        const sellerEthBefore = await provider.getBalance(seller7.address)

        await controller.connect(seller7).redeemShort(seller7VaultId)
        const vaultAfter = await controller.vaults(seller7VaultId)
        
        const sellerEthAfter = await provider.getBalance(seller7.address)

        // expect(sellerEthAfter.sub(sellerEthBefore).eq(vault7Collateral)).to.be.true
        expect(isEmptyVault(vaultAfter)).to.be.true;
      });
    });
  });
});
