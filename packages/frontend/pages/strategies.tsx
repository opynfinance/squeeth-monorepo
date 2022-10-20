import { LinkButton } from '@components/Button'
import Nav from '@components/Nav'
import CapDetailsV2 from '@components/Strategies/Crab/CapDetailsV2'
import CapDetails from '@components/Strategies/Crab/CapDetails'
import CrabStrategyHistory from '@components/Strategies/Crab/StrategyHistory'
import CrabStrategyV2History from '@components/Strategies/Crab/StrategyHistoryV2'
import StrategyInfo from '@components/Strategies/Crab/StrategyInfo'
import StrategyInfoV1 from '@components/Strategies/Crab/StrategyInfoV1'
import StrategyInfoItem from '@components/Strategies/StrategyInfoItem'
import { Typography, Tab, Tabs, Box, createGenerateClassName } from '@material-ui/core'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import { toTokenAmount } from '@utils/calculations'
import BigNumber from 'bignumber.js'
import React, { useEffect, useMemo, useState } from 'react'
import { Tooltips } from '@constants/index'
import { Links, Vaults } from '@constants/enums'
import Image from 'next/image'
import bull from '../public/images/bull.gif'
import bear from '../public/images/bear.gif'
import CrabTrade from '@components/Strategies/Crab/CrabTrade'
import CrabTradeV2 from '@components/Strategies/Crab/CrabTradeV2'
import { useAtomValue } from 'jotai'
import { addressAtom, supportedNetworkAtom } from 'src/state/wallet/atoms'
import { useSelectWallet } from 'src/state/wallet/hooks'
import {
  crabStrategyCollatRatioAtom,
  crabStrategyCollatRatioAtomV2,
  crabStrategyVaultAtom,
  crabStrategyVaultAtomV2,
  maxCapAtom,
  maxCapAtomV2,
  timeAtLastHedgeAtom,
  timeAtLastHedgeAtomV2,
} from 'src/state/crab/atoms'
import {
  useCurrentCrabPositionValueV2,
  useSetProfitableMovePercent,
  useSetProfitableMovePercentV2,
  useSetStrategyDataV2,
  useCurrentCrabPositionValue,
  useSetStrategyData,
} from 'src/state/crab/hooks'
import { currentImpliedFundingAtom, dailyHistoricalFundingAtom, indexAtom } from 'src/state/controller/atoms'
import { useInitCrabMigration } from 'src/state/crabMigration/hooks'
import { ToggleButton, ToggleButtonGroup } from '@material-ui/lab'
import { StrategyPnLV2 } from '@components/Strategies/Crab/StrategyPnLV2'

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
      [theme.breakpoints.down('md')]: {
        padding: theme.spacing(5, 5),
      },
      [theme.breakpoints.down('sm')]: {
        padding: theme.spacing(4, 4),
      },
      [theme.breakpoints.down('xs')]: {
        padding: theme.spacing(2, 2),
      },
      margin: '0 auto',
      maxWidth: '1080px',
    },
    header: {
      display: 'flex',
      marginTop: theme.spacing(4),
    },
    boldFont: {
      fontWeight: 'bold',
    },
    description: {
      marginTop: theme.spacing(4),
      [theme.breakpoints.up('md')]: {
        margin: '20px 0',
        width: '685px',
      },
      [theme.breakpoints.down('md')]: {
        width: '100%',
      },
    },
    body: {
      marginTop: theme.spacing(3),
      width: '100%',
      margin: '0',
      padding: '0',
      display: 'flex',
      [theme.breakpoints.down('md')]: {
        flexDirection: 'column-reverse',
      },
    },
    tradeCard: {
      margin: theme.spacing('0', 'auto', '20px'),
      width: '350px',
      [theme.breakpoints.up('lg')]: {
        width: '350px',
        maxHeight: '440px',
        minHeight: '350px',
        height: 'fit-content',
        position: 'sticky',
        top: '75px',
        margin: theme.spacing('-160px', '50px'),
      },
    },
    tradeForm: {
      background: theme.palette.background.stone,
      borderRadius: theme.spacing(2),
    },
    tradeCardDesktop: {
      [theme.breakpoints.down('md')]: {
        display: 'none',
      },

      margin: theme.spacing('-120px', '50px'),
    },
    details: {},
    overview: {
      display: 'grid',
      [theme.breakpoints.up('md')]: {
        gridTemplateColumns: '1fr 1fr 1fr',
      },
      [theme.breakpoints.down('sm')]: {
        gridTemplateColumns: '1fr 1fr',
      },
      [theme.breakpoints.down('xs')]: {
        gridTemplateColumns: '1fr',
      },
      gridGap: theme.spacing(2),
      columnGap: '20px',
      marginTop: theme.spacing(3),
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
    },
    strategiesConnectWalletBtn: {
      padding: theme.spacing(1),
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
    toggle: {
      justifyContent: 'right',
      marginLeft: theme.spacing(2),
    },
  }),
)

