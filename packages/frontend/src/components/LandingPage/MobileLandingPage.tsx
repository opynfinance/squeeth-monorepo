import React, { useEffect, useState } from 'react'
import { Button, Typography, Paper, Collapse, IconButton } from '@material-ui/core'
import { makeStyles, createStyles } from '@material-ui/core/styles'
import MenuIcon from '@material-ui/icons/Menu'
import Link from 'next/link'
import Image from 'next/image'
import clsx from 'clsx'

import logo from 'public/images/logo.png'
import LandingPageBackgroundOne from 'public/images/landing/athena1.png'
import LandingPageBackgroundTwo from 'public/images/landing/athena2.png'
import LandingPageBackgroundThree from 'public/images/landing/athena3.png'
import LandingPageBackgroundFour from 'public/images/landing/athena4.png'
import SqueethMobile from 'public/images/landing/squeeth-mobile.png'
import StrategiesMobile from 'public/images/landing/strategies-mobile.png'
import AuctionMobile from 'public/images/landing/auction-mobile.png'
import Twitter from 'public/images/landing/twitter.svg'
import Discord from 'public/images/landing/discord.svg'
import Github from 'public/images/landing/github.svg'
import Medium from 'public/images/landing/medium.svg'
import { useTVL } from '@hooks/useTVL'
import useAmplitude from '@hooks/useAmplitude'
import { LANDING_EVENTS } from '@utils/amplitude'
import { EXTERNAL_LINKS, ROUTES } from '@constants/routes'
import { navLinks, footerLinks } from './constants'

const designBaseWidth = 393

const vwCalculator = (width: number) => {
  return `${(width / designBaseWidth) * 100}vw`
}

