import { useVaultData } from '@hooks/useVaultData'
import { Link, Typography } from '@material-ui/core'
import BigNumber from 'bignumber.js'
import { useFirstValidVault, useLPPositionsQuery } from 'src/state/positions/hooks'
import useStyles from './useStyles'

export default function ShortSqueethLiquidated() {
  const classes = useStyles()
  const { validVault, vaultId } = useFirstValidVault()
  const { loading: isPositionLoading } = useLPPositionsQuery()
  const { existingCollat, existingCollatPercent } = useVaultData(validVault)

  return (
    <div className={classes.position}>
      <div className={classes.positionTitle}>
        <Typography className={classes.red}>Short Squeeth - Liquidated</Typography>
        <Typography className={classes.link}>
          <Link href={`vault/${vaultId}`}>Manage</Link>
        </Typography>
      </div>
      <div className={classes.shortPositionData}>
        <div className={classes.innerPositionData}>
          <div style={{ width: '50%' }}>
            <Typography variant="caption" component="span" color="textSecondary">
              Redeemable Collateral
            </Typography>
            <Typography variant="body1">
              {isPositionLoading && existingCollat.isEqualTo(0) ? 'Loading' : existingCollat.toFixed(4)} ETH
              {new BigNumber(existingCollatPercent).isFinite() ? ' (' + existingCollatPercent + ' %)' : null}
            </Typography>
          </div>
        </div>
      </div>
    </div>
  )
}
