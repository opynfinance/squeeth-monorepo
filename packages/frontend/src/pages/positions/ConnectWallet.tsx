import { useSelectWallet } from 'src/state/wallet/hooks'
import { LinkButton } from '../../components/Button'
import Nav from '../../components/Nav'
import useStyles from './useStyles'

const ConnectWallet: React.FC = () => {
  const selectWallet = useSelectWallet()
  const classes = useStyles()

  return (
    <div>
      <Nav />
      <div className={classes.container}>
        <LinkButton style={{ margin: 'auto' }} onClick={selectWallet}>
          Connect Wallet
        </LinkButton>
      </div>
    </div>
  )
}

export default ConnectWallet
