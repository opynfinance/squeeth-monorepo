import { SITE_EVENTS } from '@utils/amplitude'
import { useEffect } from 'react'
import useAmplitude from './useAmplitude'

const useTrackSiteReload = () => {
  const { track } = useAmplitude()
  const win: any = typeof window !== 'undefined' ? window : undefined

  useEffect(() => {
    if (win?.performance) {
      if (win?.performance.navigation.type == 1) {
        track(SITE_EVENTS.RELOAD_SITE)
      }
    }
  }, [win, track])
}

export default useTrackSiteReload
