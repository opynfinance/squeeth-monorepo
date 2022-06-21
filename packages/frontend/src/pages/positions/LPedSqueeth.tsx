import { useVaultData } from '@hooks/useVaultData'
import { Link, Tooltip, Typography } from '@material-ui/core'
import BigNumber from 'bignumber.js'
import { useFirstValidVault } from 'src/state/positions/hooks'
import useStyles from './useStyles'
import InfoIcon from '@material-ui/icons/InfoOutlined'
import { Tooltips } from '../../constants'
import usePositionNPnL from '@hooks/usePositionNPnL'

interface Props {
  vaultExists: boolean
}

export default function LPedSqueeth({ vaultExists }: Props) {
  const classes = useStyles()
  const { validVault: vault, vaultId, isVaultLoading } = useFirstValidVault()
  const { existingCollat, existingLiqPrice, existingCollatPercent } = useVaultData(vault)
  const { lpedoSQTHAmount, lpedPositionValue, loading: isPnLLoading } = usePositionNPnL()

  return (
    <div className={classes.position}>
      <div className={classes.positionTitle}>
        <Typography>LPed Squeeth</Typography>
        <Typography className={classes.link} id="lp-vault-link">
          {vaultExists ? <Link href={`vault/${vaultId}`}>Manage</Link> : null}
        </Typography>
      </div>
      <div className={classes.shortPositionData}>
        <div className={classes.innerPositionData}>
          <div style={{ width: '50%' }}>
            <Typography variant="caption" component="span" color="textSecondary">
              Amount
            </Typography>
            <Typography variant="body1">
              <span id="pos-page-lped-osqth-bal">{lpedoSQTHAmount.toFixed(8)}</span>
              &nbsp; oSQTH
            </Typography>
          </div>

          <div style={{ width: '50%' }}>
            <Typography variant="caption" component="span" color="textSecondary">
              Position Value
            </Typography>
            <Typography variant="body1">${isPnLLoading ? 'Loading' : lpedPositionValue.toFixed(2)}</Typography>
          </div>
        </div>
        {vaultExists ? (
          <div className={classes.innerPositionData} style={{ marginTop: '16px' }}>
            {new BigNumber(existingLiqPrice).isFinite() ? (
              <div style={{ width: '50%' }}>
                <Typography variant="caption" component="span" color="textSecondary">
                  Liquidation Price
                </Typography>
                <Tooltip title={Tooltips.LiquidationPrice}>
                  <InfoIcon fontSize="small" className={classes.infoIcon} />
                </Tooltip>
                <Typography variant="body1">
                  ${isVaultLoading && existingLiqPrice.isEqualTo(0) ? 'Loading' : existingLiqPrice.toFixed(2)}
                </Typography>
              </div>
            ) : null}
            <div style={{ width: '50%' }}>
              <Typography variant="caption" component="span" color="textSecondary">
                Collateral (Amt / Ratio)
              </Typography>
              <Typography variant="body1">
                {isVaultLoading && existingCollat.isEqualTo(0) ? 'Loading' : existingCollat.toFixed(4)} ETH
                {new BigNumber(existingCollatPercent).isFinite() ? ' (' + existingCollatPercent + ' %)' : null}
              </Typography>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
