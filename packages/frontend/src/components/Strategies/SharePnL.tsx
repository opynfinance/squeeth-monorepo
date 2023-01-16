import { Box, ButtonBase } from '@material-ui/core'
import React from 'react'
import TwitterIcon from '@material-ui/icons/Twitter'
import TelegramIcon from '@material-ui/icons/Telegram'
import { makeStyles, createStyles } from '@material-ui/core/styles'

const useStyles = makeStyles((theme) =>
  createStyles({
    buttonRoot: {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
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
      width: '13px',
      height: '13px',
    },
  }),
)

interface SharePnLProps {
  isPnlLoading: Boolean
  strategyName: 'crab' | 'zenbull'
  text: string
  sharePnlPageUrl: string
}

const SharePnL: React.FC<SharePnLProps> = ({ isPnlLoading, strategyName, text, sharePnlPageUrl }) => {
  const classes = useStyles()

  const strategyUrl = strategyName === 'crab' ? 'squeeth.com/strategies' : 'squeeth.com/strategies/bull'
  const strategyEmoji = strategyName === 'crab' ? '🦀' : '🧘🐂 '

  if (isPnlLoading) {
    return null
  }

  const postText = encodeURIComponent(`${text} at ${strategyUrl} ${strategyEmoji}`)

  const tweetHref = `https://twitter.com/intent/tweet?text=${postText}&url=${sharePnlPageUrl}`
  const telegramHref = `https://t.me/share/url?text=${postText}&url=${sharePnlPageUrl}`

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
