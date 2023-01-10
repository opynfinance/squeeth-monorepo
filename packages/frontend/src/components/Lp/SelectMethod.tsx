import { Typography, Box } from '@material-ui/core'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import { motion } from 'framer-motion'
import Image from 'next/image'
import React from 'react'

import Logo from '../../../public/images/mint-squeeth.svg'
import UniswapLogo from '../../../public/images/uniswap-uni-logo.svg'
import { LPActions, OBTAIN_METHOD, useLPState } from '@context/lp'

const useStyles = makeStyles((theme) =>
  createStyles({
    title: {
      textAlign: 'center',
      fontSize: '18px',
      fontWeight: 500,
      marginBottom: theme.spacing(2),
    },
    obtainItemContainer: {
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
    },
    obtainItem: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',

      background: theme.palette.background.stone,
      borderRadius: theme.spacing(1),
      padding: theme.spacing(4, 2),
      cursor: 'pointer',
      border: `1px solid ${theme.palette.background.lightStone}`,
      // boxShadow: `${theme.palette.primary.main} 1px 5px 47px 5px`,
      '&:hover': {
        border: `1px solid ${theme.palette.primary.main}`,
      },
    },
    obtainItemTitle: {
      color: 'rgba(255, 255, 255)',
      fontSize: '20px',
      fontWeight: 500,
    },

    obtainItemDetail: {
      color: 'rgba(255, 255, 255, 0.5)',
      fontSize: '15px',
      fontWeight: 500,
    },
  }),
)

const SelectMethod: React.FC = () => {
  const classes = useStyles()
  const { dispatch } = useLPState()

  return (
    <>
      <Typography className={classes.title}>Obtain Squeeth</Typography>
      <div className={classes.obtainItemContainer}>
        <motion.div
          initial={{ x: '-5%', opacity: 0.8 }}
          animate={{ x: 0, opacity: 1 }}
          className={classes.obtainItem}
          id="mint-sqth-to-lp-btn"
          onClick={() => dispatch({ type: LPActions.SELECT_METHOD, payload: OBTAIN_METHOD.MINT })}
        >
          <Image src={Logo} alt="Comparison Chart" height={60} width={60} />
          <Box>
            <Typography className={classes.obtainItemTitle} variant="h6">
              Mint Squeeth to LP
            </Typography>
            <Typography className={classes.obtainItemDetail}>Mint by depositing ETH as collateral</Typography>
          </Box>
        </motion.div>
        <motion.div
          initial={{ x: '-5%', opacity: 0.8 }}
          animate={{ x: 0, opacity: 1 }}
          className={classes.obtainItem}
          id="buy-sqth-to-lp-btn"
          onClick={() => dispatch({ type: LPActions.SELECT_METHOD, payload: OBTAIN_METHOD.BUY })}
        >
          <Image src={UniswapLogo} alt="Comparison Chart" height={60} width={60} />
          <Box>
            <Typography className={classes.obtainItemTitle} variant="h6">
              Buy Squeeth to LP
            </Typography>
            <Typography className={classes.obtainItemDetail}>Buy directly from Uniswap</Typography>
          </Box>
        </motion.div>
      </div>
    </>
  )
}

export default SelectMethod
