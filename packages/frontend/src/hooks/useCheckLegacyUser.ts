import { useState } from 'react'

import { useUserCrabV2TxHistory } from './useUserCrabV2TxHistory'
import useAppEffect from './useAppEffect'
import { CrabStrategyV2TxType, CrabStrategyTxType } from 'src/types'

// legacy as in users who deposited before ETH deposit was removed
export const useCheckLegacyCrabV2User = (address: string) => {
  const [isLegacyUser, setLegacyUser] = useState(false)

  const { data } = useUserCrabV2TxHistory(address ?? '')

  useAppEffect(() => {
    // launch date of new design, when we removed ETH deposit / withdraw
    const launchDate = new Date('2022-12-28T00:00:00.000Z').getTime() / 1000

    const isLegacy =
      data?.some((tx) => {
        const isDepositTx =
          tx.type === CrabStrategyV2TxType.FLASH_DEPOSIT ||
          tx.type === CrabStrategyV2TxType.DEPOSIT ||
          tx.type === CrabStrategyV2TxType.DEPOSIT_V1 ||
          tx.type === CrabStrategyTxType.DEPOSIT ||
          tx.type === CrabStrategyV2TxType.OTC_DEPOSIT

        return isDepositTx && tx.timestamp < launchDate
      }) ?? false

    setLegacyUser(isLegacy)
  }, [data])

  return isLegacyUser
}
