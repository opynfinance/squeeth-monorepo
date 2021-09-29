import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers";
import { ethers } from "hardhat"
import { expect } from "chai";
import { BigNumber, providers } from "ethers";
import { MockController, MockErc20, MockVaultNFTManager, CrabStrategy, ERC20 } from "../../../typechain";

describe("Crab Strategy", function () {
  let provider: providers.JsonRpcProvider;
  let owner: SignerWithAddress;
  let random: SignerWithAddress;
  let weth: ERC20;
  let shortNFT: MockVaultNFTManager;
  let controller: MockController;
  let crabStrategy: CrabStrategy;

  this.beforeAll("Prepare accounts", async() => {
    const accounts = await ethers.getSigners();
    const [_owner, _random] = accounts;
    random = _random
    owner = _owner
    provider = ethers.provider
  })

  this.beforeAll("Setup environment", async () => {
    const MockErc20Contract = await ethers.getContractFactory("MockErc20");
    weth = (await MockErc20Contract.deploy("WETH", "WETH")) as MockErc20;

    const NFTContract = await ethers.getContractFactory("MockVaultNFTManager");
    shortNFT = (await NFTContract.deploy()) as MockVaultNFTManager;

    const ControllerContract = await ethers.getContractFactory("MockController");
    controller = (await ControllerContract.deploy()) as MockController;

    await controller.connect(owner).init(shortNFT.address);
  })

  describe("Deployment", async () => {
    it("Deployment", async function () {
      const CrabStrategyContract = await ethers.getContractFactory("CrabStrategy");
      crabStrategy = (await CrabStrategyContract.deploy(controller.address, weth.address, "Opyn Crab Strategy", "OCS")) as CrabStrategy;
    });
  });

  describe("Crab strategy vault", async () => {
    it("Check crab details",  async () => {
      const name = await crabStrategy.name()
      const symbol = await crabStrategy.symbol()

      expect(name).to.be.eq("Opyn Crab Strategy")
      expect(symbol).to.be.eq("OCS")
    })
    it("Check crab strategy opened vault", async () => {
      const openedVaultId = await crabStrategy.getStrategyVaultId()

      expect(openedVaultId).to.be.eq(BigNumber.from(1))
    });
  });
})
