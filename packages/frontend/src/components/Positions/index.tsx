import { Typography } from '@material-ui/core'

import TxHistory from '@components/Positions/TxHistory'
import useStyles from './useStyles'
import YourVaults from './YourVaults'
import LPPositions from './LPPositions'
import Positions from './Positions'
import HeaderBar from './HeaderBar'

export default function PositionsUI() {
  const classes = useStyles()

  return (
    <div className={classes.container}>
      <HeaderBar />

      <div className={classes.sectionHeaderFirst}>
        <Typography variant="h4" className={classes.sectionTitle}>
          Your Positions
        </Typography>
      </div>
      <div className={classes.sectionContent}>
        <Positions />
      </div>

      <div className={classes.sectionHeader}>
        <Typography variant="h4" className={classes.sectionTitle}>
          Your LP Positions
        </Typography>
      </div>
      <div className={classes.sectionContent}>
        <LPPositions />
      </div>

      <div className={classes.sectionHeader}>
        <Typography variant="h4" className={classes.sectionTitle}>
          Your Vaults
        </Typography>
      </div>
      <div className={classes.sectionContent}>
        <YourVaults />
      </div>

      <div className={classes.sectionHeader}>
        <Typography variant="h4" className={classes.sectionTitle}>
          Transaction History
        </Typography>
      </div>
      <div className={classes.sectionContent}>
        <TxHistory />
      </div>
    </div>
  )
}
