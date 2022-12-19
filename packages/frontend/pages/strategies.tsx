import BigNumber from 'bignumber.js'
import React, { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { Typography, Tab, Tabs, Box } from '@material-ui/core'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import { useAtomValue } from 'jotai'

import Nav from '@components/Nav'
import CrabTradeV2 from '@components/Strategies/Crab/CrabTradeV2'
import CrabProfitabilityChart from '@components/Strategies/Crab/CrabProfitabilityChart'
import { crabStrategyCollatRatioAtomV2, crabStrategyVaultAtomV2, maxCapAtomV2 } from '@state/crab/atoms'
import { useCurrentCrabPositionValueV2, useSetStrategyDataV2 } from '@state/crab/hooks'
import { useInitCrabMigration } from '@state/crabMigration/hooks'
import { Vaults, VaultSubtitle } from '@constants/enums'
import bull from 'public/images/bull.gif'
import bear from 'public/images/bear.gif'

const useStyles = makeStyles((theme) =>
  createStyles({
    content: {
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
    container: {
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
      flexBasis: '452px',
      [theme.breakpoints.down('xs')]: {
        flex: '1',
      },
    },
    sectionTitle: {
      fontSize: '22px',
      fontWeight: 700,
      letterSpacing: '-0.01em',
    },
    text: {
      marginTop: '16px',
      color: '#BDBDBD',
    },
    tabsRoot: {
      borderBottom: '1px solid #333333',
      marginTop: '16px',
    },
    tabsIndicator: {
      backgroundColor: '#26E6F8',
    },
    comingSoon: {
      height: '50vh',
      display: 'flex',
      alignItems: 'center',
      marginTop: theme.spacing(4),
    },
    tradeSection: {
      border: '1px solid #242728',
      boxShadow: '0px 4px 40px rgba(0, 0, 0, 0.25)',
      borderRadius: theme.spacing(0.7),
      padding: '32px 24px',
    },
  }),
)

const useTabLabelStyles = makeStyles((theme) =>
  createStyles({
    title: {
      fontSize: '24px',
      fontWeight: 700,
      lineHeight: '2rem',
      [theme.breakpoints.down('xs')]: {
        fontSize: '20px',
        lineHeight: '1.5rem',
      },
      textTransform: 'initial',
    },
    subtitle: {
      fontSize: '16px',
      fontWeight: 400,
      [theme.breakpoints.down('xs')]: {
        fontSize: '13px',
      },
      textTransform: 'initial',
    },
  }),
)

const TabLabel: React.FC<{ title: Vaults; subtitle?: VaultSubtitle }> = ({ title, subtitle = '' }) => {
  const classes = useTabLabelStyles()
  return (
    <>
      <Typography className={classes.title}>{title}</Typography>
      <Typography className={classes.subtitle}>{subtitle}</Typography>
    </>
  )
}

const Strategy: React.FC<{ selectedIndex: number }> = ({ selectedIndex }) => {
  const maxCap = useAtomValue(maxCapAtomV2)
  const vault = useAtomValue(crabStrategyVaultAtomV2)

  const classes = useStyles()

  if (selectedIndex === 0) {
    return (
      <div className={classes.comingSoon}>
        <Image src={bear} alt="squeeth token" width={200} height={130} />
        <Typography variant="h6" style={{ marginLeft: '8px' }} color="primary">
          Coming soon
        </Typography>
      </div>
    )
  }

  if (selectedIndex === 2) {
    return (
      <div className={classes.comingSoon}>
        <Image src={bull} alt="squeeth token" width={200} height={130} />
        <Typography variant="h6" style={{ marginLeft: '8px' }} color="primary">
          Coming soon
        </Typography>
      </div>
    )
  }

  return (
    <div className={classes.container}>
      <div className={classes.leftColumn}>
        <div>
          <Typography variant="h2" className={classes.sectionTitle}>
            About Crab
          </Typography>
          <Typography variant="body1" className={classes.text}>
            In general, Crab earns USDC returns except when there is high ETH volatility in the market, when it may draw
            down. The strategy stacks USDC if ETH is within the below bands at the next hedge.
          </Typography>

          <CrabProfitabilityChart />
        </div>
      </div>
      <div className={classes.rightColumn}>
        <div className={classes.tradeSection}>
          <CrabTradeV2 maxCap={maxCap} depositedAmount={vault?.collateralAmount || new BigNumber(0)} />
        </div>
      </div>
    </div>
  )
}

const Strategies: React.FC = () => {
  const [selectedIndex, setSelectedIndex] = useState(1)

  const classes = useStyles()
  const collatRatio = useAtomValue(crabStrategyCollatRatioAtomV2)
  const setStrategyDataV2 = useSetStrategyDataV2()

  // useCurrentCrabPositionValueV2()
  // useInitCrabMigration()

  useEffect(() => {
    // setStrategyDataV2()
  }, [collatRatio, setStrategyDataV2])

  const handleTabChange = (_, value: number) => setSelectedIndex(value)

  return (
    <div>
      <Nav />

      <div>
        <Tabs
          centered
          classes={{ root: classes.tabsRoot, indicator: classes.tabsIndicator }}
          value={selectedIndex}
          indicatorColor="primary"
          textColor="primary"
          onChange={handleTabChange}
          aria-label="squeeth-strategies"
        >
          <Tab label={<TabLabel title={Vaults.ETHBear} subtitle={VaultSubtitle.ETHBear} />} icon={<div>🐻</div>} />
          <Tab label={<TabLabel title={Vaults.CrabVault} subtitle={VaultSubtitle.CrabVault} />} icon={<div>🦀</div>} />
          <Tab
            label={<TabLabel title={Vaults.ETHZenBull} subtitle={VaultSubtitle.ETHZenBull} />}
            icon={<div>🐂</div>}
          />
        </Tabs>

        <div className={classes.content}>
          <Strategy selectedIndex={selectedIndex} />
        </div>
      </div>
    </div>
  )
}

const Page: React.FC = () => <Strategies />

export default Page
