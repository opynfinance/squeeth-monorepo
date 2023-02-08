import InfoIcon from '@material-ui/icons/InfoOutlined'
import { Tooltip, Typography } from '@material-ui/core'
import BigNumber from 'bignumber.js'
import Link from 'next/link'
import clsx from 'clsx'

import { useVaultData } from '@hooks/useVaultData'
import { useFirstValidVault, useLPPositionsQuery, useMintedDebt } from '@state/positions/hooks'
import { Tooltips } from '@constants/index'
import { formatCurrency, formatNumber } from '@utils/formatter'
import useStyles from './useStyles'
import Loading from './Loading'

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
        <Typography variant="body1" className={classes.fontMedium}>
          Minted Squeeth
        </Typography>
        <Typography className={classes.link}>
          {vaultExists ? <Link href={`vault/${vaultId}`}>Manage</Link> : null}
        </Typography>
      </div>
      <div className={classes.shortPositionData}>
        <div className={classes.innerPositionData}>
          <div className={classes.positionColumn}>
            <Typography variant="caption" component="span" color="textSecondary">
              Amount
            </Typography>

            {isPositionLoading ? (
              <Loading />
            ) : (
              <Typography variant="body1" className={classes.textMonospace}>
                <span id="pos-page-minted-osqth-bal" className={classes.textMonospace}>
                  {formatNumber(mintedDebt.toNumber(), 6)}
                </span>{' '}
                oSQTH
              </Typography>
            )}
          </div>
        </div>

        <div className={clsx(classes.innerPositionData, classes.rowMarginTop)}>
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
