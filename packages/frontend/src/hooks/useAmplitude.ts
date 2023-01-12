import { Networks } from '../types'
import { trackEvent } from '@utils/amplitude'
import { useAtomValue } from 'jotai'
import { useCallback } from 'react'
import { networkIdAtom } from 'src/state/wallet/atoms'

const useAmplitude = () => {
  const networkId = useAtomValue(networkIdAtom)

  const track = useCallback(
    (eventName: string, eventProps?: Record<string, unknown>) => {
      if (networkId === Networks.MAINNET) {
        return trackEvent(eventName, eventProps)
      }
      console.log(`Analytics: ${eventName}`, JSON.stringify(eventProps))
    },
    [networkId],
  )

  return {
    track,
  }
}

export default useAmplitude
