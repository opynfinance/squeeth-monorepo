import { Typography } from '@material-ui/core'
import { orange } from '@material-ui/core/colors'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import OpenInNewIcon from '@material-ui/icons/OpenInNew'
import { motion } from 'framer-motion'
import React from 'react'
import { useAtomValue } from 'jotai'

import { UniswapIFrameOpen } from '@constants/enums'
import { networkIdAtom } from 'src/state/wallet/atoms'

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
      width: '400px',
      height: '496px',
      background: theme.palette.background.lightStone,
      margin: theme.spacing(1, 0),
      borderRadius: theme.spacing(1),
      overflow: 'auto',
      padding: theme.spacing(1),
    },
    iframeBox: {
      width: '100%',
      height: '450px',
      border: 0,
      borderRadius: theme.spacing(2),
      display: 'block',
      zIndex: 1,
      marginTop: theme.spacing(1),
    },
    warning: {
      color: orange[600],
      fontWeight: 500,
      fontSize: 14,
    },
    headerDiv: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: theme.spacing(0, 1),
    },
    uniOpenBtn: {
      display: 'flex',
      alignItems: 'center',
      color: theme.palette.primary.main,
    },
  }),
)

const ProvideLiquidity: React.FC = () => {
  const classes = useStyles()
  const networkId = useAtomValue(networkIdAtom)

  return (
    <>
      <Typography component="span" color="primary">
        Provide Liquidity
      </Typography>
      <motion.div initial={{ x: '-5%', opacity: 0.8 }} animate={{ x: 0, opacity: 1 }} className={classes.container}>
        <div className={classes.headerDiv}>
          <Typography variant="caption" className={classes.warning}>
            Make sure your wallet is connected to Uniswap
          </Typography>
          <a
            className={classes.uniOpenBtn}
            id="open-in-uniswap-to-lp"
            href={UniswapIFrameOpen[networkId]}
            target="_blank"
            rel="noreferrer"
          >
            <Typography variant="caption">Open in Uniswap</Typography>
            <OpenInNewIcon style={{ fontSize: 16, marginLeft: '4px' }} fontSize="small" />
          </a>
        </div>
        <iframe className={classes.iframeBox} src={UniswapIFrameOpen[networkId]}></iframe>
      </motion.div>
    </>
  )
}

export default ProvideLiquidity
