import BigNumber from 'bignumber.js'
import { useEffect, useState } from 'react'
import { Contract } from 'web3-eth-contract'

import shortAbi from '../../abis/shortHelper.json'
import { Vaults } from '../../constants'
import { useWallet } from '../../context/wallet'
import { fromTokenAmount } from '../../utils/calculations'
import { useAddresses } from '../useAddress'
import { useSqueethPool } from './useSqueethPool'

export const useShortHelper = () => {
  const { web3, address } = useWallet()
  const [contract, setContract] = useState<Contract>()

  const { getSellParam, getBuyParam } = useSqueethPool()
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
  const openShort = async (vaultId: number, amount: BigNumber, vaultType?: Vaults) => {
    if (!contract || !address) return

    const actualAmt = amount.dividedBy(10000)
    const _amount = fromTokenAmount(actualAmt, 18)
    await contract.methods.openShort(vaultId, _amount.toString(), getSellParam(amount)).send({
      from: address,
      value: _amount.multipliedBy(1.5).multipliedBy(10000), // Min collat, Should be changed based on user input type post MVP
    })
  }

  /**
   * Buy back and close vault, withdraw collateral
   * @param vaultId
   * @param amount - Amount of squeeth to buy back
   * @returns
   */
  const closeShort = async (vaultId: number, amount: BigNumber) => {
    if (!contract || !address) return

    const actualAmt = amount.dividedBy(10000)
    const _amount = fromTokenAmount(actualAmt, 18)
    const _exactOutputParams = await getBuyParam(amount)

    _exactOutputParams.recipient = shortHelper

    // _burnSqueethAmount and _withdrawAmount will be same as we are putting 1:1 collat now
    contract.methods.closeShort(vaultId, _amount.toString(), _amount.toString(), _exactOutputParams).send({
      from: address,
      value: _exactOutputParams.amountInMaximum,
    })
  }

  return {
    openShort,
    closeShort,
  }
}

export default useShortHelper
