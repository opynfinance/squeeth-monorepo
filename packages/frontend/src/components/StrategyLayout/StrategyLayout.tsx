import React, { useEffect, useState } from 'react'
import { Typography, Tab, Tabs } from '@material-ui/core'
import Image from 'next/image'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import { useRouter } from 'next/router'

import Nav from '@components/Nav'
import { Vaults, VaultSubtitle } from '@constants/enums'
import crabStrategyImg from 'public/images/crab_strategy.svg'
import bearStrategyImg from 'public/images/bear_strategy.svg'
import bullStrategyImg from 'public/images/bull_strategy.png'

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
      maxWidth: '1280px',
      width: '80%',
      margin: '0 auto',
      padding: theme.spacing(1, 5, 7, 5),

      [theme.breakpoints.down('lg')]: {
        maxWidth: 'none',
        width: '90%',
      },
      [theme.breakpoints.down('md')]: {
        width: '100%',
      },
      [theme.breakpoints.down('sm')]: {
        padding: theme.spacing(1, 4, 5, 4),
      },
      [theme.breakpoints.down('xs')]: {
        padding: theme.spacing(1, 3, 4, 3),
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
    strategyImgContainer: {
      width: '20px',
      height: '20px',
    },

    strategyImg: {
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

interface StrategyImageProps {
  img: any
  imgAlt?: string
}

const StrategyImage: React.FC<StrategyImageProps> = ({ img, imgAlt }) => {
  const classes = useTabStyles()

  return (
    <div className={classes.strategyImgContainer}>
      <Image className={classes.strategyImg} src={img} alt={imgAlt ?? ''} />
    </div>
  )
}

const StrategyLayout: React.FC<{ children: any }> = ({ children }) => {
  const router = useRouter()
  const [selectedIdx, setSelectedIdx] = useState(() => routeMap[router.pathname])

  const classes = useStyles()
  const tabClasses = useTabStyles()

  console.log({ pathname: router.pathname })
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
          if (routeMap[BEAR_PATH] === value) router.push(BEAR_PATH)
          if (routeMap[BULL_PATH] === value) router.push(BULL_PATH)
          if (routeMap[CRAB_PATH] === value) router.push(CRAB_PATH)
        }}
        aria-label="strategy tabs"
      >
        <Tab
          classes={{ root: tabClasses.tabRoot }}
          label={<StrategyLabel title={Vaults.ETHBear} subtitle={VaultSubtitle.ETHBear} />}
          icon={<StrategyImage img={bearStrategyImg} imgAlt="Bear strategy" />}
          disabled
        />
        <Tab
          classes={{ root: tabClasses.tabRoot }}
          label={<StrategyLabel title={Vaults.CrabVault} subtitle={VaultSubtitle.CrabVault} />}
          icon={<StrategyImage img={crabStrategyImg} imgAlt="Crab USDC strategy" />}
        />
        <Tab
          classes={{ root: tabClasses.tabRoot }}
          label={<StrategyLabel title={Vaults.ETHZenBull} subtitle={VaultSubtitle.ETHZenBull} />}
          icon={<StrategyImage img={bullStrategyImg} imgAlt="Zen Bull ETH strategy" />}
        />
      </Tabs>

      <div className={classes.container}>{children}</div>
    </div>
  )
}

export default StrategyLayout
