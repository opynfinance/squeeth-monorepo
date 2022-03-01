import BigNumber from 'bignumber.js'
import { useEffect, useState } from 'react'
import { Contract } from 'web3-eth-contract'
import { useAtomValue } from 'jotai'

import shortAbi from '../../abis/shortHelper.json'
import { WETH_DECIMALS, OSQUEETH_DECIMALS } from '../../constants'
// import { useWallet } from '@context/wallet'
import { fromTokenAmount } from '@utils/calculations'
import { addressAtom, web3Atom } from 'src/state/wallet/atoms'
import { useHandleTransaction } from 'src/state/wallet/hooks'
import { addressesAtom } from 'src/state/positions/atoms'
import { useGetBuyParam, useGetSellParam } from 'src/state/squeethPool/hooks'
import { normFactorAtom } from 'src/state/controller/atoms'

export const useShortHelper = () => {
  const web3 = useAtomValue(web3Atom)
  const handleTransaction = useHandleTransaction()
  const address = useAtomValue(addressAtom)
  const [contract, setContract] = useState<Contract>()

  const getSellParam = useGetSellParam()
  const getBuyParam = useGetBuyParam()

  const { shortHelper } = useAtomValue(addressesAtom)
  const normalizationFactor = useAtomValue(normFactorAtom)

  useEffect(() => {
    if (!web3) return
    setContract(new web3.eth.Contract(shortAbi as any, shortHelper))
  }, [web3])

  /**
   * deposit collat, mint squeeth and sell it in uniSwap
   * @param vaultId - 0 to create new
   * @param amount - Amount of squeeth to mint
   * @param vaultType
   * @returns
   */
  const openShort = async (vaultId: number, amount: BigNumber, collatAmount: BigNumber) => {
    if (!contract || !address) return

    const _exactInputParams = await getSellParam(amount)
    _exactInputParams.recipient = shortHelper

    const _amount = fromTokenAmount(amount, OSQUEETH_DECIMALS).multipliedBy(normalizationFactor)
    const ethAmt = fromTokenAmount(collatAmount, 18)
    const txHash = await handleTransaction(
      contract.methods.openShort(vaultId, _amount.toFixed(0), 0, _exactInputParams).send({
        from: address,
        value: ethAmt.toString(), // Already scaled to 14 so multiplied with 10000
      }),
    )

    return txHash
  }

  /**
   * Buy back and close vault, withdraw collateral
   * @param vaultId
   * @param amount - Amount of squeeth to buy back
   * @returns
   */
  const closeShort = async (vaultId: number, amount: BigNumber, withdrawAmt: BigNumber) => {
    if (!contract || !address) return

    const _amount = fromTokenAmount(amount, OSQUEETH_DECIMALS)
    const _withdrawAmt = fromTokenAmount(withdrawAmt.isPositive() ? withdrawAmt : 0, WETH_DECIMALS)
    const _exactOutputParams = await getBuyParam(amount)

    _exactOutputParams.recipient = shortHelper

    // _burnSqueethAmount and _withdrawAmount will be same as we are putting 1:1 collat now
    const txHash = await handleTransaction(
      contract.methods.closeShort(vaultId, _amount.toString(), _withdrawAmt.toFixed(0), _exactOutputParams).send({
        from: address,
        value: _exactOutputParams.amountInMaximum,
      }),
    )

    return txHash
  }

  return {
    openShort,
    closeShort,
  }
}

export default useShortHelper
