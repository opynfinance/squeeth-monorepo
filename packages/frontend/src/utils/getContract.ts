import Web3 from 'web3'

export const getContract = (web3: Web3, contractAddress: string, abi: any) => {
  return new web3.eth.Contract(abi as any, contractAddress)
}
