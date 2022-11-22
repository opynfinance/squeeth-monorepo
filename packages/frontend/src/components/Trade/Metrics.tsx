import React from 'react'
import { Typography, Box, BoxProps } from '@material-ui/core'
import { makeStyles, createStyles } from '@material-ui/core/styles'
import { useAtomValue } from 'jotai'

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
import { useOSQTHPrice } from '@hooks/useOSQTHPrice'

const useMetricStyles = makeStyles((theme) =>
  createStyles({
    container: {
      padding: '20px 24px',
      backgroundColor: theme.palette.background.stone,
      borderRadius: '12px',
    },
    label: {
      color: 'rgba(255, 255, 255, 0.5)',
      fontSize: '15px',
      fontWeight: 500,
      width: 'max-content',
    },
    value: {
      color: 'rgba(255, 255, 255)',
      fontSize: '18px',
      fontWeight: 500,
      width: 'max-content',
      fontFamily: 'DM Mono',
    },
  }),
)

const Metric: React.FC<{ label: string; value: string }> = ({ label, value }) => {
  const classes = useMetricStyles()

  return (
    <Box className={classes.container}>
      <Typography className={classes.label}>{label}</Typography>
      <Typography className={classes.value}>{value}</Typography>
    </Box>
  )
}

const Metrics: React.FC<BoxProps> = (props) => {
  const index = useAtomValue(indexAtom)
  const mark = useAtomValue(markAtom)
  const impliedVol = useAtomValue(impliedVolAtom)
  const osqthRefVol = useAtomValue(osqthRefVolAtom)
  const osqthPrice = useOSQTHPrice()
  const normFactor = useAtomValue(normFactorAtom)
  const currentImpliedFunding = useAtomValue(currentImpliedFundingAtom)
  const dailyHistoricalFunding = useAtomValue(dailyHistoricalFundingAtom)

  const eth2Price = toTokenAmount(index, 18)
  const ethPrice = eth2Price.sqrt()
  const markPrice = toTokenAmount(mark, 18)
  const impliedVolPercent = impliedVol * 100
  const osqthPriceInETH = osqthPrice.div(ethPrice)
  const currentImpliedPremium =
    currentImpliedFunding === 0 ? 'loading' : formatNumber(currentImpliedFunding * 100) + '%'
  const historicalDailyPremium =
    dailyHistoricalFunding.funding === 0 ? 'loading' : formatNumber(dailyHistoricalFunding.funding * 100) + '%'

  return (
    <Box display="flex" alignItems="center" flexWrap="wrap" gridGap="12px" {...props}>
      <Metric label="ETH Price" value={formatCurrency(ethPrice.toNumber())} />

      <Metric label="Current Implied Premium" value={currentImpliedPremium} />

      <Metric label="Historical Daily Premium" value={historicalDailyPremium} />

      <Metric label="ETH&sup2; Price" value={formatCurrency(eth2Price.toNumber())} />

      <Metric label="Mark Price" value={formatCurrency(markPrice.toNumber())} />

      <Metric label="Implied Volatility" value={`${formatNumber(impliedVolPercent)}%`} />

      <Metric label="Reference Vol." value={`${formatNumber(osqthRefVol)}%`} />

      <Metric label="oSQTH Price (ETH)" value={`${formatNumber(osqthPriceInETH.toNumber(), 4)} Ξ`} />

      <Metric label="oSQTH Price (USD)" value={formatCurrency(osqthPrice.toNumber())} />

      <Metric label="Norm Factor" value={formatNumber(normFactor.toNumber(), 4)} />
    </Box>
  )
}

export default Metrics
