import React from 'react'
import Image from 'next/image'
import { Box, Typography } from '@material-ui/core'
import { makeStyles, createStyles } from '@material-ui/core/styles'

import walletIcon from 'public/images/wallet.svg'

const useWaitForConfirmationStyles = makeStyles((theme) =>
  createStyles({
    iconWrapper: {
      backgroundColor: theme.palette.background.lightStone,
      borderRadius: '100%',
      padding: theme.spacing(2.5),
    },
    icon: {
      height: '30px',
      width: '30px',
    },
    title: {
      fontSize: '22px',
      fontWeight: 700,
      letterSpacing: '-0.01em',
    },
  }),
)

const WaitForConfirmation: React.FC = () => {
  const classes = useWaitForConfirmationStyles()

  return (
    <Box display="flex" flexDirection="column" alignItems="center" gridGap="48px">
      <div className={classes.iconWrapper}>
        <div className={classes.icon}>
          <Image src={walletIcon} alt="wallet" />
        </div>
      </div>

      <Typography className={classes.title}>Confirm transaction in your wallet</Typography>
    </Box>
  )
}

export default WaitForConfirmation
