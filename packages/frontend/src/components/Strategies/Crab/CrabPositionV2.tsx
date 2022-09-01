import { useCrabPosition } from '@hooks/useCrabPosition'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import React, { memo } from 'react'
import { useAtomValue } from 'jotai'
import { Typography, Tooltip, Box } from '@material-ui/core'
import InfoIcon from '@material-ui/icons/InfoOutlined'
import { Tooltips } from '@constants/enums'
import { addressAtom } from 'src/state/wallet/atoms'
import { useCurrentCrabPositionValue, useCurrentCrabPositionValueV2 } from 'src/state/crab/hooks'
import { pnlInPerctv2 } from 'src/lib/pnl'
import useAppMemo from '@hooks/useAppMemo'
import { userMigratedSharesAtom } from 'src/state/crabMigration/atom'
import { useCrabPositionV2 } from '@hooks/useCrabPosition/useCrabPosition'

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
  const { loading: isCrabPositonLoading, depositedUsd } = useCrabPositionV2(address || '')
  const { currentCrabPositionValue, isCrabPositionValueLoading } = useCurrentCrabPositionValueV2()

  const classes = useStyles()
  const pnl = useAppMemo(() => {
    return pnlInPerctv2(currentCrabPositionValue, depositedUsd)
  }, [currentCrabPositionValue, depositedUsd])

  const loading = useAppMemo(() => {
    console.log('Crab position loading : ', isCrabPositonLoading, isCrabPositionValueLoading)
    return isCrabPositonLoading || isCrabPositionValueLoading
  }, [isCrabPositonLoading, isCrabPositionValueLoading])

  if (loading) {
    return (
      <Box mt={2}>
        <Typography>Loading</Typography>
      </Box>
    )
  }

  if (currentCrabPositionValue.isZero()) {
    return null
  }

  return (
    <div className={classes.container}>
      <Typography color="primary" variant="subtitle1">
        Position
      </Typography>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <Typography variant="h6" id="crab-pos-bal">
          {loading ? 'Loading' : `${currentCrabPositionValue.toFixed(2)} USD`}
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
