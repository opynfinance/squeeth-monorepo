import React, { useState } from 'react'
import { makeStyles, createStyles } from '@material-ui/core/styles'
import { Paper } from '@material-ui/core'
import Hamburger from 'hamburger-react'
import Collapse from '@material-ui/core/Collapse'
import logo from 'public/images/OpynLogo.svg'
import LandingPageBackgroundOne from 'public/images/landing/landing-page-first.svg'
import LandingPageBackgroundTwo from 'public/images/landing/landing-page-second.svg'
import LandingPageBackgroundThree from 'public/images/landing/landing-page-third.svg'
import LandingPageBackgroundFour from 'public/images/landing/landing-page-fourth.svg'
import SqueethMobile from 'public/images/landing/squeeth-mobile.png'
import StrategiesMobile from 'public/images/landing/strategies-mobile.png'
import AuctionMobile from 'public/images/landing/auction-mobile.png'
import Link from 'next/link'
import Twitter from 'public/images/landing/twitter.svg'
import Discord from 'public/images/landing/discord.svg'
import Github from 'public/images/landing/github.svg'
import Medium from 'public/images/landing/medium.svg'
import Image from 'next/image'
import clsx from 'clsx'
import { Button, Typography } from '@material-ui/core'
import { useTVL } from '@hooks/useTVL'

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
      padding: `0px ${vwCalculator(10)}`,
      borderBottom: '1px solid #333333',
      display: 'flex',
      alignItems: 'center',
      position: '-webkit-sticky',
    },
    navMenu: {
      margin: `0 ${vwCalculator(10)}`,
      position: 'absolute',
    },
    navLogo: { flex: 1, alignItems: 'center', justifyContent: 'center', display: 'flex' },
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
      fontFamily: 'Avenir',
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
    background1: {
      position: 'absolute',
      backgroundImage: `url(${LandingPageBackgroundOne.src})`,
      height: `150vh`,
      width: '99vw',
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'right',
      backgroundSize: 'contain',
    },
    background2: {
      position: 'absolute',
      backgroundImage: `url(${LandingPageBackgroundTwo.src})`,
      height: `75vh`,
      width: '90vw',
      marginTop: '60vh',
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'left',
    },
    background3: {
      position: 'absolute',
      backgroundImage: `url(${LandingPageBackgroundThree.src})`,
      height: `125vh`,
      marginTop: '125vh',
      width: '100vw',
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'right',
    },
    background4: {
      position: 'absolute',
      backgroundImage: `url(${LandingPageBackgroundFour.src})`,
      height: `85vh`,
      marginTop: '240vh',
      width: '90vw',
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'left',
    },
    content: {},
    introSection: {
      display: 'flex',
      padding: `2vw`,
      justifyContent: 'center',
      alignItems: 'center',
      textAlign: 'center',
      marginTop: '150px',
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
      width: '70vw',
    },
    imageSection: {
      maxWidth: `${vwCalculator(610)}`,
    },
    statSection: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: `${vwCalculator(50)}`,
      marginTop: '100px',
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
      marginTop: '30px',
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
      fontFamily: 'Avenir',
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
    socialIcon: {
      cursor: 'pointer',
    },
  }),
)

const navLinks = [
  { label: 'Strategies', link: '/strategies/crab' },
  { label: 'Squeeth', link: '/squeeth' },
  { label: 'Auction', link: 'https://squeethportal.xyz' },
  { label: 'FAQ', link: 'https://opyn.gitbook.io/squeeth/squeeth/get-started' },
]

const footerLinks = [
  { label: 'Developers', link: 'https://opyn.gitbook.io/squeeth/squeeth/contracts-documentation' },
  { label: 'Blog', link: 'https://medium.com/opyn' },
  { label: 'Security', link: 'https://opyn.gitbook.io/squeeth/security/audits-and-insurance' },
]

