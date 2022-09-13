import { Box, Link } from '@material-ui/core'
import React, { useEffect, useState } from 'react'
import { GreyButton } from './Button'
import { Modal } from './Modal/Modal'

const ANNOUNCEMENT_KEY = 'DISABLE_MERGE_ANNOUNCEMENT'

const Announcement: React.FC = () => {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const _disableAnnouncemnt = localStorage.getItem(ANNOUNCEMENT_KEY)
    setVisible(!_disableAnnouncemnt)
  }, [])

  const dontShowAgain = () => {
    setVisible(false)
    localStorage.setItem(ANNOUNCEMENT_KEY, 'true')
  }

  return (
    <Modal title="POS Merge Announcement" open={visible} handleClose={() => setVisible(false)}>
      <Box px="10px">
        The Merge is coming.{' '}
        <Link href="/pos-merge" target="_blank">
          Read more here about what Opyn users should know about the merge
        </Link>
        .
      </Box>
      <GreyButton onClick={dontShowAgain}>Don&apos;t show again</GreyButton>
    </Modal>
  )
}

export default Announcement
