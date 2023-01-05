import { useCallback } from 'react'

import { BULL_EVENTS, CRAB_EVENTS, WALLET_EVENTS } from '@utils/amplitude'
import useAmplitude from './useAmplitude'
import { REVERTED_TRANSACTION_CODE } from '@constants/index'

const useTrackTransactionFlow = () => {
  const { track } = useAmplitude()

  const logAnalytics = useCallback(
    async (fn: () => Promise<any>, eventName: CRAB_EVENTS | BULL_EVENTS | WALLET_EVENTS) => {
      track(`${eventName}_CLICK`)
      try {
        await fn()
        track(`${eventName}_SUCCESS`)
      } catch (e: any) {
        if (e?.code === REVERTED_TRANSACTION_CODE) {
          track(`${eventName}_REVERT`)
        }
        track(`${eventName}_FAILED`, { code: e?.code })
        console.log(e)
      }
    },
    [track],
  )

  return logAnalytics
}

export default useTrackTransactionFlow
