import React, { useEffect, useState } from 'react'
import { Typography, Tab, Tabs } from '@material-ui/core'
import Image from 'next/image'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import bullEmoji from 'public/images/bull_emoji.png'

import Nav from '@components/Nav'
import { Vaults, VaultSubtitle } from '@constants/enums'
import { useRouter } from 'next/router'

const useTabLabelStyles = makeStyles((theme) =>
  createStyles({
    title: {
      fontSize: '24px',
      fontWeight: 700,
      fontFamily: 'DM Sans',
      lineHeight: '2rem',
      [theme.breakpoints.down('xs')]: {
        fontSize: '20px',
        lineHeight: '1.5rem',
      },
    },
    subtitle: {
      fontSize: '16px',
      fontWeight: 400,
      fontFamily: 'DM Sans',
      [theme.breakpoints.down('xs')]: {
        fontSize: '13px',
      },
    },
  }),
)

const TabLabel: React.FC<{ title: Vaults; subtitle?: VaultSubtitle }> = ({ title, subtitle = '' }) => {
  const classes = useTabLabelStyles()
  return (
    <div>
      <Typography className={classes.title}>{title}</Typography>
      <Typography className={classes.subtitle}>{subtitle}</Typography>
    </div>
  )
}

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
    emoji: {
      width: '18px',
      maxHeight: '25px',
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

const StrategyLayout: React.FC<{ children: any }> = ({ children }) => {
  const router = useRouter()
  const [selectedIdx, setSelectedIdx] = useState(() => routeMap[router.pathname])

  const classes = useStyles()

  useEffect(() => {
    setSelectedIdx(routeMap[router.pathname])
  }, [router.pathname])

  if (!allowedPaths.includes(router.pathname)) return children

  return (
    <div>
      <Nav />
      <div className={classes.container}>
        <Tabs
          variant="fullWidth"
          value={selectedIdx}
          indicatorColor="primary"
          textColor="primary"
          onChange={(_, value) => {
            if (routeMap[BEAR_PATH] === value) router.push(BEAR_PATH, undefined, { shallow: true })
            if (routeMap[BULL_PATH] === value) router.push(BULL_PATH, undefined, { shallow: true })
            if (routeMap[CRAB_PATH] === value) router.push(CRAB_PATH, undefined, { shallow: true })
          }}
          aria-label="disabled tabs example"
        >
          <Tab style={{ textTransform: 'none' }} label={<TabLabel title={Vaults.ETHBear} />} icon={<div>🐻</div>} />
          <Tab
            style={{ textTransform: 'none' }}
            label={<TabLabel title={Vaults.CrabVault} subtitle={VaultSubtitle.CrabVault} />}
            icon={<div>🦀</div>}
          />
          <Tab
            style={{ textTransform: 'none' }}
            label={<TabLabel title={Vaults.ETHBull} subtitle={VaultSubtitle.ETHBull} />}
            icon={
              <div className={classes.emoji}>
                <Image alt="zen bull emoji" src={bullEmoji} width={'100%'} />
              </div>
            }
          />
        </Tabs>
        {children}
      </div>
    </div>
  )
}

export default StrategyLayout
