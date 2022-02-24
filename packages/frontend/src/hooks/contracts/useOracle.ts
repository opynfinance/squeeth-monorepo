import BigNumber from 'bignumber.js'
import { useEffect, useState, useCallback } from 'react'
import { Contract } from 'web3-eth-contract'
import { useAtom } from 'jotai'

import abi from '../../abis/oracle.json'
// import { useWallet } from '@context/wallet'
import { toTokenAmount } from '@utils/calculations'
import { useAddresses } from '../useAddress'
import { web3Atom } from 'src/state/wallet/atoms'
import { addressesAtom } from 'src/state/positions/atoms'

export const useOracle = () => {
  // const { web3 } = useWallet()
  const [web3] = useAtom(web3Atom)
  // const { oracle } = useAddresses()
  const [{ oracle }] = useAtom(addressesAtom)
  const [contract, setContract] = useState<Contract>()

  useEffect(() => {
    if (!web3) return
    setContract(new web3.eth.Contract(abi as any, oracle))
  }, [oracle, web3])

  const getTwapSafe = useCallback(
    async (pool: string, base: string, quote: string, period = 300) => {
      if (!contract) return new BigNumber(0)

      const _price = await contract.methods.getTwap(pool, base, quote, period, true).call()
      return toTokenAmount(_price, 18)
    },
    [contract],
  )

  return {
    getTwapSafe,
  }
}
