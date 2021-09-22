import BigNumber from 'bignumber.js'
import { useEffect, useState } from 'react'
import { Contract } from 'web3-eth-contract'

import abi from '../../abis/oracle.json'
import { useWallet } from '../../context/wallet'
import { toTokenAmount } from '../../utils/calculations'
import { useAddresses } from '../useAddress'

export const useOracle = () => {
  const { web3, address } = useWallet()
  const { oracle } = useAddresses()
  const [contract, setContract] = useState<Contract>()

  useEffect(() => {
    if (!web3) return
    setContract(new web3.eth.Contract(abi as any, oracle))
  }, [oracle, web3])

  const getTwapSafe = async (pool: string, base: string, quote: string, period = 300) => {
    if (!contract || !address) return new BigNumber(0)

    const _price = await contract.methods.getTwaPriceSafe(pool, base, quote, period).call()
    return toTokenAmount(_price, 18)
  }

  return {
    getTwapSafe,
  }
}
