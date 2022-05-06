import { useVaultData } from '@hooks/useVaultData'
import { Tooltip, Typography } from '@material-ui/core'
import BigNumber from 'bignumber.js'
import Link from 'next/link'
import { useFirstValidVault, useLPPositionsQuery, useMintedDebt } from 'src/state/positions/hooks'
import useStyles from './useStyles'
import InfoIcon from '@material-ui/icons/InfoOutlined'
import { Tooltips } from '../../constants'

interface Props {
  vaultExists: boolean
}

export default function MintedSqueeth({ vaultExists }: Props) {
  const classes = useStyles()
  const { validVault, vaultId, isVaultLoading } = useFirstValidVault()
  const { loading: isPositionLoading } = useLPPositionsQuery()
  const { existingCollat, existingLiqPrice, existingCollatPercent } = useVaultData(validVault)
  const mintedDebt = useMintedDebt()

  return (
    <div className={classes.position}>
      <div className={classes.positionTitle}>
        <Typography>Minted Squeeth</Typography>
        <Typography className={classes.link}>
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
              {isPositionLoading ? 'Loading' : <span id="pos-page-minted-osqth-bal">{mintedDebt.toFixed(8)}</span>}{' '}
              &nbsp; oSQTH
            </Typography>
          </div>
        </div>
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
                $ {isVaultLoading && existingLiqPrice.isEqualTo(0) ? 'Loading' : existingLiqPrice.toFixed(2)}
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
      </div>
    </div>
  )
}
