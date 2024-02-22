import React from 'react'
import { Typography } from '@material-ui/core'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import { NextSeo } from 'next-seo'

import AthenaBackgroundImg from 'public/images/landing/athena1-desktop.png'
import { Nav } from '@components/Nav/Basic'
import { SiteMetaDescription, SiteMetaImage, SQUEETH_BASE_URL } from '@constants/index'

const useStyles = makeStyles((theme) =>
  createStyles({
    athenaBackground: {
      position: 'absolute',
      backgroundImage: `url(${AthenaBackgroundImg.src})`,
      height: `calc(100vh - 160px)`,
      width: '100vw',
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'right',
      backgroundSize: 'contain',
      zIndex: -1,
      [theme.breakpoints.up('md')]: {
        height: `calc(100vh - 120px)`,
      },
    },
    content: {
      width: '85%',
      margin: '3em auto 3em',
      paddingBottom: '1em',
    },
    heading: {
      fontSize: '32px',
      fontWeight: 700,
      letterSpacing: '-0.02em',
      lineHeight: '130%',
    },

    ul: {
      listStyleType: 'upper-roman',
      fontSize: '16px',
      padding: 0,
      paddingLeft: '1em',
      margin: 0,
      marginTop: '2em',
      color: theme.palette.text.hint,
      '& li': {
        marginBottom: '1.5em',
        fontSize: '20px',
      },
      [theme.breakpoints.up('md')]: {
        '& li': {
          marginBottom: '2em',
        },
      },
    },
    liContainer: {
      paddingLeft: 4,
    },
    link: {
      display: 'inline-block',
      color: theme.palette.primary.main,
      fontWeight: 500,
      fontSize: '18px',
      fontFamily: 'DM Sans',
      marginTop: theme.spacing(0.5),

      '&:hover': {
        color: theme.palette.primary.dark,
        textDecoration: 'underline',
      },
      [theme.breakpoints.up('md')]: {
        fontSize: '24px',
      },
    },
    subtext: {
      fontSize: '14px',
      fontWeight: 500,
      fontFamily: 'DM Mono',
      color: theme.palette.text.hint,
      maxWidth: '80%',
      [theme.breakpoints.up('md')]: {
        fontSize: '16px',
        maxWidth: '600px',
      },
    },
    authors: {
      fontWeight: 700,
    },
  }),
)

const RESEARCH_PAPERS = [
  {
    id: 1,
    title: 'Power Perpetuals',
    link: 'https://www.paradigm.xyz/2021/08/power-perpetuals',
    authors: ['Dave White', 'Dan Robinson', 'Zubin Koticha', 'Andrew Leone', 'Alexis Gauba', 'Aparna Krishnan'],
    date: 'Aug 17, 2021',
  },
  {
    id: 2,
    title: 'Squeeth Mechanism',
    link: 'https://medium.com/opyn/squeeth-insides-volume-1-funding-and-volatility-f16bed146b7d',
    authors: ['Joseph Clark'],
    date: 'Dec 21, 2021',
  },
  {
    id: 3,
    title: 'Squeeth Primer',
    link: 'https://medium.com/opyn/squeeth-primer-a-guide-to-understanding-opyns-implementation-of-squeeth-a0f5e8b95684',
    authors: ['Wade Prospere'],
    date: 'Jan 10, 2022',
  },
  // add more papers as needed
]

function ResearchPage() {
  const classes = useStyles()

  return (
    <div>
      <NextSeo
        title={'Opyn | Research'}
        description={SiteMetaDescription}
        canonical={SQUEETH_BASE_URL}
        openGraph={{
          images: [
            {
              url: SiteMetaImage,
              width: 1200,
              height: 630,
              alt: 'Opyn',
            },
          ],
        }}
        twitter={{
          handle: '@opyn_',
          site: '@opyn_',
          cardType: 'summary_large_image',
        }}
      />
      <Nav />

      <div className={classes.athenaBackground} />

      <div className={classes.content}>
        <Typography variant="h3" className={classes.heading}>
          Research
        </Typography>

        <ul className={classes.ul}>
          {RESEARCH_PAPERS.map((paper) => (
            <li key={paper.id}>
              <div className={classes.liContainer}>
                <a href={paper.link} target="_blank" rel="noopener noreferrer">
                  <Typography className={classes.link}>{paper.title}</Typography>
                </a>
                <Typography className={classes.subtext}>
                  by <span className={classes.authors}>{paper.authors.join(', ')}</span> on <b>{paper.date}</b>
                </Typography>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export default ResearchPage
