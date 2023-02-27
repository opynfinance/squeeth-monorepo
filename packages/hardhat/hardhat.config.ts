import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-etherscan";
import "@typechain/hardhat";
import "@float-capital/solidity-coverage" // fix compiler bug when abi encoder is enabled 
import "hardhat-contract-sizer";
import "hardhat-gas-reporter";
import "hardhat-prettier";
import "@tenderly/hardhat-tenderly";
import "hardhat-deploy";
import "@eth-optimism/hardhat-ovm";
import "@nomiclabs/hardhat-ethers";
import { HardhatUserConfig } from "hardhat/config";
import * as dotenv from 'dotenv'

// Import Tasks
import "./tasks/default";
import './tasks/addSqueethLiquidity'
import './tasks/addWethLiquidity'
import './tasks/buySqueeth'
import './tasks/buyWeth'
import './tasks/sellWeth'
import './tasks/sellSqueeth'
import './tasks/increaseSlot'

// Load env variables
dotenv.config()
const alchemyKey = process.env.ALCHEMY_KEY
const fs = require("fs");

//
// Select the network you want to deploy to here:
//
const defaultNetwork = "localhost";

function mnemonic() {
  try {
    return fs.readFileSync("./mnemonic.txt").toString().trim();
  } catch (e) {
    if (defaultNetwork !== "localhost") {
      console.log(
        "☢️ WARNING: No mnemonic file created for a deploy account. Try `yarn run generate` and then `yarn run account`."
      );
    }
  }
  return "";
}

const UNISWAP_SETTING = {
  version: "0.7.6",
  settings: {
    optimizer: {
      enabled: true,
      runs: 800,
    },
  },
};

const accounts = process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : { mnemonic: mnemonic() }

const config: HardhatUserConfig = {
  defaultNetwork,
  networks: {
    hardhat: {
      initialBaseFeePerGas: 0,
      saveDeployments: false, // only used in cicd to test deployments
      mining: {
        auto: true
      },
      forking: {
        enabled: process.env.MAINNET_FORK === 'true',
        url: `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_KEY}`,
        blockNumber: 14845140
      },
      accounts: {
        accountsBalance: '1000000000000000000000000000'
      },
    },
    localhost: {
      url: "http://localhost:8545",
      /*
        notice no mnemonic here? it will just use account 0 of the hardhat node to deploy
        (you can put in a mnemonic here to set the deployer locally)
      */
    },
    goerli: {
      url: `https://eth-goerli.g.alchemy.com/v2/${alchemyKey}`, 
      accounts,
    },
    mainnet: {
      url: `https://eth-mainnet.g.alchemy.com/v2/${alchemyKey}`, 
      accounts,
    },
    matic: {
      url: "https://polygon-mainnet.g.alchemy.com/v2/",
      gasPrice: 1000000000,
      accounts,
    },
    goerliArbitrum: {
      url: `https://arb-goerli.g.alchemy.com/v2/${alchemyKey}`,
      gasPrice: 30000000, // 0.03 gwei
      gas: 30_000_000,
      accounts,
      companionNetworks: {
        l1: "goerli",
      },
    },
    localArbitrum: {
      url: "http://localhost:8547",
      gasPrice: 0,
      accounts,
      companionNetworks: {
        l1: "localArbitrumL1",
      },
    },
    localArbitrumL1: {
      url: "http://localhost:7545",
      gasPrice: 0,
      accounts,
      companionNetworks: {
        l2: "localArbitrum",
      },
    },
    localOptimism: {
      url: "http://localhost:8545",
      gasPrice: 0,
      accounts,
      ovm: true,
      companionNetworks: {
        l1: "localOptimismL1",
      },
    },
    localOptimismL1: {
      url: "http://localhost:9545",
      gasPrice: 0,
      accounts,
      companionNetworks: {
        l2: "localOptimism",
      },
    },
    localAvalanche: {
      url: "http://localhost:9650/ext/bc/C/rpc",
      gasPrice: 225000000000,
      chainId: 43112,
      accounts,
    },
    fujiAvalanche: {
      url: "https://api.avax-test.network/ext/bc/C/rpc",
      gasPrice: 225000000000,
      chainId: 43113,
      accounts,
    },
    mainnetAvalanche: {
      url: "https://api.avax.network/ext/bc/C/rpc",
      gasPrice: 225000000000,
      chainId: 43114,
      accounts,
    },
  },
  solidity: {
    compilers: [
      UNISWAP_SETTING,
    ],
    overrides: {
      "contracts/mocks/MockTimelock.sol": {
        version: "0.8.10",
      },
      "contracts/strategy/timelock/Timelock.sol": {
        version: "0.8.10",
      },
      "contracts/strategy/timelock/SafeMath.sol": {
        version: "0.8.10",
      }
    }
  },
  ovm: {
    solcVersion: "0.7.6",
  },
  namedAccounts: {
    deployer: {
      default: 0, // here this will by default take the first account as deployer
    },
  },
  typechain: {
    outDir: "typechain",
    target: "ethers-v5",
  },
  gasReporter: {
    currency: "USD",
    gasPrice: 100,
    coinmarketcap: process.env.COINMARKETCAP,
    enabled: process.env.REPORT_GAS === "true",
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_KEY
  }
};

export default config;
