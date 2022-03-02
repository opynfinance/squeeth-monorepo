import BigNumber from 'bignumber.js'
import { ethers } from 'ethers'
import { useEffect, useState } from 'react'
import { Contract } from 'web3-eth-contract'

import shortAbi from '../../abis/shortHelper.json'
import { Vaults, WETH_DECIMALS, OSQUEETH_DECIMALS } from '../../constants'
import { useWallet } from '@context/wallet'
import { fromTokenAmount, toTokenAmount } from '@utils/calculations'
import { useAddresses } from '../useAddress'
import { useController } from './useController'
import { useSqueethPool } from './useSqueethPool'

export const useShortHelper = () => {
  const { web3, address, handleTransaction } = useWallet()
  const [contract, setContract] = useState<Contract>()

  const { getSellParam, getBuyParam } = useSqueethPool()
  const { normFactor: normalizationFactor } = useController()
  const { shortHelper } = useAddresses()

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
