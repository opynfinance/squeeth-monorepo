import { Typography, Box, CircularProgress } from '@material-ui/core'
import React, { memo } from 'react'
import clsx from 'clsx'
import ArrowDropUpIcon from '@material-ui/icons/ArrowDropUp'
import ArrowDropDownIcon from '@material-ui/icons/ArrowDropDown'
import { useAtomValue } from 'jotai'
import BigNumber from 'bignumber.js'

import { bullEthPnlAtom, bullEthPnlPerctAtom } from '@state/bull/atoms'
import useStyles from '@components/Strategies/styles'
import SharePnL from '@components/Strategies/SharePnL'
import { formatNumber, formatCurrency } from '@utils/formatter'

interface PnLProps {
  depositedUsd: BigNumber
  pnl: BigNumber
}

const PnL: React.FC<PnLProps> = ({ depositedUsd, pnl }) => {
  const classes = useStyles()
  const isPnlLoading = !pnl.isFinite()

  if (isPnlLoading) {
    return (
      <Box display="flex" alignItems="center" gridGap="12px">
        <CircularProgress size="1rem" className={classes.loadingSpinner} />
        <Typography className={classes.text}>fetching pnl...</Typography>
      </Box>
    )
  }

  const pnlPercent = pnl.toNumber()
  const pnlFormatted = formatNumber(pnlPercent)
  const pnlText = pnlPercent > 0 ? `+${pnlFormatted}%` : `${pnlFormatted}%`

  const sharePnLText = `I’m earning ${pnlText} USDC with the Opyn Crab Strategy`
  const sharePnLUrl = 'squeeth.com/strategies'

  const isPnlPositive = pnl.isGreaterThanOrEqualTo(0)

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
            {formatNumber(pnl.toNumber()) + '%'}
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
          {formatCurrency(depositedUsd.times(pnl).div(100).toNumber())})
        </Typography>
        <Typography className={classes.description}>since deposit</Typography>
      </Box>

      <SharePnL text={sharePnLText} url={sharePnLUrl} />
    </Box>
  )
}

export default PnL
