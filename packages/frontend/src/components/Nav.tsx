import { Button, Drawer, IconButton, Menu, MenuItem, ButtonBase } from '@material-ui/core'
import Hidden from '@material-ui/core/Hidden'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import Typography from '@material-ui/core/Typography'
import { darken, Box } from '@material-ui/core/'
import { Modal } from './Modal/Modal'
import MenuIcon from '@material-ui/icons/Menu'
import Image from 'next/image'
import Link from 'next/link'
import { Link as MUILink } from '@material-ui/core'
import { useRouter } from 'next/router'
import React, { useEffect, useState } from 'react'
import { useAtomValue } from 'jotai'

import useCopyClipboard from '@hooks/useCopyClipboard'
import { useWalletBalance } from '@state/wallet/hooks'
import { addressesAtom } from '@state/positions/atoms'
import { toTokenAmount } from '@utils/calculations'
import { truncateText } from '@utils/formatter'
import { BIG_ZERO } from '@constants/index'
import logo from 'public/images/OpynLogo.svg'
import WalletButton from './Button/WalletButton'
import SettingMenu from './SettingsMenu'
import useAmplitude from '@hooks/useAmplitude'
import { SITE_EVENTS } from '@utils/amplitude'
import { ShutdownAlert } from './Alerts/ShutdownAlert'

const ukLegalPayload =
  'UK Disclaimer: This web application is provided as a tool for users to interact with the Squeeth Protocol on their own initiative, with no endorsement or recommendation of crypto asset trading activities. In doing so, Opyn is not recommending that users or potential users engage in crypto asset trading activity, and users or potential users of the web application should not regard this webpage or its contents as involving any form of recommendation, invitation, or inducement to deal in crypto assets.'

const useStyles = makeStyles((theme) =>
  createStyles({
    root: {
      borderBottom: `1px solid ${theme.palette.background.stone}`,
      position: 'sticky',
      top: '0px',
      backdropFilter: 'blur(30px)',
      zIndex: theme.zIndex.appBar,
    },
    banner: {
      padding: '20px',
      boxSizing: 'border-box',
      [theme.breakpoints.down('sm')]: {
        padding: '10px',
      },
    },
    bannerContent: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      [theme.breakpoints.down('sm')]: {
        flexDirection: 'column',
        alignItems: 'flex-start',
      },
    },
    bannerText: {
      fontSize: '15px',
      fontWeight: 500,
      [theme.breakpoints.up('md')]: {
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        maxWidth: 'calc(100% - 80px)',
      },
    },
    bannerDivider: {
      borderBottom: `1px solid ${theme.palette.divider}`,
      width: '100%',
    },
    readMoreButton: {
      fontSize: '15px',
      background: 'none',
      border: 'none',
      color: theme.palette.primary.main,
      padding: 0,
      font: 'inherit',
      cursor: 'pointer',
      outline: 'inherit',
      marginLeft: '5px',
      '&:hover': {
        color: darken(theme.palette.primary.main, 0.2),
      },
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
      cursor: 'pointer',
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
  const router = useRouter()
  const userLocation = router.query?.ct
  const { data: balance } = useWalletBalance()

  const { oSqueeth } = useAtomValue(addressesAtom)
  const [navOpen, setNavOpen] = useState(false)
  const [isCopied, setCopied] = useCopyClipboard()
  const { track } = useAmplitude()

  const [anchorEl, setAnchorEl] = React.useState(null)
  const [showBanner, setShowBanner] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const handleModalToggle = () => {
    setModalOpen(!modalOpen)
  }
  const handleClick = (event: any) => {
    setAnchorEl(event.currentTarget)
  }
  const handleClose = () => {
    setAnchorEl(null)
  }

  useEffect(() => {
    if (userLocation === 'GB') {
      // 'GB' is the country code for the United Kingdom
      setShowBanner(true)
    } else {
      setShowBanner(false)
    }
  }, [userLocation])

  return (
    <>
      <div className={classes.root}>
        {showBanner && (
          <>
            <div className={classes.banner}>
              <div className={classes.bannerContent}>
                <Typography className={classes.bannerText}>{truncateText(ukLegalPayload, 150)}</Typography>
                <button className={classes.readMoreButton} onClick={handleModalToggle}>
                  Read more
                </button>
              </div>
            </div>
            <div className={classes.bannerDivider}></div>
          </>
        )}
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
                <ButtonBase aria-controls="docs-menu" aria-haspopup="true" onClick={handleClick} className="">
                  <Typography className={classes.navLink} variant="h6">
                    Docs
                  </Typography>
                </ButtonBase>
                <Menu id="docs-menu" anchorEl={anchorEl} keepMounted open={Boolean(anchorEl)} onClose={handleClose}>
                  <MenuItem onClick={handleClose}>
                    <a href="https://research.opyn.co" onClick={() => track(SITE_EVENTS.NAV_RESEARCH)}>
                      Research
                    </a>
                  </MenuItem>
                  <MenuItem onClick={handleClose}>
                    <a
                      href="https://opyn.gitbook.io/opyn-hub"
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => track(SITE_EVENTS.NAV_FAQ)}
                    >
                      FAQ
                    </a>
                  </MenuItem>
                </Menu>
              </div>
            </div>
            <div className={classes.wallet}>
              <Hidden mdDown>
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
                      <span style={{ textTransform: 'none' }}>oSQTH</span>: {oSqueeth?.substring(0, 6)}...
                      {oSqueeth?.substring(oSqueeth.length - 4)}
                    </>
                  )}
                </Button>
              </Hidden>
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
                <a href="https://research.opyn.co" onClick={() => track(SITE_EVENTS.NAV_RESEARCH)}>
                  <Typography className={classes.navLink} variant="h6">
                    Research
                  </Typography>
                </a>
                <a
                  href="https://opyn.gitbook.io/opyn-hub"
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

      <ShutdownAlert />
      <Modal
        open={modalOpen}
        handleClose={handleModalToggle}
        aria-labelledby="legal-modal-title"
        aria-describedby="legal-modal-description"
        title="Disclaimer for UK Residents"
      >
        <Box px="4px">
          {ukLegalPayload}
          <br />
          <br />
          Please review our{' '}
          <MUILink href="https://opyn.co/terms-of-service" target="_blank">
            Terms of Service
          </MUILink>{' '}
          for more details.
        </Box>
      </Modal>
    </>
  )
}

export default Nav
