import BigNumber from 'bignumber.js'
import { useEffect, useState } from 'react'
import { Contract } from 'web3-eth-contract'

import wethAbi from '../../abis/weth.json'
import { fromTokenAmount, toTokenAmount } from '@utils/calculations'
import { useAddresses } from '../useAddress'
import { useAddress, useHandleTransaction } from 'src/state/wallet/hooks'
import useAppSelector from '@hooks/useAppSelector'

/**
 * Hook to interact with WETH contract
 */
export const useWeth = () => {
  const [contract, setContract] = useState<Contract>()

  const { address } = useAddress()
  const web3 = useAppSelector(({ wallet }) => wallet.web3)
  const handleTransaction = useHandleTransaction()

  const { weth } = useAddresses()

  useEffect(() => {
    if (!web3 || !weth) return
    setContract(new web3.eth.Contract(wethAbi as any, weth))
  }, [web3])

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

  const getAllowance = async (spenderAddress: string) => {
    if (!contract || !address) return

    const allowance = await contract.methods.allowance(address, spenderAddress).call()
    return toTokenAmount(new BigNumber(allowance.toString()), 18)
  }

  return {
    wrap,
  }
}
