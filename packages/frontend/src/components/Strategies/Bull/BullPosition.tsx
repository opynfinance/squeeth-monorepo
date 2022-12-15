import { Typography, Box, CircularProgress } from '@material-ui/core'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import React, { memo } from 'react'
import clsx from 'clsx'

import Metric from '@components/Metric'
import { useBullPosition } from '@hooks/useBullPosition'
import { useAtomValue } from 'jotai'
import { bullCurrentETHPositionAtom, bullCurrentUSDCPositionAtom } from '@state/bull/atoms'
import { addressAtom } from '@state/wallet/atoms'

const useStyles = makeStyles((theme) =>
  createStyles({
    subtitle: {
      fontSize: '20px',
      fontWeight: 700,
      letterSpacing: '-0.01em',
    },
    green: {
      color: theme.palette.success.main,
    },
    red: {
      color: theme.palette.error.main,
    },
    white: {
      color: 'rgba(255, 255, 255)',
    },
    offWhite: {
      color: 'rgba(255,255,255,0.6)',
    },
    metricValue: {
      fontSize: '20px',
      fontWeight: 500,
      width: 'max-content',
      fontFamily: 'DM Mono',
    },
    metricSubValue: {
      fontSize: '18px',
      fontWeight: 500,
      width: 'max-content',
      fontFamily: 'DM Mono',
    },
    metricCaptionValue: {
      fontSize: '16px',
      fontWeight: 400,
      fontFamily: 'DM Mono',
    },
  }),
)

const BullPosition: React.FC = () => {
  const address = useAtomValue(addressAtom)
  const bullPosition = useAtomValue(bullCurrentETHPositionAtom)
  const bullUsdcPosition = useAtomValue(bullCurrentUSDCPositionAtom)
  const classes = useStyles()

  useBullPosition(address ?? '')
  const loading = false

  if (!bullPosition) {
    return null
  }

  return (
    <Box>
      <Typography variant="h4" className={classes.subtitle}>
        My Position
      </Typography>

      {loading ? (
        <Box mt={2} display="flex" alignItems="center" gridGap="20px" height={94}>
          <CircularProgress color="primary" size="1rem" />
          <Typography>Fetching current position...</Typography>
        </Box>
      ) : (
        <Box display="flex" alignItems="center" gridGap="20px" marginTop="16px" flexWrap="wrap">
          <Metric
            label="Position value"
            value={
              <div>
                <Typography className={clsx(classes.metricValue, classes.white)}>
                  {bullPosition.toFixed(6)} ETH
                </Typography>
                <Typography className={clsx(classes.metricCaptionValue, classes.offWhite)}>
                  ${bullUsdcPosition.toFixed(2)}
                </Typography>
              </div>
            }
          />
          <Metric
            label="PnL"
            value={
              <div>
                <Box display="flex" alignItems="center" gridGap="12px">
                  <Typography className={clsx(classes.metricValue, classes.white)}>8.53 ETH</Typography>
                  <Typography className={clsx(classes.metricSubValue, classes.green)}>+15.36%</Typography>
                </Box>
                <Typography className={clsx(classes.metricCaptionValue, classes.offWhite)}>$9,498.00</Typography>
              </div>
            }
          />
        </Box>
      )}
    </Box>
  )
}

export default memo(BullPosition)
