import { Link, Typography } from '@material-ui/core'
import BigNumber from 'bignumber.js'
import clsx from 'clsx'

import { useVaultData } from '@hooks/useVaultData'
import { useFirstValidVault, useLPPositionsQuery } from '@state/positions/hooks'
import useStyles from './useStyles'
import { formatNumber } from '@utils/formatter'
import Loading from './Loading'

export default function ShortSqueethLiquidated() {
  const classes = useStyles()
  const { validVault, vaultId } = useFirstValidVault()
  const { loading: isPositionLoading } = useLPPositionsQuery()
  const { existingCollat, existingCollatPercent } = useVaultData(validVault)

  return (
    <div className={classes.position}>
      <div className={classes.positionTitle}>
        <Typography className={clsx(classes.red, classes.fontMedium)} variant="body1">
          Short Squeeth - Liquidated
        </Typography>
        <Typography className={classes.link}>
          <Link href={`vault/${vaultId}`}>Manage</Link>
        </Typography>
      </div>
      <div className={classes.shortPositionData}>
        <div className={classes.innerPositionData}>
          <div className={classes.positionColumn}>
            <Typography variant="caption" component="span" color="textSecondary">
              Redeemable Collateral
            </Typography>

            {isPositionLoading && existingCollat.isEqualTo(0) ? (
              <Loading />
            ) : (
              <Typography variant="body1" className={classes.textMonospace}>
                {formatNumber(existingCollat.toNumber(), 4)} ETH
                {new BigNumber(existingCollatPercent).isFinite()
                  ? ' (' + formatNumber(existingCollatPercent) + '%)'
                  : null}
              </Typography>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
