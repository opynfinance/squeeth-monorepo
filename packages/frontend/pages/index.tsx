import React, { useEffect } from 'react'
import Hidden from '@material-ui/core/Hidden'
import DesktopLandingPage from '@components/LandingPage/DesktopLandingPage'
import MobileLandingPage from '@components/LandingPage/MobileLandingPage'
import DefaultSiteSeo from '@components/DefaultSiteSeo/DefaultSiteSeo'
import useAmplitude from '@hooks/useAmplitude'
import { LANDING_EVENTS } from '@utils/amplitude'

function LandingPage() {
  const { track } = useAmplitude()

  useEffect(() => {
    track(LANDING_EVENTS.LANDING_VISIT)
  }, [track])

  return (
    <div>
      <DefaultSiteSeo />
      <Hidden smDown>
        <DesktopLandingPage />
      </Hidden>
      <Hidden mdUp>
        <MobileLandingPage />
      </Hidden>
    </div>
  )
}

export default LandingPage
