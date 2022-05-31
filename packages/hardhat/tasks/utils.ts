import { Contract } from "ethers"
import {
  abi as POOL_ABI,
} from '@uniswap/v3-core/artifacts/contracts/UniswapV3Pool.sol/UniswapV3Pool.json'

export const networkNameToUniRouter = (name: string) => {
  switch (name) {
    case 'mainnet': return '0xE592427A0AEce92De3Edee1F18E0157C05861564'
    case 'rinkebyArbitrum': return '0xE592427A0AEce92De3Edee1F18E0157C05861564'
    default: return undefined
  }
}

export const networkNameToUniFactory = (name: string) => {
  switch (name) {
    case 'mainnet': return '0x1F98431c8aD98523631AE4a59f267346ea31F984'
    case 'rinkebyArbitrum': return '0x1F98431c8aD98523631AE4a59f267346ea31F984'
    default: return undefined
  }
}

// quoter is different from uniswap's official deployment! cause it's QuoterV2
export const networkNameToUniQuoter = (name: string) => {
  switch (name) {
    case 'mainnet': return '0xC8d3a4e6BB4952E3658CCA5081c358e6935Efa43'
    case 'rinkebyArbitrum': return undefined
    default: return undefined
  }
}

export const networkNameToPositionManager = (name: string) => {
  switch (name) {
    case 'mainnet': return '0xC36442b4a4522E871399CD717aBDD847Ab11FE88'
    case 'rinkebyArbitrum': return '0xC36442b4a4522E871399CD717aBDD847Ab11FE88'
    default: return undefined
  }
}

export const networkNameToUSDC = (name: string) => {
  switch (name) {
    case 'mainnet': return '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
    case 'ropsten': return '0x27415c30d8c87437becbd4f98474f26e712047f4'
    default: return undefined
  }
}


export const networkNameToWeth = (name: string) => {
  switch (name) {
    case 'mainnet': return '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'
    case 'ropsten': return '0xc778417e063141139fce010982780140aa0cd5ab'
    case 'rinkebyArbitrum': return '0xB47e6A5f8b33b3F17603C83a0535A9dcD7E32681'
    default: return undefined
  }
}

export const networkNameToOracle = (name: string) => {
  switch (name) {
    case 'mainnet': return '0x65D66c76447ccB45dAf1e8044e918fA786A483A1'
    case 'ropsten': return '0xBD9F4bE886653177D22fA9c79FD0DFc41407fC89'
    case 'rinkebyArbitrum': return '0xe790Afe86c0bdc4Dd7C6CBb7dB087552Ec85F6fB'
    default: return undefined
  }
}

export const networkNameToController = (name: string) => {
  switch (name) {
    case 'mainnet': return '0x64187ae08781B09368e6253F9E94951243A493D5'
    case 'ropsten': return '0x59F0c781a6eC387F09C40FAA22b7477a2950d209'
    case 'rinkebyArbitrum': return '0x6FBbc7eBd7E421839915e8e4fAcC9947dC32F4dE'
    default: return undefined
  }
}

export const networkNameToEthUSDCPool = (name: string) => {
  switch (name) {
    case 'mainnet': return '0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8'
    case 'ropsten': return '0x8356AbC730a218c24446C2c85708F373f354F0D8'
    case 'rinkebyArbitrum': return '0xe7715b01a0B16E3e38A7d9b78F6Bd2b163D7f319'
    default: return undefined
  }
}

export const getWETH = async (ethers: any, deployer: string, networkName: string)=> {
  const wethAddr = networkNameToWeth(networkName)
  if (wethAddr === undefined) {
    // get from deployed network
    return ethers.getContract("WETH9", deployer);
  } 
  // get contract instance at address
  return ethers.getContractAt('WETH9', wethAddr)
}

export const getOracle = async (ethers: any, deployer: string, networkName: string)=> {
  const oracleAddr = networkNameToOracle(networkName)
  if (oracleAddr === undefined) {
    // get from deployed network
    return ethers.getContract("Oracle", deployer);
  } 
  // get contract instance at address
  return ethers.getContractAt('Oracle', oracleAddr)
}

export const getController = async (ethers: any, deployer: string, networkName: string)=> {
  const controllerAddr = networkNameToController(networkName)
  if (controllerAddr === undefined) {
    // get from deployed network
    return ethers.getContract("Controller", deployer);
  } 
  // get contract instance at address
  return ethers.getContractAt('Controller', controllerAddr)
}

export const getEthUSDCPool = async (ethers: any, deployer: string, networkName: string)=> {
  const ethUSDCPoolAddress = networkNameToEthUSDCPool(networkName)
  if (ethUSDCPoolAddress === undefined) {
    // get from deployed network
    return ethers.getContract(POOL_ABI, deployer);
  } 
  // get contract instance at address
  return ethers.getContractAt(POOL_ABI, ethUSDCPoolAddress)
}

export const getUSDC = async (ethers: any, deployer: string, networkName: string)=> {
  const usdcAddress = networkNameToUSDC(networkName)
  if (usdcAddress === undefined) {
    // use to local deployment as USDC
    return ethers.getContract("MockErc20", deployer);
  } 
  // get contract instance at address
  return ethers.getContractAt('MockErc20', usdcAddress)
}

/**
 * 
 * @param networkName 
 */
export const hasUniswapDeployments = (networkName: string) => {
  if (networkName === 'mainnet') return true
  if (networkName === 'rinkebyArbitrum') return true
  return false
}

export const getUniswapDeployments = async(ethers: any, deployer: string, networkName: string) => {
  // Get Uniswap Factory
  let uniswapFactory: Contract
  if (networkNameToUniFactory(networkName) === undefined) {
    uniswapFactory = await ethers.getContract("UniswapV3Factory", deployer);
  } else {
    uniswapFactory = await ethers.getContract('IUniswapV3Factory', networkNameToUniFactory(networkName))
  }
  
  // Get Uniswap Factory
  let swapRouter: Contract
  if (networkNameToUniRouter(networkName) === undefined) {
    swapRouter = await ethers.getContract("SwapRouter", deployer);
  } else {
    swapRouter = await ethers.getContract('ISwapRouter', networkNameToUniRouter(networkName))
  }

  // Get Position Manager
  let positionManager: Contract
  if (networkNameToPositionManager(networkName) === undefined) {
    positionManager = await ethers.getContract("NonfungiblePositionManager", deployer);
  } else {
    positionManager = await ethers.getContract('INonfungiblePositionManager', networkNameToPositionManager(networkName))
  }

  return { positionManager, swapRouter, uniswapFactory }
}