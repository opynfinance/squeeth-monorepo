import { Typography } from '@material-ui/core'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import { motion } from 'framer-motion'
import Image from 'next/image'
import React from 'react'

import Logo from '../../../public/images/mint-squeeth.svg'
import UniswapLogo from '../../../public/images/uniswap-uni-logo.svg'
import { LPActions, OBTAIN_METHOD, useLPState } from '@context/lp'

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
      padding: theme.spacing(2),
    },
    obtainItem: {
      width: '400px',
      height: '240px',
      background: theme.palette.background.lightStone,
      margin: theme.spacing(1, 0),
      borderRadius: theme.spacing(1),
      padding: theme.spacing(2),
      cursor: 'pointer',
      border: `1px solid ${theme.palette.background.lightStone}`,
      // boxShadow: `${theme.palette.primary.main} 1px 5px 47px 5px`,
      '&:hover': {
        border: `1px solid ${theme.palette.primary.main}`,
      },
    },
    obtainItemTitle: {
      marginBottom: theme.spacing(3),
      // fontWeight: 500,
      // fontSize: 18,
    },
    obtainItemImg: {
      marginTop: theme.spacing(4),
    },
    obtainItemDetail: {
      marginTop: theme.spacing(3),
      color: theme.palette.text.secondary,
    },
  }),
)

const SelectMethod: React.FC = () => {
  const classes = useStyles()
  const { dispatch } = useLPState()

  return (
    <>
      <Typography component="span" color="primary">
        Obtain Squeeth
      </Typography>
      <motion.div
        initial={{ x: '-5%', opacity: 0.8 }}
        animate={{ x: 0, opacity: 1 }}
        className={classes.obtainItem}
        id="mint-sqth-to-lp-btn"
        onClick={() => dispatch({ type: LPActions.SELECT_METHOD, payload: OBTAIN_METHOD.MINT })}
      >
        <Typography className={classes.obtainItemTitle} variant="h6">
          Mint Squeeth to LP
        </Typography>
        <Image className={classes.obtainItemImg} src={Logo} alt="Comparison Chart" height={60} width={60} />
        <Typography className={classes.obtainItemDetail}>Mint Squeeth by depositing ETH as collateral</Typography>
      </motion.div>
      <motion.div
        initial={{ x: '-5%', opacity: 0.8 }}
        animate={{ x: 0, opacity: 1 }}
        className={classes.obtainItem}
        id="buy-sqth-to-lp-btn"
        onClick={() => dispatch({ type: LPActions.SELECT_METHOD, payload: OBTAIN_METHOD.BUY })}
      >
        <Typography className={classes.obtainItemTitle} variant="h6">
          Buy Squeeth to LP
        </Typography>
        <Image className={classes.obtainItemImg} src={UniswapLogo} alt="Comparison Chart" height={60} width={60} />
        <Typography className={classes.obtainItemDetail}>Buy Squeeth directly from Uniswap</Typography>
      </motion.div>
    </>
  )
}

export default SelectMethod
