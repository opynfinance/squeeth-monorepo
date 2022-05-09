import { useCrabPosition } from '@hooks/useCrabPosition'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import React, { memo } from 'react'
import { useAtomValue } from 'jotai'
import { Typography, Tooltip, Box } from '@material-ui/core'
import InfoIcon from '@material-ui/icons/InfoOutlined'
import { Tooltips } from '@constants/enums'
import { addressAtom } from 'src/state/wallet/atoms'
import { isCrabUsingMidPriceAtom } from 'src/state/crab/atoms'
import { useCurrentCrabPositionValue } from 'src/state/crab/hooks'
import { pnlInPerct } from 'src/lib/pnl'

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
      padding: theme.spacing(1),
      backgroundColor: theme.palette.background.lightStone,
      borderRadius: theme.spacing(1),
      marginTop: theme.spacing(2),
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

const CrabPosition: React.FC = () => {
  const address = useAtomValue(addressAtom)
  const isCrabUsingMidPrice = useAtomValue(isCrabUsingMidPriceAtom)
  const { minCurrentUsd, minPnL, loading, depositedUsd } = useCrabPosition(address || '')
  const { currentCrabPositionValue } = useCurrentCrabPositionValue()

  const classes = useStyles()
  const pnl = isCrabUsingMidPrice ? pnlInPerct(currentCrabPositionValue, depositedUsd) : minPnL
  const crabPositionValue = isCrabUsingMidPrice ? currentCrabPositionValue : minCurrentUsd

  if (loading) {
    return (
      <Box mt={2}>
        <Typography>Loading</Typography>
      </Box>
    )
  }

  if (crabPositionValue.isZero()) {
    return null
  }

  return (
    <div className={classes.container}>
      <Typography color="primary" variant="subtitle1">
        Position
      </Typography>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <Typography variant="h6" id="crab-pos-bal">
          {loading ? 'Loading' : `${crabPositionValue.toFixed(2)} USD`}
        </Typography>
        {!loading && pnl.isFinite() ? (
          <Typography
            variant="body2"
            style={{ marginLeft: '4px', fontWeight: 600 }}
            className={pnl.isNegative() ? classes.red : classes.green}
          >
            ({pnl.toFixed(2)} %)
          </Typography>
        ) : null}
        <Tooltip title={Tooltips.CrabPnL}>
          <InfoIcon fontSize="small" className={classes.infoIcon} />
        </Tooltip>
      </div>
    </div>
  )
}

export default memo(CrabPosition)
