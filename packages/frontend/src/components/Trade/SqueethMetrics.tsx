import React from 'react'
import { Box, BoxProps, Typography, Tooltip } from '@material-ui/core'
import { makeStyles, createStyles } from '@material-ui/core/styles'
import { useAtomValue } from 'jotai'
import InfoIcon from '@material-ui/icons/InfoOutlined'

import {
  normFactorAtom,
  impliedVolAtom,
  indexAtom,
  markAtom,
  osqthRefVolAtom,
  dailyHistoricalFundingAtom,
  currentImpliedFundingAtom,
} from '@state/controller/atoms'
import { toTokenAmount } from '@utils/calculations'
import { formatCurrency, formatNumber } from '@utils/formatter'
import Metric from '@components/Metric'
import { Tooltips } from '@constants/enums'

const useStyles = makeStyles((theme) =>
  createStyles({
    labelContainer: {
      display: 'flex',
      alignItems: 'center',
      color: 'rgba(255, 255, 255, 0.5)',
    },
    label: {
      fontSize: '15px',
      fontWeight: 500,
      width: 'max-content',
    },
    infoIcon: {
      fontSize: '15px',
      marginLeft: theme.spacing(0.5),
    },
  }),
)

const Label: React.FC<{ label: string; tooltipTitle: string }> = ({ label, tooltipTitle }) => {
  const classes = useStyles()

  return (
    <div className={classes.labelContainer}>
      <Typography className={classes.label}>{label}</Typography>
      <Tooltip title={tooltipTitle}>
        <InfoIcon fontSize="small" className={classes.infoIcon} />
      </Tooltip>
    </div>
  )
}

const SqueethMetrics: React.FC<BoxProps> = (props) => {
  const index = useAtomValue(indexAtom)
  const mark = useAtomValue(markAtom)
  const impliedVol = useAtomValue(impliedVolAtom)
  const osqthRefVol = useAtomValue(osqthRefVolAtom)
  const normFactor = useAtomValue(normFactorAtom)
  const currentImpliedFunding = useAtomValue(currentImpliedFundingAtom)
  const dailyHistoricalFunding = useAtomValue(dailyHistoricalFundingAtom)

  const eth2Price = toTokenAmount(index, 18)
  const ethPrice = eth2Price.sqrt()
  const markPrice = toTokenAmount(mark, 18)
  const impliedVolPercent = impliedVol * 100
  const currentImpliedPremium =
    currentImpliedFunding === 0 ? 'loading' : formatNumber(currentImpliedFunding * 100) + '%'
  const historicalDailyPremium =
    dailyHistoricalFunding.funding === 0 ? 'loading' : formatNumber(dailyHistoricalFunding.funding * 100) + '%'

  return (
    <Box display="flex" alignItems="center" flexWrap="wrap" gridGap="12px" {...props}>
      <Metric
        label={<Label label="ETH Price" tooltipTitle={Tooltips.SpotPrice} />}
        value={formatCurrency(ethPrice.toNumber())}
      />

      <Metric
        label={<Label label="ETH&sup2; Price" tooltipTitle={Tooltips.SpotPrice} />}
        value={formatCurrency(eth2Price.toNumber())}
      />

      <Metric
        label={<Label label="Mark Price" tooltipTitle={Tooltips.Mark} />}
        value={formatCurrency(markPrice.toNumber())}
      />

      <Metric
        label={<Label label="Implied Volatility" tooltipTitle={Tooltips.ImplVol} />}
        value={`${formatNumber(impliedVolPercent)}%`}
      />

      <Metric
        label={<Label label="Reference Volatility" tooltipTitle={Tooltips.osqthRefVol} />}
        value={`${formatNumber(osqthRefVol)}%`}
      />

      <Metric
        label={<Label label="Norm Factor" tooltipTitle={Tooltips.NormFactor} />}
        value={formatNumber(normFactor.toNumber(), 4)}
      />

      <Metric
        label={<Label label="Current Implied Premium" tooltipTitle={Tooltips.CurrentImplFunding} />}
        value={currentImpliedPremium}
      />

      <Metric
        label={
          <Label
            label="Historical Daily Premium"
            tooltipTitle={`Historical daily premium based on the last ${dailyHistoricalFunding.period} hours. Calculated using a ${dailyHistoricalFunding.period} hour TWAP of Mark - Index`}
          />
        }
        value={historicalDailyPremium}
      />
    </Box>
  )
}

export default SqueethMetrics
