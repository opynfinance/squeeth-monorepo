import { Contract } from "ethers"

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

export const getWETH = async (ethers: any, deployer: string, networkName: string)=> {
  const wethAddr = networkNameToWeth(networkName)
  if (wethAddr === undefined) {
    // get from deployed network
    return ethers.getContractAt("WETH9", deployer);
  } 
  // get contract instance at address
  return ethers.getContract('WETH9', wethAddr)
}

export const getUSDC = async (ethers: any, deployer: string, networkName: string)=> {
  const usdcAddress = networkNameToUSDC(networkName)
  if (usdcAddress === undefined) {
    // use to local deployment as USDC
    return ethers.getContractAt("MockErc20", deployer);
  } 
  // get contract instance at address
  return ethers.getContract('MockErc20', usdcAddress)
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
    uniswapFactory = await ethers.getContractAt("UniswapV3Factory", deployer);
  } else {
    uniswapFactory = await ethers.getContract('IUniswapV3Factory', networkNameToUniFactory(networkName))
  }
  
  // Get Uniswap Factory
  let swapRouter: Contract
  if (networkNameToUniRouter(networkName) === undefined) {
    swapRouter = await ethers.getContractAt("SwapRouter", deployer);
  } else {
    swapRouter = await ethers.getContract('ISwapRouter', networkNameToUniRouter(networkName))
  }

  // Get Position Manager
  let positionManager: Contract
  if (networkNameToPositionManager(networkName) === undefined) {
    positionManager = await ethers.getContractAt("NonfungiblePositionManager", deployer);
  } else {
    positionManager = await ethers.getContract('INonfungiblePositionManager', networkNameToPositionManager(networkName))
  }

  return { positionManager, swapRouter, uniswapFactory }
}