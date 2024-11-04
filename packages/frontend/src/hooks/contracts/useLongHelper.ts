import BigNumber from 'bignumber.js'
import { useAtomValue } from 'jotai'

import { OSQUEETH_DECIMALS } from '../../constants'
import { fromTokenAmount } from '@utils/calculations'
import { addressAtom } from 'src/state/wallet/atoms'
import { useHandleTransaction } from 'src/state/wallet/hooks'
import { controllerContractAtom } from '../../state/contracts/atoms'

export const useShutdownLongHelper = () => {
  const handleTransaction = useHandleTransaction()
  const address = useAtomValue(addressAtom)
  const contract = useAtomValue(controllerContractAtom)

  /**
   * Redeem vault
   * @param vaultId
   * @returns
   */
  const redeemLongHelper = async (osqthAmount: BigNumber, onTxConfirmed?: () => void) => {
    if (!contract || !address) {
      return
    }

    // redeem vault
    const result = await handleTransaction(
      contract.methods.redeemLong(fromTokenAmount(osqthAmount, OSQUEETH_DECIMALS).toFixed(0)).send({
        from: address,
      }),
      onTxConfirmed,
    )

    return result
  }

  return {
    redeemLongHelper,
  }
}
