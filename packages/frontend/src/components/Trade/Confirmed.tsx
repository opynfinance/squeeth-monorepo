import { createStyles, makeStyles, Typography } from '@material-ui/core'
import Image from 'next/image'
import React from 'react'
import { useAtomValue } from 'jotai'

import { EtherscanPrefix } from '@constants/index'
import { networkIdAtom } from '@state/wallet/atoms'

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
      textAlign: 'center',
      marginBottom: theme.spacing(4),
    },
    etherscan: {
      color: theme.palette.primary.main,
      marginTop: theme.spacing(1),
    },
    thirdHeading: {
      marginTop: theme.spacing(3),
      paddingLeft: theme.spacing(1),
      paddingRight: theme.spacing(1),
    },
    confMsg: {
      marginTop: theme.spacing(1),
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
    },
    infoIcon: {
      fontSize: '1rem',
      marginLeft: theme.spacing(0.5),
      marginTop: '2px',
    },
  }),
)

const useConfirmGraphicStyles = makeStyles((theme) =>
  createStyles({
    graphic: {
      marginTop: theme.spacing(4),
    },
    img: {
      borderRadius: theme.spacing(2),
    },
  }),
)

const ConfirmGraphic: React.FC<{ type?: ConfirmType }> = ({ type }) => {
  const classes = useConfirmGraphicStyles()
  if (type === ConfirmType.CRAB)
    return (
      <div className={classes.graphic}>
        <Image
          src="https://media.giphy.com/media/ukLCGEh7kXDJ5wNWT7/giphy.gif"
          alt="squeeth crab cat"
          width={120}
          height={120}
          className={classes.img}
        />
        <Typography variant="body1" component="div">
          Stay Crabby!
        </Typography>
      </div>
    )
  if (type === ConfirmType.TRADE)
    return (
      <div className={classes.graphic}>
        <Image
          src="https://media.giphy.com/media/eYU60NpFPCONDEItBa/giphy.gif"
          alt="squeeth cat"
          width={120}
          height={120}
          className={classes.img}
        />
        <Typography variant="body1" component="div">
          Stay Squeethy!
        </Typography>
      </div>
    )

  if (type === ConfirmType.BULL)
    return (
      <div className={classes.graphic}>
        <Image
          src="https://media.giphy.com/media/j2VvomNXigtS1MfeT8/giphy.gif"
          alt="squeeth bull cat"
          width={120}
          height={120}
          className={classes.img}
        />
        <Typography variant="body1" component="div">
          Stay Bullish!
        </Typography>
      </div>
    )
  return <></>
}

export enum ConfirmType {
  TRADE,
  CRAB,
  BULL,
}

type ConfirmedProps = {
  confirmationMessage: string
  txnHash: string
  confirmType: ConfirmType
}

const Confirmed: React.FC<ConfirmedProps> = ({ confirmationMessage, txnHash, confirmType }) => {
  const classes = useStyles()
  const networkId = useAtomValue(networkIdAtom)

  return (
    <div className={classes.container}>
      <div>
        <Typography variant="body1" className={classes.confMsg} id="conf-msg">
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
      <ConfirmGraphic type={confirmType} />
    </div>
  )
}

export default Confirmed
