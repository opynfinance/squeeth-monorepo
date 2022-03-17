import { useCrabPosition } from '@hooks/useCrabPosition'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import React, { useEffect, useState } from 'react'
import { useAtomValue } from 'jotai'
import { Typography, Tooltip } from '@material-ui/core'
import BigNumber from 'bignumber.js'
import InfoIcon from '@material-ui/icons/InfoOutlined'
import { Tooltips } from '@constants/enums'
import { addressAtom } from 'src/state/wallet/atoms'

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
      padding: theme.spacing(1),
      backgroundColor: theme.palette.background.lightStone,
      borderRadius: theme.spacing(1),
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

  return (
    <div className={classes.container}>
      <Typography color="primary" variant="subtitle1">
        Position
      </Typography>
      {minCurrentUsd?.gt(0) ? (
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Typography variant="h6">{loading ? 'Loading' : `${minCurrentUsd.toFixed(2)} USD`}</Typography>
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
      ) : (
        <Typography variant="body2">--</Typography>
      )}
    </div>
  )
}

export default CrabPosition
