import { Box, Link } from '@material-ui/core'
import { useAtomValue, useAtom } from 'jotai'
import { useState } from 'react'

import { useRestrictUser } from '@context/restrict-user'
import { Modal } from './Modal/Modal'
import {
  connectedWalletAtom,
  isStrikeCountModalOpenAtom,
  addressStrikeCountAtom,
  isWalletLoadingAtom,
} from '@state/wallet/atoms'

interface StrikeWarningModalProps {
  setIsStrikeModalShown: (value: boolean) => void
}

const StrikeWarningModal: React.FC<StrikeWarningModalProps> = ({ setIsStrikeModalShown }) => {
  const [isOpen, setIsOpen] = useState(true)

  const onClose = () => {
    setIsOpen(false)
    setIsStrikeModalShown(true)
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
  setIsStrikeModalShown: (value: boolean) => void
}

const StrikeCountModal: React.FC<StrikeCountModalProps> = ({ setIsStrikeModalShown }) => {
  const addressStrikeCount = useAtomValue(addressStrikeCountAtom)
  const [isStrikeCountModalOpen, setIsStrikeCountModalOpen] = useAtom(isStrikeCountModalOpenAtom)

  const onClose = () => {
    setIsStrikeCountModalOpen(false)
    setIsStrikeModalShown(true)
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
  const isWalletConnected = useAtomValue(connectedWalletAtom)
  const isWalletLoading = useAtomValue(isWalletLoadingAtom)

  const [isStrikeModalShown, setIsStrikeModalShown] = useState(false)
  const { isRestricted } = useRestrictUser()

  if (isRestricted && !isWalletLoading) {
    if (isWalletConnected) {
      return <StrikeCountModal setIsStrikeModalShown={setIsStrikeModalShown} />
    }

    if (!isStrikeModalShown) {
      return <StrikeWarningModal setIsStrikeModalShown={setIsStrikeModalShown} />
    }
  }

  return null
}
