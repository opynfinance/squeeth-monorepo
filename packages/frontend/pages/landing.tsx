import React from 'react'
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
import Market from 'public/images/landing/market.svg'
import Image from 'next/image'
import clsx from 'clsx'
import { Button, Typography } from '@material-ui/core'
import { useTVL } from '@hooks/useTVL'

const designBaseWidth = 1512

const vwCalculator = (width: number) => {
  return `${(width / designBaseWidth) * 100}vw`
}

const useStyles = makeStyles((theme) =>
  createStyles({
    '*': {
      overflow: 'hidden',
    },
    gradient_text: {
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
    nav_logo: {},
    nav_links: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: `${vwCalculator(24)}`,
      flex: 1,
    },
    nav_link: {
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
    nav_action: {
      marginLeft: `${vwCalculator(16)}`,
    },
    nav_start_earning: {
      backgroundColor: theme.palette.primary.main,
      padding: `20px ${vwCalculator(18)}`,
      fontFamily: 'Avenir',
      fontWeight: 800,
      fontSize: '18px',
      lineHeight: '130%',
      maxWidth: '150px',
      '&:hover': {
        backgroundColor: theme.palette.primary.dark,
      },
    },
    background1: {
      position: 'absolute',
      backgroundImage: `url(${LandingPageBackground.src})`,
      height: '175vh',
      width: '99vw',
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'right',
      backgroundSize: 'contain',
    },
    background2: {
      position: 'absolute',
      backgroundImage: `url(${LandingPageBackgroundDown.src})`,
      height: '352vh',
      width: '90vw',
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'left',
      //   backgroundSize: 'contain',
    },
    content: {},
    title_section: {
      display: 'flex',
      padding: `${vwCalculator(120)}`,
      alignItems: 'center',
    },
    title_section_left: {},
    title_section_left_heading: {
      fontFamily: 'DM Sans',
      fontWeight: 700,
      fontSize: '64px',
      margin: 0,
    },
    title_section_left_subheading: {
      fontFamily: 'DM Sans',
      fontWeight: 400,
      fontSize: '32px',
      lineHeight: '42px',
      color: '#BDBDBD',
      margin: 0,
    },
    title_section_right: {
      flex: 1,
      display: 'flex',
      justifyContent: 'flex-end',
    },
    title_image: {
      maxWidth: `${vwCalculator(610)}`,
    },
    stat_section: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: `${vwCalculator(284)}`,
      marginTop: '70px',
    },
    stat_section_item: {
      maxWidth: `${vwCalculator(160)}`,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      flexDirection: 'column',
    },
    stat_section_title: {
      fontFamily: 'DM Sans',
      fontWeight: 400,
      fontSize: '56px',
      lineHeight: '73px',
    },
    stat_section_subtitle: {
      fontFamily: 'DM Sans',
      fontWeight: 400,
      fontSize: '22px',
      lineHeight: '29px',
      color: '#BDBDBD',
      textAlign: 'center',
    },
    squeeth_section: {
      display: 'flex',
      padding: `${vwCalculator(120)}`,
      alignItems: 'center',
      marginTop: '300px',
    },
    content_section_left: {},
    content_section_left_header: {
      display: 'flex',
      alignItems: 'center',
      gap: `${vwCalculator(29)}`,
    },
    content_section_left_header_image: {
      maxWidth: '',
    },
    content_section_left_header_label: {
      fontFamily: 'DM Sans',
      fontWeight: 500,
      fontSize: '32px',
      lineHeight: '42px',
      marginTop: '-5px',
    },
    content_section_left_title: {
      fontFamily: 'DM Sans',
      fontWeight: 700,
      fontSize: '32px',
      lineHeight: '42px',
    },
    content_section_left_subtitle: {
      fontFamily: 'DM Sans',
      fontWeight: 400,
      fontSize: '24px',
      lineHeight: '31px',
      color: '#BDBDBD',
    },
    content_section_button: {
      backgroundColor: theme.palette.primary.main,
      padding: `14px ${vwCalculator(18)}`,
      fontFamily: 'Avenir',
      fontWeight: 800,
      fontSize: '18px',
      lineHeight: '130%',
      maxWidth: '164px',
      '&:hover': {
        backgroundColor: theme.palette.primary.dark,
      },
    },
    strategies_section: {
      display: 'flex',
      padding: `${vwCalculator(120)}`,
      alignItems: 'center',
    },
    auction_section: {
      display: 'flex',
      padding: `${vwCalculator(120)}`,
      alignItems: 'center',
      marginTop: '100px',
    },
    auction_section_left: {
      flex: 1,
    },
    footer: {
      display: 'flex',
      alignItems: 'center',
      padding: `40px ${vwCalculator(120)}`,
    },
    footer_links: {
      flex: '1',
      display: 'flex',
      gap: `${vwCalculator(36)}`,
    },
    footer_link: {
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
    footer_social: {
      display: 'flex',
      alignItems: 'center',
      gap: `${vwCalculator(9)}`,
    },
    social_icon: {
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

function LandingPage() {
  const classes = useStyles()
  const tvl = useTVL()

  return (
    <div className={classes.landing_page_container}>
      <div className={classes.nav}>
        <div className={classes.nav_logo}>
          <Link href={'/'} passHref>
            <Image src={logo} alt="logo" width={97} height={75} />
          </Link>
        </div>
        <div className={classes.nav_links}>
          {navLinks.map((link) => (
            <Typography variant="h3" className={classes.nav_link} key={link.label}>
              <Link href={link.link} passHref>
                {link.label}
              </Link>
            </Typography>
          ))}
          <div className={classes.nav_action}>
            <Link href={'/strategies/crab'} passHref>
              <Button className={classes.nav_start_earning}>Start Earning</Button>
            </Link>
          </div>
        </div>
      </div>
      <div className={classes.background1} />
      <div className={classes.background2} />
      <div className={classes.content}>
        <div className={classes.title_section}>
          <div className={classes.title_section_left}>
            <Typography variant="h1" className={classes.title_section_left_heading}>
              Stack your ETH
            </Typography>
            <Typography variant="h1" className={classes.title_section_left_heading}>
              & stables.
            </Typography>
            <div style={{ marginTop: '24px' }} />
            <Typography variant="h2" className={classes.title_section_left_subheading}>
              Investment strategies for DeFi.
            </Typography>
            <Typography variant="h2" className={classes.title_section_left_subheading}>
              Powered by squeeth.
            </Typography>
            <div style={{ marginTop: '39px' }} />
            <Link href={'/strategies/crab'} passHref>
              <Button className={classes.nav_start_earning}>Start Earning</Button>
            </Link>
          </div>
          <div className={classes.title_section_right}>
            <div className={classes.title_image}>
              <Image src={LandingTitle} alt="Title Image" />
            </div>
          </div>
        </div>
        <div className={classes.stat_section}>
          <div className={classes.stat_section_item}>
            <div className={clsx([classes.stat_section_title, classes.gradient_text])}>$16b+</div>
            <div className={classes.stat_section_subtitle}>Total Notional Volume</div>
          </div>
          <div className={classes.stat_section_item}>
            <div className={clsx([classes.stat_section_title, classes.gradient_text])}>${tvl}m+</div>
            <div className={classes.stat_section_subtitle}>Total Value Locked</div>
          </div>
        </div>
        <div className={classes.squeeth_section}>
          <div className={classes.content_section_left}>
            <div className={classes.content_section_left_header}>
              <div className={classes.content_section_left_header_image}>
                <Image src={logo} alt="logo" width={97} height={75} />
              </div>
              <Typography
                variant="h3"
                className={clsx([classes.content_section_left_header_label, classes.gradient_text])}
              >
                SQUEETH
              </Typography>
            </div>
            <div style={{ marginTop: '25px' }} />
            <Typography variant="h3" className={classes.content_section_left_title}>
              Leverage without liquidations.
            </Typography>
            <div style={{ marginTop: '41px' }} />
            <Typography variant="h3" className={classes.content_section_left_subtitle}>
              Bet on ETH with unlimited upside,
            </Typography>
            <Typography variant="h3" className={classes.content_section_left_subtitle}>
              protected downside, and no liquidations.
            </Typography>
            <div style={{ marginTop: '41px' }} />
            <Link href={'/squeeth'} passHref>
              <Button className={classes.content_section_button}>Trade Squeeth</Button>
            </Link>
          </div>
          <div className={classes.title_section_right}>
            <div className={classes.title_image}>
              <Image src={Squeeth} alt="Squeeth Image" />
            </div>
          </div>
        </div>
        <div className={classes.strategies_section}>
          <div className={classes.content_section_left}>
            <div className={classes.content_section_left_header}>
              <div className={classes.content_section_left_header_image}>
                <Image src={logo} alt="logo" width={97} height={75} />
              </div>
              <Typography
                variant="h3"
                className={clsx([classes.content_section_left_header_label, classes.gradient_text])}
              >
                STRATEGIES
              </Typography>
            </div>
            <div style={{ marginTop: '25px' }} />
            <Typography variant="h3" className={classes.content_section_left_title}>
              Earn returns on your crypto.
            </Typography>
            <div style={{ marginTop: '41px' }} />
            <Typography variant="h3" className={classes.content_section_left_subtitle}>
              ETH and USDC strategies to
            </Typography>
            <Typography variant="h3" className={classes.content_section_left_subtitle}>
              supercharge your portfolio.
            </Typography>
            <div style={{ marginTop: '41px' }} />
            <Link href={'/strategies/crab'} passHref>
              <Button className={classes.content_section_button}>Start Earning</Button>
            </Link>
          </div>
          <div className={classes.title_section_right}>
            <div className={classes.title_image}>
              <Image src={Strategies} alt="Strategies Image" />
            </div>
          </div>
        </div>
        <div className={classes.auction_section}>
          <div className={classes.auction_section_left}>
            <div className={classes.title_image}>
              <Image src={Auction} alt="Strategies Image" />
            </div>
          </div>
          <div className={classes.content_section_left}>
            <div className={classes.content_section_left_header}>
              <div className={classes.content_section_left_header_image}>
                <Image src={logo} alt="logo" width={97} height={75} />
              </div>
              <Typography
                variant="h3"
                className={clsx([classes.content_section_left_header_label, classes.gradient_text])}
              >
                AUCTION
              </Typography>
            </div>
            <div style={{ marginTop: '25px' }} />
            <Typography variant="h3" className={classes.content_section_left_title}>
              Trade squeeth in size.
            </Typography>
            <div style={{ marginTop: '41px' }} />
            <Typography variant="h3" className={classes.content_section_left_subtitle}>
              Participate in large, regular auctions to trade
            </Typography>
            <Typography variant="h3" className={classes.content_section_left_subtitle}>
              squeeth in size with low price impact.
            </Typography>
            <div style={{ marginTop: '41px' }} />
            <Link href={'https://squeethportal.xyz'} passHref>
              <Button className={classes.content_section_button}>Try Auction</Button>
            </Link>
          </div>
        </div>
        <div style={{ marginTop: '100px' }} />
      </div>
      <div className={classes.footer}>
        <div className={classes.footer_links}>
          {footerLinks.map((link) => (
            <Typography key={link.label} variant="h4" className={classes.footer_link}>
              <Link href={link.link} passHref>
                {link.label}
              </Link>
            </Typography>
          ))}
        </div>
        <div className={classes.footer_social}>
          <Image className={classes.social_icon} src={Twitter} alt="Opyn Twitter" />
          <Image className={classes.social_icon} src={Discord} alt="Opyn Discord" />
          <Image className={classes.social_icon} src={Github} alt="Opyn Github" />
          <Image className={classes.social_icon} src={Market} alt="Opyn Market" />
        </div>
      </div>
    </div>
  )
}

export default LandingPage
