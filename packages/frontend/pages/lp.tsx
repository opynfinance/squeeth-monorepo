import { Button, createStyles, makeStyles } from '@material-ui/core'
import Card from '@material-ui/core/Card'
import Chip from '@material-ui/core/Chip'
import InputAdornment from '@material-ui/core/InputAdornment'
import Paper from '@material-ui/core/Paper'
import Table from '@material-ui/core/Table'
import TableBody from '@material-ui/core/TableBody'
import TableCell from '@material-ui/core/TableCell'
import TableContainer from '@material-ui/core/TableContainer'
import TableHead from '@material-ui/core/TableHead'
import TableRow from '@material-ui/core/TableRow'
import TextField from '@material-ui/core/TextField'
import Typography from '@material-ui/core/Typography'
import ArrowRightAltIcon from '@material-ui/icons/ArrowRightAlt'
import BigNumber from 'bignumber.js'
import Image from 'next/image'
import React, { useEffect, useMemo, useState } from 'react'

import squeethTokenSymbol from '../public/images/Squeeth.png'
import { PrimaryButton } from '../src/components/Buttons'
import CollatRange from '../src/components/CollatRange'
import { PrimaryInput } from '../src/components/Inputs'
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
import { useLPPositions, useShortPositions } from '../src/hooks/usePositions'
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
    table: {
      minWidth: 650,
    },
    tableContainer: {
      flexBasis: '72%',
      marginTop: '1.5em',
      marginRight: '1.5em',
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
    anchor: {
      color: '#FF007A',
      fontSize: '16px',
    },
    listLink: {
      color: '#FF007A',
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

  const classes = useStyles()
  const { positions } = useLPPositions()
  const { pool } = useSqueethPool()
  const { balance, connected } = useWallet()
  const { wSqueeth } = useAddresses()
  const squeethBal = useTokenBalance(wSqueeth, 10, WSQUEETH_DECIMALS)
  const { existingCollatPercent, shortVaults, existingCollat } = useShortPositions()

  const {
    getShortAmountFromDebt,
    openDepositAndMint,
    normFactor: normalizationFactor,
    getDebtAmount,
    burnAndRedeem,
  } = useController()
  const { getWSqueethPositionValue } = useSqueethPool()
  const { vaults } = useVaultManager()
  const vaultId = useMemo(() => {
    if (!vaults.length) return 0

    return vaults[0].id
  }, [vaults])

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
    if (amount.isEqualTo(squeethBal) && shortVaults.length) {
      setWithdrawCollat(shortVaults[0].collateralAmount)
    } else {
      getDebtAmount(squeethBal.minus(amount)).then((debt) => {
        if (!debt) return
        const neededCollat = debt.times(collatPercent / 100)
        setWithdrawCollat(existingCollat.minus(neededCollat))
      })
    }
  }, [amount.toString(), existingCollat.toString(), shortVaults.length])

  const mint = async () => {
    setLoading(true)
    const confirmedHash = await openDepositAndMint(vaultId, mintAmount, collatAmount)
    setConfirmed(true)
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

  const liqPrice = useMemo(() => {
    const rSqueeth = normalizationFactor.multipliedBy(amount.toNumber() || 1).dividedBy(10000)

    return collatAmount.div(rSqueeth.multipliedBy(1.5))
  }, [amount, collatPercent, collatAmount.toString(), normalizationFactor.toNumber()])

  const Mint = useMemo(() => {
    return (
      <div className={classes.mintBurnTabPanel}>
        {!confirmed ? (
          <div>
            <p style={{ textAlign: 'center', fontSize: '.75rem' }}>Mint Squeeth</p>

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
              value={'1'}
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

  const inRange = (lower: number, upper: number) => {
    if (!pool) {
      return false
    }
    return upper > pool?.tickCurrent && pool?.tickCurrent > lower
  }

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

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <TableContainer component={Paper} className={classes.tableContainer}>
            <Table className={classes.table} aria-label="simple table">
              <TableHead>
                <TableRow>
                  <TableCell align="right">Token ID</TableCell>
                  <TableCell align="right">In Range</TableCell>
                  <TableCell align="right">% of Pool</TableCell>
                  <TableCell align="right">Liquidity</TableCell>
                  <TableCell align="right">Collected Fees</TableCell>
                  <TableCell align="right">Uncollected Fees</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {positions?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" style={{ textAlign: 'center', fontSize: '16px' }}>
                      <p>No Existing LP Positions</p>

                      <p>
                        <p>1. Mint Squeeth on the right.</p>
                        <a
                          href="https://squeeth-uniswap.netlify.app/#/add/ETH/0x06980aDd9a68D17eA81C7664ECD1e9DDB85360D9/3000"
                          target="_blank"
                          rel="noreferrer"
                          className={classes.listLink}
                        >
                          <p>2. Deposit Squeeth and ETH into Uniswap V3 Pool 🦄</p>
                        </a>
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  positions?.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell component="th" align="right" scope="row">
                        <a href={`https://squeeth-uniswap.netlify.app/#/pool/${p.id}`} target="_blank" rel="noreferrer">
                          #{p.id}
                        </a>
                      </TableCell>
                      <TableCell align="right">
                        {inRange(p.tickLower.tickIdx, p.tickUpper.tickIdx) ? (
                          <Chip label="Yes" size="small" />
                        ) : (
                          <Chip label="No" size="small" />
                        )}
                      </TableCell>
                      <TableCell align="right">
                        {((pool ? p.liquidity / Number(pool?.liquidity) : 0) * 100).toFixed(3)}
                      </TableCell>
                      <TableCell align="right">
                        <span style={{ marginRight: '.5em' }}>
                          {Number(p.amount0).toFixed(4)} {p.token0.symbol}
                        </span>
                        <span>
                          {Number(p.amount1).toFixed(4)} {p.token1.symbol}
                        </span>
                      </TableCell>
                      <TableCell align="right">
                        <span style={{ marginRight: '.5em' }}>
                          {p.collectedFeesToken0} {p.token0.symbol}
                        </span>
                        <span>
                          {p.collectedFeesToken1} {p.token1.symbol}
                        </span>
                      </TableCell>
                      <TableCell align="right">
                        <span style={{ marginRight: '.5em' }}>
                          {p.fees0?.toFixed(6)} {p.token0.symbol}
                        </span>
                        <span>
                          {p.fees1?.toFixed(6)} {p.token1.symbol}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
              {positions && positions?.length > 0 ? (
                <TableCell colSpan={6}>
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <a
                      href="https://squeeth-uniswap.netlify.app/#/add/ETH/0x06980aDd9a68D17eA81C7664ECD1e9DDB85360D9/3000"
                      target="_blank"
                      rel="noreferrer"
                      className={classes.anchor}
                    >
                      Provide Liquidity on Uniswap V3 🦄
                    </a>
                  </div>
                </TableCell>
              ) : null}
            </Table>
          </TableContainer>
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
