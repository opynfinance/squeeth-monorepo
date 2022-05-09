import { Tooltip, Typography } from '@material-ui/core'
import BigNumber from 'bignumber.js'
import { useAtomValue } from 'jotai'
import { useEffect } from 'react'
import { useCalculateCurrentValue, useSetStrategyData } from 'src/state/crab/hooks'
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
}

const CrabPosition: React.FC<CrabPositionType> = ({
  depositedEth,
  depositedUsd,
  loading,
  pnlWMidPriceInPerct,
  pnlWMidPriceInUSD,
  currentCrabPositionValue,
  currentCrabPositionValueInETH,
}) => {
  const classes = useStyles()

  const getPnlClassName = () => {
    if (loading) {
      return ''
    }

    return currentCrabPositionValue.gte(0) ? classes.green : classes.red
  }

  const collatRatio = useAtomValue(crabStrategyCollatRatioAtom)
  const setStrategyData = useSetStrategyData()
  const calculateCurrentValue = useCalculateCurrentValue()

  useEffect(() => {
    setStrategyData()
  }, [collatRatio, setStrategyData])

  useEffect(() => {
    calculateCurrentValue()
  }, [calculateCurrentValue])

  return (
    <div className={classes.position} id="pos-page-crab">
      <div className={classes.positionTitle}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Typography>🦀</Typography>
          <Typography style={{ marginLeft: '8px' }}>Crab strategy</Typography>
        </div>
      </div>
      <div className={classes.shortPositionData}>
        <div className={classes.innerPositionData}>
          <div style={{ width: '50%' }}>
            <Typography variant="caption" component="span" color="textSecondary">
              Deposited Amount
            </Typography>
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
            <Typography variant="body1" className={getPnlClassName()} id="pos-page-crab-pnl-amount">
              {!loading ? '$' + `${pnlWMidPriceInUSD.toFixed(2)}` : 'Loading'}
            </Typography>
            <Typography variant="caption" className={getPnlClassName()}>
              {!loading ? `${pnlWMidPriceInPerct.toFixed(2)}` + '%' : 'Loading'}
            </Typography>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CrabPosition
