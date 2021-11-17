import { createStyles, makeStyles } from '@material-ui/core'
import Card from '@material-ui/core/Card'
import InputAdornment from '@material-ui/core/InputAdornment'
import Step from '@material-ui/core/Step'
import StepLabel from '@material-ui/core/StepLabel'
import Stepper from '@material-ui/core/Stepper'
import TextField from '@material-ui/core/TextField'
import Typography from '@material-ui/core/Typography'
import ArrowRightAltIcon from '@material-ui/icons/ArrowRightAlt'
import BigNumber from 'bignumber.js'
import Image from 'next/image'
import React, { useCallback, useEffect, useMemo, useState } from 'react'

import squeethTokenSymbol from '../public/images/Squeeth.png'
import { PrimaryButton } from '../src/components/Buttons'
import CollatRange from '../src/components/CollatRange'
import { PrimaryInput } from '../src/components/Inputs'
import { LPTable } from '../src/components/LPTable'
import Nav from '../src/components/Nav'
import { SecondaryTab, SecondaryTabs } from '../src/components/Tabs'
import Confirmed from '../src/components/Trade/Confirmed'
import TradeDetails from '../src/components/Trade/TradeDetails'
import TradeInfoItem from '../src/components/Trade/TradeInfoItem'
import { WSQUEETH_DECIMALS } from '../src/constants'
import { useWallet } from '../src/context/wallet'
import { useController } from '../src/hooks/contracts/useController'
import { useSqueethPool } from '../src/hooks/contracts/useSqueethPool'
import { useTokenBalance } from '../src/hooks/contracts/useTokenBalance'
import { useVaultManager } from '../src/hooks/contracts/useVaultManager'
import { useAddresses } from '../src/hooks/useAddress'
import { getETHPriceCoingecko, useETHPrice } from '../src/hooks/useETHPrice'
import { useShortPositions } from '../src/hooks/usePositions'
import { toTokenAmount } from '../src/utils/calculations'

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
      height: 'calc(100vh - 64px)',
      maxHeight: '1000px',
      padding: theme.spacing(4),
      maxWidth: '1600px',
    },
    logoContainer: {
      display: 'flex',
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
    innerTicket: {
      background: theme.palette.background.lightStone,
      overflow: 'auto',
    },
    mintBurnCard: {
      backgroundColor: '#2a2d2e',
      margin: '0 auto',
    },
    mintBurnTabPanel: {
      width: '98%',
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
    squeethInfo: {
      [theme.breakpoints.down('sm')]: {
        width: '100%',
        marginTop: theme.spacing(2),
      },
    },
    squeethInfoSubGroup: {
      display: 'flex',
      marginTop: theme.spacing(2),
      marginBottom: theme.spacing(2),
      alignItems: 'center',
    },
    infoItem: {
      marginRight: theme.spacing(1),
      paddingRight: theme.spacing(1.5),
    },
    infoLabel: {
      display: 'flex',
      alignItems: 'center',
    },
    stepper: {
      marginBottom: theme.spacing(1),
    },
  }),
)

