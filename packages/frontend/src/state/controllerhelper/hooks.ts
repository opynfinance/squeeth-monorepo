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
    async (vaultId: number, ethCollateralDeposit: BigNumber, squeethAmount: BigNumber, minToReceive: number) => {
      if (!contract || !address) return

      console.log('got here', {
        vaultId,
        minToReceive,
        ethCollateralDeposit: ethCollateralDeposit.toString(),
        squeethAmount: squeethAmount.toString(),
      })

      const wPowerPerpAmount = fromTokenAmount(squeethAmount, OSQUEETH_DECIMALS).multipliedBy(normalizationFactor)
      const totalCollateralToDeposit = fromTokenAmount(ethCollateralDeposit, 18)

      const result = await handleTransaction(
        contract.methods.flashswapWMint(vaultId, totalCollateralToDeposit, wPowerPerpAmount, minToReceive).send({
          from: address,
          value: totalCollateralToDeposit,
        }),
      )
      return result
    },
    [contract, address],
  )
  return flashSwapAndMint
}
