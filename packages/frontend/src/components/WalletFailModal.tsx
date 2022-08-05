import { Box } from '@material-ui/core'
import { useAtom } from 'jotai'
import { walletFailVisibleAtom } from 'src/state/wallet/atoms'
import { Modal } from './Modal/Modal'

export default function WalletFailModal() {
  const [visible, setVisible] = useAtom(walletFailVisibleAtom)

  return (
    <Modal title="Wallet connect failed" open={visible} handleClose={() => setVisible(false)}>
      <Box px="10px">
        Unable to connect wallet for failure to comply with the Terms of Service (link).
        <br />
        For more information see the Updated Terms FAQ (link)
      </Box>
    </Modal>
  )
}
