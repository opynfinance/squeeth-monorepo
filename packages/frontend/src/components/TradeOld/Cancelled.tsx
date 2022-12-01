import { createStyles, makeStyles, Typography } from '@material-ui/core'
import React from 'react'
import { useAtomValue } from 'jotai'

import { EtherscanPrefix } from '../../constants'
import { networkIdAtom } from 'src/state/wallet/atoms'

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
    img: {
      borderRadius: theme.spacing(2),
    },
  }),
)

type ConfirmedProps = {
  txnHash: string
}

const Cancelled: React.FC<ConfirmedProps> = ({ txnHash }) => {
  const classes = useStyles()
  const networkId = useAtomValue(networkIdAtom)

  return (
    <div>
      <div>
        <Typography variant="body1" className={classes.confMsg}>
          You cancelled the transaction
        </Typography>
        <a
          className={classes.etherscan}
          href={`${EtherscanPrefix[networkId]}${txnHash}`}
          target="_blank"
          rel="noreferrer"
        >
          View on Etherscan
        </a>
      </div>
    </div>
  )
}

export default Cancelled
