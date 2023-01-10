import { Typography, Box, CircularProgress } from '@material-ui/core'
import React, { memo } from 'react'
import clsx from 'clsx'
import ArrowDropUpIcon from '@material-ui/icons/ArrowDropUp'
import ArrowDropDownIcon from '@material-ui/icons/ArrowDropDown'
import { useAtomValue } from 'jotai'

import { bullEthPnlAtom, bullEthPnlPerctAtom } from '@state/bull/atoms'
import useStyles from '@components/Strategies/styles'
import { formatNumber } from '@utils/formatter'
import SharePnL from '@components/Strategies/SharePnL'

const PnL: React.FC = () => {
  const bullEthPnL = useAtomValue(bullEthPnlAtom)
  const bullEthPnlPerct = useAtomValue(bullEthPnlPerctAtom)
  const classes = useStyles()

  const isPnlLoading = !bullEthPnL.isFinite()

  if (isPnlLoading) {
    return (
      <Box display="flex" alignItems="center" gridGap="12px">
        <CircularProgress size="1rem" className={classes.loadingSpinner} />
        <Typography className={classes.text}>fetching pnl...</Typography>
      </Box>
    )
  }

  const pnlPercent = bullEthPnlPerct.toNumber()
  const pnlFormatted = formatNumber(pnlPercent)
  const pnlText = pnlPercent > 0 ? `+${pnlFormatted}%` : `${pnlFormatted}%`

  const sharePnLText = `I’m earning ${pnlText} stacking ETH with the Opyn Zen Bull Strategy`
  const sharePnLUrl = 'squeeth.com/strategies/bull'

  const isPnlPositive = bullEthPnL.isGreaterThanOrEqualTo(0)

  return (
    <Box display="flex" flexDirection="column" gridGap="12px">
      <Box display="flex" alignItems="center" gridGap="8px">
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
      </Box>

      <SharePnL text={sharePnLText} url={sharePnLUrl} />
    </Box>
  )
}

export default PnL
