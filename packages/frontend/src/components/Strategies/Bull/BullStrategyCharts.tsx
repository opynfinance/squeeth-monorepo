import { createStyles, makeStyles } from '@material-ui/core/styles'
import { Typography, Box } from '@material-ui/core'
import React, { memo } from 'react'
import { atom, useAtom, useAtomValue } from 'jotai'

import BullStrategyPerformanceChart from '@components/Charts/BullStrategyPerformanceChart'

enum ChartType {
  PNL = 'PNL',
  Funding = 'Premium',
}

const chartTradeTypeAtom = atom(0)

const modeAtom = atom<ChartType>((get) => {
  const tradeType = get(chartTradeTypeAtom)

  if (tradeType === 0) return ChartType.PNL
  else if (tradeType === 1) return ChartType.Funding

  return ChartType.PNL
})

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
      maxWidth: '640px',
    },
    navDiv: {
      display: 'flex',
      marginBottom: theme.spacing(2),
      marginTop: theme.spacing(2),
      alignItems: 'center',
    },
    chartNav: {
      border: `1px solid ${theme.palette.primary.main}30`,
    },
    subtitle: {
      fontSize: '20px',
      fontWeight: 700,
      letterSpacing: '-0.01em',
    },
  }),
)

function BullStrategyCharts() {
  const classes = useStyles()
  const [tradeType, setTradeType] = useAtom(chartTradeTypeAtom)
  const mode = useAtomValue(modeAtom)

  return (
    <Box>
      <Typography variant="h4" className={classes.subtitle}>
        Performance
      </Typography>
      <Box marginTop="12px">
        <div className={classes.container}>
          <BullStrategyPerformanceChart />
        </div>
      </Box>
    </Box>
  )
}

const ChartMemoized = memo(BullStrategyCharts)

export default ChartMemoized
