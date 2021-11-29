import { Hidden, Typography } from '@material-ui/core'
import Button from '@material-ui/core/Button'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import React from 'react'
import { useMemo } from 'react'

import { useWallet } from '../context/wallet'
import { Networks } from '../types'
import { toTokenAmount } from '../utils/calculations'

const useStyles = makeStyles((theme) =>
  createStyles({
    walletContainer: {
      display: 'flex',
      alignItems: 'center',
      background: `${theme.palette.primary.main}90`,
      borderRadius: theme.spacing(1),
    },
    balance: {
      padding: theme.spacing(1, 1),
      height: theme.spacing(4),
      alignItems: 'center',
      display: 'flex',
      borderRadius: theme.spacing(1),
    },
    walletBtn: {
      background: theme.palette.background.default,
    },
  }),
)

const WalletButton: React.FC = () => {
  const { selectWallet, connected, address, networkId, balance } = useWallet()
  const classes = useStyles()

  const shortAddress = useMemo(
    () => (address ? address.slice(0, 8) + '...' + address.slice(address.length - 8, address.length) : ''),
    [address],
  )

  const Circle = ({ networkId }: { networkId: Networks }) => {
    const color = networkId === Networks.MAINNET ? '#05b169' : '#8F7FFE'
    return (
      <div
        style={{
          marginRight: '1rem',
          display: 'inline-block',
          backgroundColor: color,
          borderRadius: '50%',
          width: '.6rem',
          height: '.6rem',
        }}
      />
    )
  }

  return (
    <div style={{ marginLeft: '16px' }}>
      {!connected ? (
        <Button variant="contained" color="primary" onClick={selectWallet}>
          Connect wallet
        </Button>
      ) : (
        <div className={classes.walletContainer}>
          <Hidden smDown>
            <div className={classes.balance}>{toTokenAmount(balance, 18).toFixed(4)} ETH</div>
          </Hidden>
          <Button variant="outlined" color="primary" onClick={selectWallet} className={classes.walletBtn}>
            <Circle networkId={networkId} />
            {shortAddress}
          </Button>
        </div>
      )}
    </div>
  )
}

export default WalletButton
