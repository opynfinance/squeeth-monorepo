import BigNumber from 'bignumber.js'
import React, { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { Typography, Tab, Tabs, Box } from '@material-ui/core'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import { useAtomValue } from 'jotai'

import Nav from '@components/Nav'
import CapDetails from '@components/Strategies/Crab/CapDetails'
import CapDetailsV2 from '@components/Strategies/Crab/CapDetailsV2'
import CrabStrategyV2History from '@components/Strategies/Crab/StrategyHistoryV2'
import StrategyInfo from '@components/Strategies/Crab/StrategyInfoV2'
import CrabTrade from '@components/Strategies/Crab/CrabTrade'
import CrabTradeV2 from '@components/Strategies/Crab/CrabTradeV2'
import { StrategyChartsV2 } from '@components/Strategies/Crab/StrategyChartsV2'
import Metric, { MetricLabel } from '@components/Metric'
import CrabPositionV2 from '@components/Strategies/Crab/CrabPositionV2'
import {
  crabStrategyCollatRatioAtom,
  crabStrategyCollatRatioAtomV2,
  crabStrategyVaultAtom,
  crabStrategyVaultAtomV2,
  ethPriceAtLastHedgeAtomV2,
  maxCapAtom,
  maxCapAtomV2,
  timeAtLastHedgeAtom,
  timeAtLastHedgeAtomV2,
} from '@state/crab/atoms'
import {
  useCurrentCrabPositionValueV2,
  useSetProfitableMovePercentV2,
  useSetStrategyData,
  useSetStrategyDataV2,
  useCurrentCrabPositionValue,
} from '@state/crab/hooks'
import { currentImpliedFundingAtom, dailyHistoricalFundingAtom, indexAtom } from '@state/controller/atoms'
import { useInitCrabMigration } from '@state/crabMigration/hooks'
import { formatNumber, formatCurrency } from '@utils/formatter'
import { toTokenAmount } from '@utils/calculations'
import { Tooltips } from '@constants/enums'
import { Vaults } from '@constants/enums'
import bull from 'public/images/bull.gif'
import bear from 'public/images/bear.gif'

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
      maxWidth: '1280px',
      width: '80%',
      margin: '0 auto',
      padding: theme.spacing(1, 5),
      [theme.breakpoints.down('lg')]: {
        maxWidth: 'none',
        width: '90%',
      },
      [theme.breakpoints.down('md')]: {
        width: '100%',
      },
      [theme.breakpoints.down('sm')]: {
        padding: theme.spacing(1, 4),
      },
      [theme.breakpoints.down('xs')]: {
        padding: theme.spacing(1, 3),
      },
    },
    columnContainer: {
      marginTop: '32px',
      display: 'flex',
      justifyContent: 'center',
      gridGap: '96px',
      flexWrap: 'wrap',
      [theme.breakpoints.down('md')]: {
        gridGap: '40px',
      },
    },
    leftColumn: {
      flex: 1,
      minWidth: '480px',
      [theme.breakpoints.down('xs')]: {
        minWidth: '320px',
      },
    },
    rightColumn: {
      flexBasis: '440px',
      [theme.breakpoints.down('xs')]: {
        flex: '1',
      },
    },
    subtitle: {
      fontSize: '20px',
      fontWeight: 700,
      letterSpacing: '-0.01em',
    },
    comingSoon: {
      height: '50vh',
      display: 'flex',
      alignItems: 'center',
      marginTop: theme.spacing(4),
    },
    tradeSection: {
      position: 'sticky',
      top: '100px',
      border: '1px solid #242728',
      boxShadow: '0px 4px 40px rgba(0, 0, 0, 0.25)',
      borderRadius: theme.spacing(0.7),
      padding: '32px 24px',
    },
  }),
)

