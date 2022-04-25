import { Typography } from '@material-ui/core'
import { useAtomValue } from 'jotai'
import { supportedNetworkAtom } from 'src/state/wallet/atoms'
import { useSelectWallet } from 'src/state/wallet/hooks'
import { LinkButton } from '../../components/Button'
import Nav from '../../components/Nav'
import useStyles from './useStyles'

const ConnectWallet: React.FC = () => {
  const selectWallet = useSelectWallet()
  const classes = useStyles()
  const supportedNetwork = useAtomValue(supportedNetworkAtom)

  return (
    <div>
      <Nav />
      <div className={classes.container}>
        {supportedNetwork ? (
          <LinkButton style={{ margin: 'auto' }} onClick={selectWallet}>
            Connect Wallet
          </LinkButton>
        ) : (
          <Typography>Unsupported Network</Typography>
        )}
      </div>
    </div>
  )
}

export default ConnectWallet
