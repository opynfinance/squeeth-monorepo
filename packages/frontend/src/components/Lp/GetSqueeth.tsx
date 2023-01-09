import { Typography } from '@material-ui/core'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import { motion } from 'framer-motion'
import React from 'react'

import { LPActions, OBTAIN_METHOD, useLPState } from '@context/lp'
import Long from '@components/Trade/Long'
import MintSqueeth from '@components/Trade/Mint'

const useStyles = makeStyles((theme) =>
  createStyles({
    title: {
      textAlign: 'center',
      fontSize: '18px',
      fontWeight: 500,
      marginBottom: theme.spacing(2),
    },
  }),
)

const GetSqueeth: React.FC = () => {
  const classes = useStyles()
  const { lpState, dispatch } = useLPState()

  const onMint = () => {
    dispatch({ type: LPActions.GO_TO_PROVIDE_LIQUIDITY })
  }

  return (
    <>
      <Typography className={classes.title}>
        {lpState.obtainMethod === OBTAIN_METHOD.BUY ? 'Buy Squeeth to LP' : 'Mint Squeeth to LP'}
      </Typography>
      <motion.div initial={{ x: '-5%', opacity: 0.8 }} animate={{ x: 0, opacity: 1 }}>
        {lpState.obtainMethod === OBTAIN_METHOD.BUY ? (
          <Long isLPage open={true} showTitle={false} />
        ) : (
          <MintSqueeth onMint={onMint} />
        )}
      </motion.div>
    </>
  )
}

export default GetSqueeth
