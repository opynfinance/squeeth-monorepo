import BigNumber from 'bignumber.js'
import { useState } from 'react'
import { Contract } from 'web3-eth-contract'
import { useAtomValue } from 'jotai'

import wethAbi from '../../abis/weth.json'
import { fromTokenAmount } from '@utils/calculations'
import { useHandleTransaction } from 'src/state/wallet/hooks'
import { addressAtom, web3Atom } from 'src/state/wallet/atoms'
import { addressesAtom } from 'src/state/positions/atoms'
import useAppEffect from '@hooks/useAppEffect'

/**
 * Hook to interact with WETH contract
 */
export const useWeth = () => {
  const [contract, setContract] = useState<Contract>()

  const web3 = useAtomValue(web3Atom)
  const handleTransaction = useHandleTransaction()
  const address = useAtomValue(addressAtom)
  const { weth } = useAtomValue(addressesAtom)

  useAppEffect(() => {
    if (!web3 || !weth) return
    setContract(new web3.eth.Contract(wethAbi as any, weth))
  }, [web3, weth])

  /**
   *
   * Wrap ETH to WETH
   * @param amount - Amount to wrap
   * @returns
   */
  const wrap = (amount: BigNumber): Promise<any> => {
    if (!contract || !address) return Promise.resolve()

    const _amount = fromTokenAmount(amount, 18)
    return handleTransaction(
      contract.methods.deposit().send({
        from: address,
        value: _amount,
      }),
    )
  }

  // const getAllowance = async (spenderAddress: string) => {
  //   if (!contract || !address) return

  //   const allowance = await contract.methods.allowance(address, spenderAddress).call()
  //   retur(new BigNumber(allowance.toString()), 18)
  // }

  return {
    wrap,
  }
}
