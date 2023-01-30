import { Button, Drawer, IconButton } from '@material-ui/core'
import Hidden from '@material-ui/core/Hidden'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import Typography from '@material-ui/core/Typography'
import MenuIcon from '@material-ui/icons/Menu'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/router'
import React, { useState } from 'react'
import { useAtomValue } from 'jotai'

import useCopyClipboard from '@hooks/useCopyClipboard'
import { useWalletBalance } from '@state/wallet/hooks'
import { addressesAtom } from '@state/positions/atoms'
import { toTokenAmount } from '@utils/calculations'
import { BIG_ZERO } from '@constants/index'
import logo from 'public/images/OpynLogo.svg'
import WalletButton from './Button/WalletButton'
import SettingMenu from './SettingsMenu'
import useAmplitude from '@hooks/useAmplitude'
import { SITE_EVENTS } from '@utils/amplitude'

const useStyles = makeStyles((theme) =>
  createStyles({
    root: {
      borderBottom: `1px solid ${theme.palette.background.stone}`,
      position: 'sticky',
      top: '0px',
      backdropFilter: 'blur(30px)',
      zIndex: theme.zIndex.appBar,
    },
    content: {
      maxWidth: '1280px',
      width: '80%',
      padding: theme.spacing(0, 2.5),
      margin: '0 auto',
      height: '64px',
      display: 'flex',
      alignItems: 'center',
      [theme.breakpoints.down('lg')]: {
        maxWidth: 'none',
        width: '90%',
      },
      [theme.breakpoints.down('md')]: {
        width: '100%',
      },
      [theme.breakpoints.down('sm')]: {
        padding: theme.spacing(0, 2),
      },
      [theme.breakpoints.down('xs')]: {
        padding: theme.spacing(0, 1),
      },
    },
    logo: {
      marginRight: 'auto',
      marginTop: theme.spacing(1.75),
      marginLeft: theme.spacing(-1),
    },
    navDiv: {
      display: 'flex',
      alignItems: 'center',
      position: 'absolute',
      marginLeft: theme.spacing(12),
      [theme.breakpoints.down(1042)]: {
        marginLeft: theme.spacing(18),
      },
    },
    navLink: {
      margin: theme.spacing(0, 2),
      textDecoration: 'none',
      cursor: 'pointer',
      color: theme.palette.text.secondary,
      fontWeight: 400,
      letterSpacing: '-0.02em',
      [theme.breakpoints.down('md')]: {
        margin: theme.spacing(1, 1.5, 1),
      },
      [theme.breakpoints.down(1042)]: {
        margin: theme.spacing(1, 1, 1),
      },
      [theme.breakpoints.down('sm')]: {
        margin: theme.spacing(1, 0),
      },
    },
    navActive: {
      color: theme.palette.primary.main,
    },
    wallet: {
      display: 'flex',
      marginRight: theme.spacing(2),
    },
    navDrawer: {
      padding: theme.spacing(2, 4),
      '& > *': {
        marginBottom: theme.spacing(1),
      },
    },
  }),
)

export const NavLink: React.FC<{ path: string; name: string; highlightForPaths?: string[] }> = ({
  path,
  name,
  highlightForPaths,
}) => {
  const classes = useStyles()
  const router = useRouter()

  return (
    <Typography
      className={
        router.pathname === path || highlightForPaths?.includes(router.pathname)
          ? `${classes.navLink} ${classes.navActive}`
          : classes.navLink
      }
      variant="h6"
    >
      <Link href={path}>{name}</Link>
    </Typography>
  )
}

