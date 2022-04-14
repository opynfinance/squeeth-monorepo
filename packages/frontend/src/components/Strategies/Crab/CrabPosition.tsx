import { useCrabPosition } from '@hooks/useCrabPosition'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import React, { memo } from 'react'
import { useAtomValue } from 'jotai'
import { Typography, Tooltip, Box } from '@material-ui/core'
import InfoIcon from '@material-ui/icons/InfoOutlined'
import { Tooltips } from '@constants/enums'
import { addressAtom } from 'src/state/wallet/atoms'

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
  const { minCurrentUsd, minPnL, loading } = useCrabPosition(address || '')
  const classes = useStyles()

  if (loading) {
    return (
      <Box mt={2}>
        <Typography>Loading</Typography>
      </Box>
    )
  }

  if (minCurrentUsd.isZero()) {
    return null
  }

  return (
    <div className={classes.container}>
      <Typography color="primary" variant="subtitle1">
        Position
      </Typography>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <Typography variant="h6" id="crab-pos-bal">{loading ? 'Loading' : `${minCurrentUsd.toFixed(2)} USD`}</Typography>
        {!loading && minPnL.isFinite() ? (
          <Typography
            variant="body2"
            style={{ marginLeft: '4px', fontWeight: 600 }}
            className={minPnL.isNegative() ? classes.red : classes.green}
          >
            ({minPnL.toFixed(2)} %)
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
