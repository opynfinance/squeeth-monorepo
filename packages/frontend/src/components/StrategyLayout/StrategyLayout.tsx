import React, { useEffect, useState } from 'react'
import { Typography, Tab, Tabs } from '@material-ui/core'
import Image from 'next/image'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import { useRouter } from 'next/router'

import Nav from '@components/Nav'
import { Vaults, VaultSubtitle } from '@constants/enums'
import Emoji from '@components/Emoji'
import ethLogo from 'public/images/eth-logo.svg'
import usdcLogo from 'public/images/usdc-logo.svg'

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
      maxWidth: '1280px',
      width: '80%',
      margin: '0 auto',
      padding: theme.spacing(1, 5, 10, 5),

      [theme.breakpoints.down('lg')]: {
        maxWidth: 'none',
        width: '90%',
      },
      [theme.breakpoints.down('md')]: {
        width: '100%',
      },
      [theme.breakpoints.down('sm')]: {
        padding: theme.spacing(1, 4, 8, 4),
      },
      [theme.breakpoints.down('xs')]: {
        padding: theme.spacing(1, 3, 6, 3),
      },
    },
  }),
)

const useTabStyles = makeStyles((theme) =>
  createStyles({
    tabsRoot: {
      borderBottom: '1px solid #333333',
      marginTop: '16px',
    },
    tabsIndicator: {
      backgroundColor: '#26E6F8',
    },
    tabRoot: {
      paddingTop: '12px',
      paddingBottom: '12px',
      width: '240px',
      [theme.breakpoints.down('md')]: {
        width: '30%',
      },
    },
    labelTitle: {
      textTransform: 'initial',
      fontSize: '24px',
      fontWeight: 700,

      lineHeight: '2rem',
      [theme.breakpoints.down('xs')]: {
        fontSize: '20px',
        lineHeight: '1.5rem',
      },
    },
    labelSubtitle: {
      textTransform: 'initial',
      fontSize: '16px',
      fontWeight: 400,
      [theme.breakpoints.down('xs')]: {
        fontSize: '13px',
      },
    },
    strategyIconContainer: {
      position: 'relative',
    },
    strategyEmoji: {
      fontSize: '20px',
    },
    strategyTokenLogoContainer: {
      position: 'absolute',
      bottom: 16,
      left: 0,
      right: 0,
      width: '20px',
      height: '20px',
      zIndex: -10,
      margin: 'auto',
    },
    strategyTokenLogo: {
      width: '100%',
    },
  }),
)

const STRATEGIES_PATH = '/strategies'

const CRAB_PATH = `${STRATEGIES_PATH}/crab`
const BULL_PATH = `${STRATEGIES_PATH}/bull`
const BEAR_PATH = `${STRATEGIES_PATH}/bear`

const allowedPaths = [CRAB_PATH, BULL_PATH, BEAR_PATH]

const routeMap = {
  [BEAR_PATH]: 0,
  [CRAB_PATH]: 1,
  [BULL_PATH]: 2,
}

const StrategyLabel: React.FC<{ title: Vaults; subtitle?: VaultSubtitle }> = ({ title, subtitle = '' }) => {
  const classes = useTabStyles()

  return (
    <div>
      <Typography className={classes.labelTitle}>{title}</Typography>
      <Typography className={classes.labelSubtitle}>{subtitle}</Typography>
    </div>
  )
}

interface StrategyIconProps {
  emoji: string
  emojiLabel?: string
  tokenLogo?: string
  tokenLabel?: string
}

const StrategyIcon: React.FC<StrategyIconProps> = ({ emoji, emojiLabel, tokenLogo, tokenLabel }) => {
  const classes = useTabStyles()

  return (
    <div className={classes.strategyIconContainer}>
      <Emoji className={classes.strategyEmoji} aria-label={emojiLabel}>
        {emoji}
      </Emoji>
      {tokenLogo && (
        <div className={classes.strategyTokenLogoContainer}>
          <Image className={classes.strategyTokenLogo} src={tokenLogo} alt={tokenLabel ?? ''} />
        </div>
      )}
    </div>
  )
}

const StrategyLayout: React.FC<{ children: any }> = ({ children }) => {
  const router = useRouter()
  const [selectedIdx, setSelectedIdx] = useState(() => routeMap[router.pathname])

  const classes = useStyles()
  const tabClasses = useTabStyles()

  useEffect(() => {
    setSelectedIdx(routeMap[router.pathname])
  }, [router.pathname])

  if (!allowedPaths.includes(router.pathname)) {
    return children
  }

  return (
    <div>
      <Nav />

      <Tabs
        centered
        classes={{ root: tabClasses.tabsRoot, indicator: tabClasses.tabsIndicator }}
        value={selectedIdx}
        indicatorColor="primary"
        textColor="primary"
        onChange={(_, value) => {
          if (routeMap[BEAR_PATH] === value) router.push(BEAR_PATH, undefined, { shallow: true })
          if (routeMap[BULL_PATH] === value) router.push(BULL_PATH, undefined, { shallow: true })
          if (routeMap[CRAB_PATH] === value) router.push(CRAB_PATH, undefined, { shallow: true })
        }}
        aria-label="strategy tabs"
      >
        <Tab
          classes={{ root: tabClasses.tabRoot }}
          label={<StrategyLabel title={Vaults.ETHBear} subtitle={VaultSubtitle.ETHBear} />}
          icon={<StrategyIcon emoji="🐻" emojiLabel="bear" />}
          disabled
        />
        <Tab
          classes={{ root: tabClasses.tabRoot }}
          label={<StrategyLabel title={Vaults.CrabVault} subtitle={VaultSubtitle.CrabVault} />}
          icon={<StrategyIcon emoji="🦀" emojiLabel="crab" tokenLogo={usdcLogo} tokenLabel="USDC" />}
        />
        <Tab
          classes={{ root: tabClasses.tabRoot }}
          label={<StrategyLabel title={Vaults.ETHZenBull} subtitle={VaultSubtitle.ETHZenBull} />}
          icon={<StrategyIcon emoji="🧘🐂" emojiLabel="zen bull" tokenLogo={ethLogo} tokenLabel="ETH" />}
        />
      </Tabs>

      <div className={classes.container}>{children}</div>
    </div>
  )
}

export default StrategyLayout
