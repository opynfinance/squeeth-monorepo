import ReactMarkdown from 'markdown-to-jsx'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import Box from '@material-ui/core/Box'
import Link from '@material-ui/core/Link'
import Typography from '@material-ui/core/Typography'
import { NextSeo } from 'next-seo'

import Nav from '@components/Nav'
import { getMarkdown } from '@utils/markdown'
import { SQUEETH_BASE_URL } from '@constants/index'

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
      width: '90%',
      margin: '7em auto 3em',
      maxWidth: '900px',
      paddingBottom: '1em',
    },
    subHeading: {
      fontWeight: theme.typography.fontWeightBold,
    },
  }),
)

function MarkdownListItem(props: any) {
  return <Box component="li" sx={{ mt: 1, fontSize: 15 }} {...props} />
}

const options = {
  overrides: {
    h1: {
      component: Typography,
      props: {
        gutterBottom: true,
        variant: 'h4',
        component: 'h1',
      },
    },
    h2: {
      component: Typography,
      props: { gutterBottom: true, component: 'h2' },
    },
    h3: {
      component: Typography,
      props: { gutterBottom: true, variant: 'h5', component: 'div' },
    },
    h4: {
      component: Typography,
      props: {
        gutterBottom: true,
        variant: 'h6',
        paragraph: true,
      },
    },
    h5: {
      component: Typography,
      props: {
        gutterBottom: true,
        // variant: 'h6',
        paragraph: true,
        fontSize: 10,
        fontWeight: 600,
      },
    },
    p: {
      component: Typography,
      props: { paragraph: true },
    },
    a: { component: Link },
    li: {
      component: MarkdownListItem,
    },
  },
}

const PrivacyPolicy = (props: any) => {
  const classes = useStyles()
  return (
    <>
      <NextSeo
        title="Opyn"
        description="Opyn builds DeFi strategies and derivatives like squeeth, a new financial primitive providing perpetual leverage without liquidations"
        canonical={SQUEETH_BASE_URL}
        openGraph={{
          images: [
            {
              url: SQUEETH_BASE_URL + '/images/squeeth-og-image.png',
              width: 1200,
              height: 630,
              alt: 'Squeeth',
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
      <main>
        <div className={classes.container}>
          <ReactMarkdown options={options}>{props.file}</ReactMarkdown>
        </div>
      </main>
    </>
  )
}

export async function getStaticProps() {
  const file = getMarkdown('privacy-policy')

  return { props: { file } }
}

export default PrivacyPolicy
