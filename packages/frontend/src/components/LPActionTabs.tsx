import { createStyles, makeStyles, Tooltip } from '@material-ui/core'
import Card from '@material-ui/core/Card'
import InputAdornment from '@material-ui/core/InputAdornment'
import TextField from '@material-ui/core/TextField'
import Typography from '@material-ui/core/Typography'
import { SettingsBackupRestoreTwoTone } from '@material-ui/icons'
import ArrowRightAltIcon from '@material-ui/icons/ArrowRightAlt'
import BigNumber from 'bignumber.js'
import React, { useEffect, useMemo, useState } from 'react'

import { WSQUEETH_DECIMALS } from '../constants'
import { useTrade } from '../context/trade'
import { useWallet } from '../context/wallet'
import { useController } from '../hooks/contracts/useController'
import { useSqueethPool } from '../hooks/contracts/useSqueethPool'
import { useTokenBalance } from '../hooks/contracts/useTokenBalance'
import { useAddresses } from '../hooks/useAddress'
import { useETHPrice } from '../hooks/useETHPrice'
import { useLongPositions, useShortPositions } from '../hooks/usePositions'
import { useTransactionHistory } from '../hooks/useTransactionHistory'
import { toTokenAmount } from '../utils/calculations'
import { PrimaryButton } from './Buttons'
import CollatRange from './CollatRange'
import { PrimaryInput } from './inputs/PrimaryInput'
import { StepperBox as Stepper } from './StepperBox'
import { SecondaryTab, SecondaryTabs } from './Tabs'
import Confirmed from './Trade/Confirmed'
import Long from './Trade/Long'
import TradeDetails from './Trade/TradeDetails'
import TradeInfoItem from './Trade/TradeInfoItem'
import { UniswapIframe } from './UniswapIframe'

const useStyles = makeStyles((theme) =>
  createStyles({
    tabBackGround: {
      position: 'sticky',
      top: '0',
      zIndex: 20,
      background: '#2A2D2E',
    },
    mintBurnContainer: {
      flexBasis: '25%',
      marginTop: '1.5em',
    },
    mintBurnCard: {
      maxWidth: '480px',
      backgroundColor: '#2a2d2e',
      margin: '0 auto',
      textAlign: 'center',
    },
    mintBurnTabPanel: {
      width: '100%',
      // margin: '0 auto',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
    },
    buttonDiv: {
      position: 'sticky',
      bottom: '0',
      background: '#2A2D2E',
      paddingBottom: theme.spacing(3),
    },
    hint: {
      display: 'flex',
      alignItems: 'center',
    },
    hintTextContainer: {
      display: 'flex',
    },
    hintTitleText: {
      marginRight: '.5em',
    },
    arrowIcon: {
      marginLeft: '4px',
      marginRight: '4px',
      fontSize: '20px',
    },
    thirdHeading: {
      marginTop: theme.spacing(1.5),
    },
    divider: {
      margin: theme.spacing(2, 0),
      width: '300px',
      marginLeft: 'auto',
      marginRight: 'auto',
    },
    amountInput: {
      marginTop: theme.spacing(1),
      backgroundColor: theme.palette.success.main,
    },
    stepper: {
      width: '100%',
      marginBottom: theme.spacing(1),
    },
    linkHover: {
      '&:hover': {
        opacity: 0.7,
      },
    },
    anchor: {
      color: '#FF007A',
      fontSize: '16px',
    },
  }),
)

interface LPActionTabsProps {
  amount: BigNumber
  setAmount: (amount: BigNumber) => void
  collatAmount: BigNumber
  setCollatAmount: (collatAmount: BigNumber) => void
  collatPercent: number
  setCollatPercent: (collatPercent: number) => void
  withdrawCollat: BigNumber
  setWithdrawCollat: (withdrawCollat: BigNumber) => void
  mintAmount: BigNumber
  setMintAmount: (mintAmount: BigNumber) => void
  loading: boolean
  setLoading: (loading: boolean) => void
  confirmed: boolean
  setConfirmed: (confirmed: boolean) => void
  txHash: string
  setTxHash: (txHash: string) => void
}

