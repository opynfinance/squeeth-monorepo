import React, { useEffect } from 'react'
import { makeStyles, createStyles } from '@material-ui/core/styles'
import logo from 'public/images/OpynLogo.svg'
import LandingPageBackground from 'public/images/landing-page-background.svg'
import LandingPageBackgroundDown from 'public/images/landing-page-background-down.svg'
import LandingTitle from 'public/images/landing/landing-title.png'
import Squeeth from 'public/images/landing/squeeth.png'
import Link from 'next/link'
import Strategies from 'public/images/landing/strategies.png'
import Auction from 'public/images/landing/auction.png'
import Twitter from 'public/images/landing/twitter.svg'
import Discord from 'public/images/landing/discord.svg'
import Github from 'public/images/landing/github.svg'
import Medium from 'public/images/landing/medium.svg'
import Image from 'next/image'
import clsx from 'clsx'
import { Button, Typography } from '@material-ui/core'
import { useTVL } from '@hooks/useTVL'
import useAmplitude from '@hooks/useAmplitude'
import { LANDING_EVENTS, SITE_EVENTS } from '@utils/amplitude'

const designBaseWidth = 1512

const vwCalculator = (width: number) => {
  return `${(width / designBaseWidth) * 100}vw`
}

const useStyles = makeStyles((theme) =>
  createStyles({
    '*': {
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
      padding: `32px ${vwCalculator(120)}`,
      borderBottom: '1px solid #333333',
      display: 'flex',
      alignItems: 'center',
    },
    navLinks: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: `${vwCalculator(24)}`,
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
      marginLeft: `${vwCalculator(16)}`,
    },
    navStartEarningButton: {
      backgroundColor: theme.palette.primary.main,
      padding: `20px ${vwCalculator(18)}`,
      fontFamily: 'Avenir',
      fontWeight: 800,
      fontSize: '18px',
      lineHeight: '130%',
      maxWidth: '180px',
      '&:hover': {
        backgroundColor: theme.palette.primary.dark,
      },
    },
    background1: {
      position: 'absolute',
      backgroundImage: `url(${LandingPageBackground.src})`,
      height: `${vwCalculator(1400)}`,
      width: '100vw',
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'right',
      backgroundSize: 'contain',
    },
    background2: {
      position: 'absolute',
      backgroundImage: `url(${LandingPageBackgroundDown.src})`,
      height: `${vwCalculator(2950)}`,
      width: '90vw',
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'left',
    },
    content: {},
    introSection: {
      display: 'flex',
      padding: `${vwCalculator(120)}`,
      alignItems: 'center',
      [theme.breakpoints.down('md')]: {
        gap: '30px',
      },
    },
    introSectionLeft: {
      flex: 1,
      display: 'flex',
      justifyContent: 'center',
    },
    introSectionHeading: {
      fontFamily: 'DM Sans',
      fontWeight: 700,
      fontSize: '64px',
      margin: 0,
      [theme.breakpoints.down('lg')]: {
        fontSize: '64px',
      },
      [theme.breakpoints.down('md')]: {
        fontSize: '50px',
      },
    },
    introSectionSubHeading: {
      fontFamily: 'DM Sans',
      fontWeight: 400,
      fontSize: '32px',
      lineHeight: '42px',
      color: '#BDBDBD',
      margin: 0,
      [theme.breakpoints.down('lg')]: {
        fontSize: '32px',
      },
      [theme.breakpoints.down('md')]: {
        fontSize: '30px',
      },
    },
    imageSectionRight: {
      flex: 1,
      display: 'flex',
      justifyContent: 'center',
    },
    imageSection: {
      maxWidth: `${vwCalculator(610)}`,
    },
    statSection: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: `${vwCalculator(284)}`,
      marginTop: '70px',
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
      fontSize: '56px',
      lineHeight: '73px',
    },
    statSectionSubTitle: {
      fontFamily: 'DM Sans',
      fontWeight: 400,
      fontSize: '22px',
      lineHeight: '29px',
      color: '#BDBDBD',
      textAlign: 'center',
    },
    squeethSection: {
      display: 'flex',
      padding: `${vwCalculator(120)}`,
      alignItems: 'center',
      marginTop: '300px',
      [theme.breakpoints.down('md')]: {
        gap: '30px',
      },
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
      fontSize: '32px',
      lineHeight: '42px',
      marginTop: '-5px',
    },
    contentSectionTitle: {
      fontFamily: 'DM Sans',
      fontWeight: 700,
      fontSize: '32px',
      lineHeight: '42px',
      [theme.breakpoints.down('md')]: {
        fontSize: '25px',
      },
    },
    contentSectionSubTitle: {
      fontFamily: 'DM Sans',
      fontWeight: 400,
      fontSize: '24px',
      lineHeight: '31px',
      color: '#BDBDBD',
      [theme.breakpoints.down('md')]: {
        fontSize: '20px',
      },
    },
    contentSectionButton: {
      backgroundColor: theme.palette.primary.main,
      padding: `14px ${vwCalculator(18)}`,
      fontFamily: 'Avenir',
      fontWeight: 800,
      fontSize: '18px',
      lineHeight: '130%',
      maxWidth: '180px',
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
      [theme.breakpoints.down('md')]: {
        gap: '30px',
      },
    },
    auctionSectionLeft: {
      flex: 1,
      display: 'flex',
      justifyContent: 'center',
    },
    auctionSectionRight: {
      flex: 1,
      display: 'flex',
      justifyContent: 'center',
    },
    footer: {
      display: 'flex',
      alignItems: 'center',
      padding: `40px ${vwCalculator(120)}`,
    },
    footerLinks: {
      flex: '1',
      display: 'flex',
      gap: `${vwCalculator(36)}`,
    },
    footerLink: {
      fontFamily: 'DM Sans',
      fontWeight: 500,
      fontSize: '16px',
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
  { label: 'Auction', link: 'https://squeethportal.xyz', analyticsEvent: SITE_EVENTS.NAV_AUCTION },
  {
    label: 'FAQ',
    link: 'https://opyn.gitbook.io/opyn-strategies/crab-strategy/introduction',
    analyticsEvent: SITE_EVENTS.NAV_FAQ,
  },
]

const footerLinks = [
  { label: 'Developers', link: 'https://opyn.gitbook.io/squeeth-1/', analyticsEvent: LANDING_EVENTS.NAV_DEVELOPERS },
  { label: 'Blog', link: 'https://medium.com/opyn', analyticsEvent: LANDING_EVENTS.NAV_BLOG },
  {
    label: 'Security',
    link: 'https://opyn.gitbook.io/squeeth-faq/squeeth/security',
    analyticsEvent: LANDING_EVENTS.NAV_SECURITY,
  },
]

function DesktopLandingPage() {
  const classes = useStyles()
  const tvl = useTVL()
  const { track } = useAmplitude()

  useEffect(() => {
    track(LANDING_EVENTS.LANDING_VISIT_DESKTOP)
  }, [track])

  return (
    <div className={classes.landing_page_container}>
      <div className={classes.nav}>
        <div>
          <Link href={'/'} passHref>
            <Image src={logo} alt="logo" width={97} height={75} />
          </Link>
        </div>
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
          <div className={classes.navAction}>
            <Link href={'/strategies/crab'} passHref>
              <Button onClick={() => track(LANDING_EVENTS.NAV_START_EARNING)} className={classes.navStartEarningButton}>
                Start Earning
              </Button>
            </Link>
          </div>
        </div>
      </div>
      <div className={classes.background1} />
      <div className={classes.background2} />
      <div className={classes.content}>
        <div className={classes.introSection}>
          <div className={classes.introSectionLeft}>
            <div>
              <Typography variant="h1" className={clsx([classes.introSectionHeading, classes.gradientText])}>
                Stack your ETH
              </Typography>
              <Typography variant="h1" className={clsx([classes.introSectionHeading, classes.gradientText])}>
                & stables.
              </Typography>
              <div style={{ marginTop: '24px' }} />
              <Typography variant="h2" className={classes.introSectionSubHeading}>
                Investment strategies for DeFi.
              </Typography>
              <Typography variant="h2" className={classes.introSectionSubHeading}>
                Powered by squeeth.
              </Typography>
              <div style={{ marginTop: '39px' }} />
              <Link href={'/strategies/crab'} passHref>
                <Button
                  onClick={() => track(LANDING_EVENTS.NAV_HERO_TOP_START_EARNING)}
                  className={classes.navStartEarningButton}
                >
                  Start Earning
                </Button>
              </Link>
            </div>
          </div>
          <div className={classes.imageSectionRight}>
            <div className={classes.imageSection}>
              <Image src={LandingTitle} alt="Title Image" placeholder="blur" />
            </div>
          </div>
        </div>
        <div className={classes.statSection}>
          <div className={classes.statSectionItem}>
            <div className={clsx([classes.statSectionTitle, classes.gradientText])}>$16b+</div>
            <div className={classes.statSectionSubTitle}>Total Notional</div>
            <div className={classes.statSectionSubTitle}>Volume</div>
          </div>
          <div className={classes.statSectionItem}>
            <div className={clsx([classes.statSectionTitle, classes.gradientText])}>${tvl}m+</div>
            <div className={classes.statSectionSubTitle}>Total Value</div>
            <div className={classes.statSectionSubTitle}>Locked</div>
          </div>
        </div>
        <div className={classes.squeethSection}>
          <div className={classes.introSectionLeft}>
            <div>
              <div className={classes.contentSectionHeader}>
                <div className={classes.contentSectionHeaderImage}>
                  <Image src={logo} alt="logo" width={97} height={75} placeholder="blur" />
                </div>
                <Typography variant="h3" className={clsx([classes.contentSectionHeaderLabel, classes.gradientText])}>
                  SQUEETH
                </Typography>
              </div>
              <div style={{ marginTop: '25px' }} />
              <Typography variant="h3" className={classes.contentSectionTitle}>
                Leverage without liquidations.
              </Typography>
              <div style={{ marginTop: '41px' }} />
              <Typography variant="h3" className={classes.contentSectionSubTitle}>
                Bet on ETH with unlimited upside,
              </Typography>
              <Typography variant="h3" className={classes.contentSectionSubTitle}>
                protected downside, and no liquidations.
              </Typography>
              <div style={{ marginTop: '41px' }} />
              <Link href={'/squeeth'} passHref>
                <Button onClick={() => track(LANDING_EVENTS.NAV_HERO_SQUEETH)} className={classes.contentSectionButton}>
                  Trade Squeeth
                </Button>
              </Link>
            </div>
          </div>
          <div className={classes.imageSectionRight}>
            <div className={classes.imageSection}>
              <Image src={Squeeth} alt="Squeeth Image" placeholder="blur" />
            </div>
          </div>
        </div>
        <div className={classes.strategiesSection}>
          <div className={classes.introSectionLeft}>
            <div>
              <div className={classes.contentSectionHeader}>
                <div className={classes.contentSectionHeaderImage}>
                  <Image src={logo} alt="logo" width={97} height={75} placeholder="blur" />
                </div>
                <Typography variant="h3" className={clsx([classes.contentSectionHeaderLabel, classes.gradientText])}>
                  STRATEGIES
                </Typography>
              </div>
              <div style={{ marginTop: '25px' }} />
              <Typography variant="h3" className={classes.contentSectionTitle}>
                Earn returns on your crypto.
              </Typography>
              <div style={{ marginTop: '41px' }} />
              <Typography variant="h3" className={classes.contentSectionSubTitle}>
                ETH and USDC strategies to
              </Typography>
              <Typography variant="h3" className={classes.contentSectionSubTitle}>
                supercharge your portfolio.
              </Typography>
              <div style={{ marginTop: '41px' }} />
              <Link href={'/strategies/crab'} passHref>
                <Button
                  onClick={() => track(LANDING_EVENTS.NAV_HERO_DOWN_START_EARNING)}
                  className={classes.contentSectionButton}
                >
                  Start Earning
                </Button>
              </Link>
            </div>
          </div>
          <div className={classes.imageSectionRight}>
            <div className={classes.imageSection}>
              <Image src={Strategies} alt="Strategies Image" placeholder="blur" />
            </div>
          </div>
        </div>
        <div className={classes.auctionSection}>
          <div className={classes.auctionSectionLeft}>
            <div className={classes.imageSection}>
              <Image src={Auction} alt="Auction Image" placeholder="blur" />
            </div>
          </div>
          <div className={classes.auctionSectionRight}>
            <div>
              <div className={classes.contentSectionHeader}>
                <div className={classes.contentSectionHeaderImage}>
                  <Image src={logo} alt="logo" width={97} height={75} />
                </div>
                <Typography variant="h3" className={clsx([classes.contentSectionHeaderLabel, classes.gradientText])}>
                  AUCTION
                </Typography>
              </div>
              <div style={{ marginTop: '25px' }} />
              <Typography variant="h3" className={classes.contentSectionTitle}>
                Trade squeeth in size.
              </Typography>
              <div style={{ marginTop: '41px' }} />
              <Typography variant="h3" className={classes.contentSectionSubTitle}>
                Participate in large, regular auctions to trade
              </Typography>
              <Typography variant="h3" className={classes.contentSectionSubTitle}>
                squeeth in size with low price impact.
              </Typography>
              <div style={{ marginTop: '41px' }} />
              <Link href={'https://squeethportal.xyz'} passHref>
                <Button onClick={() => track(LANDING_EVENTS.NAV_HERO_AUCTION)} className={classes.contentSectionButton}>
                  Try Auction
                </Button>
              </Link>
            </div>
          </div>
        </div>
        <div style={{ marginTop: '100px' }} />
      </div>
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
            <Link href={'https://twitter.com/opyn_'} passHref>
              <Image className={classes.socialIcon} src={Twitter} alt="Opyn Twitter" />
            </Link>
          </div>
          <div onClick={() => track(LANDING_EVENTS.NAV_SOCIAL_DISCORD)}>
            <Link href={'https://tiny.cc/opyndiscord'} passHref>
              <Image className={classes.socialIcon} src={Discord} alt="Opyn Discord" />
            </Link>
          </div>
          <div onClick={() => track(LANDING_EVENTS.NAV_SOCIAL_GITHUB)}>
            <Link href={'https://github.com/opynfinance/squeeth-monorepo'} passHref>
              <Image className={classes.socialIcon} src={Github} alt="Opyn Github" />
            </Link>
          </div>
          <div onClick={() => track(LANDING_EVENTS.NAV_SOCIAL_MEDIUM)}>
            <Link href={'https://medium.com/opyn'} passHref>
              <Image className={classes.socialIcon} src={Medium} alt="Opyn Medium" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DesktopLandingPage
