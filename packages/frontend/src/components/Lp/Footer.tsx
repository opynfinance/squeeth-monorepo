import React from 'react'
import { Typography, Divider } from '@material-ui/core'
import { makeStyles, createStyles } from '@material-ui/core/styles'
import { useAtomValue } from 'jotai'

import { normFactorAtom, impliedVolAtom, indexAtom, markAtom, osqthRefVolAtom } from '@state/controller/atoms'
import { toTokenAmount } from '@utils/calculations'
import { formatCurrency, formatNumber } from '@utils/formatter'
import { useOSQTHPrice } from '@hooks/useOSQTHPrice'

const useStatStyles = makeStyles({
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  label: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: '14px',
    fontWeight: 500,
    width: 'max-content',
  },
  value: {
    color: 'rgba(255, 255, 255)',
    fontSize: '15px',
    fontWeight: 500,
    width: 'max-content',
  },
})

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => {
  const classes = useStatStyles()

  return (
    <div className={classes.container}>
      <Typography className={classes.label}>{label}</Typography>
      <Typography className={classes.value}>{value}</Typography>
    </div>
  )
}

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
      position: 'fixed',
      left: 0,
      bottom: 0,
      width: '100vw',
      overflowX: 'auto',
      display: 'flex',
      alignItems: 'center',
      gap: '24px',
      padding: '16px 48px',
      borderTop: '1px solid',
      borderColor: theme.palette.background.lightStone,
    },
    divider: {
      height: '32px',
      backgroundColor: theme.palette.background.lightStone,
    },
  }),
)

const Footer: React.FC = () => {
  const index = useAtomValue(indexAtom)
  const mark = useAtomValue(markAtom)
  const impliedVol = useAtomValue(impliedVolAtom)
  const osqthRefVol = useAtomValue(osqthRefVolAtom)
  const osqthPrice = useOSQTHPrice()
  const normFactor = useAtomValue(normFactorAtom)

  const eth2Price = toTokenAmount(index, 18)
  const ethPrice = eth2Price.sqrt()
  const markPrice = toTokenAmount(mark, 18)
  const impliedVolPercent = impliedVol * 100
  const osqthPriceInETH = osqthPrice.div(ethPrice)

  const classes = useStyles()

  return (
    <div className={classes.container}>
      <Stat label="ETH Price" value={formatCurrency(ethPrice.toNumber())} />

      <Divider orientation="vertical" className={classes.divider} />
      <Stat label="ETH&sup2; Price" value={formatCurrency(eth2Price.toNumber())} />

      <Divider orientation="vertical" className={classes.divider} />
      <Stat label="Mark Price" value={formatCurrency(markPrice.toNumber())} />

      <Divider orientation="vertical" className={classes.divider} />
      <Stat label="Implied Volatility" value={`${formatNumber(impliedVolPercent)}%`} />

      <Divider orientation="vertical" className={classes.divider} />
      <Stat label="Reference Volatility" value={`${formatNumber(osqthRefVol)}%`} />

      <Divider orientation="vertical" className={classes.divider} />
      <Stat label="oSQTH Price (USD)" value={formatCurrency(osqthPrice.toNumber())} />

      <Divider orientation="vertical" className={classes.divider} />
      <Stat label="oSQTH Price (ETH)" value={`${formatNumber(osqthPriceInETH.toNumber(), 4)} Ξ`} />

      <Divider orientation="vertical" className={classes.divider} />
      <Stat label="Norm Factor" value={formatNumber(normFactor.toNumber(), 4)} />
    </div>
  )
}

export default Footer
