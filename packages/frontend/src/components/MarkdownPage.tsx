import ReactMarkdown from 'markdown-to-jsx'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import Box from '@material-ui/core/Box'
import Link from '@material-ui/core/Link'
import Typography from '@material-ui/core/Typography'

import Nav from '@components/Nav'

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

interface Props {
  markdown: string
}

export default function MarkdownPage({ markdown }: Props) {
  const classes = useStyles()
  return (
    <>
      <Nav />
      <main>
        <div className={classes.container}>
          <ReactMarkdown options={options}>{markdown}</ReactMarkdown>
        </div>
      </main>
    </>
  )
}
