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

import logo from '../../public/images/SqueethLogo.svg'
import useCopyClipboard from '@hooks/useCopyClipboard'
import { toTokenAmount } from '@utils/calculations'
import WalletButton from './Button/WalletButton'
import SettingMenu from './SettingsMenu'
import { useWalletBalance } from 'src/state/wallet/hooks'
import { BIG_ZERO } from '../constants/'
import { addressesAtom } from 'src/state/positions/atoms'

const useStyles = makeStyles((theme) =>
  createStyles({
    nav: {
      height: '64px',
      display: 'flex',
      alignItems: 'center',
      position: 'sticky',
      top: '0px',
      zIndex: 30,
      //background: theme.palette.background.default,
      borderBottom: `1px solid ${theme.palette.background.stone}`,
      backdropFilter: 'blur(30px)',
    },
    logo: {
      marginRight: 'auto',
      marginTop: theme.spacing(1),
      marginLeft: theme.spacing(2),
    },
    navDiv: {
      display: 'flex',
      alignItems: 'center',
      position: 'absolute',
      marginLeft: theme.spacing(20),
      [theme.breakpoints.down(1042)]: {
        marginLeft: theme.spacing(18),
      },
    },
    navLink: {
      margin: theme.spacing(0, 3),
      textDecoration: 'none',
      cursor: 'pointer',
      color: theme.palette.text.secondary,
      fontWeight: 400,
      [theme.breakpoints.down('md')]: {
        margin: theme.spacing(1, 2, 1),
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
    contractAddress: {
      width: '200px',
      [theme.breakpoints.down('md')]: {
        width: '50px',
      },
    },
  }),
)

export const NavLink: React.FC<{ path: string; name: string }> = ({ path, name }) => {
  const classes = useStyles()
  const router = useRouter()

  return (
    <Typography
      className={router.pathname === path ? `${classes.navLink} ${classes.navActive}` : classes.navLink}
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

  return (
    <div className={classes.nav}>
      <div className={classes.logo}>
        <a href="https://squeeth.opyn.co/">
          <Image src={logo} alt="logo" width={127} height={55} />
        </a>
      </div>
      {/*For Desktop view*/}
      <Hidden smDown>
        <div className={classes.navDiv}>
          <div style={{ display: 'flex' }}>
            <NavLink path="/" name="Trade" />
            <NavLink path="/strategies" name="Strategies" />
            {/* <NavLink path="/trade" name="Trade 1" /> */}
            <NavLink path="/positions" name="Positions" />
            <NavLink path="/lp" name="LP" />
            <a href="https://opyn.gitbook.io/squeeth/resources/squeeth-faq" target="_blank" rel="noreferrer">
              <Typography className={classes.navLink} variant="h6">
                FAQ
              </Typography>
            </a>
          </div>
        </div>
        <div className={classes.wallet}>
          {/* <Button
            variant="contained"
            onClick={(e) => {
              e.preventDefault()
              window.open('https://opyn.canny.io/', '_blank')
            }}
            style={{
              marginRight: '16px',
              backgroundColor: '#1F8E98',
              color: '#FFF',
            }}
          >
            Share Feedback
          </Button> */}
          <Button
            variant="outlined"
            color="primary"
            onClick={() => {
              setCopied(oSqueeth)
            }}
            className={classes.contractAddress}
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
            <NavLink path="/" name="Trade" />
            <NavLink path="/strategies" name="Strategies" />
            <NavLink path="/positions" name="Positions" />
            <NavLink path="/lp" name="LP" />
            <a href="https://opyn.gitbook.io/squeeth/resources/squeeth-faq" target="_blank" rel="noreferrer">
              <Typography className={classes.navLink} variant="h6">
                FAQ
              </Typography>
            </a>
          </div>
        </Drawer>
      </Hidden>
    </div>
  )
}

export default Nav
