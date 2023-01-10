import { Box, ButtonBase } from '@material-ui/core'
import React, { memo } from 'react'
import TwitterIcon from '@material-ui/icons/Twitter'
import TelegramIcon from '@material-ui/icons/Telegram'
import { makeStyles, createStyles } from '@material-ui/core/styles'

const useStyles = makeStyles((theme) =>
  createStyles({
    buttonRoot: {
      border: '1px solid #fff',
      borderRadius: '100%',
      width: '26px',
      height: '26px',
      backgroundColor: '#101010',
      '&:hover': {
        backgroundColor: theme.palette.background.lightStone,
      },
      transition: 'background-color 0.1s ease-in',
    },
    icon: {
      width: '14px',
      height: '14px',
    },
  }),
)

interface SharePnLProps {
  isPnlLoading: Boolean
  text: string
  url: string
}

const SharePnL: React.FC<SharePnLProps> = ({ isPnlLoading, text, url }) => {
  const classes = useStyles()

  if (isPnlLoading) {
    return null
  }

  const tweetText = encodeURIComponent(`${text} at ${url} 🦀`)
  const tweetHref = `https://twitter.com/intent/tweet?text=${tweetText}`

  const telegramText = encodeURIComponent(`${text} 🦀`)
  const telegramHref = `https://t.me/share/url?url=https://${url}&text=${telegramText}`

  return (
    <Box display="flex" gridGap="8px" alignItems="center">
      <ButtonBase classes={{ root: classes.buttonRoot }} href={tweetHref} target="_blank">
        <TwitterIcon className={classes.icon} />
      </ButtonBase>

      <ButtonBase classes={{ root: classes.buttonRoot }} href={telegramHref} target="_blank">
        <TelegramIcon className={classes.icon} />
      </ButtonBase>
    </Box>
  )
}

export default SharePnL
