import { useAtomValue } from 'jotai'

import { web3Atom } from '../state/wallet/atoms'

import { getContract } from '../utils/getContract'

const useContract = (address: string, abi: any) => {
  const web3 = useAtomValue(web3Atom)
  if (!web3) return null
  return getContract(web3, address, abi)
}
export default useContract
