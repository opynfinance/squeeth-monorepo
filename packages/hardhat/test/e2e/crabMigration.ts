import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { ethers } from "hardhat"
import { expect } from "chai";
import { BigNumber, providers } from "ethers";
import { CrabStrategy, CrabStrategyV2, CrabMigration, IEulerDToken, WETH9, MockEulerDToken, IEulerExec} from "../../../typechain";
import { isSimilar, wmul, wdiv, one, oracleScaleFactor } from "../../utils"

describe("Crab Migration", function () {
 
    let crabStrategyV1: CrabStrategy;
    let crabStrategyV2: CrabStrategyV2
    let crabMigration: CrabMigration;

    let weth: WETH9;
    let dToken: IEulerDToken;
    let eulerExec: IEulerExec;

    let provider: providers.JsonRpcProvider;
    let owner: SignerWithAddress;
    let random: SignerWithAddress;
    let d1: SignerWithAddress;
    let d2: SignerWithAddress;

    const eulerMainnetAddress = "0x27182842E098f60e3D576794A5bFFb0777E025d3";
    const eulerExecAddress = "0x59828FdF7ee634AaaD3f58B19fDBa3b03E2D9d80";
    const dTokenAddress = "0x62e28f054efc24b26A794F5C1249B6349454352C";
    const wethAddress = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
    const crabV1Address = "0xf205ad80BB86ac92247638914265887A8BAa437D";
    const d1Address = "0x7ba50e6f1fc2bddfaad95b6bb9947949a588a038";
    const d2Address = "0x8b08a0a2e1bb7160fa0263abd28cd2d22f18943c";
    const squeethControllerAddress = "0x64187ae08781B09368e6253F9E94951243A493D5";
    const oracleAddress = "0x65D66c76447ccB45dAf1e8044e918fA786A483A1";
    const uniswapFactoryAddress = "0x1F98431c8aD98523631AE4a59f267346ea31F984";
    const wethOsqthPoolAddress = "0x82c427AdFDf2d245Ec51D8046b41c4ee87F0d29C";

    let deposit1Amount: BigNumber
    let deposit2Amount: BigNumber

    this.beforeAll("Prepare accounts", async () => {
        const accounts = await ethers.getSigners();
        const [_owner, _d1, _random, _d2] = accounts;
        d1 = _d1
        d2 = _d2
        random = _random
        owner = _owner
        provider = ethers.provider
    })

    this.beforeAll("Setup environment", async () => { 
        weth = await ethers.getContractAt("WETH9", wethAddress);
        dToken = await ethers.getContractAt("IEulerDToken", dTokenAddress);
        eulerExec = await ethers.getContractAt("IEulerExec", eulerExecAddress);
        crabStrategyV1 = await ethers.getContractAt("CrabStrategy", crabV1Address);

        // deposit1Amount = await crabStrategyV1.balanceOf(d1Address);
        // deposit2Amount = await crabStrategyV1.balanceOf(d2Address);
    })
    
    this.beforeAll("Deploy Crab 2", async () => {
        const CrabContract = await ethers.getContractFactory("CrabStrategyV2");
        crabStrategyV2 = (await CrabContract.deploy(
                            squeethControllerAddress, 
                            oracleAddress, 
                            wethAddress, 
                            uniswapFactoryAddress, 
                            wethOsqthPoolAddress, 
                            random.address,
                            1,
                            1,
                            1,
                            1,
                            ethers.utils.parseEther("10.0")));
    })

    this.beforeAll("Deploy Crab Migration", async () => { 
        const MigrationContract = await ethers.getContractFactory("CrabMigration");
        crabMigration = (await MigrationContract.deploy(crabV1Address, crabStrategyV2.address, eulerMainnetAddress, wethAddress, dTokenAddress));
    })

    describe("Test Migration", async() => { 

        xit("d1 deposits crabV1 shares", async () => { 
            const crabV1BalanceBefore = await crabStrategyV1.balanceOf(crabMigration.address); 

            await crabStrategyV1.connect(d1).approve(crabMigration.address, deposit1Amount);
            await crabMigration.connect(d1).depositV1Shares(deposit1Amount);

            const crabV1BalanceAfter = await crabStrategyV1.balanceOf(crabMigration.address);
            const d1SharesDeposited  = await crabMigration.sharesDeposited(d1.address);

            expect(crabV1BalanceBefore).to.be.equal('0');
            expect(crabV1BalanceAfter).to.be.equal(deposit1Amount);
            expect(d1SharesDeposited).to.be.equal(deposit1Amount);
        })

        xit("d2 deposits crabV1 shares", async () => { 
            const crabV1BalanceBefore = await crabStrategyV1.balanceOf(crabMigration.address); 

            await crabStrategyV1.connect(d2).approve(crabMigration.address, deposit2Amount);
            await crabMigration.connect(d2).depositV1Shares(deposit2Amount);

            const crabV1BalanceAfter = await crabStrategyV1.balanceOf(crabMigration.address);
            const d2SharesDeposited  = await crabMigration.sharesDeposited(d2.address);

            expect(crabV1BalanceAfter.sub(crabV1BalanceBefore)).to.be.equal(deposit2Amount);
            expect(d2SharesDeposited).to.be.equal(deposit2Amount);
        })

        xit("should not be able to claim until strategy has been migrated", async () => { 
            await expect(crabMigration.connect(d1).claimV2Shares()).to.be.revertedWith("M3");
        })
    })


})