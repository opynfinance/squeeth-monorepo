import { Contract } from "ethers"

export const networkNameToUniRouter = (name: string) => {
  switch (name) {
    case 'rinkebyArbitrum': return '0xE592427A0AEce92De3Edee1F18E0157C05861564'
    default: return undefined
  }
}

export const networkNameToUniFactory = (name: string) => {
  switch (name) {
    
    case 'rinkebyArbitrum': return '0x1F98431c8aD98523631AE4a59f267346ea31F984'
    default: return undefined
  }
}

export const networkNameToUniQuoter = (name: string) => {
  switch (name) {
    // quoter is different from uniswap's official deployment!
    case 'rinkebyArbitrum': return '0x8f92cfB1BF6eD1ce79F2E8Eb0DC96e0F3b61276D'
    default: return undefined
  }
}

export const networkNameToPositionManager = (name: string) => {
  switch (name) {
    case 'rinkebyArbitrum': return '0xC36442b4a4522E871399CD717aBDD847Ab11FE88'
    default: return undefined
  }
}

export const networkNameToDai = (name: string) => {
  switch (name) {
    case 'mainnet': return '0x6b175474e89094c44da98b954eedeac495271d0f'
    default: return undefined
  }
}

export const networkNameToWeth = (name: string) => {
  switch (name) {
    case 'ropsten': return '0xc778417e063141139fce010982780140aa0cd5ab'
    case 'rinkebyArbitrum': return '0xB47e6A5f8b33b3F17603C83a0535A9dcD7E32681'
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

export const getDai = async (ethers: any, deployer: string, networkName: string)=> {
  const daiAddress = networkNameToDai(networkName)
  if (daiAddress === undefined) {
    return ethers.getContract("MockErc20", deployer);
  } 
  // get contract instance at address
  return ethers.getContractAt('MockErc20', daiAddress)
}

/**
 * 
 * @param networkName 
 */
export const hasUniswapDeployments = (networkName: string) => {
  if (networkName === 'rinkebyArbitrum') return true
  return false
}

export const getUniswapDeployments = async(ethers: any, deployer: string, networkName: string) => {
  // Get Uniswap Factory
  let uniswapFactory: Contract
  if (networkNameToUniFactory(networkName) === undefined) {
    uniswapFactory = await ethers.getContract("UniswapV3Factory", deployer);
  } else {
    uniswapFactory = await ethers.getContractAt('IUniswapV3Factory', networkNameToUniFactory(networkName))
  }
  
  // Get Uniswap Factory
  let swapRouter: Contract
  if (networkNameToUniRouter(networkName) === undefined) {
    swapRouter = await ethers.getContract("SwapRouter", deployer);
  } else {
    swapRouter = await ethers.getContractAt('ISwapRouter', networkNameToUniRouter(networkName))
  }

  // Get Position Manager
  let positionManager: Contract
  if (networkNameToPositionManager(networkName) === undefined) {
    positionManager = await ethers.getContract("NonfungiblePositionManager", deployer);
  } else {
    positionManager = await ethers.getContractAt('INonfungiblePositionManager', networkNameToPositionManager(networkName))
  }

  return { positionManager, swapRouter, uniswapFactory }
}