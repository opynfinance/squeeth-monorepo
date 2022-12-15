import { Contract } from "ethers"
import fs from 'fs'

export const networkNameToUniRouter = (name: string) => {
  switch (name) {
    case 'mainnet': return '0xE592427A0AEce92De3Edee1F18E0157C05861564'
    case 'rinkebyArbitrum': return '0xE592427A0AEce92De3Edee1F18E0157C05861564'
    case 'goerli': return '0x833A158dA5ceBc44901211427E9Df936023EC0d3'
    default: return undefined
  }
}

export const networkNameToUniFactory = (name: string) => {
  switch (name) {
    case 'mainnet': return '0x1F98431c8aD98523631AE4a59f267346ea31F984'
    case 'rinkebyArbitrum': return '0x1F98431c8aD98523631AE4a59f267346ea31F984'
    case 'goerli': return '0x55C0ceF3cc64F511C34b18c720bCf38feC6C6fFa'
    default: return undefined
  }
}

// quoter is different from uniswap's official deployment! cause it's QuoterV2
export const networkNameToUniQuoter = (name: string) => {
  switch (name) {
    case 'mainnet': return '0xC8d3a4e6BB4952E3658CCA5081c358e6935Efa43'
    case 'rinkebyArbitrum': return undefined
    case 'goerli': return '0x759442726c06F7938cd2cB63aC9Ae373Dc1dEcf6'
    default: return undefined
  }
}

export const networkNameToPositionManager = (name: string) => {
  switch (name) {
    case 'mainnet': return '0xC36442b4a4522E871399CD717aBDD847Ab11FE88'
    case 'rinkebyArbitrum': return '0xC36442b4a4522E871399CD717aBDD847Ab11FE88'
    case 'goerli': return '0x24a66308bab3BEbC2821480adA395BF1C4ff8Bf2'
    default: return undefined
  }
}

export const networkNameToUSDC = (name: string) => {
  switch (name) {
    case 'mainnet': return '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
    case 'ropsten': return '0x27415c30d8c87437becbd4f98474f26e712047f4'
    case 'goerli': return '0x306bf03b689f7d7e5e9D3aAC87a068F16AFF9482'
    default: return undefined
  }
}


export const networkNameToWeth = (name: string) => {
  switch (name) {
    case 'mainnet': return '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'
    case 'ropsten': return '0xc778417e063141139fce010982780140aa0cd5ab'
    case 'rinkebyArbitrum': return '0xB47e6A5f8b33b3F17603C83a0535A9dcD7E32681'
    case 'goerli': return '0x083fd3D47eC8DC56b572321bc4dA8b26f7E82103'
    default: return undefined
  }
}

export const networkNameToController = (name: string) => {
  switch (name) {
    case 'mainnet': return '0x64187ae08781B09368e6253F9E94951243A493D5'
    case 'ropsten': return '0x59F0c781a6eC387F09C40FAA22b7477a2950d209'
    case 'goerli': return '0x6FC3f76f8a2D256Cc091bD58baB8c2Bc3F51d508'
    default: return undefined
  }
}

export const networkNameToExec = (name: string) => {
  switch (name) {
    case 'mainnet': return '0x59828FdF7ee634AaaD3f58B19fDBa3b03E2D9d80'
    case 'ropsten': return '0xF7B8611008Ed073Ef348FE130671688BBb20409d'
    case 'goerli': return '0x4b62EB6797526491eEf6eF36D3B9960E5d66C394'
    default: return undefined
  }
}

export const networkNameToEuler = (name: string) => {
  switch (name) {
    case 'mainnet': return '0x27182842E098f60e3D576794A5bFFb0777E025d3'
    case 'ropsten': return '0xfC3DD73e918b931be7DEfd0cc616508391bcc001'
    case 'goerli': return '0x931172BB95549d0f29e10ae2D079ABA3C63318B3'
    default: return undefined
  }
}

export const networkNameToDweth = (name: string) => {
  switch (name) {
    case 'mainnet': return '0x62e28f054efc24b26A794F5C1249B6349454352C'
    case 'ropsten': return '0x682b4c36a6D4749Ced8C3abF47AefDFC57A17754'
    case 'goerli': return '0x356079240635B276A63065478471d89340443C49'
    default: return undefined
  }
}

export const networkNameToCrab = (name: string) => {
  switch (name) {
    case 'mainnet': return '0xf205ad80BB86ac92247638914265887A8BAa437D'
    case 'ropsten': return '0xbffBD99cFD9d77c49595dFe8eB531715906ca4Cf'
    case 'goerli': return '0x9a23a941F5e70F6960a0E39B8a3964ef83DCbe91'
    default: return undefined
  }
}

export const getWETH = async (ethers: any, deployer: string, networkName: string) => {
  const wethAddr = networkNameToWeth(networkName)
  if (wethAddr === undefined) {
    // get from deployed network
    return ethers.getContract("WETH9", deployer);
  }
  // get contract instance at address
  return ethers.getContractAt('WETH9', wethAddr)
}

export const getUSDC = async (ethers: any, deployer: string, networkName: string) => {
  const usdcAddress = networkNameToUSDC(networkName)
  if (usdcAddress === undefined) {
    // use to local deployment as USDC
    return ethers.getContract("MockErc20", deployer);
  }
  // get contract instance at address
  return ethers.getContractAt('MockErc20', usdcAddress)
}

export const getController = async (ethers: any, deployer: string, networkName: string) => {
  const controllerAddr = networkNameToController(networkName)
  if (controllerAddr === undefined) {
    // get from deployed network
    return ethers.getContract("Controller", deployer);
  }
  // get contract instance at address
  return ethers.getContractAt('Controller', controllerAddr)
}

export const getExec = async (deployer: string, networkName: string) => {
  const execAddr = networkNameToExec(networkName)
  if (execAddr === undefined) {
    return ''
  }
  // get contract instance at address
  return execAddr;
}

export const getEuler = async (deployer: string, networkName: string) => {
  const eulerAddr = networkNameToEuler(networkName)
  if (eulerAddr === undefined) {
    return ''
  }
  // get contract instance at address
  return eulerAddr
}

export const getDwethToken = async (deployer: string, networkName: string) => {
  const dWethAddr = networkNameToDweth(networkName)
  if (dWethAddr === undefined) {
    return ''
  }
  // get contract instance at address
  return dWethAddr
}

export const getCrab = (networkName: string) => {
  const crabAddress = networkNameToCrab(networkName)
  if (crabAddress === undefined) {
    return ''
  }
  // get contract instance at address
  return crabAddress
}

/**
 * 
 * @param networkName 
 */
export const hasUniswapDeployments = (networkName: string) => {
  if (networkName === 'mainnet') return true
  if (networkName === 'rinkebyArbitrum') return true
  if (networkName === 'ropsten') return true
  if (networkName === 'goerli') return true   // our own uni deployment on goerli with OpynWETH9
  return false
}

export const getUniswapDeployments = async (ethers: any, deployer: string, networkName: string) => {
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

export const createArgumentFile = (contract: string, network: string, args: Array<any>) => {
  const path = `./arguments/${contract}-${network}.js`
  const content = `module.exports = [${args.map(a => `"${a}"`).join(',')}]`

  fs.writeFileSync(path, content);
}