function MobileLandingPage() {
  const [navOpen, setNavOpen] = useState(false)
  const classes = useStyles()
  const tvl = useTVL()

  return (
    <div className={classes.landing_page_container}>
      <div className={classes.nav}>
        <div className={classes.navMenu}>
          <Hamburger size={20} toggled={navOpen} toggle={setNavOpen} />
        </div>
        <div className={classes.navLogo}>
          <Link href={'/'} passHref>
            <Image src={logo} alt="logo" width={83} height={59} />
          </Link>
        </div>
        <div className={classes.navAction}>
          <Link href={'/strategies/crab'} passHref>
            <Button className={classes.navStartEarningButton}>Launch</Button>
          </Link>
        </div>
      </div>

      <div style={{ position: 'absolute', width: '100vw', zIndex: 1 }}>
        <Collapse in={navOpen}>
          <Paper className={classes.drawerWrapper} elevation={2}>
            <div className={classes.navLinks}>
              {navLinks.map((link) => (
                <Typography variant="h3" className={classes.navLink} key={link.label}>
                  <Link href={link.link} passHref>
                    {link.label}
                  </Link>
                </Typography>
              ))}
            </div>
          </Paper>
        </Collapse>
      </div>

      <div className={classes.background1} />
      <div className={classes.background2} />
      <div className={classes.background3} />
      <div className={classes.background4} />
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
            <Link href={'/strategies/crab'} passHref>
              <Button className={clsx([classes.navStartEarningButton, classes.introStartEarningButton])}>
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
        <div style={{ marginTop: '100px' }} />
        <div className={classes.verticalImage}>
          <Image src={SqueethMobile} alt="Squeeth" />
        </div>
        <div className={classes.squeethSection}>
          <div className={classes.contentSectionHeader}>
            <div className={classes.contentSectionHeaderImage}>
              <Image src={logo} alt="logo" width={70} height={53} />
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
          <Link href={'/squeeth'} passHref>
            <Button className={classes.contentSectionButton}>Trade Squeeth</Button>
          </Link>
        </div>
        <div style={{ marginTop: '100px' }} />
        <div className={classes.verticalImage}>
          <Image src={StrategiesMobile} alt="Strategies" />
        </div>
        <div className={classes.squeethSection}>
          <div className={classes.contentSectionHeader}>
            <div className={classes.contentSectionHeaderImage}>
              <Image src={logo} alt="logo" width={70} height={53} />
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
          <Link href={'/strategies/crab'} passHref>
            <Button className={classes.contentSectionButton}>Start Earning</Button>
          </Link>
        </div>
        <div style={{ marginTop: '100px' }} />
        <div className={classes.verticalImage}>
          <Image src={AuctionMobile} alt="Auction" />
        </div>
        <div className={classes.squeethSection}>
          <div className={classes.contentSectionHeader}>
            <div className={classes.contentSectionHeaderImage}>
              <Image src={logo} alt="logo" width={70} height={53} />
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
          <Link href={'https://squeethportal.xyz'} passHref>
            <Button className={classes.contentSectionButton}>Try Auction</Button>
          </Link>
        </div>
        <div style={{ marginTop: '35px' }} />
        <div className={classes.footer}>
          <div className={classes.footerLinks}>
            {footerLinks.map((link) => (
              <Typography key={link.label} variant="h4" className={classes.footerLink}>
                <Link href={link.link} passHref>
                  {link.label}
                </Link>
              </Typography>
            ))}
          </div>
          <div className={classes.footerSocial}>
            <Link href={'https://twitter.com/opyn_'} passHref>
              <Image className={classes.socialIcon} src={Twitter} alt="Opyn Twitter" />
            </Link>
            <Link href={'https://tiny.cc/opyndiscord'} passHref>
              <Image className={classes.socialIcon} src={Discord} alt="Opyn Discord" />
            </Link>
            <Link href={'https://github.com/opynfinance/squeeth-monorepo'} passHref>
              <Image className={classes.socialIcon} src={Github} alt="Opyn Github" />
            </Link>
            <Link href={'https://medium.com/opyn'} passHref>
              <Image className={classes.socialIcon} src={Medium} alt="Opyn Medium" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MobileLandingPage
