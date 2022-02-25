import { LinkButton, PrimaryButton } from '@components/Button'
import { PrimaryInput } from '@components/Input/PrimaryInput'
import Nav from '@components/Nav'
import CapDetails from '@components/Strategies/Crab/CapDetails'
import CrabStrategyHistory from '@components/Strategies/Crab/StrategyHistory'
import StrategyInfo from '@components/Strategies/Crab/StrategyInfo'
import StrategyInfoItem from '@components/Strategies/StrategyInfoItem'
// import { useWallet } from '@context/wallet'
import { CrabProvider, useCrab } from '@context/crabStrategy'
import { Typography, Tab, Tabs } from '@material-ui/core'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import { useController } from '@hooks/contracts/useController'
import { toTokenAmount } from '@utils/calculations'
import BigNumber from 'bignumber.js'
import React, { useMemo, useState } from 'react'
import { Tooltips } from '@constants/index'
import { Links, Vaults } from '@constants/enums'
import Image from 'next/image'
import bull from '../public/images/bull.gif'
import bear from '../public/images/bear.gif'
import CrabTrade from '@components/Strategies/Crab/CrabTrade'
import { useAtom } from 'jotai'
import { addressAtom } from 'src/state/wallet/atoms'
import { useSelectWallet } from 'src/state/wallet/hooks'

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
    tradeForm: {
      background: theme.palette.background.stone,
      borderRadius: theme.spacing(2),
      margin: theme.spacing(0, 'auto'),
      width: '350px',
      position: 'sticky',
      height: '440px',
      top: '100px',
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
  // const { address, selectWallet } = useWallet()
  const { maxCap, vault, collatRatio, timeAtLastHedge, profitableMovePercent } = useCrab()
  const { index, currentImpliedFunding, dailyHistoricalFunding } = useController()

  const [address] = useAtom(addressAtom)
  const selectWallet = useSelectWallet()
  useMemo(() => {
    if (selectedIdx === 0) return Vaults.ETHBull
    if (selectedIdx === 1) return Vaults.CrabVault
    if (selectedIdx === 2) return Vaults.ETHBear
    else return Vaults.Custom
  }, [selectedIdx])

  return (
    <div>
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
              USD terms. You earn funding without taking any view on if ETH will move up or down.
              <a className={classes.link} href={Links.CrabFAQ} target="_blank" rel="noreferrer">
                {' '}
                Learn more.{' '}
              </a>
            </Typography>
            <div className={classes.body}>
              <div className={classes.details}>
                <CapDetails maxCap={maxCap} depositedAmount={vault?.collateralAmount || new BigNumber(0)} />
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
                    tooltip={`${
                      Tooltips.StrategyEarnFunding
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
                    value={collatRatio.toString()}
                    label="Collat Ratio (%)"
                    tooltip={Tooltips.StrategyCollRatio}
                  />
                </div>
                <StrategyInfo />
                <CrabStrategyHistory />
              </div>
              <div className={classes.tradeForm}>
                {!!address ? (
                  <CrabTrade maxCap={maxCap} depositedAmount={vault?.collateralAmount || new BigNumber(0)} />
                ) : (
                  <div className={classes.connectWalletDiv}>
                    <LinkButton onClick={() => selectWallet()}>Connect Wallet</LinkButton>
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

const Page: React.FC = () => (
  <CrabProvider>
    <Strategies />
  </CrabProvider>
)

export default Page
