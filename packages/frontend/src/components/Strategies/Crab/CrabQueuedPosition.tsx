import { PrimaryButton } from '@components/Button'
import { BIG_ZERO, USDC_DECIMALS } from '@constants/index'
import { Box, Button, CircularProgress, createStyles, makeStyles, Typography } from '@material-ui/core'
import { toTokenAmount } from '@utils/calculations'
import { useAtom, useAtomValue } from 'jotai'
import { useState } from 'react'
import { crabQueuedAtom, crabUSDValueAtom, usdcQueuedAtom } from 'src/state/crab/atoms'
import { useDeQueueDepositUSDC, useDeQueueWithdrawCrab } from 'src/state/crab/hooks'
import { useTransactionStatus } from 'src/state/wallet/hooks'

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
      marginTop: theme.spacing(0.5),
    },
    green: {
      color: theme.palette.success.main,
    },
    red: {
      color: theme.palette.error.main,
    },
    infoIcon: {
      fontSize: '10px',
      marginLeft: theme.spacing(0.5),
    },
  }),
)

const CrabQueuedPosition: React.FC = () => {
  const classes = useStyles()
  const [usdcQueued, setUsdcQueued] = useAtom(usdcQueuedAtom)
  const [crabQueued, setCrabQueued] = useAtom(crabQueuedAtom)
  const crabUsdValue = useAtomValue(crabUSDValueAtom)

  const [usdcLoading, setUSDCLoading] = useState(false)
  const [crabLoading, setCrabLoading] = useState(false)

  const dequeueUSDC = useDeQueueDepositUSDC()
  const dequeueCRAB = useDeQueueWithdrawCrab()

  const { resetTransactionData } = useTransactionStatus()

  const onDeQueueUSDC = async () => {
    setUSDCLoading(true)
    try {
      await dequeueUSDC(usdcQueued, resetTransactionData)
      setUsdcQueued(BIG_ZERO)
    } catch (e) {
      console.log(e)
    }
    setUSDCLoading(false)
  }

  const onDeQueueCrab = async () => {
    setCrabLoading(true)
    try {
      await dequeueCRAB(crabQueued, resetTransactionData)
      setCrabQueued(BIG_ZERO)
    } catch (e) {
      console.log(e)
    }
    setCrabLoading(false)
  }

  return (
    <Box className={classes.container}>
      <Typography variant="subtitle1" color="primary">
        Queued Position
      </Typography>
      {!usdcQueued.isZero() ? (
        <Box display="flex" alignItems="center">
          <Typography>
            Deposit:{' '}
            <Typography color="textPrimary" component="span" style={{ fontWeight: 600 }}>
              {Number(toTokenAmount(usdcQueued, USDC_DECIMALS)).toLocaleString()} USD
            </Typography>
          </Typography>
          <Button color="primary" style={{ marginLeft: '4px' }} onClick={onDeQueueUSDC} disabled={usdcLoading}>
            {!usdcLoading ? 'Cancel' : <CircularProgress color="primary" size={25} />}
          </Button>{' '}
        </Box>
      ) : null}
      {!crabQueued.isZero() ? (
        <Box display="flex" alignItems="center">
          <Typography>
            Withdrawal:{' '}
            <Typography color="textPrimary" component="span" style={{ fontWeight: 600 }}>
              {Number(toTokenAmount(crabQueued, 18).times(toTokenAmount(crabUsdValue, 18))).toLocaleString()} USD
            </Typography>
          </Typography>
          <Button color="primary" style={{ marginLeft: '4px' }} onClick={onDeQueueCrab} disabled={crabLoading}>
            {!crabLoading ? 'Cancel' : <CircularProgress color="primary" size={25} />}
          </Button>
        </Box>
      ) : null}
    </Box>
  )
}

export default CrabQueuedPosition
