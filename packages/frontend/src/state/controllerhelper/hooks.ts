import { OSQUEETH_DECIMALS } from '@constants/index'
import { fromTokenAmount } from '@utils/calculations'
import BigNumber from 'bignumber.js'
import { useAtomValue } from 'jotai'
import { useCallback } from 'react'
import { controllerHelperContractAtom } from '../contracts/atoms'
import { normFactorAtom } from '../controller/atoms'
import { useGetSellQuote } from '../squeethPool/hooks'

import { addressAtom } from '../wallet/atoms'
import { useHandleTransaction } from '../wallet/hooks'

export const useFlashSwapAndMint = () => {
  const handleTransaction = useHandleTransaction()
  const contract = useAtomValue(controllerHelperContractAtom)
  const address = useAtomValue(addressAtom)
  const normalizationFactor = useAtomValue(normFactorAtom)
  const getSellQuote = useGetSellQuote()

  /**
   * flashSwapAndMint - Used to create / mint and swap short position with flash swap to reduce collateral sent.
   * @param vaultId - 0 to create new
   * @param ethCollateralDeposit - Total collateral amount to deposit
   * @param squeethAmount - Amount of squeeth to mint
   * @param minToReceive - minimum to receive for swap from squeeth -> eth
   * @returns
   */
  const flashSwapAndMint = useCallback(
    async (
      vaultId: number,
      ethCollateralDeposit: BigNumber,
      squeethAmount: BigNumber,
      minToReceive: BigNumber,
      onTxConfirmed?: () => void,
    ) => {
      if (!contract || !address) return

      const sellQuote = await getSellQuote(squeethAmount)
      const wPowerPerpAmount = fromTokenAmount(squeethAmount, OSQUEETH_DECIMALS).multipliedBy(normalizationFactor)
      const totalCollateralToDeposit = fromTokenAmount(ethCollateralDeposit, 18)
      const _minToReceive = fromTokenAmount(minToReceive, 18)

      const result = await handleTransaction(
        contract.methods
          .flashswapWMint({
            vaultId,
            totalCollateralToDeposit: totalCollateralToDeposit.toString(),
            wPowerPerpAmount: wPowerPerpAmount.toFixed(0),
            minToReceive: _minToReceive.toString(),
          })
          .send({
            from: address,
            value: fromTokenAmount(ethCollateralDeposit.minus(sellQuote.amountOut), 18).toString(),
          }),
        onTxConfirmed,
      )
      return result
    },
    [contract, address],
  )
  return flashSwapAndMint
}
