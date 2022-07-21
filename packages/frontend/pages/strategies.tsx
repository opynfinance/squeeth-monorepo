import { LinkButton } from '@components/Button'
import Nav from '@components/Nav'
import CapDetailsV2 from '@components/Strategies/Crab/CapDetailsV2'
import CrabStrategyHistory from '@components/Strategies/Crab/StrategyHistory'
import StrategyInfo from '@components/Strategies/Crab/StrategyInfo'
import StrategyInfoItem from '@components/Strategies/StrategyInfoItem'
import { Typography, Tab, Tabs, Box } from '@material-ui/core'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import { toTokenAmount } from '@utils/calculations'
import BigNumber from 'bignumber.js'
import React, { useEffect, useMemo, useState } from 'react'
import { Tooltips } from '@constants/index'
import { Links, Vaults } from '@constants/enums'
import Image from 'next/image'
import bull from '../public/images/bull.gif'
import bear from '../public/images/bear.gif'
// import CrabTrade from '@components/Strategies/Crab/CrabTrade'
import CrabTradeV2 from '@components/Strategies/Crab/CrabTradeV2'
import { useAtomValue } from 'jotai'
import { addressAtom, supportedNetworkAtom } from 'src/state/wallet/atoms'
import { useSelectWallet } from 'src/state/wallet/hooks'
import {
  crabStrategyCollatRatioAtomV2,
  crabStrategyVaultAtomV2,
  currentCrabPositionValueInETHAtomV2,
  maxCapAtomV2,
  timeAtLastHedgeAtomV2,
} from 'src/state/crab/atoms'
import { useCurrentCrabPositionValueV2, useSetProfitableMovePercent, useSetStrategyDataV2 } from 'src/state/crab/hooks'
import { currentImpliedFundingAtom, dailyHistoricalFundingAtom, indexAtom } from 'src/state/controller/atoms'
import MigrationNotice from '@components/Strategies/Crab/MigrationNotice'
import { useInitCrabMigration } from 'src/state/crabMigration/hooks'
import { isQueuedAtom } from 'src/state/crabMigration/atom'
import { makeItCrabRain } from '@components/Strategies/Crab/util'

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
      padding: theme.spacing(4, 20),
      marginLeft: 'auto',
      marginRight: 'auto',
      maxWidth: '1500px',
    },
    header: {
      display: 'flex',
      alignItems: 'center',
      marginTop: theme.spacing(4),
    },
    body: {
      display: 'flex',
      marginTop: theme.spacing(3),
    },
    tradeCard: {
      width: '350px',
      maxHeight: '440px',
      minHeight: '350px',
      height: 'fit-content',
      position: 'sticky',
      top: '75px',
      margin: theme.spacing('-120px', '50px'),
    },
    tradeForm: {
      background: theme.palette.background.stone,
      borderRadius: theme.spacing(2),
      marginTop: theme.spacing(4),
    },
    overview: {
      display: 'flex',
      columnGap: '20px',
      marginTop: theme.spacing(3),
    },
    details: {
      display: 'flex',
      flexDirection: 'column',
      paddingRight: theme.spacing(5),
    },
    chartContainer: {
      padding: theme.spacing(0),
      marginTop: theme.spacing(4),
      maxWidth: '640px',
    },
    link: {
      color: theme.palette.primary.main,
    },
    comingSoon: {
      height: '50vh',
      display: 'flex',
      alignItems: 'center',
      marginTop: theme.spacing(4),
    },
    connectWalletDiv: {
      display: 'flex',
      flexDirection: 'column',
      paddingRight: theme.spacing(5),
    },
    tabBackGround: {
      position: 'sticky',
      top: '0',
      zIndex: 20,
      // background: '#2A2D2E',
    },
    settingsButton: {
      marginTop: theme.spacing(2),
      marginLeft: theme.spacing(37),
      justifyContent: 'right',
      alignSelf: 'center',
    },
  }),
)

