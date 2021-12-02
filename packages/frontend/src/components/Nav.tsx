import { Button, Drawer, IconButton } from '@material-ui/core'
import Hidden from '@material-ui/core/Hidden'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import Typography from '@material-ui/core/Typography'
import MenuIcon from '@material-ui/icons/Menu'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/router'
import React, { useRef, useState } from 'react'

// import logo from '../../public/images/logo.svg'
import logo from '../../public/images/SqueethLogo.png'
import { useWallet } from '../context/wallet'
import { useAddresses } from '../hooks/useAddress'
import useCopyClipboard from '../hooks/useCopyClipboard'
// import { useSqueethPool } from '../src/hooks/contracts/useSqueethPool'
import { toTokenAmount } from '../utils/calculations'
import WalletButton from './WalletButton'

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
      marginLeft: theme.spacing(2),
    },
    navDiv: {
      display: 'flex',
      alignItems: 'center',
      position: 'absolute',
      marginLeft: theme.spacing(20),
    },
    navLink: {
      margin: theme.spacing(0, 3),
      textDecoration: 'none',
      cursor: 'pointer',
      color: theme.palette.text.secondary,
      fontWeight: 400,
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
      padding: theme.spacing(2),
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
  const { balance } = useWallet()
  const { wSqueeth } = useAddresses()
  const [navOpen, setNavOpen] = useState(false)
  const [isCopied, setCopied] = useCopyClipboard()
  // const { getWSqueethPositionValue } = useSqueethPool()

  return (
    <div className={classes.nav}>
      <div className={classes.logo}>
        <Image src={logo} alt="logo" width={127} height={55} />
      </div>
      {/*For Desktop view*/}
      <Hidden smDown>
        <div className={classes.navDiv}>
          <div style={{ display: 'flex' }}>
            <NavLink path="/" name="Trade" />
            {/* <NavLink path="/trade" name="Trade 1" /> */}
            {/* <NavLink path="/strategies" name="Strategies" /> */}
            <NavLink path="/positions" name="Positions" />
            <NavLink path="/lp" name="LP" />
          </div>
        </div>
        <div className={classes.wallet}>
          <Button
            variant="outlined"
            color="primary"
            onClick={() => {
              setCopied(wSqueeth)
            }}
            style={{
              width: '200px',
            }}
          >
            {' '}
            {isCopied ? (
              <>Copied</>
            ) : (
              <>
                oSQTH: {wSqueeth?.substring(0, 6)}...{wSqueeth?.substring(wSqueeth.length - 4)}
              </>
            )}
          </Button>
          <WalletButton />
        </div>
      </Hidden>
      <Hidden mdUp>
        <Typography color="primary">{toTokenAmount(balance, 18).toFixed(4)} ETH</Typography>
        <IconButton onClick={() => setNavOpen(true)}>
          <MenuIcon />
        </IconButton>
        <Drawer anchor="right" open={navOpen} onClose={() => setNavOpen(false)}>
          <div className={classes.navDrawer}>
            <WalletButton />
            <NavLink path="/" name="Trade" />
            <NavLink path="/strategies" name="Strategies" />
            <NavLink path="/positions" name="Positions" />
            <NavLink path="/lp" name="LP" />
          </div>
        </Drawer>
      </Hidden>
    </div>
  )
}

export default Nav
