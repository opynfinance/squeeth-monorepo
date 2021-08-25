export const networkNameToWeth = (name: string) => {
  switch (name) {
    case 'ropsten': {
      return '0xc778417e063141139fce010982780140aa0cd5ab'
    }
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