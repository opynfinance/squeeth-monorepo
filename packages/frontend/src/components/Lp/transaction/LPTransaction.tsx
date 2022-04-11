import LoadingButton from '@components/Button/LoadingButton'
import { Box, Typography, List, ListItem } from '@material-ui/core'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import { useAtomValue } from 'jotai'
import React from 'react'
import { BUY_AND_LP_STEPS, lpTxTypeAtom, LP_TX_TYPE } from 'src/state/lp/atoms'
import AddLiquidity from './AddLiquidity'
import SwapAndAdd from './SwapAndAdd'

const useStyles = makeStyles((theme) =>
  createStyles({
    nftBox: {
      background: theme.palette.background.lightStone,
      borderRadius: theme.spacing(2),
      width: '250px',
      height: '350px',
    },
    root: {
      gap: theme.spacing(4),
      padding: theme.spacing(3),
      marginTop: theme.spacing(2),
    },
  }),
)

const LPTransaction: React.FC = () => {
  const classes = useStyles()
  const txType = useAtomValue(lpTxTypeAtom)

  return (
    <Box>
      <Box display="flex" className={classes.root}>
        <Box className={classes.nftBox} />
        <Box flexGrow={1}>
          {txType === LP_TX_TYPE.ADD_LIQUIDITY ? <AddLiquidity /> : null}
          {txType === LP_TX_TYPE.SWAP_AND_ADD_LIQUIDITY ? <SwapAndAdd /> : null}
        </Box>
      </Box>
    </Box>
  )
}

export default LPTransaction
