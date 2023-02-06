import { Typography } from '@material-ui/core'
import { useAtomValue } from 'jotai'

import { supportedNetworkAtom } from '@state/wallet/atoms'
import { useSelectWallet } from '@state/wallet/hooks'
import { LinkButton } from '@components/Button'
import useStyles from './useStyles'

const ConnectWallet: React.FC = () => {
  const selectWallet = useSelectWallet()
  const classes = useStyles()
  const supportedNetwork = useAtomValue(supportedNetworkAtom)

  return (
    <div>
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
