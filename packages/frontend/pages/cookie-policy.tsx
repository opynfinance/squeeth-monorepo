import { createStyles, makeStyles } from '@material-ui/core/styles'

import Nav from '@components/Nav'
import CookiePolicy from '../src/components/CookiePolicy'
import Link from 'next/link'

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
      width: '90%',
      margin: '3em ',
      maxWidth: '900px',
      marginBottom: '0',
      paddingBottom: '1em',
    },
    subHeading: {
      fontWeight: theme.typography.fontWeightBold,
    },
    main: {
      display: 'flex',
      fontSize: '1rem',
    },
    subTopics: {
      display: 'block',
      height: '90vh',
      borderRight: '1px solid white',
      paddingTop: '3em ',
      position: 'sticky',
      top: '9%',
      [theme.breakpoints.down('xs')]: {
        display: 'none',
      },
    },
    list: {
      width: '95%',
    },
    listItem: {
      marginBottom: '1em',
      '&:hover,&:focus': {
        color: '#2ce6f9',
        textDecoration: 'underline',
      },
    },
  }),
)

const CP = () => {
  const classes = useStyles()
  return (
    <>
      <Nav />
      <main className={classes.main}>
        <div className={classes.subTopics}>
          <ul className={classes.list}>
            <li className={classes.listItem}>
              <Link href="#what-is-a-tracker">
                <a>What is a Tracker</a>
              </Link>
            </li>
            <li className={classes.listItem}>
              <Link href="#what-do-trackers-do">
                <a> What Trackers Does the Interface Use</a>
              </Link>
            </li>
            <li className={classes.listItem}>
              <Link href="#how-do-i-manage">
                <a> How Do I Manage Trackers?</a>
              </Link>
            </li>
          </ul>
        </div>
        <div className={classes.container}>
          <CookiePolicy />
        </div>
      </main>
    </>
  )
}

export default CP
