import { Button, createStyles, makeStyles, TextField } from '@material-ui/core'
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
import { useFlashClosePosition, useOpenPositionDeposit, useRebalanceGeneralSwap } from 'src/state/lp/hooks'
import { useCollectFees } from 'src/state/lp/hooks'
import BigNumber from 'bignumber.js'
import useAppCallback from '@hooks/useAppCallback'
import { useFirstValidVault } from 'src/state/positions/hooks'
import { useGetTwapSqueethPrice, useUpdateOperator } from 'src/state/controller/hooks'
import { addressesAtom } from 'src/state/positions/atoms'

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
      width: '300px',
      color: 'gray',
      backgroundColor: '#a9fbf6',
      marginTop: '10px',
      marginBottom: '10px',
    },
    testField: {
      marginTop: '10px',
      marginBottom: '10px',
    },
  }),
)

export function LPCalculator() {
  const { controllerHelper } = useAtomValue(addressesAtom)
  const classes = useStyles()
  const { isRestricted } = useRestrictUser()
  const ethPrice = useETHPrice()
  const [lpType, setLpType] = useState(0)
  const supportedNetwork = useAtomValue(supportedNetworkAtom)
  const squeethPrice = useGetTwapSqueethPrice()
  const openLPPosition = useOpenPositionDeposit()
  const closeLPPosition = useFlashClosePosition()
  const collectFees = useCollectFees()
  const rebalanceSwap = useRebalanceGeneralSwap()
  const updateOperator = useUpdateOperator()
  const { vaultId, validVault: vault } = useFirstValidVault()

  const [vaultID, setVaultID] = useState(0)
  const [squeethAmount, setSqueethAmount] = useState(0)
  const [lowerTick, setLowerTick] = useState(-500000)
  const [upperTick, setUpperTick] = useState(500000)
  const [slippage, setSlippage] = useState(0.0025)
  const [collatToWithdraw, setCollatToWithdraw] = useState(0)
  const [collatRatio, setCollatRatio] = useState(1.5)
  const [liquidityPercentage, setLiquidityPercentage] = useState(1)
  const [burnPercentage, setBurnPercentage] = useState(1)
  const [burnExactRemoved, setBurnExactRemoved] = useState(true)

  const openPos = useAppCallback(async () => {
    try {
      await openLPPosition(
        new BigNumber(squeethAmount),
        lowerTick,
        upperTick,
        vaultID,
        collatRatio,
        slippage,
        collatToWithdraw,
        () => {},
      )
    } catch (e) {
      console.log(e)
    }
  }, [squeethAmount, vaultID, lowerTick, upperTick, collatRatio, slippage, collatToWithdraw, openLPPosition])

  const updateOp = useAppCallback(async () => {
    try {
      await updateOperator(vaultID, controllerHelper)
    } catch (e) {
      console.log(e)
    }
  }, [vaultID, controllerHelper, updateOperator])

  const collFees = useAppCallback(async () => {
    try {
      await collectFees(vaultID, () => {})
    } catch (e) {
      console.log(e)
    }
  }, [vaultID, collectFees])

  const closePos = useAppCallback(async () => {
    try {
      await closeLPPosition(
        vaultID,
        liquidityPercentage,
        burnPercentage,
        collatToWithdraw,
        burnExactRemoved,
        slippage,
        () => {},
      )
    } catch (e) {
      console.log(e)
    }
  }, [vaultID, liquidityPercentage, burnPercentage, collatToWithdraw, burnExactRemoved, slippage, closeLPPosition])

  const rebalSwap = useAppCallback(async () => {
    try {
      await rebalanceSwap(vaultID, lowerTick, upperTick, slippage, () => {})
    } catch (e) {
      console.log(e)
    }
  }, [vaultID, lowerTick, upperTick, slippage, rebalanceSwap])

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
                <TextField
                  className={classes.testField}
                  id="outlined-name"
                  label="Vault ID"
                  value={vaultID}
                  onChange={(event) => setVaultID(Number(event.target.value))}
                />
                <TextField
                  className={classes.testField}
                  id="outlined-name"
                  label="Squeeth Amount"
                  value={squeethAmount}
                  onChange={(event) => setSqueethAmount(Number(event.target.value))}
                />
                <TextField
                  className={classes.testField}
                  id="outlined-name"
                  label="Lower Tick"
                  value={lowerTick}
                  onChange={(event) => setLowerTick(Number(event.target.value))}
                />
                <TextField
                  className={classes.testField}
                  id="outlined-name"
                  label="Upper Tick"
                  value={upperTick}
                  onChange={(event) => setUpperTick(Number(event.target.value))}
                />
                <TextField
                  className={classes.testField}
                  id="outlined-name"
                  label="Slippage Tolerance"
                  value={slippage}
                  onChange={(event) => setSlippage(Number(event.target.value))}
                />
                <TextField
                  className={classes.testField}
                  id="outlined-name"
                  label="Collateral to Withdraw"
                  value={collatToWithdraw}
                  onChange={(event) => setCollatToWithdraw(Number(event.target.value))}
                />
                <TextField
                  className={classes.testField}
                  id="outlined-name"
                  label="Collat Ratio"
                  value={collatRatio}
                  onChange={(event) => setCollatRatio(Number(event.target.value))}
                />
                <TextField
                  className={classes.testField}
                  id="outlined-name"
                  label="Liquidity Percentage (in decimal)"
                  value={liquidityPercentage}
                  onChange={(event) => setLiquidityPercentage(Number(event.target.value))}
                />
                <TextField
                  className={classes.testField}
                  id="outlined-name"
                  label="Burn Percentage (in decimal)"
                  value={burnPercentage}
                  onChange={(event) => setBurnPercentage(Number(event.target.value))}
                />
                <TextField
                  className={classes.testField}
                  id="outlined-name"
                  label="Burn Exact Removed"
                  value={burnExactRemoved}
                  onChange={(event) => setBurnExactRemoved(Boolean(event.target.value))}
                />
                <br />
                <Button onClick={openPos} className={classes.buttonTest}>
                  {'Open Mint and Deposit'}
                </Button>
                <br />
                <Button onClick={updateOp} className={classes.buttonTest}>
                  {'Update Operator'}
                </Button>
                <br />
                <Button onClick={collFees} className={classes.buttonTest}>
                  {'Collect Fees'}
                </Button>
                <br />
                <Button onClick={closePos} className={classes.buttonTest}>
                  {'Close Position'}
                </Button>
                <br />
                <Button onClick={rebalSwap} className={classes.buttonTest}>
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
