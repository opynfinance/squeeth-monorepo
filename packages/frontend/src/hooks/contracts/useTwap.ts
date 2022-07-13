import useAppEffect from '@hooks/useAppEffect'
import { toTokenAmount } from '@utils/calculations'
import BigNumber from 'bignumber.js'
import { useAtomValue } from 'jotai'
import { useState } from 'react'
import { useQuery } from 'react-query'
import { addressesAtom } from 'src/state/positions/atoms'
import { web3Atom } from 'src/state/wallet/atoms'
import { Contract } from 'web3-eth-contract'
import abi from '../../abis/oracle.json'

export default function useTwap(pool: string, base: string, quote: string, period = 300) {
  const web3 = useAtomValue(web3Atom)
  const { oracle } = useAtomValue(addressesAtom)
  const [contract, setContract] = useState<Contract>()

  useAppEffect(() => {
    if (!web3) return
    setContract(new web3.eth.Contract(abi as any, oracle))
  }, [oracle, web3])

  const { data } = useQuery(
    ['twap', pool, base, quote, period],
    async () => {
      if (!contract) return new BigNumber(0)
      const _price = await contract.methods.getTwap(pool, base, quote, period, true).call()
      return toTokenAmount(_price, 18)
    },
    { enabled: !!contract, refetchInterval: 10000 },
  )

  return data ?? new BigNumber(0)
}
