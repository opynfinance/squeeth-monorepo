import { Button, createStyles, makeStyles } from '@material-ui/core'

import Typography from '@material-ui/core/Typography'
import crabRave from '../public/images/crab-rave.gif'
import Image from 'next/image'
import Nav from '@components/Nav'
import { Links } from '@constants/enums'

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
      height: '90vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      gap: '10px',
      padding: theme.spacing(4),
    },
    logoTitle: {
      [theme.breakpoints.down('sm')]: {
        fontSize: 18,
      },
      margin: `${theme.spacing(1)}px 0 ${theme.spacing(1)}px 0`,
      textAlign: 'center',
    },
    info: {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      textAlign: 'center',
    },
  }),
)

export function Vault() {
  const classes = useStyles()

  return (
    <div>
      <Nav />
      <div className={classes.container}>
        <Image src={crabRave} alt="squeeth token" width={200} height={130} />
        <Typography variant="h5" className={classes.logoTitle}>
          Strategies Coming Jan 24!
        </Typography>
        <div className={classes.info}>
          <a
            href="https://twitter.com/wadepros/status/1476973710150152194?s=20"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button style={{ color: '#000', textTransform: 'none' }} variant="contained" color="primary">
              <span>Learn more</span>
            </Button>
          </a>
        </div>
        <div className={classes.info}>
          <a
            href="https://opyn.gitbook.io/squeeth/resources/squeeth-strategies-faq"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button style={{ color: '#000', textTransform: 'none' }} variant="contained" color="primary">
              <span>Strategy FAQ</span>
            </Button>
          </a>
        </div>
      </div>
    </div>
  )
}

export default Vault