export function LPCalculator() {
  const [currentAction, setCurrentAction] = useState(0)
  const [amount, setAmount] = useState(new BigNumber(0))
  const [collatAmount, setCollatAmount] = useState(new BigNumber(0))
  const [collatPercent, setCollatPercent] = useState(200)
  const [withdrawCollat, setWithdrawCollat] = useState(new BigNumber(0))
  const [mintAmount, setMintAmount] = useState(new BigNumber(0))
  const [loading, setLoading] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [txHash, setTxHash] = useState('')
  const [step, setStep] = useState(0)

  const classes = useStyles()
  const { pool, getWSqueethPositionValue, tvl } = useSqueethPool()
  const { balance, connected } = useWallet()
  const { weth, wSqueeth } = useAddresses()
  const squeethBal = useTokenBalance(wSqueeth, 10, WSQUEETH_DECIMALS)
  const { existingCollatPercent, shortVaults, existingCollat } = useShortPositions()
  const ethPrice = useETHPrice()
  const {
    mark,
    index,
    impliedVol,
    getShortAmountFromDebt,
    openDepositAndMint,
    normFactor: normalizationFactor,
    getDebtAmount,
    burnAndRedeem,
  } = useController()

  const steps = ['Mint Squeeth', 'LP the SQTH-ETH Uniswap Pool']

  const vaultId = useMemo(() => {
    if (!shortVaults.length) return 0

    return shortVaults[0].id
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
    if (shortVaults.length && amount.isEqualTo(shortVaults[0].shortAmount)) {
      setWithdrawCollat(shortVaults[0].collateralAmount)
    } else {
      console.log(squeethBal.toNumber(), shortVaults[0].shortAmount.toNumber(), amount.toNumber())
      getDebtAmount(shortVaults[0].shortAmount.minus(amount)).then((debt) => {
        if (!debt) return
        const neededCollat = debt.times(collatPercent / 100)
        setWithdrawCollat(existingCollat.minus(neededCollat))
      })
    }
  }, [amount.toString(), existingCollat.toString(), shortVaults.length, collatPercent, confirmed])

  const mint = async () => {
    setLoading(true)
    const confirmedHash = await openDepositAndMint(vaultId, mintAmount, collatAmount)
    setConfirmed(true)
    setStep(1)
    setTxHash(confirmedHash.transactionHash)
    setLoading(false)
  }

  const burn = async () => {
    console.log(shortVaults[0])
    setLoading(true)
    const confirmedHash = await burnAndRedeem(vaultId, amount, withdrawCollat)
    setConfirmed(true)
    setTxHash(confirmedHash.transactionHash)
    setLoading(false)
  }

  const resetMintState = () => {
    setConfirmed(false)
    setStep(0)
  }

  const liqPrice = useMemo(() => {
    const rSqueeth = normalizationFactor.multipliedBy(amount.toNumber() || 1).dividedBy(10000)

    return collatAmount.div(rSqueeth.multipliedBy(1.5))
  }, [amount, collatPercent, collatAmount.toString(), normalizationFactor.toNumber()])

  const Mint = useMemo(() => {
    return (
      <div className={classes.mintBurnTabPanel}>
        <Stepper activeStep={step} className={classes.stepper}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
        {!confirmed ? (
          <div>
            {/* <p style={{ textAlign: 'center', fontSize: '.75rem' }}>Mint Squeeth</p> */}

            <PrimaryInput
              value={collatAmount.toNumber()}
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
              value={amount.toNumber()}
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

  const SqueethInfo = useCallback(() => {
    return (
      <div className={classes.squeethInfo}>
        <div>
          <div className={classes.squeethInfoSubGroup}>
            {/* hard coded width layout to align with the next line */}
            <div className={classes.infoItem}>
              <Typography color="textSecondary" variant="body2">
                ETH Price
              </Typography>
              <Typography>${ethPrice.toNumber().toLocaleString()}</Typography>
            </div>
            <div className={classes.infoItem}>
              <div className={classes.infoLabel}>
                <Typography color="textSecondary" variant="body2">
                  ETH&sup2; Price
                </Typography>
              </div>
              <Typography>${Number(toTokenAmount(index, 18).toFixed(0)).toLocaleString()}</Typography>
            </div>
            <div className={classes.infoItem}>
              <div className={classes.infoLabel}>
                <Typography color="textSecondary" variant="body2">
                  Mark Price
                </Typography>
              </div>
              <Typography>${Number(toTokenAmount(mark, 18).toFixed(0)).toLocaleString()}</Typography>
            </div>
            <div className={classes.infoItem}>
              <div className={classes.infoLabel}>
                <Typography color="textSecondary" variant="body2">
                  oSQTH Price
                </Typography>
              </div>
              <Typography>${Number(getWSqueethPositionValue(1).toFixed(2).toLocaleString()) || 'loading'}</Typography>
            </div>
            <div className={classes.infoItem}>
              <div className={classes.infoLabel}>
                <Typography color="textSecondary" variant="body2">
                  Implied Volatility
                </Typography>
              </div>
              <Typography>{(impliedVol * 100).toFixed(2)}%</Typography>
            </div>

            {/* <div className={classes.infoItem}>
              <div className={classes.infoLabel}>
                <Typography color="textSecondary" variant="body2">
                  Pool TVL
                </Typography>
              </div>
              <Typography>{tvl || 'loading'}%</Typography>
            </div> */}
          </div>
        </div>
      </div>
    )
  }, [
    classes.infoItem,
    classes.infoLabel,
    classes.squeethInfo,
    classes.squeethInfoSubGroup,
    ethPrice.toNumber(),
    impliedVol.toString(),
    ethPrice.toString(),
    mark.toString(),
    index.toString(),
  ])

  return (
    <div>
      <Nav />
      <div className={classes.container}>
        <div className={classes.logoContainer}>
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
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <LPTable isLPage={true} pool={pool}></LPTable>
          <div className={classes.mintBurnContainer}>
            <Card className={classes.mintBurnCard}>
              <SecondaryTabs
                value={currentAction}
                onChange={(evt, val) => setCurrentAction(val)}
                aria-label="simple tabs example"
                centered
                variant="fullWidth"
                className={classes.tabBackGround}
              >
                <SecondaryTab label="Mint" />
                <SecondaryTab label="Burn" />
              </SecondaryTabs>
              <div>{currentAction === 0 ? Mint : Burn}</div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LPCalculator
