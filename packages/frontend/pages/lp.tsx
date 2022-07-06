import { Button, createStyles, makeStyles } from '@material-ui/core'
import Typography from '@material-ui/core/Typography'
import Image from 'next/image'
import React, { useState } from 'react'

import squeethTokenSymbol from '../public/images/Squeeth.svg'
import ObtainSqueeth from '@components/Lp/ObtainSqueeth'
import SqueethInfo from '@components/Lp/SqueethInfo'
import LPBuyChart from '@components/Charts/LPBuyChart'
import LPMintChart from '@components/Charts/LPMintChart'
import Nav from '@components/Nav'
import { LPProvider } from '@context/lp'
import { useRestrictUser } from '@context/restrict-user'
import { SqueethTab, SqueethTabs } from '@components/Tabs'
import { useETHPrice } from '@hooks/useETHPrice'
import { supportedNetworkAtom } from 'src/state/wallet/atoms'
import { useAtomValue } from 'jotai'
import { useClosePosition, useOpenPositionDeposit, useRebalanceVault, useRebalanceGeneralSwap } from 'src/state/lp/hooks'
import { useCollectFees } from 'src/state/lp/hooks'
import BigNumber from 'bignumber.js'
import useAppCallback from '@hooks/useAppCallback'
import { useFirstValidVault } from 'src/state/positions/hooks'
import { useGetTwapSqueethPrice, useUpdateOperator } from 'src/state/controller/hooks'
import { addressesAtom } from 'src/state/positions/atoms'
import useAppEffect from '@hooks/useAppEffect'
import { CONTROLLER_HELPER } from '@constants/address'

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
      padding: theme.spacing(4, 10),
      marginLeft: 'auto',
      marginRight: 'auto',
      maxWidth: '1500px',
      display: 'flex',
      justifyContent: 'space-between',
    },
    logoContainer: {
      display: 'flex',
      alignItems: 'center',
      width: '100%',
    },
    logoTitle: {
      marginLeft: theme.spacing(1),
      [theme.breakpoints.down('sm')]: {
        fontSize: 18,
      },
    },
    logoSubTitle: {
      marginLeft: theme.spacing(1),
      [theme.breakpoints.down('sm')]: {
        fontSize: 16,
      },
    },
    logo: {
      marginTop: theme.spacing(0.5),
      alignSelf: 'flex-start',
    },
    comparison: {
      marginTop: theme.spacing(4),
      //paddingBottom: theme.spacing(2),
    },
    comparisonItem: {
      width: '400px',
    },
    comparisonPoint: {
      marginTop: theme.spacing(2),
      padding: theme.spacing(0, 2),
    },
    details: {
      marginTop: theme.spacing(4),
      // paddingLeft: theme.spacing(4),
      // display: 'flex',
    },
    heading: {
      marginTop: theme.spacing(3),
    },
    tradeForm: {
      position: 'sticky',
      top: '100px',
    },
    chartNav: {
      border: `1px solid ${theme.palette.primary.main}30`,
    },
    buttonTest: {
      marginTop: theme.spacing(1),
      backgroundColor: theme.palette.success.main,
      '&:hover': {
        backgroundColor: theme.palette.success.dark,
      },
    },
  }),
)