const Strategies: React.FC = () => {
  const [selectedIdx, setSelectedIdx] = useState(1)

  const classes = useStyles()
  const maxCap = useAtomValue(maxCapAtomV2)
  const vault = useAtomValue(crabStrategyVaultAtomV2)
  const collatRatio = useAtomValue(crabStrategyCollatRatioAtomV2)
  const timeAtLastHedge = useAtomValue(timeAtLastHedgeAtomV2)
  const profitableMovePercent = useSetProfitableMovePercent()
  const setStrategyData = useSetStrategyDataV2()
  useCurrentCrabPositionValueV2()
  useInitCrabMigration()

  const index = useAtomValue(indexAtom)
  const isQueued = useAtomValue(isQueuedAtom)
  const dailyHistoricalFunding = useAtomValue(dailyHistoricalFundingAtom)
  const currentImpliedFunding = useAtomValue(currentImpliedFundingAtom)
  const currentEthValue = useAtomValue(currentCrabPositionValueInETHAtomV2)

  const address = useAtomValue(addressAtom)
  const supportedNetwork = useAtomValue(supportedNetworkAtom)
  const selectWallet = useSelectWallet()

  useEffect(() => {
    setStrategyData()
  }, [collatRatio, setStrategyData])

  useMemo(() => {
    if (selectedIdx === 0) return Vaults.ETHBull
    if (selectedIdx === 1) return Vaults.CrabVault
    if (selectedIdx === 2) return Vaults.ETHBear
    else return Vaults.Custom
  }, [selectedIdx])

  useEffect(() => {
    if (isQueued) {
      makeItCrabRain()
    }
  }, [isQueued])

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
          <Tab style={{ textTransform: 'none' }} label={Vaults.ETHBull} icon={<div>🐂</div>} />
          <Tab style={{ textTransform: 'none' }} label={Vaults.CrabVault} icon={<div>🦀</div>} />
          <Tab style={{ textTransform: 'none' }} label={Vaults.ETHBear} icon={<div>🐻</div>} />
        </Tabs>
        {selectedIdx === 0 ? ( //bull vault
          <div className={classes.comingSoon}>
            <Image src={bull} alt="squeeth token" width={200} height={130} />
            <Typography variant="h6" style={{ marginLeft: '8px' }} color="primary">
              Coming soon
            </Typography>
          </div>
        ) : selectedIdx === 2 ? ( //bear vault
          <div className={classes.comingSoon}>
            <Image src={bear} alt="squeeth token" width={200} height={130} />
            <Typography variant="h6" style={{ marginLeft: '8px' }} color="primary">
              Coming soon
            </Typography>
          </div>
        ) : (
          <div>
            <div className={classes.header}>
              <Typography variant="h6">🦀</Typography>
              <Typography variant="h6" style={{ marginLeft: '8px' }} color="primary">
                Crab Strategy
              </Typography>
            </div>
            <Typography variant="subtitle1" color="textSecondary" style={{ width: '60%', marginTop: '8px' }}>
              Crab automates a strategy that performs best in sideways markets. Based on current funding, crab would be
              profitable if ETH moves less than approximately <b>{(profitableMovePercent * 100).toFixed(2)}%</b> in
              either direction each day. Crab hedges daily, reducing risk of liquidations. Crab aims to be profitable in
              USD terms, stacking ETH if price drops and selling ETH if price increases.
              <a className={classes.link} href={Links.CrabFAQ} target="_blank" rel="noreferrer">
                {' '}
                Learn more.{' '}
              </a>
            </Typography>
            <div className={classes.body}>
              <div className={classes.details}>
                <CapDetailsV2 maxCap={maxCap} depositedAmount={vault?.collateralAmount || new BigNumber(0)} />
                <div className={classes.overview}>
                  <StrategyInfoItem
                    value={Number(toTokenAmount(index, 18).sqrt()).toFixed(2).toLocaleString()}
                    label="ETH Price ($)"
                    tooltip={Tooltips.SpotPrice}
                    priceType="spot"
                  />
                  <StrategyInfoItem
                    value={(currentImpliedFunding * 100).toFixed(2)}
                    label="Current Implied Funding (%)"
                    tooltip={`${Tooltips.StrategyEarnFunding}. ${Tooltips.CurrentImplFunding}`}
                  />
                  <StrategyInfoItem
                    value={(dailyHistoricalFunding.funding * 100).toFixed(2)}
                    label="Historical Daily Funding (%)"
                    tooltip={`${Tooltips.StrategyEarnFunding
                      }. ${`Historical daily funding based on the last ${dailyHistoricalFunding.period} hours. Calculated using a ${dailyHistoricalFunding.period} hour TWAP of Mark - Index`}`}
                  />
                </div>
                <div className={classes.overview}>
                  <StrategyInfoItem
                    value={new Date(timeAtLastHedge * 1000).toLocaleString(undefined, {
                      day: 'numeric',
                      month: 'numeric',
                      hour: 'numeric',
                      minute: 'numeric',
                    })}
                    label="Last hedged at"
                    tooltip={
                      'Last hedged at ' +
                      new Date(timeAtLastHedge * 1000).toLocaleString(undefined, {
                        day: 'numeric',
                        month: 'long',
                        hour: 'numeric',
                        minute: 'numeric',
                        timeZoneName: 'long',
                      }) +
                      '. Hedges every 24hrs or every 20% ETH price move'
                    }
                  />
                  <StrategyInfoItem
                    value={(profitableMovePercent * 100).toFixed(2)}
                    label="Current Profit Threshold (%)"
                    tooltip={Tooltips.StrategyProfitThreshold}
                  />
                  <StrategyInfoItem
                    value={collatRatio === Infinity ? '0.00' : collatRatio.toString()}
                    label="Collat Ratio (%)"
                    tooltip={Tooltips.StrategyCollRatio}
                  />
                </div>
                <StrategyInfo />
                <CrabStrategyHistory />
              </div>
              {supportedNetwork && (
                <div className={classes.tradeCard}>
                  {!currentEthValue.isZero() && !isQueued ? <MigrationNotice /> : null}
                  <div className={classes.tradeForm}>
                    {!!address ? (
                      <CrabTradeV2 maxCap={maxCap} depositedAmount={vault?.collateralAmount || new BigNumber(0)} />
                    ) : (
                      <div className={classes.connectWalletDiv}>
                        <LinkButton onClick={() => selectWallet()}>Connect Wallet</LinkButton>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const Page: React.FC = () => <Strategies />

export default Page
