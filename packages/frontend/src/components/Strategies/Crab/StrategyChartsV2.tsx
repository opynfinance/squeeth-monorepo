import { Typography} from '@material-ui/core'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import React, { memo } from 'react'
import { atom, useAtom, useAtomValue } from 'jotai'
import { SqueethTab, SqueethTabs } from '@components/Tabs'
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
      marginTop: theme.spacing(4),
      marginBottom: theme.spacing(1),
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
          <div style={{ display: 'flex', marginTop: '32px' }}>
              <Typography variant="h5" color="primary" style={{}}>
              Strategy Performance 
              </Typography>
          </div>
          <div className={classes.navDiv}>
            <SqueethTabs
            style={{ background: 'transparent' }}
            className={classes.chartNav}
            value={tradeType}
            onChange={(evt, val) => setTradeType(val)}
            aria-label="Sub nav tabs"
            scrollButtons="auto"
            variant="scrollable"
            >
              <SqueethTab label="PnL" />
              <SqueethTab label="Premium" />
            </SqueethTabs>
          </div>

          {mode === ChartType.PNL ? (
            <CrabStrategyV2PnLChart />
          ) : mode === ChartType.Funding ? (
            <FundingChart />
          ) : null }
          
        </div>
      </>
    )
}

const ChartMemoized = memo(StrategyChartsV2)

export { ChartMemoized as StrategyChartsV2 }

