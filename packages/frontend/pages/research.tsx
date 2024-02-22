import React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Hidden, Button, Typography, useMediaQuery, useTheme, Paper, Collapse } from '@material-ui/core'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import Hamburger from 'hamburger-react'

import logo from 'public/images/OpynLogo.svg'
import DefaultSiteSeo from '@components/DefaultSiteSeo/DefaultSiteSeo'

const useStyles = makeStyles((theme) =>
  createStyles({
    m_nav: {
      padding: `0px 10px`,
      display: 'flex',
      alignItems: 'center',
      boxShadow: '0px 3px 4px rgba(0, 0, 0, 0.2)',
      background: 'linear-gradient(180deg, #1A1C1D 0%, #191B1C 100%)',
    },
    m_navMenu: {
      margin: `0px 4px 0px -4px`,
      position: 'absolute',
    },
    m_navLogo: { flex: 1, alignItems: 'center', justifyContent: 'center', display: 'flex' },
    m_navDrawer: {},
    m_navLinks: {
      display: 'flex',
      flexDirection: 'column',
      gap: `15px`,
      flex: 1,
    },
    m_drawer: {
      position: 'absolute',
      width: '100vw',
      zIndex: 1,
    },
    m_drawerWrapper: {
      backgroundColor: '#232526',
      padding: '20px 20px',
    },
    m_navLink: {
      fontFamily: 'DM Sans',
      fontWeight: 700,
      fontSize: `16px`,
      lineHeight: '140%',
      color: '#F2F2F2',
      opacity: 0.5,
      cursor: 'pointer',
      transitionDuration: '300ms',
      '&:hover': {
        opacity: 1,
      },
    },
    m_navAction: {
      position: 'absolute',
      right: '10px',
    },
    m_navStartEarningButton: {
      backgroundColor: theme.palette.primary.main,
      padding: `8px 10px`,
      fontFamily: 'DM Sans',
      fontWeight: 800,
      fontSize: '14px',
      lineHeight: '130%',
      maxWidth: '250px',
      '&:hover': {
        backgroundColor: theme.palette.primary.dark,
      },
    },
    logo: {
      cursor: 'pointer',
    },
    nav: {
      padding: '8px 120px',
      borderBottom: '1px solid #333333',
      display: 'flex',
      alignItems: 'center',
    },
    navLinks: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: '32px',
      flex: 1,
    },
    navLink: {
      fontFamily: 'DM Sans',
      fontWeight: 700,
      fontSize: `16px`,
      lineHeight: '140%',
      color: '#F2F2F2',
      opacity: 0.5,
      cursor: 'pointer',
      transitionDuration: '300ms',
      '&:hover': {
        opacity: 1,
      },
    },
    navAction: {
      marginLeft: '16px',
    },
    navStartEarningButton: {
      backgroundColor: theme.palette.primary.main,
      padding: '15px 18px',
      fontFamily: 'DM Sans',
      fontWeight: 800,
      fontSize: '18px',
      lineHeight: '130%',
      maxWidth: '180px',
      '&:hover': {
        backgroundColor: theme.palette.primary.dark,
      },
    },
    navMenu: {
      margin: `0 10px`,
      position: 'absolute',
    },
    drawerWrapper: {
      backgroundColor: '#232526',
      padding: '20px 20px',
    },
  }),
)

const navLinks = [
  { label: 'Strategies', link: '/strategies/crab' },
  { label: 'Squeeth', link: '/squeeth' },
  { label: 'Auction', link: 'https://squeethportal.xyz' },
  {
    label: 'FAQ',
    link: 'https://opyn.gitbook.io/opyn-strategies/strategies-faq/faq',
  },
]

function Nav() {
  const classes = useStyles()
  const theme = useTheme()
  const isMobileBreakpoint = useMediaQuery(theme.breakpoints.down('sm'))

  const [navOpen, setNavOpen] = React.useState(false)

  if (isMobileBreakpoint) {
    return (
      <div>
        <div className={classes.m_nav}>
          <div className={classes.m_navMenu}>
            <Hamburger size={20} toggled={navOpen} toggle={setNavOpen} />
          </div>
          <div className={classes.m_navLogo}>
            <Link href={'/'} passHref>
              <Image src={logo} alt="logo" width={83} height={59} />
            </Link>
          </div>
          <div className={classes.m_navAction}>
            <Link href={'/strategies/crab'} passHref>
              <Button className={classes.m_navStartEarningButton}>Launch</Button>
            </Link>
          </div>
        </div>

        <div style={{ position: 'absolute', width: '100vw', zIndex: 1 }}>
          <Collapse in={navOpen}>
            <Paper className={classes.m_drawerWrapper} elevation={2}>
              <div className={classes.m_navLinks}>
                {navLinks.map((link) => (
                  <Typography variant="h3" className={classes.m_navLink} key={link.label}>
                    <Link href={link.link} passHref>
                      {link.label}
                    </Link>
                  </Typography>
                ))}
              </div>
            </Paper>
          </Collapse>
        </div>
      </div>
    )
  }

  return (
    <div className={classes.nav}>
      <div className={classes.logo}>
        <Link href={'/'} passHref>
          <Image src={logo} alt="logo" width={97} height={75} />
        </Link>
      </div>
      <div className={classes.navLinks}>
        {navLinks.map((link) => (
          <Typography variant="h3" className={classes.navLink} key={link.label}>
            <Link href={link.link} passHref>
              {link.label}
            </Link>
          </Typography>
        ))}
        <div className={classes.navAction}>
          <Link href={'/strategies/crab'} passHref>
            <Button className={classes.navStartEarningButton}>Start Earning</Button>
          </Link>
        </div>
      </div>
    </div>
  )
}

function ResearchPage() {
  return (
    <div>
      <DefaultSiteSeo />
      <Nav />
    </div>
  )
}

export default ResearchPage
