import { OSQUEETH_DECIMALS } from '@constants/index'
import { fromTokenAmount } from '@utils/calculations'
import BigNumber from 'bignumber.js'
import { useAtomValue } from 'jotai'
import { useCallback } from 'react'
import { controllerHelperContractAtom } from '../contracts/atoms'
import { normFactorAtom } from '../controller/atoms'

import { addressAtom } from '../wallet/atoms'
import { useHandleTransaction } from '../wallet/hooks'

export const useFlashSwapAndMint = () => {
  const handleTransaction = useHandleTransaction()
  const contract = useAtomValue(controllerHelperContractAtom)
  const address = useAtomValue(addressAtom)
  const normalizationFactor = useAtomValue(normFactorAtom)

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
      msgValue: BigNumber,
      onTxConfirmed?: () => void,
    ) => {
      if (!contract || !address) return

      const wPowerPerpAmountToMint = fromTokenAmount(squeethAmount, OSQUEETH_DECIMALS)
        .multipliedBy(normalizationFactor)
        .toFixed(0)
      const collateralAmount = fromTokenAmount(ethCollateralDeposit, 18).toFixed(0)
      const _minToReceive = fromTokenAmount(minToReceive, 18).toString()
      const value = fromTokenAmount(msgValue, 18).toFixed(0)

      const result = await handleTransaction(
        contract.methods
          .flashswapSellLongWMint({
            vaultId,
            collateralAmount,
            wPowerPerpAmountToMint,
            minToReceive: _minToReceive,
            wPowerPerpAmountToSell: '0',
          })
          .send({
            from: address,
            value,
          }),
        onTxConfirmed,
      )
      return result
    },
    [contract, address],
  )
  return flashSwapAndMint
}
