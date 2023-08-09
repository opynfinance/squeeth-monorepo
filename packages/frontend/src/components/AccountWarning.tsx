import { Box, Link } from '@material-ui/core'
import { Modal } from './Modal/Modal'
import { useRestrictUser } from '@context/restrict-user'
import { useState } from 'react'

export default function AccountWarning() {
  const { isRestricted } = useRestrictUser()
  const [showWarning, setShowWarning] = useState(true)

  return (
    <Modal
      title="You are accessing from a restricted territory"
      open={isRestricted && showWarning}
      handleClose={() => setShowWarning(false)}
    >
      <Box px="10px">
        If your wallet attempts to connect 3 times from a restricted territory, your wallet address will be blocked.
        Please read the{' '}
        <Link href="https://opyn.co/terms-of-service" target="_blank">
          Terms of Service
        </Link>
      </Box>
    </Modal>
  )
}
