import { Box, createStyles, IconButton, Link, makeStyles, Typography } from '@material-ui/core'
import React, { useEffect, useState } from 'react'
import CloseIcon from '@material-ui/icons/Close'

const ANNOUNCEMENT_KEY = 'DISABLE_MERGE_ANNOUNCEMENT'

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
      backgroundColor: theme.palette.background.lightStone,
      padding: theme.spacing(1, 0),
      display: 'flex',
      justifyContent: 'center',
    },
  }),
)

const Announcement: React.FC = () => {
  const styles = useStyles()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const _disableAnnouncemnt = localStorage.getItem(ANNOUNCEMENT_KEY)
    setVisible(!_disableAnnouncemnt)
  }, [])

  const dontShowAgain = () => {
    setVisible(false)
    localStorage.setItem(ANNOUNCEMENT_KEY, 'true')
  }

  if (!visible) return null

  return (
    <Box py="8" className={styles.container}>
      <Typography align="center" variant="body2" component="span">
        The Merge is coming. Read more about what Opyn users should know about the merge{' '}
        <Link href="/pos-merge" target="_blank">
          here
        </Link>
        .{' '}
        <IconButton onClick={dontShowAgain} aria-label="close" size="small">
          <CloseIcon fontSize="small" style={{ color: '#fff' }} />
        </IconButton>
      </Typography>
    </Box>
  )
}

export default Announcement
