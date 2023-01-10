import { Typography, Box, CircularProgress, ButtonBase } from '@material-ui/core'
import React, { memo } from 'react'
import clsx from 'clsx'
import ArrowDropUpIcon from '@material-ui/icons/ArrowDropUp'
import ArrowDropDownIcon from '@material-ui/icons/ArrowDropDown'
import TwitterIcon from '@material-ui/icons/Twitter'
import TelegramIcon from '@material-ui/icons/Telegram'
import { useAtomValue } from 'jotai'
import { makeStyles, createStyles } from '@material-ui/core/styles'

import {
  bullCurrentETHPositionAtom,
  bullCurrentUSDCPositionAtom,
  bullEthPnlAtom,
  bullEthPnlPerctAtom,
  bullPositionLoadedAtom,
  isBullPositionRefetchingAtom,
} from '@state/bull/atoms'
import useStyles from '@components/Strategies/styles'
import { formatCurrency, formatNumber } from '@utils/formatter'

const useSharePnLStyles = makeStyles((theme) =>
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
  const classes = useSharePnLStyles()

  const pnl = formatNumber(pnlPercent)
  const pnlText = pnlPercent > 0 ? `+${pnl}%` : `${pnl}%`
  const tweetText = encodeURIComponent(
    `I’m earning ${pnlText} stacking USDC with the Opyn Crab Strategy at squeeth.com/strategies 🦀`,
  )
  const postTweetHref = `https://twitter.com/intent/tweet?text=${tweetText}`

  return (
    <Box display="flex" gridGap="8px" alignItems="center">
      <ButtonBase classes={{ root: classes.buttonRoot }} href={postTweetHref} target="_blank">
        <TwitterIcon className={classes.icon} />
      </ButtonBase>

      <ButtonBase classes={{ root: classes.buttonRoot }}>
        <TelegramIcon className={classes.icon} />
      </ButtonBase>
    </Box>
  )
}

const BullPosition: React.FC = () => {
  const bullPosition = useAtomValue(bullCurrentETHPositionAtom)
  const bullUsdcPosition = useAtomValue(bullCurrentUSDCPositionAtom)
  const bullEthPnL = useAtomValue(bullEthPnlAtom)
  const bullEthPnlPerct = useAtomValue(bullEthPnlPerctAtom)
  const classes = useStyles()

  const loading = !useAtomValue(bullPositionLoadedAtom)
  const isPositionRefetching = useAtomValue(isBullPositionRefetchingAtom)

  if (bullPosition.isZero() && !isPositionRefetching) {
    return null
  }

  if (loading || isPositionRefetching) {
    return (
      <Box display="flex" alignItems="flex-start" marginTop="8px" height="98px">
        <Box display="flex" alignItems="center" gridGap="20px">
          <CircularProgress size="1.25rem" className={classes.loadingSpinner} />
          <Typography className={classes.text}>Fetching current position...</Typography>
        </Box>
      </Box>
    )
  }

  const isPnlPositive = bullEthPnL.isGreaterThanOrEqualTo(0)

  return (
    <Box display="flex" flexDirection="column" gridGap="12px">
      <Box display="flex" flexDirection="column" gridGap="8px">
        <Typography variant="h4" className={classes.sectionTitle}>
          My Zen Bull Position
        </Typography>

        <Box display="flex" gridGap="12px" alignItems="baseline">
          <Typography className={clsx(classes.heading, classes.textMonospace)}>
            {formatNumber(bullPosition.toNumber(), 4) + ' ETH'}
          </Typography>
          <Typography className={clsx(classes.description, classes.textMonospace)}>
            {formatCurrency(bullUsdcPosition.toNumber())}
          </Typography>
        </Box>

        <Box display="flex" alignItems="center" gridGap="8px">
          {bullEthPnL.isFinite() ? (
            <>
              <Box display="flex" marginLeft="-6px">
                {isPnlPositive ? (
                  <ArrowDropUpIcon className={classes.colorSuccess} />
                ) : (
                  <ArrowDropDownIcon className={classes.colorError} />
                )}

                <Typography
                  className={clsx(
                    classes.description,
                    classes.textSemibold,
                    classes.textMonospace,
                    isPnlPositive ? classes.colorSuccess : classes.colorError,
                  )}
                >
                  {formatNumber(bullEthPnlPerct.toNumber()) + '%'}
                </Typography>
              </Box>

              <Typography
                className={clsx(
                  classes.description,
                  classes.textSemibold,
                  classes.textMonospace,
                  isPnlPositive ? classes.colorSuccess : classes.colorError,
                )}
              >
                ({isPnlPositive && '+'}
                {formatNumber(bullEthPnL.toNumber(), 4) + ' ETH'})
              </Typography>
              <Typography className={classes.description}>since deposit</Typography>
            </>
          ) : (
            <Box display="flex" alignItems="center" gridGap="12px">
              <CircularProgress size="1rem" className={classes.loadingSpinner} />
              <Typography className={classes.text}>fetching pnl...</Typography>
            </Box>
          )}
        </Box>
      </Box>

      <SharePnL pnlPercent={bullEthPnlPerct.toNumber()} />
    </Box>
  )
}

export default memo(BullPosition)
