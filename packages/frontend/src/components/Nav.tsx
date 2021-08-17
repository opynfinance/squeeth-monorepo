import React from 'react'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import Typography from '@material-ui/core/Typography';
import Link from 'next/link'
import Image from 'next/image'
import logo from '../../public/images/logo.svg'
import { useRouter } from "next/router";


const useStyles = makeStyles(theme => (createStyles({
  nav: {
    height: '64px',
    padding: theme.spacing(2),
    display: 'flex',
    alignItems: 'center'
  },
  logo: {
    marginRight: theme.spacing(2)
  },
  navDiv: {
    marginLeft: theme.spacing(2),
    display: 'flex',
    justifyContent: 'center',
    width: '100%'
  },
  navLink: {
    margin: theme.spacing(0,1),
    textDecoration: 'none',
    cursor: 'pointer',
    color: theme.palette.text.secondary,
  },
  navActive: {
    color: theme.palette.primary.main,
  }
})))

const NavLink: React.FC<{ path: string, name: string}> = ({ path, name }) => {
  const classes= useStyles();
  const router = useRouter();

  return (
    <Link href={path}>
      <Typography 
        className={router.pathname === path ? `${classes.navLink} ${classes.navActive}` : classes.navLink }
        variant="body1"
      >
        {name}
      </Typography>
    </Link>
  )
}

const Nav: React.FC = () => {
  const classes = useStyles();

  return (
    <div className={classes.nav}>
      <Image src={logo} alt="logo" width={75} height={75} className={classes.logo} />
      <div className={classes.navDiv}>
        <NavLink path="/" name="Squeeth" />
        <NavLink path="/vault" name="Vaults" />
        <NavLink path="/lp" name="LP" />
      </div>
    </div>
  )
}

export default Nav
