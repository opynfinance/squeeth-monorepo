import { createStyles, makeStyles } from '@material-ui/core/styles'
import React, { memo } from 'react'
import { atom, useAtom, useAtomValue } from 'jotai'

import { SqueethTabNew, SqueethTabsNew } from '@components/Tabs'
import FundingChart from '@components/Charts/FundingChart'
import { CrabStrategyV2PnLChart } from '@components/Charts/CrabStrategyV2PnLChart'

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
      padding: theme.spacing(0),
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
  }),
)

function StrategyChartsV2() {
  const classes = useStyles()
  const [tradeType, setTradeType] = useAtom(chartTradeTypeAtom)
  const mode = useAtomValue(modeAtom)

  return (
    <>
      <div className={classes.container}>
        <div className={classes.navDiv}>
          <SqueethTabsNew
            style={{ background: 'transparent' }}
            className={classes.chartNav}
            value={tradeType}
            onChange={(evt, val) => setTradeType(val)}
            aria-label="Sub nav tabs"
            scrollButtons="auto"
            variant="scrollable"
          >
            <SqueethTabNew label="PnL" style={{ width: '140px' }} />
            <SqueethTabNew label="Premium" style={{ width: '140px' }} />
          </SqueethTabsNew>
        </div>

        {mode === ChartType.PNL ? <CrabStrategyV2PnLChart /> : mode === ChartType.Funding ? <FundingChart /> : null}
      </div>
    </>
  )
}

const ChartMemoized = memo(StrategyChartsV2)

export { ChartMemoized as StrategyChartsV2 }
