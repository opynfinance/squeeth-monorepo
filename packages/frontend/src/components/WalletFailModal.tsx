import { Box, Link } from '@material-ui/core'
import { useAtom } from 'jotai'
import { walletFailVisibleAtom } from 'src/state/wallet/atoms'
import { Modal } from './Modal/Modal'

export default function WalletFailModal() {
  const [visible, setVisible] = useAtom(walletFailVisibleAtom)

  return (
    <Modal title="Wallet connect failed" open={visible} handleClose={() => setVisible(false)}>
      <Box px="10px">
        Unable to connect wallet for failure to comply with the{' '}
        <Link href="https://squeeth.opyn.co/terms-of-service" target="_blank">
          Terms of Service
        </Link>
        .
        <br />
        For more information see the{' '}
        <Link href="https://opyn.gitbook.io/squeeth/resources/squeeth-faq" target="_blank">
          Updated Terms FAQ
        </Link>
        .
      </Box>
    </Modal>
  )
}
