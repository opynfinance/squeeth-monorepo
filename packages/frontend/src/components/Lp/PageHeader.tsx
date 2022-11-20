import { makeStyles, createStyles } from '@material-ui/core/styles'
import { Typography } from '@material-ui/core'

const useStyles = makeStyles((theme) =>
  createStyles({
    root: {
      border: `2px solid ${theme.palette.background.lightStone}`,
      borderLeft: 0,
      borderRight: 0,
      backgroundImage: 'url("/images/header-background.svg")',
      backgroundRepeat: 'no-repeat',
      backgroundSize: 'cover',
      backgroundColor: 'rgba(112, 227, 246, 0.02)',
    },
    container: {
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      padding: theme.spacing(10),
      maxWidth: '1500px',
      width: '95%',
      marginLeft: 'auto',
      marginRight: 'auto',
    },
    title: {
      fontWeight: 700,
      fontSize: '32px',
      letterSpacing: '-0.02em',
    },
    subtitle: {
      color: theme.palette.grey[400],
      fontWeight: 400,
      fontSize: '18px',
    },
  }),
)

const PageHeader: React.FC = () => {
  const classes = useStyles()

  return (
    <div className={classes.root}>
      <div className={classes.container}>
        <Typography variant="h1" className={classes.title}>
          Deposit ERC-20s, earn ETH.
        </Typography>
        <Typography variant="subtitle1" className={classes.subtitle}>
          Provide liquidity to earn interest through fees and funding.
        </Typography>
      </div>
    </div>
  )
}

export default PageHeader
