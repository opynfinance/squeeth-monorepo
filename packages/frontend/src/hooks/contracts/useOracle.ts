import BigNumber from 'bignumber.js'
import { useState, useCallback } from 'react'
import { Contract } from 'web3-eth-contract'
import { useAtomValue } from 'jotai'

import abi from '../../abis/oracle.json'
import { toTokenAmount } from '@utils/calculations'
import { web3Atom } from 'src/state/wallet/atoms'
import { addressesAtom } from 'src/state/positions/atoms'
import useAppEffect from '@hooks/useAppEffect'

export const useOracle = () => {
  const web3 = useAtomValue(web3Atom)
  const { oracle } = useAtomValue(addressesAtom)
  const [contract, setContract] = useState<Contract>()

  useAppEffect(() => {
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