export const LPActionTabs: React.FC<LPActionTabsProps> = ({
  amount,
  setAmount,
  collatAmount,
  setCollatAmount,
  collatPercent,
  setCollatPercent,
  withdrawCollat,
  setWithdrawCollat,
  mintAmount,
  setMintAmount,
  loading,
  setLoading,
  confirmed,
  setConfirmed,
  txHash,
  setTxHash,
}) => {
  const [currentAction, setCurrentAction] = useState(0) // set current tab
  const [currentTabs, setCurrentTabs] = useState(0) //set tabs type
  const [buyStep, setBuyStep] = useState(0) // set active step for buy tab
  const [mintStep, setMintStep] = useState(0) // set active step for mint tab

  const classes = useStyles()
  const { pool, getWSqueethPositionValue, tvl } = useSqueethPool()
  const { balance, connected, address } = useWallet()
  const { weth, wSqueeth } = useAddresses()
  const squeethBal = useTokenBalance(wSqueeth, 10, WSQUEETH_DECIMALS)
  const {
    existingCollatPercent,
    shortVaults,
    firstValidVault,
    existingCollat,
    isMintedBal,
    squeethAmount: shortAmt,
  } = useShortPositions()
  const { squeethAmount: longAmt } = useLongPositions()
  const { transactions } = useTransactionHistory()
  const { tradeType, openPosition, setOpenPosition } = useTrade()
  const ethPrice = useETHPrice()
  const {
    getShortAmountFromDebt,
    openDepositAndMint,
    normFactor: normalizationFactor,
    getDebtAmount,
    burnAndRedeem,
  } = useController()

  const vaultId = useMemo(() => {
    if (!shortVaults.length) return 0

    return shortVaults[firstValidVault].id
  }, [shortVaults])

  const { mintMinCollatError, burnMinCollatError, minCollRatioError } = useMemo(() => {
    let mintMinCollatError = null
    let burnMinCollatError = null
    let minCollRatioError = null

    if (collatPercent < 150) {
      minCollRatioError = 'Minimum collateral ratio is 150%'
    }

    if (connected && collatAmount > balance) {
      mintMinCollatError = 'Insufficient ETH balance'
    } else if (connected && collatAmount.plus(existingCollat).lt(0.5)) {
      mintMinCollatError = 'Minimum collateral is 0.5 ETH'
    }

    if (connected && withdrawCollat.minus(existingCollat).abs().isLessThan(0.5)) {
      burnMinCollatError =
        'You must have at least 0.5 ETH collateral unless you fully close out your position. Either fully close your position, or close out less'
    }

    return { mintMinCollatError, burnMinCollatError, minCollRatioError }
  }, [amount, balance, amount, connected, withdrawCollat.toNumber(), existingCollat])

  useEffect(() => {
    setCurrentAction(0) // set default tab to mint tab
  }, [address])

  useEffect(() => {
    if (isMintedBal) {
      setCurrentTabs(2) // have minted
      setMintStep(1) // set mint tab default step to 2nd step
      if (longAmt.toNumber() > 0 && squeethBal.toNumber() > 0) {
        setBuyStep(1) // set buy tab default step to 2nd step
      } else {
        setBuyStep(0) // set buy tab default step to 1st step
      }
    } else {
      setMintStep(0) // set default step to 1st step
      if (longAmt.toNumber() > 0 && squeethBal.toNumber() > 0) {
        setCurrentTabs(1) // w squeeth but no minted bal
        setBuyStep(1) // set default step to 2nd step
      } else {
        setCurrentTabs(0) //no squeeth and no minted bal
        setBuyStep(0) // set default step to 1st step
      }
    }
    // return () => {
    //   setCurrentTabs(0)
    //   setBuyStep(0)
    //   setMintStep(0)
    //   setCurrentAction(0)
    // }
  }, [address, squeethBal, transactions, isMintedBal])

  useEffect(() => {
    if (collatAmount.isNaN() || collatAmount.isZero()) {
      setMintAmount(new BigNumber(0))
      return
    }
    const debt = collatAmount.times(100).div(collatPercent)
    getShortAmountFromDebt(debt).then((s) => setMintAmount(s))
  }, [collatPercent, collatAmount.toString()])

  useEffect(() => {
    if (amount.isNaN() || amount.isZero()) {
      setWithdrawCollat(new BigNumber(0))
      return
    }
    if (shortVaults.length && amount.isEqualTo(shortVaults[firstValidVault].shortAmount)) {
      setWithdrawCollat(shortVaults[firstValidVault].collateralAmount)
    } else {
      // console.log(squeethBal.toNumber(), shortVaults[0].shortAmount.toNumber(), amount.toNumber())
      getDebtAmount(shortVaults[firstValidVault].shortAmount.minus(amount)).then((debt) => {
        if (!debt) return
        const neededCollat = debt.times(collatPercent / 100)
        setWithdrawCollat(existingCollat.minus(neededCollat))
      })
    }
  }, [amount.toString(), existingCollat.toString(), shortVaults.length, firstValidVault, collatPercent, confirmed])

  const mint = async () => {
    setLoading(true)
    const confirmedHash = await openDepositAndMint(vaultId, mintAmount, collatAmount)
    setConfirmed(true)
    setMintStep(1)
    setTxHash(confirmedHash.transactionHash)
    setLoading(false)
  }

  const burn = async () => {
    console.log(shortVaults[firstValidVault])
    setLoading(true)
    const confirmedHash = await burnAndRedeem(vaultId, amount, withdrawCollat)
    setConfirmed(true)
    setTxHash(confirmedHash.transactionHash)
    setLoading(false)
  }

  const resetMintState = () => {
    setConfirmed(false)
    setMintStep(0)
  }

  const liqPrice = useMemo(() => {
    const rSqueeth = normalizationFactor.multipliedBy(amount.toNumber() || 1).dividedBy(10000)

    return collatAmount.div(rSqueeth.multipliedBy(1.5))
  }, [amount, collatPercent, collatAmount.toString(), normalizationFactor.toNumber()])

  const Mint = useMemo(() => {
    return (
      <div className={classes.mintBurnTabPanel}>
        <Stepper activeStep={mintStep} />
        {!confirmed ? (
          mintStep === 0 ? (
            <div>
              {/* <p style={{ textAlign: 'center', fontSize: '.75rem' }}>Mint Squeeth</p> */}
              <PrimaryInput
                value={collatAmount.toNumber().toString()}
                onChange={(v) => setCollatAmount(new BigNumber(v))}
                label="Collateral"
                tooltip="Collateral"
                actionTxt="Max"
                onActionClicked={() => setCollatAmount(toTokenAmount(balance, 18))}
                unit="ETH"
                convertedValue={0.0}
                hint={
                  !!mintMinCollatError ? (
                    mintMinCollatError
                  ) : (
                    <div className={classes.hint}>
                      <span className={classes.hintTextContainer}>
                        <span className={classes.hintTitleText}>Balance</span>{' '}
                        <span>{toTokenAmount(balance, 18).toFixed(4)}</span>
                      </span>
                      <span style={{ marginLeft: '4px' }}>ETH</span>
                    </div>
                  )
                }
                error={!!mintMinCollatError}
              />
              <div className={classes.thirdHeading}>
                <TextField
                  size="small"
                  value={collatPercent}
                  type="number"
                  style={{ width: 300 }}
                  onChange={(event: any) => setCollatPercent(Number(event.target.value))}
                  id="filled-basic"
                  label="Collateral Ratio"
                  variant="outlined"
                  error={!!minCollRatioError}
                  helperText={minCollRatioError}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <Typography variant="caption">%</Typography>
                      </InputAdornment>
                    ),
                  }}
                  inputProps={{
                    min: '0',
                  }}
                />
              </div>
              <div className={classes.thirdHeading}></div>
              <CollatRange onCollatValueChange={(val) => setCollatPercent(val)} collatValue={collatPercent} />

              <TradeDetails
                actionTitle="Mint"
                amount={mintAmount.toFixed(6)}
                unit="oSQTH"
                value={getWSqueethPositionValue(mintAmount).toFixed(2)}
                hint={`Position ${squeethBal.toFixed(6)}`}
              />
              <div className={classes.divider}>
                <TradeInfoItem
                  label="Liquidation Price"
                  value={liqPrice.toFixed(2)}
                  tooltip="Liquidation Price"
                  unit="USDC"
                />
                <TradeInfoItem
                  label="Current collateral ratio"
                  value={existingCollatPercent}
                  tooltip="Current collateral ratio"
                  unit="%"
                />
                <PrimaryButton
                  variant="contained"
                  onClick={mint}
                  className={classes.amountInput}
                  style={{ width: '100%' }}
                  disabled={!!mintMinCollatError}
                >
                  Mint
                </PrimaryButton>
              </div>
            </div>
          ) : (
            <UniswapIframe />
          )
        ) : (
          <div style={{ textAlign: 'center' }}>
            <Confirmed confirmationMessage={`Minted ${mintAmount.toFixed(6)} Squeeth`} txnHash={txHash} isLP={true} />
            <div className={classes.buttonDiv}>
              <PrimaryButton
                variant="contained"
                onClick={() => resetMintState()}
                className={classes.amountInput}
                style={{ width: '300px' }}
              >
                {'Close'}
              </PrimaryButton>
            </div>
          </div>
        )}
      </div>
    )
  }, [
    balance.toString(),
    classes.amountInput,
    classes.divider,
    classes.hint,
    classes.hintTextContainer,
    classes.hintTitleText,
    classes.mintBurnTabPanel,
    classes.thirdHeading,
    collatAmount.toString(),
    collatPercent.toString(),
    existingCollatPercent,
    liqPrice.toString(),
    mintAmount.toString(),
    squeethBal.toString(),
  ])

  const Burn = useMemo(() => {
    const quote = {
      amountOut: new BigNumber(0),
      priceImpact: '0.50',
      minimumAmountOut: 0.0,
    }
    return (
      <div className={classes.mintBurnTabPanel}>
        {!confirmed ? (
          <div>
            <p style={{ textAlign: 'center', fontSize: '.75rem' }}>Burn squeeth and redeem collateral</p>

            <PrimaryInput
              value={amount.toNumber().toString()}
              onChange={(v) => setAmount(new BigNumber(v))}
              label="Amount"
              tooltip="Amount of oSQTH to burn"
              actionTxt="Max"
              onActionClicked={() => setAmount(squeethBal)}
              unit="oSQTH"
              convertedValue={0.0}
              hint={
                !!burnMinCollatError ? (
                  burnMinCollatError
                ) : (
                  <div className={classes.hint}>
                    <span className={classes.hintTextContainer}>
                      <span className={classes.hintTitleText}>Balance</span> <span>{squeethBal.toFixed(6)}</span>
                    </span>
                    {quote.amountOut.gt(0) ? (
                      <>
                        <ArrowRightAltIcon className={classes.arrowIcon} />
                        <span>{amount}</span>
                      </>
                    ) : null}{' '}
                    <span style={{ marginLeft: '4px' }}>oSQTH</span>
                  </div>
                )
              }
              error={!!burnMinCollatError}
            />
            <div className={classes.thirdHeading}>
              <TextField
                size="small"
                value={collatPercent}
                type="number"
                style={{ width: 300 }}
                onChange={(event: any) => setCollatPercent(Number(event.target.value))}
                id="filled-basic"
                label="Collateral Ratio"
                variant="outlined"
                error={!!minCollRatioError}
                helperText={minCollRatioError}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <Typography variant="caption">%</Typography>
                    </InputAdornment>
                  ),
                }}
                inputProps={{
                  min: '0',
                }}
              />
            </div>
            <div className={classes.thirdHeading}></div>
            <CollatRange onCollatValueChange={(val) => setCollatPercent(val)} collatValue={collatPercent} />

            <TradeDetails
              actionTitle="Redeem"
              amount={withdrawCollat.abs().toFixed(4)}
              unit="ETH"
              value={withdrawCollat.abs().times(ethPrice).toFixed(2)}
              hint={
                <div className={classes.hint}>
                  <span className={classes.hintTextContainer}>
                    <span className={classes.hintTitleText}>Balance</span>{' '}
                    <span>{toTokenAmount(balance, 18).toFixed(4)}</span>
                  </span>
                  {withdrawCollat.toNumber() ? (
                    <>
                      <ArrowRightAltIcon className={classes.arrowIcon} />
                      <span>{toTokenAmount(balance, 18).plus(withdrawCollat).toFixed(4)}</span>
                    </>
                  ) : null}{' '}
                  <span style={{ marginLeft: '4px' }}>ETH</span>
                </div>
              }
            />
            <div className={classes.divider}>
              <TradeInfoItem label="Liquidation Price" value={0.0} tooltip="Liquidation Price" unit="USDC" />

              <TradeInfoItem label="Current collateral ratio" value={'0'} tooltip="Current collateral ratio" unit="%" />

              <PrimaryButton
                variant="contained"
                onClick={burn}
                className={classes.amountInput}
                disabled={!!burnMinCollatError}
                style={{ width: '100%' }}
              >
                Burn
              </PrimaryButton>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <Confirmed
              confirmationMessage={`Burned ${amount.toFixed(6)} Squeeth, Redeeming ${withdrawCollat.toFixed(4)} ETH`}
              txnHash={txHash}
            />
            <div className={classes.buttonDiv}>
              <PrimaryButton
                variant="contained"
                onClick={() => setConfirmed(false)}
                className={classes.amountInput}
                style={{ width: '300px' }}
              >
                {'Close'}
              </PrimaryButton>
            </div>
          </div>
        )}
      </div>
    )
  }, [
    amount.toString(),
    balance.toString(),
    classes.amountInput,
    classes.arrowIcon,
    classes.divider,
    classes.hint,
    classes.hintTextContainer,
    classes.hintTitleText,
    classes.mintBurnTabPanel,
    classes.thirdHeading,
    collatPercent,
    squeethBal.toString(),
    withdrawCollat.toString(),
  ])

  return (
    <div className={classes.mintBurnContainer}>
      <Card className={classes.mintBurnCard}>
        {currentTabs === 2 && (
          <>
            <SecondaryTabs
              value={currentAction}
              onChange={(evt, val) => {
                setCurrentAction(val)
                if (val === 2) {
                  setOpenPosition(val)
                }
              }}
              aria-label="simple tabs example"
              centered
              variant="fullWidth"
              className={classes.tabBackGround}
            >
              <SecondaryTab label="Mint" />
              <SecondaryTab label="Burn" />
              <SecondaryTab label="Buy" />
            </SecondaryTabs>
            <div>
              {currentAction === 0 ? (
                Mint
              ) : currentAction === 1 ? (
                Burn
              ) : (
                <Long
                  isLPage={true}
                  activeStep={buyStep}
                  balance={Number(toTokenAmount(balance, 18).toFixed(4))}
                  open={currentAction === 2}
                  closeTitle="Sell squeeth ERC20"
                />
              )}
            </div>
          </>
        )}
        {currentTabs === 1 && (
          <>
            <SecondaryTabs
              value={currentAction}
              onChange={(evt, val) => {
                setCurrentAction(val)
                if (val === 0 || val === 1) {
                  setOpenPosition(val)
                }
              }}
              aria-label="simple tabs example"
              centered
              variant="fullWidth"
              className={classes.tabBackGround}
            >
              <SecondaryTab label="Buy" />
              <SecondaryTab label="Sell" />
              <SecondaryTab label="Mint" />
            </SecondaryTabs>
            <div>
              {currentAction === 0 || currentAction === 1 ? (
                <Long
                  isLPage={true}
                  activeStep={buyStep}
                  balance={Number(toTokenAmount(balance, 18).toFixed(4))}
                  open={currentAction === 0}
                  closeTitle="Sell squeeth ERC20"
                />
              ) : (
                Mint
              )}
            </div>
          </>
        )}
        {currentTabs === 0 && (
          <>
            <SecondaryTabs
              value={currentAction}
              onChange={(evt, val) => {
                setCurrentAction(val)
                if (val === 0) {
                  setOpenPosition(val)
                }
              }}
              aria-label="simple tabs example"
              centered
              variant="fullWidth"
              className={classes.tabBackGround}
            >
              <SecondaryTab label="Buy" />
              <SecondaryTab label="Mint" />
            </SecondaryTabs>
            <div>
              {currentAction === 0 ? (
                <Long
                  activeStep={buyStep}
                  isLPage={true}
                  balance={Number(toTokenAmount(balance, 18).toFixed(4))}
                  open={currentAction === 0}
                  closeTitle="Sell squeeth ERC20"
                />
              ) : (
                Mint
              )}
            </div>
          </>
        )}
      </Card>
    </div>
  )
}
