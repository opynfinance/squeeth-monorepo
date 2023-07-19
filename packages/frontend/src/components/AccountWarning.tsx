import { Box, Link } from '@material-ui/core'
import { useAtom } from 'jotai'
import { walletFailVisibleAtom } from 'src/state/wallet/atoms'
import { Modal } from './Modal/Modal'
import { useRestrictUser } from '@context/restrict-user'
import { useState } from 'react'

export default function AccountWarning() {
  const { isRestricted } = useRestrictUser()
  const [showWarning, setShowWarning] = useState(true)

  return (
    <Modal
      title="You're accessing for restricted region"
      open={isRestricted && showWarning}
      handleClose={() => setShowWarning(false)}
    >
      <Box px="10px">
        You are connecting from a restricted region. Please read the{' '}
        <Link href="https://opyn.co/terms-of-service" target="_blank">
          Terms of Service
        </Link>
        . If connected 3 times from a restricted region, your account will be blocked .
      </Box>
    </Modal>
  )
}
