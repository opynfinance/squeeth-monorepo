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
import logo from 'public/images/logo.png'
import WalletButton from './Button/WalletButton'
import SettingMenu from './SettingsMenu'
import useAmplitude from '@hooks/useAmplitude'
import { SITE_EVENTS } from '@utils/amplitude'
import { ROUTES, EXTERNAL_LINKS } from '@constants/routes'

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
      padding: theme.spacing(1.5, 5),
      margin: '0 auto',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      [theme.breakpoints.down('lg')]: {
        maxWidth: 'none',
        width: '90%',
      },
      [theme.breakpoints.down('md')]: {
        width: '100%',
      },
      [theme.breakpoints.down('sm')]: {
        padding: theme.spacing(1.5, 4),
      },
      [theme.breakpoints.down('xs')]: {
        padding: theme.spacing(1.5, 3),
      },
    },
    leftNav: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-start',
      gridGap: theme.spacing(1.5),
    },
    rightNav: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-end',
    },
    logo: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flex: '0 0 56px',
    },
    navDiv: {
      display: 'flex',
      alignItems: 'center',
    },
    navLink: {
      margin: theme.spacing(0, 1.75),
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
    navDrawer: {
      padding: theme.spacing(2, 4),
      '& > *': {
        marginBottom: theme.spacing(1),
      },
    },
    menuButton: {
      padding: 0,
      marginLeft: theme.spacing(1.5),
      '&:hover': {
        backgroundColor: 'transparent',
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
        {/*For Desktop view*/}
        <Hidden smDown>
          <div className={classes.leftNav}>
            <Link href={ROUTES.HOME} passHref>
              <a className={classes.logo}>
                <Image src={logo} alt="logo" width={56} height={44} />
              </a>
            </Link>

            <div className={classes.navDiv}>
              <NavLink
                highlightForPaths={[ROUTES.STRATEGY.CRAB, ROUTES.STRATEGY.BULL]}
                path={ROUTES.STRATEGY.CRAB}
                name="Strategies"
              />
              <NavLink path={ROUTES.SQUEETH} name="Squeeth" />
              <NavLink path={ROUTES.POSITIONS} name="Positions" />
              <a
                href={EXTERNAL_LINKS.AUCTION}
                target="_blank"
                rel="noreferrer"
                onClick={() => track(SITE_EVENTS.NAV_AUCTION)}
              >
                <Typography className={classes.navLink} variant="h6">
                  Auction
                </Typography>
              </a>
              <NavLink path={ROUTES.LP} name="LP" />
              <a href={EXTERNAL_LINKS.FAQ} target="_blank" rel="noreferrer" onClick={() => track(SITE_EVENTS.NAV_FAQ)}>
                <Typography className={classes.navLink} variant="h6">
                  FAQ
                </Typography>
              </a>
            </div>
          </div>
          <div className={classes.rightNav}>
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
          <div className={classes.leftNav}>
            <Link href={ROUTES.HOME} passHref>
              <a className={classes.logo}>
                <Image src={logo} alt="logo" width={56} height={44} />
              </a>
            </Link>
          </div>

          <div className={classes.rightNav}>
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
                  highlightForPaths={[ROUTES.STRATEGY.CRAB, ROUTES.STRATEGY.BULL]}
                  path={ROUTES.STRATEGY.CRAB}
                  name="Strategies"
                />
                <NavLink path={ROUTES.SQUEETH} name="Squeeth" />
                <NavLink path={ROUTES.POSITIONS} name="Positions" />
                <a
                  href={EXTERNAL_LINKS.AUCTION}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => track(SITE_EVENTS.NAV_AUCTION)}
                >
                  <Typography className={classes.navLink} variant="h6">
                    Auction
                  </Typography>
                </a>
                <NavLink path={ROUTES.LP} name="LP" />
                <a
                  href={EXTERNAL_LINKS.FAQ}
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
          </div>
        </Hidden>
      </div>
    </div>
  )
}

export default Nav
