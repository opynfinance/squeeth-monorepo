import { useETHPrice } from '@hooks/useETHPrice'
import { createStyles, makeStyles, TextField, Typography } from '@material-ui/core'
import Alert from '@material-ui/lab/Alert'
import { useAtomValue } from 'jotai'
import React, { memo, useState } from 'react'
import { collatRatioAtom, useGetVaultPNLWithRebalance } from 'src/state/ethPriceCharts/atoms'

import { Links, Vaults } from '../../constants'
import { SqueethTab, SqueethTabs } from '../Tabs'
import FundingChart from './FundingChart'
import ShortSqueethPayoff from './ShortSqueethPayoff'

const useStyles = makeStyles((theme) =>
  createStyles({
    navDiv: {
      display: 'flex',
      marginBottom: theme.spacing(2),
      alignItems: 'center',
    },
    chartNav: {
      border: `1px solid ${theme.palette.primary.main}30`,
      [theme.breakpoints.down('sm')]: {
        width: '100%',
      },
    },
    cardDetail: {
      color: theme.palette.text.secondary,
      lineHeight: '1.75rem',
      fontSize: '14px',
      marginTop: theme.spacing(2),
      maxWidth: '800px',
    },
    cardTitle: {
      color: theme.palette.primary.main,
    },
    header: {
      color: theme.palette.primary.main,
    },
    payoffContainer: {
      display: 'grid',
      gap: '2rem',
      overflow: 'auto',
      // maxHeight: '310',
      [theme.breakpoints.up('md')]: {
        gridTemplateColumns: '1fr 1fr',
      },
    },
    shortPayoff: {
      width: '90%',
      margin: '0 auto',
      [theme.breakpoints.up('md')]: {
        width: '100%',
        margin: 0,
      },
    },
    shortDescription: {
      [theme.breakpoints.up('md')]: {
        justifySelf: 'end',
      },
    },
  }),
)

function ShortChart({
  vault,
  longAmount,
  setCustomLong,
}: {
  vault?: Vaults
  longAmount: number
  setCustomLong: Function
  showPercentage: boolean
}) {
  const ethPrice = useETHPrice()
  const collatRatio = useAtomValue(collatRatioAtom)
  const getVaultPNLWithRebalance = useGetVaultPNLWithRebalance()

  const seriesRebalance = getVaultPNLWithRebalance(longAmount)
  const classes = useStyles()
  const [chartType, setChartType] = useState(0)

  return (
    <div>
      <div className={classes.navDiv}>
        <SqueethTabs
          style={{ background: 'transparent' }}
          className={classes.chartNav}
          value={chartType}
          onChange={(evt, val) => setChartType(val)}
          aria-label="Sub nav tabs"
        >
          <SqueethTab label="Payoff" />
          <SqueethTab label="Premium" />
          <SqueethTab label="Risks" />
        </SqueethTabs>
      </div>
      {seriesRebalance && seriesRebalance.length === 0 && (
        <Alert severity="info"> Loading historical data, this could take a while</Alert>
      )}
      {chartType === 0 ? (
        <div className={classes.payoffContainer}>
          <div className={classes.shortPayoff}>
            <ShortSqueethPayoff ethPrice={ethPrice.toNumber()} collatRatio={collatRatio} />
          </div>

          <div className={classes.shortDescription}>
            <Typography className={classes.cardTitle} variant="h6">
              What is short squeeth?
            </Typography>
            <Typography variant="body2" className={classes.cardDetail}>
              Short squeeth (ETH&sup2;) is an ETH collateralized short ETH&sup2; position. Your returns will be a
              combination of being short oSQTH and long ETH collateral. You earn a funding rate for taking on this
              position. You enter the position by putting down collateral, minting, and selling squeeth. You provide ETH
              collateral to mint squeeth, and your collateralization ratio determines your exposure. If you become
              undercollateralized, you could be liquidated.{' '}
              <a className={classes.header} href={Links.GitBook} target="_blank" rel="noreferrer">
                {' '}
                Learn more.{' '}
              </a>
            </Typography>
          </div>
        </div>
      ) : chartType === 1 ? (
        <FundingChart />
      ) : (
        <div>
          {' '}
          <Typography className={classes.cardTitle} variant="h6">
            Risks
          </Typography>
          <Typography variant="body2" className={classes.cardDetail}>
            If you fall below the minimum collateralization threshold (150%), you are at risk of liquidation. This
            position performs best when ETH price does not move much. If ETH price moves considerably, it is likely
            unprofitable.
            <br /> <br />
            Squeeth smart contracts have been audited by Trail of Bits, Akira, and Sherlock. However, smart contracts
            are experimental technology and we encourage caution only risking funds you can afford to lose.
            <a className={classes.header} href={Links.GitBook} target="_blank" rel="noreferrer">
              {' '}
              Learn more.{' '}
            </a>
          </Typography>
        </div>
      )}
      <br />
      {vault === Vaults.Custom && (
        <TextField
          onChange={(event) => setCustomLong(parseFloat(event.target.value))}
          size="small"
          value={longAmount}
          type="number"
          style={{ width: 300 }}
          label="ETH Long"
          variant="outlined"
        />
      )}
    </div>
  )
}

export const MemoizedShortChart = memo(ShortChart)