const useStyles = makeStyles((theme) =>
  createStyles({
    body: {
      overflow: 'hidden',
    },
    gradientText: {
      background: `linear-gradient(180deg, #FFFFFF 0%, #C2C2C2 100%)`,
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
    },
    landing_page_container: {
      width: '100%',
      height: '100%',
      overflow: 'hidden',
    },
    nav: {
      padding: `8px ${vwCalculator(10)}`,
      display: 'flex',
      alignItems: 'center',
      boxShadow: '0px 3px 4px rgba(0, 0, 0, 0.2)',
      background: 'linear-gradient(180deg, #1A1C1D 0%, #191B1C 100%)',
    },
    navMenu: {
      margin: `0 ${vwCalculator(10)}`,
      position: 'absolute',
    },
    navLogo: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      display: 'flex',
    },
    navDrawer: {},
    navDrawerBackground: {
      backgroundColor: '#191B1C',
      boxShadow: '1px 1px 5px rgba(255,255,255,.3)',
      padding: '20px 40px 20px 20px',
    },
    backdrop: { marginTop: '20px' },
    navLinks: {
      display: 'flex',
      flexDirection: 'column',
      gap: `${vwCalculator(15)}`,
      flex: 1,
    },
    drawer: {
      position: 'absolute',
      width: '100vw',
      zIndex: 1,
    },
    drawerWrapper: {
      backgroundColor: '#232526',
      padding: '20px 20px',
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
      position: 'absolute',
      right: '10px',
    },
    navStartEarningButton: {
      backgroundColor: theme.palette.primary.main,
      padding: `10px ${vwCalculator(15)}`,
      fontWeight: 800,
      fontSize: '12px',
      lineHeight: '130%',
      maxWidth: '250px',
      '&:hover': {
        backgroundColor: theme.palette.primary.dark,
      },
    },
    introStartEarningButton: {
      padding: `20px ${vwCalculator(20)}`,
      fontSize: '20px',
    },
    athenaGraphicAbsoluteContainer: { position: 'absolute', width: '100vw', zIndex: -1 },
    background1: {
      display: 'flex',
      justifyContent: 'flex-end',
    },
    background2: {
      height: `100%`,
      marginTop: '-15vh',
    },
    background3: {
      display: 'flex',
      justifyContent: 'flex-end',
      marginTop: '-3vh',
    },
    background4: {
      marginTop: '20vh',
    },
    content: {},
    introSection: {
      display: 'flex',
      padding: `2vw`,
      justifyContent: 'center',
      alignItems: 'center',
      textAlign: 'center',
      marginTop: '12vh',
    },
    introSectionHeading: {
      fontFamily: 'DM Sans',
      fontWeight: 700,
      fontSize: '48px',
      margin: 0,
    },
    introSectionSubHeading: {
      fontFamily: 'DM Sans',
      fontWeight: 500,
      fontSize: '20px',
      lineHeight: '26px',
      color: '#BDBDBD',
      margin: 0,
      [theme.breakpoints.down('lg')]: {
        fontSize: '42px',
      },
      [theme.breakpoints.down('md')]: {
        fontSize: '42px',
      },
      [theme.breakpoints.down('sm')]: {
        fontSize: '30px',
      },
      [theme.breakpoints.down('xs')]: {
        fontSize: '20px',
      },
    },
    verticalImage: {
      margin: 'auto',
      width: '65vw',
    },
    imageSection: {
      maxWidth: `${vwCalculator(610)}`,
    },
    statSection: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: `${vwCalculator(50)}`,
      marginTop: '11vh',
    },
    statSectionItem: {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      flexDirection: 'column',
    },
    statSectionTitle: {
      fontFamily: 'DM Sans',
      fontWeight: 400,
      fontSize: '44px',
      lineHeight: '57px',
    },
    statSectionSubTitle: {
      maxWidth: `${vwCalculator(120)}`,
      fontFamily: 'DM Sans',
      fontWeight: 400,
      fontSize: '16px',
      lineHeight: '21px',
      color: '#BDBDBD',
      textAlign: 'center',
    },
    squeethSection: {
      display: 'flex',
      flexDirection: 'column',

      padding: '0 10vw',
      marginTop: '3vh',
    },
    contentSectionHeader: {
      display: 'flex',
      alignItems: 'center',
      gap: `${vwCalculator(29)}`,
    },
    contentSectionHeaderImage: {
      maxWidth: '',
    },
    contentSectionHeaderLabel: {
      fontFamily: 'DM Sans',
      fontWeight: 500,
      fontSize: '28px',
      lineHeight: '42px',
      marginTop: '-5px',
    },
    contentSectionTitle: {
      fontFamily: 'DM Sans',
      fontWeight: 700,
      fontSize: '28px',
      lineHeight: '36px',
    },
    contentSectionSubTitle: {
      fontFamily: 'DM Sans',
      fontWeight: 500,
      fontSize: '14px',
      lineHeight: '18px',
      color: '#BDBDBD',
    },
    contentSectionButton: {
      backgroundColor: theme.palette.primary.main,
      padding: `15px ${vwCalculator(10)}`,
      fontWeight: 800,
      fontSize: '14px',
      lineHeight: '130%',
      maxWidth: '130px',
      '&:hover': {
        backgroundColor: theme.palette.primary.dark,
      },
    },
    strategiesSection: {
      display: 'flex',
      padding: `${vwCalculator(120)}`,
      alignItems: 'center',
    },
    auctionSection: {
      display: 'flex',
      padding: `${vwCalculator(120)}`,
      alignItems: 'center',
      marginTop: '100px',
    },
    auctionSectionLeft: {
      flex: 1,
    },
    footer: {
      display: 'flex',
      alignItems: 'center',
      padding: `10px 20px`,
    },
    footerLinks: {
      flex: '1',
      display: 'flex',
      gap: `15px`,
    },
    footerLink: {
      fontFamily: 'DM Sans',
      fontWeight: 500,
      fontSize: '10px',
      lineHeight: '41px',
      color: '#BDBDBD',
      cursor: 'pointer',
      transitionDuration: '300ms',
      '&:hover': {
        color: '#F2F2F2',
      },
    },
    footerSocial: {
      display: 'flex',
      alignItems: 'center',
      gap: `${vwCalculator(9)}`,
    },
    menuButton: {
      padding: 0,
      '&:hover': {
        backgroundColor: 'transparent',
      },
    },
  }),
)

