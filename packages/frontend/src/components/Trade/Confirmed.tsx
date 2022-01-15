import { createStyles, makeStyles, Tooltip, Typography } from '@material-ui/core'
import InfoIcon from '@material-ui/icons/InfoOutlined'
import Image from 'next/image'
import React from 'react'

import { EtherscanPrefix, Tooltips } from '../../constants'
import { useWallet } from '@context/wallet'
import { UniswapIframe } from '../Modal/UniswapIframe'

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
    uniswapLink: {
      marginTop: theme.spacing(6),
      marginBottom: theme.spacing(6),
      display: 'flex',
      alignItems: 'center',
    },
    uniLP: {
      color: '#FF007A',
      marginLeft: theme.spacing(3),
      // textDecoration: 'underline',
    },
    infoIcon: {
      fontSize: '1rem',
      marginLeft: theme.spacing(0.5),
      marginTop: '2px',
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
        {!isLP ? (
          <Typography variant="h6" className={classes.thirdHeading} component="div">
            Confirmed 🎉
          </Typography>
        ) : null}
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
        <div className={classes.uniswapLink}>
          <Typography variant="body1" component="div" className={classes.uniLP}>
            <UniswapIframe />
          </Typography>
          <Tooltip title={Tooltips.UniswapLoading}>
            <InfoIcon className={classes.infoIcon} />
          </Tooltip>
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
