import { Hidden, Box, Button, Typography } from '@material-ui/core'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import React from 'react'
import { useMemo, useState } from 'react'
import { useAtomValue } from 'jotai'

import { Networks } from '../../types'
import { toTokenAmount } from '@utils/calculations'
import { useENS } from '@hooks/useENS'
import Davatar from '@davatar/react'
import { addressAtom, connectedWalletAtom, networkIdAtom, supportedNetworkAtom } from 'src/state/wallet/atoms'
import { useDiscconectWallet, useSelectWallet, useWalletBalance } from 'src/state/wallet/hooks'
import { BIG_ZERO } from '../../constants'

const useStyles = makeStyles((theme) =>
  createStyles({
    walletBox: {
      [theme.breakpoints.up('md')]: {
        marginLeft: theme.spacing(1),
      },
    },
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
    account: {
      display: 'flex',
      alignItems: 'center',
      '& img': {
        marginRight: theme.spacing(1),
      },
      '& div': {
        marginRight: theme.spacing(1),
      },
    },
    networkErrorBtn: {
      background: theme.palette.error.main,
      color: theme.palette.text.primary,
      '&:hover': {
        background: theme.palette.error.main,
      },
    },
    networkErrorContent: {
      position: 'absolute',
      top: 42,
      right: 0,
      width: 260,
      padding: 12,
      border: `1px solid ${theme.palette.divider}`,
      background: theme.palette.background.default,
      borderRadius: 12,
      zIndex: 2,
      '& button': {
        marginTop: 8,
      },
      [theme.breakpoints.down('sm')]: {
        right: 'unset',
        left: 0,
      },
    },
  }),
)

const WalletButton: React.FC = () => {
  const connected = useAtomValue(connectedWalletAtom)
  const address = useAtomValue(addressAtom)
  const networkId = useAtomValue(networkIdAtom)
  const supportedNetwork = useAtomValue(supportedNetworkAtom)
  const { data: balance } = useWalletBalance()
  const disconnectWallet = useDiscconectWallet()
  const selectWallet = useSelectWallet()
  const [networkErrorVisible, setNetworkErrorVisible] = useState(false)

  const classes = useStyles()
  const { ensName } = useENS(address)

  const shortAddress = useMemo(
    () => (address ? address.slice(0, 8) + '...' + address.slice(address.length - 8, address.length) : ''),
    [address],
  )

  const switchToMainnet = () => {
    const { ethereum } = window as any
    ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x1' }] })
  }

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
    <div className={classes.walletBox}>
      {!connected ? (
        <Button variant="contained" color="primary" onClick={selectWallet} id="connect-wallet">
          Connect wallet
        </Button>
      ) : !supportedNetwork ? (
        <Box position="relative">
          <Button
            variant="contained"
            className={classes.networkErrorBtn}
            onMouseOver={() => setNetworkErrorVisible(true)}
            onClick={() => setNetworkErrorVisible(!networkErrorVisible)}
          >
            Unsupported Network
          </Button>
          {networkErrorVisible && (
            <div onMouseLeave={() => setNetworkErrorVisible(false)} className={classes.networkErrorContent}>
              <Typography color="textPrimary">This network is not supported.</Typography>
              <Button fullWidth variant="outlined" color="primary" onClick={switchToMainnet}>
                Switch to Mainnet
              </Button>
            </div>
          )}
        </Box>
      ) : (
        <div className={classes.walletContainer}>
          <Hidden smDown>
            <div className={classes.balance}>
              <span id="user-eth-wallet-balance">{toTokenAmount(balance ?? BIG_ZERO, 18).toFixed(4)}</span>
              ETH
            </div>
          </Hidden>
          <Button variant="outlined" color="primary" onClick={disconnectWallet} className={classes.walletBtn}>
            <Circle networkId={networkId} />
            <div className={classes.account} id="wallet-address">
              {/* <Davatar size={20} address={address || ''} /> */}
              <span>{ensName || shortAddress}</span>
            </div>
          </Button>
        </div>
      )}
    </div>
  )
}

export default WalletButton