export function LPCalculator() {
  const [isVaultApproved, setIsVaultApproved] = useState(true)
  const classes = useStyles()
  const { isRestricted } = useRestrictUser()
  const ethPrice = useETHPrice()
  const [lpType, setLpType] = useState(0)
  const supportedNetwork = useAtomValue(supportedNetworkAtom)
  const squeethPrice = useGetTwapSqueethPrice()
  const openLPPosition = useOpenPositionDeposit()
  const closeLPPosition = useClosePosition()
  const collectFees = useCollectFees()
  const rebalanceVault = useRebalanceVault()
  const rebalanceSwap = useRebalanceGeneralSwap()
  const { vaultId, validVault: vault } = useFirstValidVault()

  const openPos = useAppCallback(async () => {
    try {
      await openLPPosition(new BigNumber(50), -887220, 887220, 0, () => {})
    } catch (e) {
      console.log(e)
    }
  }, [vaultId, squeethPrice])

  const collFees = useAppCallback(async () => {
    try {
      await collectFees(Number(682), () => {})
    } catch (e) {
      console.log(e)
    }
  }, [vaultId])

  const closePos = useAppCallback(async () => {
    try {
      await closeLPPosition(Number(682), () => {})
    } catch (e) {
      console.log(e)
    }
  }, [vaultId])

  const rebalVault = useAppCallback(async () => {
    try {
      await rebalanceVault(Number(682), -887220, 887220, () => {})
    } catch (e) {
      console.log(e)
    }
  }, [vaultId])

  const rebalSwap = useAppCallback(async () => {
    try {
      await rebalanceSwap(Number(682), 0, 3000, () => {})
    } catch (e) {
      console.log(e)
    }
  }, [vaultId])


  return (
    <div>
      <Nav />
      <div className={classes.container}>
        <div style={{ width: '800px', paddingRight: '16px' }}>
          <div style={{ display: 'flex' }}>
            <div className={classes.logo}>
              <Image src={squeethTokenSymbol} alt="squeeth token" width={37} height={37} />
            </div>
            <div>
              <Typography variant="h5" className={classes.logoTitle}>
                Uniswap V3 LP SQTH-ETH Pool
              </Typography>
              <Typography className={classes.logoSubTitle} variant="body1" color="textSecondary">
                Earn LP fees for providing SQTH-ETH liquidity
              </Typography>
            </div>
          </div>
          <SqueethInfo />
          <div className={classes.details}>
            <div style={{ display: 'flex' }}>
              <SqueethTabs
                style={{ background: 'transparent' }}
                className={classes.chartNav}
                value={lpType}
                onChange={(evt, val) => setLpType(val)}
                aria-label="Sub nav tabs"
                scrollButtons="auto"
                variant="scrollable"
              >
                <SqueethTab label={'Buy and LP'} />
                <SqueethTab label="Mint and LP" />
              </SqueethTabs>
            </div>
            {lpType === 0 ? (
              <div style={{ marginTop: '16px' }}>
                <Typography color="primary" variant="h6">
                  Buy squeeth and LP
                </Typography>
                <Typography>
                  Earn a payoff similar to ETH<sup>1.5</sup>
                </Typography>
                <Typography className={classes.heading} variant="subtitle1" color="primary">
                  Details
                </Typography>
                <Typography>
                  Buying and LPing gives you a leverage position with a payoff similar to ETH<sup>1.5</sup>. You give up
                  some of your squeeth upside in exchange for trading fees. You are paying funding for being long
                  squeeth, but earning fees from LPing on Uniswap.
                </Typography>
                <Typography className={classes.heading} variant="subtitle1" color="primary">
                  Payoff
                </Typography>
                <LPBuyChart ethPrice={ethPrice.toNumber()} />
                <Typography variant="caption" color="textSecondary">
                  This payoff diagram does not included funding or trading fees and assumes implied volatility stays
                  constant.{' '}
                </Typography>
                <Typography className={classes.heading} variant="subtitle1" color="primary">
                  Risks
                </Typography>
                <Typography variant="body1">
                  You are exposed to squeeth funding, so if you hold the position for a long period of time without
                  upward price movements in ETH, you can lose considerable funds to funding payments.
                </Typography>
                <br />
                <Typography variant="body1">
                  {' '}
                  Squeeth smart contracts have been audited by Trail of Bits, Akira, and Sherlock. However, smart
                  contracts are experimental technology and we encourage caution only risking funds you can afford to
                  lose.
                </Typography>
                <Typography className={classes.heading} variant="subtitle1" color="primary">
                  Testing One Click LP Hooks
                </Typography>
                <Button
                  onClick={openPos}
                  style={{
                    width: '300px',
                    color: 'gray',
                    backgroundColor: '#a9fbf6',
                  }}
                >
                  {'Open Mint and Deposit LP Position'}
                </Button>

                <Button
                  onClick={collFees}
                  style={{
                    width: '300px',
                    color: 'gray',
                    backgroundColor: '#a9fbf6',
                  }}
                >
                  {'Collect Fees'}
                </Button>

                <Button
                  onClick={closePos}
                  style={{
                    width: '300px',
                    color: 'gray',
                    backgroundColor: '#a9fbf6',
                  }}
                >
                  {'Close LP Position'}
                </Button>

                <Button
                  onClick={rebalVault}
                  style={{
                    width: '300px',
                    color: 'gray',
                    backgroundColor: '#a9fbf6',
                  }}
                >
                  {'Rebalance Vault Position'}
                </Button>

                <Button
                  onClick={rebalSwap}
                  style={{
                    width: '300px',
                    color: 'gray',
                    backgroundColor: '#a9fbf6',
                  }}
                >
                  {'Rebalance General Swap'}
                </Button>

              </div>
            ) : (
              <div style={{ marginTop: '16px' }}>
                <Typography color="primary" variant="h6">
                  Mint squeeth and LP
                </Typography>
                <Typography>Earn yield from trading fees while being long ETH</Typography>
                <Typography className={classes.heading} variant="subtitle1" color="primary">
                  Details
                </Typography>
                <Typography>
                  Minting and LPing is similar to a covered call. You start off with a position similar to 1x long ETH
                  that gets less long ETH as the price moves up and longer ETH as the price moves down.
                </Typography>
                <Typography className={classes.heading} variant="subtitle1" color="primary">
                  Payoff
                </Typography>
                <LPMintChart ethPrice={ethPrice.toNumber()} />
                <Typography variant="caption" color="textSecondary">
                  This payoff diagram does not included funding or trading fees and assumes implied volatility stays
                  constant.{' '}
                </Typography>
                <Typography className={classes.heading} variant="subtitle1" color="primary">
                  Risks
                </Typography>
                <Typography variant="body1">
                  You enter this position neutral to squeeth exposure, but could end up long squeeth exposed to funding
                  or short squeeth depending on ETH price movements. If you fall below the minimum collateralization
                  threshold (150%), you are at risk of liquidation.
                </Typography>
                <br />
                <Typography variant="body1">
                  {' '}
                  Squeeth smart contracts have been audited by Trail of Bits, Akira, and Sherlock. However, smart
                  contracts are experimental technology and we encourage caution only risking funds you can afford to
                  lose.
                </Typography>
              </div>
            )}
          </div>
        </div>
        <div>
          {supportedNetwork && <div className={classes.tradeForm}>{!isRestricted ? <ObtainSqueeth /> : null}</div>}
        </div>
      </div>
    </div>
  )
}

export function LPage() {
  return (
    // <TradeProvider>
    <LPProvider>
      <LPCalculator />
    </LPProvider>
    // </TradeProvider>
  )
}

export default LPage