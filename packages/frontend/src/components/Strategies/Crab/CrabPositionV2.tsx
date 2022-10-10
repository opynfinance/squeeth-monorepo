import { Typography, Box, CircularProgress } from '@material-ui/core'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import React, { memo } from 'react'
import { useAtomValue } from 'jotai'
import clsx from 'clsx'

import { addressAtom } from '@state/wallet/atoms'
import { useCurrentCrabPositionValueV2 } from '@state/crab/hooks'
import useAppMemo from '@hooks/useAppMemo'
import { useCrabPositionV2 } from '@hooks/useCrabPosition/useCrabPosition'
import Metric from '@components/Metric'
import { formatCurrency, formatNumber } from '@utils/formatter'
import { pnlInPerctv2 } from 'src/lib/pnl'
import CrabQueuedPosition from './CrabQueuedPosition'
import { crabQueuedAtom, usdcQueuedAtom } from 'src/state/crab/atoms'

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
      marginTop: theme.spacing(2),
    },
    subtitle: {
      fontSize: '22px',
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
    infoIcon: {
      fontSize: '10px',
      marginLeft: theme.spacing(0.5),
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
  }),
)

const CrabPosition: React.FC = () => {
  const address = useAtomValue(addressAtom)
  const { loading: isCrabPositionLoading, depositedUsd } = useCrabPositionV2(address || '')
  const { currentCrabPositionValue, isCrabPositionValueLoading } = useCurrentCrabPositionValueV2()

  const usdcQueued = useAtomValue(usdcQueuedAtom)
  const crabQueued = useAtomValue(crabQueuedAtom)

  const classes = useStyles()
  const pnl = useAppMemo(() => {
    return pnlInPerctv2(currentCrabPositionValue, depositedUsd)
  }, [currentCrabPositionValue, depositedUsd])

  const loading = useAppMemo(() => {
    console.log('Crab position loading : ', isCrabPositionLoading, isCrabPositionValueLoading)
    return isCrabPositionLoading || isCrabPositionValueLoading
  }, [isCrabPositionLoading, isCrabPositionValueLoading])

  if (currentCrabPositionValue.isZero() && usdcQueued.isZero() && crabQueued.isZero()) return null

  return (
    <Box>
      <Typography variant="h4" className={classes.subtitle}>
        My Position
      </Typography>

      {loading ? (
        <Box mt={2} display="flex" alignItems="flex-start" gridGap="20px" height="94px">
          <CircularProgress color="primary" size="1rem" />
          <Typography>Fetching current position...</Typography>
        </Box>
      ) : (
        <Box display="flex" alignItems="center" gridGap="20px" marginTop="16px" flexWrap="wrap">
          <Metric
            label="Position value"
            value={
              <Typography className={clsx(classes.metricValue, classes.white)}>
                {formatCurrency(currentCrabPositionValue.toNumber())}
              </Typography>
            }
          />
          {pnl.isFinite() && (
            <Metric
              label="PnL"
              value={
                <Box display="flex" alignItems="center" gridGap="12px">
                  <Typography className={clsx(classes.metricValue, classes.white)}>
                    {formatCurrency(depositedUsd.times(pnl).div(100).toNumber())}
                  </Typography>
                  <Typography className={clsx(classes.metricSubValue, pnl.isNegative() ? classes.red : classes.green)}>
                    {formatNumber(pnl.toNumber()) + '%'}
                  </Typography>
                </Box>
              }
            />
          )}
        </Box>
      )}
    </Box>
  )
}

export default memo(CrabPosition)
