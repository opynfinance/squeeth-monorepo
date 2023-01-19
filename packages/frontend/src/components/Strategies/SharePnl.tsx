import { Box, ButtonBase, Tooltip } from '@material-ui/core'
import React from 'react'
import TwitterIcon from '@material-ui/icons/Twitter'
import TelegramIcon from '@material-ui/icons/Telegram'
import { makeStyles, createStyles } from '@material-ui/core/styles'

import { formatNumber } from '@utils/formatter'
import { SQUEETH_BASE_URL } from '@constants/index'

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

interface SharePnlProps {
  isPnlLoading: Boolean
  strategy: 'crab' | 'zenbull'
  pnl: number
  firstDepositTimestamp: number
}

const SharePnl: React.FC<SharePnlProps> = ({ isPnlLoading, strategy, pnl, firstDepositTimestamp }) => {
  const classes = useStyles()

  return <></>

  if (isPnlLoading) {
    return null
  }

  const pnlFormatted = formatNumber(pnl)
  const pnlText = pnl > 0 ? `+${pnlFormatted}%` : `${pnlFormatted}%`

  const isCrab = strategy === 'crab'

  const strategyEmoji = isCrab ? '🦀' : '🧘🐂 '
  const text = isCrab
    ? `I'm earning ${pnlText} USDC with the Opyn Crab Strategy`
    : `I'm earning ${pnlText} stacking ETH with the Opyn Zen Bull Strategy`
  const twitterText = isCrab
    ? `I'm earning ${pnlText} USDC with the @opyn_ Crab Strategy`
    : `I'm earning ${pnlText} stacking ETH with the @opyn_ Zen Bull Strategy`
  const pageUrl = `${SQUEETH_BASE_URL}/share-pnl/${strategy}/${firstDepositTimestamp}/${pnlFormatted}`

  const postText = encodeURIComponent(`${text} ${strategyEmoji}`)
  const tweetText = encodeURIComponent(`${twitterText} ${strategyEmoji}`)
  const encodedUrl = encodeURIComponent(pageUrl)

  const tweetHref = `https://twitter.com/intent/tweet?text=${tweetText}&url=${encodedUrl}`
  const telegramHref = `https://t.me/share/url?text=${postText}&url=${encodedUrl}`

  return (
    <Box display="flex" gridGap="8px" alignItems="center">
      <ButtonBase classes={{ root: classes.buttonRoot }} href={tweetHref} target="_blank">
        <Tooltip title="Share your PnL on Twitter" placement="top">
          <TwitterIcon className={classes.icon} />
        </Tooltip>
      </ButtonBase>

      <ButtonBase classes={{ root: classes.buttonRoot }} href={telegramHref} target="_blank">
        <Tooltip title="Share your PnL on Telegram" placement="top">
          <TelegramIcon className={classes.icon} />
        </Tooltip>
      </ButtonBase>
    </Box>
  )
}

export default SharePnl
