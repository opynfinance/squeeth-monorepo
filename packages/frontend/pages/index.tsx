import React from 'react'
import Hidden from '@material-ui/core/Hidden'
import DesktopLandingPage from '@components/LandingPage/DesktopLandingPage'
import MobileLandingPage from '@components/LandingPage/MobileLandingPage'

function LandingPage() {
  return (
    <div>
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