const Nav: React.FC = () => {
  const classes = useStyles()
  const { data: balance } = useWalletBalance()

  const { oSqueeth } = useAtomValue(addressesAtom)
  const [navOpen, setNavOpen] = useState(false)
  const [isCopied, setCopied] = useCopyClipboard()
  const { track } = useAmplitude()

  return (
    <div className={classes.root}>
      <div className={classes.content}>
        <div className={classes.logo}>
          <Link href={'/'} passHref>
            <Image src={logo} alt="logo" width={102} height={44} />
          </Link>
        </div>
        {/*For Desktop view*/}
        <Hidden smDown>
          <div className={classes.navDiv}>
            <div style={{ display: 'flex' }}>
              <NavLink
                highlightForPaths={['/strategies/crab', '/strategies/bull']}
                path="/strategies/crab"
                name="Strategies"
              />
              <NavLink path="/squeeth" name="Squeeth" />
              <NavLink path="/positions" name="Positions" />
              <a
                href="https://squeethportal.xyz"
                target="_blank"
                rel="noreferrer"
                onClick={() => track(SITE_EVENTS.NAV_AUCTION)}
              >
                <Typography className={classes.navLink} variant="h6">
                  Auction
                </Typography>
              </a>
              <NavLink path="/lp" name="LP" />
              <a
                href="https://opyn.gitbook.io/crab-strategy/crab-strategy/introduction"
                target="_blank"
                rel="noreferrer"
                onClick={() => track(SITE_EVENTS.NAV_FAQ)}
              >
                <Typography className={classes.navLink} variant="h6">
                  FAQ
                </Typography>
              </a>
            </div>
          </div>
          <div className={classes.wallet}>
            <Button
              variant="outlined"
              color="primary"
              onClick={() => {
                setCopied(oSqueeth)
              }}
            >
              {isCopied ? (
                <>Copied</>
              ) : (
                <>
                  <span style={{ textTransform: 'none' }}>oSQTH</span>
                  <Hidden mdDown>
                    : {oSqueeth?.substring(0, 6)}...{oSqueeth?.substring(oSqueeth.length - 4)}
                  </Hidden>
                </>
              )}
            </Button>
            <WalletButton />
            <SettingMenu />
          </div>
        </Hidden>
        <Hidden mdUp>
          <Typography color="primary">{toTokenAmount(balance ?? BIG_ZERO, 18).toFixed(4)} ETH</Typography>
          <IconButton onClick={() => setNavOpen(true)}>
            <MenuIcon />
          </IconButton>
          <Drawer anchor="right" open={navOpen} onClose={() => setNavOpen(false)}>
            <div className={classes.navDrawer}>
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <WalletButton />
                <SettingMenu />
              </div>
              <Button
                variant="outlined"
                color="primary"
                onClick={() => {
                  setCopied(oSqueeth)
                }}
                style={{
                  marginTop: '8px',
                  width: '200px',
                }}
              >
                {isCopied ? (
                  <>Copied</>
                ) : (
                  <>
                    <span style={{ textTransform: 'none' }}>oSQTH</span>: {oSqueeth?.substring(0, 6)}...
                    {oSqueeth?.substring(oSqueeth.length - 4)}
                  </>
                )}
              </Button>
              <NavLink
                highlightForPaths={['/strategies/crab', '/strategies/bull']}
                path="/strategies/crab"
                name="Strategies"
              />
              <NavLink path="/squeeth" name="Squeeth" />
              <NavLink path="/positions" name="Positions" />
              <a
                href="https://squeethportal.xyz"
                target="_blank"
                rel="noreferrer"
                onClick={() => track(SITE_EVENTS.NAV_AUCTION)}
              >
                <Typography className={classes.navLink} variant="h6">
                  Auction
                </Typography>
              </a>
              <NavLink path="/lp" name="LP" />
              <a
                href="https://opyn.gitbook.io/squeeth/resources/squeeth-faq"
                target="_blank"
                rel="noreferrer"
                onClick={() => track(SITE_EVENTS.NAV_FAQ)}
              >
                <Typography className={classes.navLink} variant="h6">
                  FAQ
                </Typography>
              </a>
            </div>
          </Drawer>
        </Hidden>
      </div>
    </div>
  )
}

export default Nav