function MobileLandingPage() {
  const [navOpen, setNavOpen] = useState(false)
  const classes = useStyles()
  const tvl = useTVL()
  const { track } = useAmplitude()

  useEffect(() => {
    track(LANDING_EVENTS.LANDING_VISIT_MOBILE)
  }, [track])

  const handleNavOpen = () => {
    setNavOpen(!navOpen)
  }

  return (
    <div className={classes.landing_page_container}>
      <div className={classes.nav}>
        <div className={classes.navMenu}>
          <IconButton onClick={handleNavOpen} className={classes.menuButton}>
            <MenuIcon />
          </IconButton>
        </div>

        <Link href={ROUTES.HOME} passHref>
          <a className={classes.navLogo}>
            <Image src={logo} alt="logo" width={56} height={44} />
          </a>
        </Link>

        <div className={classes.navAction}>
          <Link href={ROUTES.STRATEGY.CRAB} passHref>
            <Button onClick={() => track(LANDING_EVENTS.NAV_START_EARNING)} className={classes.navStartEarningButton}>
              Launch
            </Button>
          </Link>
        </div>
      </div>

      <div style={{ position: 'absolute', width: '100vw', zIndex: 1 }}>
        <Collapse in={navOpen}>
          <Paper className={classes.drawerWrapper} elevation={2}>
            <div className={classes.navLinks}>
              {navLinks.map((link) => (
                <Typography
                  onClick={() => link.analyticsEvent && track(link.analyticsEvent)}
                  variant="h3"
                  className={classes.navLink}
                  key={link.label}
                >
                  <Link href={link.link} passHref>
                    {link.label}
                  </Link>
                </Typography>
              ))}
            </div>
          </Paper>
        </Collapse>
      </div>

      <div className={classes.athenaGraphicAbsoluteContainer}>
        <div>
          <div className={classes.background1}>
            <Image src={LandingPageBackgroundOne} alt="Athena 1" />
          </div>
          <div className={classes.background2}>
            <Image src={LandingPageBackgroundTwo} alt="Athena 2" />
          </div>
          <div className={classes.background3}>
            <Image src={LandingPageBackgroundThree} alt="Athena 3" />
          </div>
          <div className={classes.background4}>
            <Image src={LandingPageBackgroundFour} alt="Athena 4" />
          </div>
        </div>
      </div>
      <div className={classes.content}>
        <div className={classes.introSection}>
          <div>
            <Typography variant="h1" className={clsx([classes.introSectionHeading, classes.gradientText])}>
              Stack your ETH
            </Typography>
            <Typography variant="h1" className={clsx([classes.introSectionHeading, classes.gradientText])}>
              & stables.
            </Typography>
            <div style={{ marginTop: '15px' }} />
            <Typography variant="h2" className={classes.introSectionSubHeading}>
              Powerful investment strategies for DeFi.
            </Typography>
            <Typography variant="h2" className={classes.introSectionSubHeading}>
              Built on squeeth.
            </Typography>
            <div style={{ marginTop: '20px' }} />
            <Link href={ROUTES.STRATEGY.CRAB} passHref>
              <Button
                onClick={() => track(LANDING_EVENTS.NAV_HERO_TOP_START_EARNING)}
                className={clsx([classes.navStartEarningButton, classes.introStartEarningButton])}
              >
                Start Earning
              </Button>
            </Link>
          </div>
        </div>
        <div className={classes.statSection}>
          <div className={classes.statSectionItem}>
            <div className={clsx([classes.statSectionTitle, classes.gradientText])}>$16b</div>
            <div className={classes.statSectionSubTitle}>Total Notional Volume</div>
          </div>
          <div className={classes.statSectionItem}>
            <div className={clsx([classes.statSectionTitle, classes.gradientText])}>${tvl}m</div>
            <div className={classes.statSectionSubTitle}>Total Value Locked</div>
          </div>
        </div>
        <div style={{ marginTop: '11vh' }} />
        <div className={classes.verticalImage}>
          <Image src={SqueethMobile} alt="Squeeth" placeholder="blur" />
        </div>
        <div className={classes.squeethSection}>
          <div className={classes.contentSectionHeader}>
            <div className={classes.contentSectionHeaderImage}>
              <Image src={logo} alt="logo" width={67} height={53} />
            </div>
            <Typography variant="h3" className={clsx([classes.contentSectionHeaderLabel, classes.gradientText])}>
              SQUEETH
            </Typography>
          </div>
          <div style={{ marginTop: '15px' }} />
          <Typography variant="h3" className={classes.contentSectionTitle}>
            Leverage without liquidations.
          </Typography>
          <div style={{ marginTop: '15px' }} />
          <Typography variant="h3" className={classes.contentSectionSubTitle}>
            Bet on ETH with unlimited upside,
          </Typography>
          <Typography variant="h3" className={classes.contentSectionSubTitle}>
            protected downside, and no liquidations.
          </Typography>
          <div style={{ marginTop: '15px' }} />
          <Link href={ROUTES.SQUEETH} passHref>
            <Button onClick={() => track(LANDING_EVENTS.NAV_HERO_SQUEETH)} className={classes.contentSectionButton}>
              Trade Squeeth
            </Button>
          </Link>
        </div>
        <div style={{ marginTop: '17vh' }} />
        <div className={classes.verticalImage}>
          <Image src={StrategiesMobile} alt="Strategies" placeholder="blur" />
        </div>
        <div className={classes.squeethSection}>
          <div className={classes.contentSectionHeader}>
            <div className={classes.contentSectionHeaderImage}>
              <Image src={logo} alt="logo" width={67} height={53} />
            </div>
            <Typography variant="h3" className={clsx([classes.contentSectionHeaderLabel, classes.gradientText])}>
              STRATEGIES
            </Typography>
          </div>
          <div style={{ marginTop: '15px' }} />
          <Typography variant="h3" className={classes.contentSectionTitle}>
            Earn returns on
          </Typography>
          <Typography variant="h3" className={classes.contentSectionTitle}>
            your crypto.
          </Typography>
          <div style={{ marginTop: '15px' }} />
          <Typography variant="h3" className={classes.contentSectionSubTitle}>
            ETH and USDC strategies to supercharge
          </Typography>
          <Typography variant="h3" className={classes.contentSectionSubTitle}>
            your portfolio.
          </Typography>
          <div style={{ marginTop: '15px' }} />
          <Link href={ROUTES.STRATEGY.CRAB} passHref>
            <Button
              onClick={() => track(LANDING_EVENTS.NAV_HERO_DOWN_START_EARNING)}
              className={classes.contentSectionButton}
            >
              Start Earning
            </Button>
          </Link>
        </div>
        <div style={{ marginTop: '19vh' }} />
        <div className={classes.verticalImage}>
          <Image src={AuctionMobile} alt="Auction" placeholder="blur" />
        </div>
        <div className={classes.squeethSection}>
          <div className={classes.contentSectionHeader}>
            <div className={classes.contentSectionHeaderImage}>
              <Image src={logo} alt="logo" width={67} height={53} />
            </div>
            <Typography variant="h3" className={clsx([classes.contentSectionHeaderLabel, classes.gradientText])}>
              AUCTION
            </Typography>
          </div>
          <div style={{ marginTop: '15px' }} />
          <Typography variant="h3" className={classes.contentSectionTitle}>
            Trade squeeth in size.
          </Typography>
          <div style={{ marginTop: '15px' }} />
          <Typography variant="h3" className={classes.contentSectionSubTitle}>
            Participate in large, regular auctions to trade
          </Typography>
          <Typography variant="h3" className={classes.contentSectionSubTitle}>
            squeeth in size with low price impact.
          </Typography>
          <div style={{ marginTop: '15px' }} />
          <Link href={EXTERNAL_LINKS.AUCTION} passHref>
            <Button onClick={() => track(LANDING_EVENTS.NAV_HERO_AUCTION)} className={classes.contentSectionButton}>
              Try Auction
            </Button>
          </Link>
        </div>
        <div style={{ marginTop: '5vh' }} />
        <div className={classes.footer}>
          <div className={classes.footerLinks}>
            {footerLinks.map((link) => (
              <Typography
                onClick={() => link.analyticsEvent && track(link.analyticsEvent)}
                key={link.label}
                variant="h4"
                className={classes.footerLink}
              >
                <Link href={link.link} passHref>
                  {link.label}
                </Link>
              </Typography>
            ))}
          </div>
          <div className={classes.footerSocial}>
            <div onClick={() => track(LANDING_EVENTS.NAV_SOCIAL_TWITTER)}>
              <Link href={EXTERNAL_LINKS.TWITTER} passHref>
                <a>
                  <Image src={Twitter} alt="Opyn Twitter" />
                </a>
              </Link>
            </div>
            <div onClick={() => track(LANDING_EVENTS.NAV_SOCIAL_DISCORD)}>
              <Link href={EXTERNAL_LINKS.DISCORD} passHref>
                <a>
                  <Image src={Discord} alt="Opyn Discord" />
                </a>
              </Link>
            </div>
            <div onClick={() => track(LANDING_EVENTS.NAV_SOCIAL_GITHUB)}>
              <Link href={EXTERNAL_LINKS.GITHUB} passHref>
                <a>
                  <Image src={Github} alt="Opyn Github" />
                </a>
              </Link>
            </div>
            <div onClick={() => track(LANDING_EVENTS.NAV_SOCIAL_MEDIUM)}>
              <Link href={EXTERNAL_LINKS.MEDIUM} passHref>
                <a>
                  <Image src={Medium} alt="Opyn Medium" />
                </a>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MobileLandingPage