const Strategies: React.FC = () => {
  const [selectedIdx, setSelectedIdx] = useState(1)

  // which crab strategy to display. V1 or V2.
  const [displayCrabV1] = useState(false)

  const classes = useStyles()
  const maxCap = useAtomValue(displayCrabV1 ? maxCapAtom : maxCapAtomV2)
  const vault = useAtomValue(displayCrabV1 ? crabStrategyVaultAtom : crabStrategyVaultAtomV2)
  const collatRatio = useAtomValue(displayCrabV1 ? crabStrategyCollatRatioAtom : crabStrategyCollatRatioAtomV2)
  const timeAtLastHedge = useAtomValue(displayCrabV1 ? timeAtLastHedgeAtom : timeAtLastHedgeAtomV2)
  const profitableMovePercentV2 = useSetProfitableMovePercentV2()
  const setStrategyData = useSetStrategyData()
  const setStrategyDataV2 = useSetStrategyDataV2()
  const ethPriceAtLastHedge = useAtomValue(ethPriceAtLastHedgeAtomV2)

  useCurrentCrabPositionValueV2()
  useCurrentCrabPositionValue()
  useInitCrabMigration()

  const index = useAtomValue(indexAtom)
  const dailyHistoricalFunding = useAtomValue(dailyHistoricalFundingAtom)
  const currentImpliedFunding = useAtomValue(currentImpliedFundingAtom)

  const CapDetailsComponent = displayCrabV1 ? CapDetails : CapDetailsV2
  const CrabTradeComponent = displayCrabV1 ? CrabTrade : CrabTradeV2

  const ethPrice = Number(toTokenAmount(ethPriceAtLastHedge, 18))

  const lowerPriceBandForProfitability = ethPrice - profitableMovePercentV2 * ethPrice
  const upperPriceBandForProfitability = ethPrice + profitableMovePercentV2 * ethPrice

  useEffect(() => {
    if (displayCrabV1) setStrategyData()
  }, [collatRatio, displayCrabV1, setStrategyData])

  useEffect(() => {
    if (!displayCrabV1) setStrategyDataV2()
  }, [collatRatio, displayCrabV1, setStrategyDataV2])

  useMemo(() => {
    if (selectedIdx === 0) return Vaults.ETHBear
    if (selectedIdx === 1) return Vaults.CrabVault
    if (selectedIdx === 2) return Vaults.ETHBull
    else return Vaults.Custom
  }, [selectedIdx])

  return (
    <div>
      <div id="rain"></div>
      <Nav />
      <div className={classes.container}>
        <Tabs
          variant="fullWidth"
          value={selectedIdx}
          indicatorColor="primary"
          textColor="primary"
          onChange={(event, value) => {
            setSelectedIdx(value)
          }}
          aria-label="disabled tabs example"
        >
          <Tab style={{ textTransform: 'none' }} label={Vaults.ETHBear} icon={<div>🐻</div>} />
          <Tab style={{ textTransform: 'none' }} label={Vaults.CrabVault} icon={<div>🦀</div>} />
          <Tab style={{ textTransform: 'none' }} label={Vaults.ETHBull} icon={<div>🐂</div>} />
        </Tabs>
        {selectedIdx === 2 ? ( //bull vault
          <div className={classes.comingSoon}>
            <Image src={bull} alt="squeeth token" width={200} height={130} />
            <Typography variant="h6" style={{ marginLeft: '8px' }} color="primary">
              Coming soon
            </Typography>
          </div>
        ) : selectedIdx === 0 ? ( //bear vault
          <div className={classes.comingSoon}>
            <Image src={bear} alt="squeeth token" width={200} height={130} />
            <Typography variant="h6" style={{ marginLeft: '8px' }} color="primary">
              Coming soon
            </Typography>
          </div>
        ) : (
          <div>
            <Box marginTop="40px">
              <CrabPositionV2 />
            </Box>

            <div className={classes.columnContainer}>
              <div className={classes.leftColumn}>
                <Box>
                  <Typography variant="h4" className={classes.subtitle}>
                    Strategy Details
                  </Typography>

                  <Box marginTop="12px">
                    <CapDetailsComponent
                      maxCap={maxCap}
                      depositedAmount={vault?.collateralAmount || new BigNumber(0)}
                    />
                  </Box>
                </Box>

                <Box display="flex" alignItems="center" flexWrap="wrap" gridGap="12px" marginTop="32px">
                  <Metric
                    flexBasis="250px"
                    label={<MetricLabel label="ETH Price" tooltipTitle={Tooltips.SpotPrice} />}
                    value={formatCurrency(toTokenAmount(index, 18).sqrt().toNumber())}
                  />
                  <Metric
                    flexBasis="250px"
                    label={
                      <MetricLabel
                        label="Current Implied Premium"
                        tooltipTitle={`${Tooltips.StrategyEarnFunding}. ${Tooltips.CurrentImplFunding}`}
                      />
                    }
                    value={formatNumber(currentImpliedFunding * 100) + '%'}
                  />
                  <Metric
                    flexBasis="250px"
                    label={
                      <MetricLabel
                        label="Historical Daily Premium"
                        tooltipTitle={`${
                          Tooltips.StrategyEarnFunding
                        }. ${`Historical daily premium based on the last ${dailyHistoricalFunding.period} hours. Calculated using a ${dailyHistoricalFunding.period} hour TWAP of Mark - Index`}`}
                      />
                    }
                    value={formatNumber(dailyHistoricalFunding.funding * 100) + '%'}
                  />
                  <Metric
                    flexBasis="250px"
                    label={
                      <MetricLabel
                        label="Last hedged at"
                        tooltipTitle={
                          'Last hedged at ' +
                          new Date(timeAtLastHedge * 1000).toLocaleString(undefined, {
                            day: 'numeric',
                            month: 'long',
                            hour: 'numeric',
                            minute: 'numeric',
                            timeZoneName: 'long',
                          }) +
                          '. Hedges approximately 3 times a week (on MWF) or every 20% ETH price move'
                        }
                      />
                    }
                    value={new Date(timeAtLastHedge * 1000).toLocaleString(undefined, {
                      day: 'numeric',
                      month: 'numeric',
                      hour: 'numeric',
                      minute: 'numeric',
                    })}
                  />
                  <Metric
                    flexBasis="250px"
                    label={
                      <MetricLabel
                        label={`Approx Profitable (${formatNumber(profitableMovePercentV2 * 100)}%)`}
                        tooltipTitle={Tooltips.StrategyProfitThreshold}
                      />
                    }
                    value={
                      formatCurrency(lowerPriceBandForProfitability) +
                      ' - ' +
                      formatCurrency(upperPriceBandForProfitability)
                    }
                  />
                  <Metric
                    flexBasis="250px"
                    label={<MetricLabel label="Collateralization Ratio" tooltipTitle={Tooltips.StrategyCollRatio} />}
                    value={formatNumber(collatRatio === Infinity ? 0 : collatRatio) + '%'}
                  />
                </Box>

                <Box marginTop="32px">
                  <Typography variant="h4" className={classes.subtitle}>
                    Crab PnL
                  </Typography>

                  <Box marginTop="12px">
                    <StrategyChartsV2 />
                  </Box>
                </Box>

                <Box marginTop="32px">
                  <Typography variant="h4" className={classes.subtitle}>
                    Profitability conditions
                  </Typography>
                  <StrategyInfo />
                </Box>

                <Box marginTop="32px">
                  <Typography variant="h4" className={classes.subtitle}>
                    Strategy Hedges
                  </Typography>
                  <Box marginTop="24px">
                    <CrabStrategyV2History />
                  </Box>
                </Box>
              </div>
              <div className={classes.rightColumn}>
                <div className={classes.tradeSection}>
                  <CrabTradeComponent maxCap={maxCap} depositedAmount={vault?.collateralAmount || new BigNumber(0)} />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const Page: React.FC = () => <Strategies />

export default Page
