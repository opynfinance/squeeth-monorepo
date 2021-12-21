import { Button, createStyles, makeStyles } from '@material-ui/core'
import Typography from '@material-ui/core/Typography'
import Image from 'next/image'
import Router from 'next/router'
import React, { useMemo } from 'react'

import discordIcon from '../public/images/discord.svg'
import squeethTokenSymbol from '../public/images/Squeeth.png'
import twitterIcon from '../public/images/twitter.png'
import { useWallet } from '@context/wallet'
import { LoginState, useWhitelist } from '@context/whitelist'

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      gap: '10px',
      padding: theme.spacing(4),
    },
    logoTitle: {
      marginLeft: theme.spacing(1),
      [theme.breakpoints.down('sm')]: {
        fontSize: 18,
      },
      textAlign: 'center',
    },
    info: {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      gap: '10px',
      textAlign: 'center',
    },
    terms: {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      gap: '10px',
      maxWidth: '300px',
      fontSize: 12,
      marginTop: theme.spacing(2),
      textAlign: 'center',
    },
  }),
)

export default function SignIn() {
  const { me, setMe, whitelistAddrs } = useWhitelist()
  const { selectWallet, connected, address } = useWallet()
  const classes = useStyles()

  useMemo(() => {
    const whitelisted = connected && !!address && whitelistAddrs.includes(address)
    if (whitelisted) {
      setMe(address)
      Router.push('/')
    }
  }, [connected, address, whitelistAddrs])

  return me?.loginState === LoginState.GUEST ? (
    <div className={classes.container}>
      <Image src={squeethTokenSymbol} alt="squeeth token" width={37} height={37} />
      <Typography variant="h5" className={classes.logoTitle}>
        Welcome to Squeeth!
      </Typography>
      <Typography variant="h6" className={classes.logoTitle}>
        ↓ Connect wallet ↓
      </Typography>
      <Button onClick={selectWallet} style={{ width: 300, color: '#000' }} variant="contained" color="primary">
        {'Connect Wallet'}
      </Button>
      <div className={classes.info}>
        <a href="https://discord.gg/ztEuhjyaBF">
          <Button style={{ color: '#000', textTransform: 'none' }} variant="contained" color="primary">
            <span>Squeeth Together</span>
            <span style={{ display: 'flex', marginLeft: '5px' }}>
              <Image src={discordIcon} alt="squeeth token" width={27} height={27} />
            </span>
          </Button>
        </a>
      </div>
      <Typography variant="body2" className={classes.terms} color="textSecondary">
        By connecting your wallet, you acknowledge and agree that you are using the Squeeth testnet solely for the
        purpose of product testing and user feedback. Users are testing the Squeeth frontend for these purposes only.
      </Typography>
    </div>
  ) : (
    <div className={classes.container}>
      <Image src={squeethTokenSymbol} alt="squeeth token" width={37} height={37} />
      <Typography variant="h5" className={classes.logoTitle}>
        Squeeth coming on Jan 10th!
      </Typography>
      <div className={classes.info}>
        <a href="https://discord.gg/ztEuhjyaBF" target="_blank" rel="noopener noreferrer">
          <Button style={{ color: '#000', textTransform: 'none' }} variant="contained" color="primary">
            <span>Squeeth Together</span>
            <span style={{ display: 'flex', marginLeft: '5px' }}>
              <Image src={discordIcon} alt="discord" width={27} height={27} />
            </span>
          </Button>
        </a>
      </div>
      <div className={classes.info}>
        <a href="https://twitter.com/opyn_" target="_blank" rel="noopener noreferrer">
          <Button style={{ color: '#000', textTransform: 'none' }} variant="contained" color="primary">
            <span>Get Updates</span>
            <span style={{ display: 'flex', marginLeft: '5px' }}>
              <Image src={twitterIcon} alt="twitter" width={27} height={27} />
            </span>
          </Button>
        </a>
      </div>
      <div className={classes.info}>
        <a href="https://www.paradigm.xyz/2021/08/power-perpetuals/" target="_blank" rel="noopener noreferrer">
          <Button style={{ color: '#000', textTransform: 'none' }} variant="contained" color="primary">
            <span>Learn more</span>
          </Button>
        </a>
      </div>
    </div>
  )
}
