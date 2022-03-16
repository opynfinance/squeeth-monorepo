import BigNumber from 'bignumber.js'
import { useCallback, useEffect, useState } from 'react'
import { useAtomValue } from 'jotai'

import abi from '../../abis/erc20.json'
// import { useWallet } from '@context/wallet'
import { toTokenAmount } from '@utils/calculations'
import { useHandleTransaction } from 'src/state/wallet/hooks'
import { addressAtom, web3Atom } from 'src/state/wallet/atoms'

const MAX_UINT = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'

export function useUserAllowance(token: string, spenderAddess: string) {
  // const { web3, address, handleTransaction } = useWallet()
  const handleTransaction = useHandleTransaction()
  const web3 = useAtomValue(web3Atom)
  const address = useAtomValue(addressAtom)

  const [allowance, setAllowance] = useState(new BigNumber(0))
  const [isLoadingAllowance, setIsLoadingAllowance] = useState(true)

  const approve = useCallback(
    async (onTxConfirmed: () => void) => {
      if (!web3 || !address) return

      const erc = new web3.eth.Contract(abi as any, token)
      const approveAmount = MAX_UINT

      if (spenderAddess === '') throw new Error('Unkown Spender')

      await handleTransaction(erc.methods.approve(spenderAddess, approveAmount).send({ from: address }), async () => {
        onTxConfirmed()
        const newAllowance = await erc.methods.allowance(address, spenderAddess).call()
        setAllowance(toTokenAmount(new BigNumber(newAllowance.toString()), 18))
      })
    },
    [web3, token, address, spenderAddess],
  )

  useEffect(() => {
    if (!address || !web3) return
    const erc = new web3.eth.Contract(abi as any, token)
    erc.methods
      .allowance(address, spenderAddess)
      .call()
      .then((allowance: any) => {
        setAllowance(toTokenAmount(new BigNumber(allowance.toString()), 18))
        setIsLoadingAllowance(false)
      })
      .catch(() => {
        setIsLoadingAllowance(false)
      })
  }, [web3, spenderAddess, token, address])

  return { allowance, isLoadingAllowance, approve }
}
