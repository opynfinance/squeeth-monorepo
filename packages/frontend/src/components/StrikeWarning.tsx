import { Box, Link } from '@material-ui/core'
import { useAtomValue, useAtom } from 'jotai'
import { useState, useEffect } from 'react'

import { useRestrictUser } from '@context/restrict-user'
import { Modal } from './Modal/Modal'
import { connectedWalletAtom, isStrikeCountModalOpenAtom, addressStrikeCountAtom } from '@state/wallet/atoms'

interface StrikeWarningModalProps {
  setIsStrikeModalShownOnce: (value: boolean) => void
}

const StrikeWarningModal: React.FC<StrikeWarningModalProps> = ({ setIsStrikeModalShownOnce }) => {
  const [isOpen, setIsOpen] = useState(true)

  const onClose = () => {
    setIsOpen(false)
    setIsStrikeModalShownOnce(true)
  }

  return (
    <Modal title="You are accessing from a restricted territory" open={isOpen} handleClose={onClose}>
      <Box px="4px">
        Any attempt to connect your wallet, including page refreshes, will be considered a strike. After three strikes,
        your wallet address will be blocked.
        <br />
        <br />
        Please be aware that refreshing the page will not resolve the issue, but will instead count towards your
        strikes. Review our{' '}
        <Link href="https://opyn.co/terms-of-service" target="_blank">
          Terms of Service
        </Link>{' '}
        for more details.
      </Box>
    </Modal>
  )
}

interface StrikeCountModalProps {
  setIsStrikeModalShownOnce: (value: boolean) => void
}

const StrikeCountModal: React.FC<StrikeCountModalProps> = ({ setIsStrikeModalShownOnce }) => {
  const addressStrikeCount = useAtomValue(addressStrikeCountAtom)
  const [isStrikeCountModalOpen, setIsStrikeCountModalOpen] = useAtom(isStrikeCountModalOpenAtom)

  const onClose = () => {
    setIsStrikeCountModalOpen(false)
    setIsStrikeModalShownOnce(true)
  }

  return (
    <Modal title="Strike Count Warning" open={isStrikeCountModalOpen} handleClose={onClose}>
      <Box px="4px">
        You currently have {addressStrikeCount} strike(s). Be aware that after three strikes, your wallet address will
        be blocked.
        <br />
        <br />
        Please review our{' '}
        <Link href="https://opyn.co/terms-of-service" target="_blank">
          Terms of Service
        </Link>{' '}
        for more details.
      </Box>
    </Modal>
  )
}

export default function StrikeModalManager() {
  const [showModal, setShowModal] = useState(false)
  const isWalletConnected = useAtomValue(connectedWalletAtom)
  const [isStrikeModalShownOnce, setIsStrikeModalShownOnce] = useState(false)
  const { isRestricted } = useRestrictUser()

  // delayed state change - show modal after 2 seconds
  // this is because it takes some time to automatically connect the wallet (incase previously connected)
  useEffect(() => {
    if (isRestricted) {
      const timerId = setTimeout(() => setShowModal(true), 2_000)
      // cleanup function to clear the timeout if the component is unmounted before the delay is over.
      return () => clearTimeout(timerId)
    }
  }, [isRestricted])

  if (showModal) {
    if (isWalletConnected) {
      return <StrikeCountModal setIsStrikeModalShownOnce={setIsStrikeModalShownOnce} />
    }
    if (!isStrikeModalShownOnce) {
      return <StrikeWarningModal setIsStrikeModalShownOnce={setIsStrikeModalShownOnce} />
    }
  }
  return null
}
