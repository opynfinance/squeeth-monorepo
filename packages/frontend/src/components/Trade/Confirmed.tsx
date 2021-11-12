import { createStyles, makeStyles, Typography } from '@material-ui/core'
import Image from 'next/image'
import React from 'react'

import { EtherscanPrefix } from '../../constants'
import { useWallet } from '../../context/wallet'

const useStyles = makeStyles((theme) =>
  createStyles({
    etherscan: {
      color: theme.palette.primary.main,
      marginTop: theme.spacing(1),
      marginBotton: theme.spacing(3),
    },
    thirdHeading: {
      marginTop: theme.spacing(3),
      paddingLeft: theme.spacing(1),
      paddingRight: theme.spacing(1),
    },
    confMsg: {
      marginTop: theme.spacing(1),
    },
    squeethCat: {
      marginTop: theme.spacing(6),
      marginBottom: theme.spacing(6),
    },
    uniLP: {
      color: '#FF007A',
      // textDecoration: 'underline',
    },
  }),
)

type ConfirmedProps = {
  confirmationMessage: string
  txnHash: string
  isLP?: boolean
}

const Confirmed: React.FC<ConfirmedProps> = ({ confirmationMessage, txnHash, isLP }) => {
  const classes = useStyles()
  const { networkId } = useWallet()

  return (
    <div>
      <div>
        <Typography variant="h6" className={classes.thirdHeading} component="div">
          Confirmed 🎉
        </Typography>
        <Typography variant="body1" className={classes.confMsg}>
          {' '}
          {confirmationMessage}{' '}
        </Typography>
        <a
          className={classes.etherscan}
          href={`${EtherscanPrefix[networkId]}${txnHash}`}
          target="_blank"
          rel="noreferrer"
        >
          {' '}
          View on Etherscan{' '}
        </a>
      </div>
      {isLP ? (
        <div className={classes.squeethCat}>
          <Typography variant="body1" component="div" className={classes.uniLP}>
            <a
              href="https://squeeth-uniswap.netlify.app/#/add/ETH/0x06980aDd9a68D17eA81C7664ECD1e9DDB85360D9/3000"
              target="_blank"
              rel="noreferrer"
            >
              Provide Liquidity on Uniswap 🦄
            </a>
          </Typography>
        </div>
      ) : (
        <div className={classes.squeethCat}>
          <Image
            src="https://media.giphy.com/media/eYU60NpFPCONDEItBa/giphy.gif"
            alt="squeeth cat"
            width={100}
            height={100}
          />
          <Typography variant="body1" component="div">
            Stay Squeethy!
          </Typography>
        </div>
      )}
    </div>
  )
}

export default Confirmed
