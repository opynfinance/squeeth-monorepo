import { OSQUEETH_DECIMALS } from '@constants/index'
import { fromTokenAmount } from '@utils/calculations'
import BigNumber from 'bignumber.js'
import { useAtomValue } from 'jotai'
import { controllerHelperContractAtom } from '../contracts/atoms'

import { addressAtom } from '../wallet/atoms'
import { useHandleTransaction } from '../wallet/hooks'
import useAppCallback from '@hooks/useAppCallback'
import { UNI_POOL_FEES } from '../../constants/index'

export const useFlashSwapAndMint = () => {
  const handleTransaction = useHandleTransaction()
  const contract = useAtomValue(controllerHelperContractAtom)
  const address = useAtomValue(addressAtom)

  /**
   * flashSwapAndMint - Used to create / mint and swap short position with flash swap to reduce collateral sent.
   * @param vaultId - 0 to create new
   * @param ethCollateralDeposit - Total collateral amount to deposit
   * @param squeethAmount - Amount of squeeth to mint
   * @param minToReceive - minimum to receive for swap from squeeth -> eth
   * @returns
   */
  const flashSwapAndMint = useAppCallback(
    async (
      vaultId: number,
      ethCollateralDeposit: BigNumber,
      squeethAmount: BigNumber,
      minToReceive: BigNumber,
      msgValue: BigNumber,
      onTxConfirmed?: () => void,
    ) => {
      if (!contract || !address) return

      const wPowerPerpAmountToMint = fromTokenAmount(squeethAmount, OSQUEETH_DECIMALS).toFixed(0)
      const collateralToDeposit = fromTokenAmount(ethCollateralDeposit, 18).toFixed(0)
      const _minToReceive = fromTokenAmount(minToReceive, 18).toFixed(0)
      const value = fromTokenAmount(msgValue, 18).toFixed(0)

      const result = await handleTransaction(
        contract.methods
          .flashswapSellLongWMint({
            vaultId,
            collateralToDeposit,
            wPowerPerpAmountToMint,
            minToReceive: _minToReceive,
            wPowerPerpAmountToSell: '0',
            poolFee: UNI_POOL_FEES,
          })
          .send({
            from: address,
            value,
          }),
        onTxConfirmed,
      )
      return result
    },
    [address, contract, handleTransaction],
  )
  return flashSwapAndMint
}
export const useFlashSwapAndBurn = () => {
  const handleTransaction = useHandleTransaction()
  const contract = useAtomValue(controllerHelperContractAtom)
  const address = useAtomValue(addressAtom)

  /**
   * flashSwapAndBurn - Used for swap and burn with switching from short to long.
   * @param vaultId - 0 to create new
   * @param squeethAmount - Amount of squeeth to burn
   * @param collateralAmount - eth collateral to withdraw
   * @param maxToPay - slippage amount
   * @returns
   */
  const flashSwapAndBurn = useAppCallback(
    async (vaultId, squeethAmount, collateralAmount, maxToPay, msgValue, onTxConfirmed) => {
      if (!contract || !address) return

      const wPowerPerpAmountToBurn = fromTokenAmount(squeethAmount, OSQUEETH_DECIMALS).toFixed(0)
      const collateralToWithdraw = fromTokenAmount(collateralAmount, 18).toFixed(0)
      const _maxToPay = fromTokenAmount(maxToPay, 18).toFixed(0)
      const value = fromTokenAmount(msgValue, 18).toFixed(0)

      const result = await handleTransaction(
        contract.methods
          .flashswapWBurnBuyLong({
            vaultId,
            collateralToWithdraw,
            wPowerPerpAmountToBurn,
            maxToPay: _maxToPay,
            wPowerPerpAmountToBuy: '0',
            poolFee: UNI_POOL_FEES,
          })
          .send({
            from: address,
            value,
          }),
        onTxConfirmed,
      )
      return result
    },
    [address, contract, handleTransaction],
  )
  return flashSwapAndBurn
}