const Strategies: React.FC = () => {
  const [selectedIdx, setSelectedIdx] = useState(1)

  // which crab strategy to display. V1 or V2.
  const [displayCrabV1, setDisplayCrabV1] = useState(false)

  const classes = useStyles()
  const maxCap = useAtomValue(displayCrabV1 ? maxCapAtom : maxCapAtomV2)
  const vault = useAtomValue(displayCrabV1 ? crabStrategyVaultAtom : crabStrategyVaultAtomV2)
  const collatRatio = useAtomValue(displayCrabV1 ? crabStrategyCollatRatioAtom : crabStrategyCollatRatioAtomV2)
  const timeAtLastHedge = useAtomValue(displayCrabV1 ? timeAtLastHedgeAtom : timeAtLastHedgeAtomV2)
  const profitableMovePercent = useSetProfitableMovePercent()
  const profitableMovePercentV2 = useSetProfitableMovePercentV2()
  const setStrategyData = useSetStrategyData()
  const setStrategyDataV2 = useSetStrategyDataV2()

  useCurrentCrabPositionValueV2()
  useCurrentCrabPositionValue()
  useInitCrabMigration()

  const index = useAtomValue(indexAtom)
  const dailyHistoricalFunding = useAtomValue(dailyHistoricalFundingAtom)
  const currentImpliedFunding = useAtomValue(currentImpliedFundingAtom)

  const address = useAtomValue(addressAtom)
  const supportedNetwork = useAtomValue(supportedNetworkAtom)
  const selectWallet = useSelectWallet()

  const CapDetailsComponent = displayCrabV1 ? CapDetails : CapDetailsV2
  const CrabTradeComponent = displayCrabV1 ? CrabTrade : CrabTradeV2

  useEffect(() => {
    if (displayCrabV1) setStrategyData()
  }, [collatRatio, displayCrabV1, setStrategyData])

  useEffect(() => {
    if (!displayCrabV1) setStrategyDataV2()
  }, [collatRatio, displayCrabV1, setStrategyDataV2])

  useMemo(() => {
    if (selectedIdx === 0) return Vaults.ETHBull
    if (selectedIdx === 1) return Vaults.CrabVault
    if (selectedIdx === 2) return Vaults.ETHBear
    else return Vaults.Custom
  }, [selectedIdx])

  const switchToV1 = () => {
    setDisplayCrabV1(true)
  }
  const switchToV2 = () => {
    setDisplayCrabV1(false)
  }

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
                Crab Strategy - Earn USD Returns
              </Typography>
              <div className={classes.toggle}>
                <ToggleButtonGroup size="small" color="primary" value={displayCrabV1} exclusive>
                  <ToggleButton value={false} onClick={switchToV2}>
                    V2
                  </ToggleButton>
                  <ToggleButton value={true} onClick={switchToV1}>
                    V1
                  </ToggleButton>
                </ToggleButtonGroup>
              </div>
            </div>
            {displayCrabV1 ? (
              <Typography variant="subtitle1" color="textSecondary" className={classes.description}>
                Crab automates a strategy that performs best in sideways markets. Based on current premiums, crab would
                be profitable if ETH moves less than approximately{' '}
                <b className={classes.boldFont}>{(profitableMovePercent * 100).toFixed(2)}%</b> in either direction each
                day. Crab hedges daily, reducing risk of liquidations. Crab aims to be profitable in USD terms, stacking
                ETH if price drops and selling ETH if price increases.
                <a className={classes.link} href={Links.CrabFAQ} target="_blank" rel="noreferrer">
                  {' '}
                  Learn more.{' '}
                </a>
              </Typography>
            ) : (
              <Typography variant="subtitle1" color="textSecondary" className={classes.description}>
                Crab automates a strategy that performs best in sideways markets. Based on current premiums, crab would
                be profitable if ETH moves less than approximately{' '}
                <b className={classes.boldFont}>{(profitableMovePercentV2 * 100).toFixed(2)}%</b> in either direction
                between 2 day hedges. Crab hedges approximately three times a week (on MWF). Crab aims to be profitable
                in USD terms, stacking ETH if price drops and selling ETH price increases.
                <a className={classes.link} href={Links.CrabFAQ} target="_blank" rel="noreferrer">
                  {' '}
                  Learn more.{' '}
                </a>
              </Typography>
            )}
            <div className={classes.body}>
              <div className={classes.details}>
                <CapDetailsComponent maxCap={maxCap} depositedAmount={vault?.collateralAmount || new BigNumber(0)} />
                <div className={classes.overview}>
                  <StrategyInfoItem
                    value={Number(toTokenAmount(index, 18).sqrt()).toFixed(2).toLocaleString()}
                    label="ETH Price ($)"
                    tooltip={Tooltips.SpotPrice}
                    priceType="spot"
                  />
                  <StrategyInfoItem
                    value={(currentImpliedFunding * 100).toFixed(2)}
                    label="Current Implied Premium (%)"
                    tooltip={`${Tooltips.StrategyEarnFunding}. ${Tooltips.CurrentImplFunding}`}
                  />
                  <StrategyInfoItem
                    value={(dailyHistoricalFunding.funding * 100).toFixed(2)}
                    label="Historical Daily Premium (%)"
                    tooltip={`${
                      Tooltips.StrategyEarnFunding
                    }. ${`Historical daily premium based on the last ${dailyHistoricalFunding.period} hours. Calculated using a ${dailyHistoricalFunding.period} hour TWAP of Mark - Index`}`}
                  />
                  <StrategyInfoItem
                    link="https://www.squeethportal.xyz/auctionHistory"
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
                      '. Hedges approximately 3 times a week (on MWF) or every 20% ETH price move'
                    }
                  />
                  {displayCrabV1 ? (
                    <StrategyInfoItem
                      value={(profitableMovePercent * 100).toFixed(2)}
                      label="Current Profit Threshold (%)"
                      tooltip={Tooltips.StrategyProfitThreshold}
                    />
                  ) : (
                    <StrategyInfoItem
                      value={(profitableMovePercentV2 * 100).toFixed(2)}
                      label="Current Profit Threshold (%)"
                      tooltip={Tooltips.StrategyProfitThreshold}
                    />
                  )}
                  <StrategyInfoItem
                    link="https://squeeth.opyn.co/vault/286"
                    value={collatRatio === Infinity ? '0.00' : collatRatio.toString()}
                    label="Collat Ratio (%)"
                    tooltip={Tooltips.StrategyCollRatio}
                  />
                </div>
                {displayCrabV1 ? null : <StrategyPnLV2 />}
                {displayCrabV1 ? <StrategyInfoV1 /> : <StrategyInfo />}
                {displayCrabV1 ? <CrabStrategyHistory /> : <CrabStrategyV2History />}
              </div>
              <div className={classes.tradeCard}>
                {supportedNetwork && (
                  <div className={classes.tradeForm}>
                    {!!address ? (
                      <CrabTradeComponent
                        maxCap={maxCap}
                        depositedAmount={vault?.collateralAmount || new BigNumber(0)}
                      />
                    ) : (
                      <div className={classes.connectWalletDiv}>
                        <LinkButton className={classes.strategiesConnectWalletBtn} onClick={() => selectWallet()}>
                          Connect Wallet
                        </LinkButton>
                      </div>
                    )}
                  </div>
                )}
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
