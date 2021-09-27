import { createStyles, makeStyles } from '@material-ui/core/styles'
import Typography from '@material-ui/core/Typography'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/router'
import React from 'react'

import logo from '../../public/images/logo.svg'
import WalletButton from './WalletButton'

const useStyles = makeStyles((theme) =>
  createStyles({
    nav: {
      height: '64px',
      padding: theme.spacing(2),
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      position: 'sticky',
      top: '0px',
      zIndex: 10,
      background: theme.palette.background.default,
      borderBottom: `1px solid ${theme.palette.background.stone}`,
    },
    logo: {
      marginRight: theme.spacing(2),
    },
    navDiv: {
      display: 'flex',
      justifyContent: 'center',
    },
    navLink: {
      margin: theme.spacing(0, 3),
      textDecoration: 'none',
      cursor: 'pointer',
      color: theme.palette.text.secondary,
      fontWeight: 400,
    },
    navActive: {
      color: theme.palette.primary.main,
    },
  }),
)

const NavLink: React.FC<{ path: string; name: string }> = ({ path, name }) => {
  const classes = useStyles()
  const router = useRouter()

  return (
    <Link href={path}>
      <Typography
        className={router.pathname === path ? `${classes.navLink} ${classes.navActive}` : classes.navLink}
        variant="h6"
      >
        {name}
      </Typography>
    </Link>
  )
}

const Nav: React.FC = () => {
  const classes = useStyles()

  return (
    <div className={classes.nav}>
      <Image src={logo} alt="logo" width={75} height={75} className={classes.logo} />
      <div className={classes.navDiv}>
        <NavLink path="/" name="Squeeth" />
        <NavLink path="/strategies" name="Strategies" />
        <NavLink path="/positions" name="Positions" />
        <NavLink path="/lp" name="LP" />
      </div>
      <WalletButton />
    </div>
  )
}

export default Nav
