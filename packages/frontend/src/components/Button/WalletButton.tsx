import { ConnectButton } from '@rainbow-me/rainbowkit'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import '@rainbow-me/rainbowkit/styles.css'

const useStyles = makeStyles((theme) =>
  createStyles({
    walletBox: {
      [theme.breakpoints.up('md')]: {
        marginLeft: theme.spacing(1),
      },
    },
  }),
)

export const WalletButton = () => {
  const classes = useStyles()
  return (
    <div className={classes.walletBox}>
      <ConnectButton />
    </div>
  )
}

export default WalletButton
