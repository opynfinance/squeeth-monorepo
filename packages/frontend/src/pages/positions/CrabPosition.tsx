import { Tooltip, Typography } from '@material-ui/core'
import BigNumber from 'bignumber.js'
import { useAtomValue } from 'jotai'
import { useEffect } from 'react'
import { useCurrentCrabPositionValue, useCurrentCrabPositionValueV2, useSetStrategyData } from 'src/state/crab/hooks'
import InfoIcon from '@material-ui/icons/InfoOutlined'
import { crabStrategyCollatRatioAtom } from 'src/state/crab/atoms'
import useStyles from './useStyles'
import { Tooltips } from '../../constants'

type CrabPositionType = {
  depositedEth: BigNumber
  depositedUsd: BigNumber
  loading: boolean
  pnlWMidPriceInUSD: BigNumber
  pnlWMidPriceInPerct: BigNumber
  currentCrabPositionValue: BigNumber
  currentCrabPositionValueInETH: BigNumber
  version: String
}

const CrabPosition: React.FC<CrabPositionType> = ({
  depositedEth,
  depositedUsd,
  loading,
  pnlWMidPriceInPerct,
  pnlWMidPriceInUSD,
  currentCrabPositionValue,
  currentCrabPositionValueInETH,
  version,
}) => {
  const classes = useStyles()
  const collatRatio = useAtomValue(crabStrategyCollatRatioAtom)
  const setStrategyData = useSetStrategyData()
  useCurrentCrabPositionValue()
  useCurrentCrabPositionValueV2()

  useEffect(() => {
    setStrategyData()
  }, [collatRatio, setStrategyData])

  return (
    <div className={classes.position} id="pos-page-crab">
      <div className={classes.positionTitle}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Typography>🦀</Typography>
          <Typography style={{ marginLeft: '8px' }}>{version}</Typography>
        </div>
      </div>
      <div className={classes.shortPositionData}>
        <div className={classes.innerPositionData}>
          <div style={{ width: '50%' }}>
            <Typography variant="caption" component="span" color="textSecondary">
              Deposited Amount
            </Typography>
            <Tooltip title={Tooltips.CrabMigratedDeposit}>
              <InfoIcon fontSize="small" className={classes.infoIcon} />
            </Tooltip>
            <Typography variant="body1">$ {depositedUsd.toFixed(2)}</Typography>
            <Typography variant="body2" color="textSecondary">
              <span id="pos-page-crab-deposited-amount">{depositedEth.toFixed(6)}</span>
              &nbsp; ETH
            </Typography>
          </div>
          <div style={{ width: '50%' }}>
            <Typography variant="caption" component="span" color="textSecondary">
              Current Position
            </Typography>
            <Typography variant="body1">{!loading ? `$ ${currentCrabPositionValue.toFixed(2)}` : 'Loading'}</Typography>
            <Typography variant="body2" color="textSecondary">
              {!loading ? `${currentCrabPositionValueInETH.toFixed(6)}  ETH` : 'Loading'}
            </Typography>
          </div>
        </div>
        <div className={classes.innerPositionData} style={{ marginTop: '16px' }}>
          <div style={{ width: '50%' }}>
            <Typography variant="caption" component="span" color="textSecondary">
              Unrealized P&L
            </Typography>
            <Tooltip title={Tooltips.CrabPnL}>
              <InfoIcon fontSize="small" className={classes.infoIcon} />
            </Tooltip>
            <Typography
              variant="body1"
              className={pnlWMidPriceInUSD.isLessThan(0) ? classes.red : classes.green}
              id="pos-page-crab-pnl-amount"
            >
              {!loading ? '$' + `${pnlWMidPriceInUSD.toFixed(2)}` : 'Loading'}
            </Typography>
            <Typography variant="caption" className={pnlWMidPriceInPerct.isLessThan(0) ? classes.red : classes.green}>
              {!loading ? `${pnlWMidPriceInPerct.toFixed(2)}` + '%' : 'Loading'}
            </Typography>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CrabPosition
