import { Box, ButtonBase } from '@material-ui/core'
import React, { memo } from 'react'
import TwitterIcon from '@material-ui/icons/Twitter'
import TelegramIcon from '@material-ui/icons/Telegram'
import { makeStyles, createStyles } from '@material-ui/core/styles'

import { formatNumber } from '@utils/formatter'

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

const SharePnL: React.FC<{ pnlPercent: number }> = ({ pnlPercent }) => {
  const classes = useStyles()

  const pnl = formatNumber(pnlPercent)
  const pnlText = pnlPercent > 0 ? `+${pnl}%` : `${pnl}%`

  const url = 'squeeth.com/strategies/bull'
  const text = `I’m earning ${pnlText} stacking ETH with the Opyn Zen Bull Strategy`

  const tweetText = encodeURIComponent(`${text} at ${url} 🧘🐂`)
  const telegramText = encodeURIComponent(`${text} 🧘🐂`)
  const tweetHref = `https://twitter.com/intent/tweet?text=${tweetText}`
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
