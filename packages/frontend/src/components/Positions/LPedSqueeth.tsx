import { Link, Tooltip, Typography } from '@material-ui/core'
import BigNumber from 'bignumber.js'
import InfoIcon from '@material-ui/icons/InfoOutlined'

import { useVaultData } from '@hooks/useVaultData'
import { useFirstValidVault, useLpDebt } from '@state/positions/hooks'
import { Tooltips } from '@constants/index'
import { formatNumber, formatCurrency } from '@utils/formatter'
import useStyles from './useStyles'

const Loading = () => {
  return <Typography variant="body1">loading...</Typography>
}

interface Props {
  vaultExists: boolean
}

export default function LPedSqueeth({ vaultExists }: Props) {
  const classes = useStyles()
  const { validVault: vault, vaultId, isVaultLoading } = useFirstValidVault()
  const lpedSqueeth = useLpDebt()
  const { existingCollat, existingLiqPrice, existingCollatPercent } = useVaultData(vault)

  return (
    <div className={classes.position}>
      <div className={classes.positionTitle}>
        <Typography>LP&apos;ed Squeeth</Typography>
        <Typography className={classes.link} id="lp-vault-link">
          {vaultExists ? <Link href={`vault/${vaultId}`}>Manage</Link> : null}
        </Typography>
      </div>
      <div className={classes.shortPositionData}>
        <div className={classes.innerPositionData}>
          <div className={classes.positionColumn}>
            <Typography variant="caption" component="span" color="textSecondary">
              Amount
            </Typography>
            <Typography variant="body1" className={classes.textMonospace}>
              <span id="pos-page-lped-osqth-bal">{formatNumber(lpedSqueeth.toNumber(), 6)}</span> oSQTH
            </Typography>
          </div>
        </div>
        <div className={classes.innerPositionData} style={{ marginTop: '16px' }}>
          {new BigNumber(existingLiqPrice).isFinite() ? (
            <div className={classes.positionColumn}>
              <div className={classes.titleWithTooltip}>
                <Typography variant="caption" component="span" color="textSecondary">
                  Liquidation Price
                </Typography>
                <Tooltip title={Tooltips.LiquidationPrice}>
                  <InfoIcon fontSize="small" className={classes.infoIcon} />
                </Tooltip>
              </div>

              {isVaultLoading && existingLiqPrice.isEqualTo(0) ? (
                <Loading />
              ) : (
                <Typography variant="body1" className={classes.textMonospace}>
                  {formatCurrency(existingLiqPrice.toNumber())}
                </Typography>
              )}
            </div>
          ) : null}

          <div className={classes.positionColumn}>
            <Typography variant="caption" component="span" color="textSecondary">
              Collateral (Amt / Ratio)
            </Typography>

            {isVaultLoading && existingCollat.isEqualTo(0) ? (
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
