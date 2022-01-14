import { createStyles, makeStyles, Tooltip, Typography } from '@material-ui/core'
import FiberManualRecordIcon from '@material-ui/icons/FiberManualRecord'
import InfoIcon from '@material-ui/icons/InfoOutlined'
import Link from 'next/link'
import { useMemo, useState, useEffect } from 'react'
import BigNumber from 'bignumber.js'
import clsx from 'clsx'

import { LPTable } from '@components/Lp/LPTable'
import Nav from '@components/Nav'
import History from '@components/Trade/History'
import { WSQUEETH_DECIMALS } from '../src/constants'
import { PositionType } from '../src/types/'
import { Tooltips, TransactionType } from '@constants/enums'
import { useSqueethPool } from '@hooks/contracts/useSqueethPool'
import { useTokenBalance } from '@hooks/contracts/useTokenBalance'
import { useAddresses } from '@hooks/useAddress'
import { useETHPrice } from '@hooks/useETHPrice'
import { useLPPositions, usePnL, usePositions } from '@hooks/usePositions'
import { useTransactionHistory } from '@hooks/useTransactionHistory'
import { useVaultLiquidations } from '@hooks/contracts/useLiquidations'
import { toTokenAmount, fromTokenAmount } from '@utils/calculations'
import { useController } from '@hooks/contracts/useController'

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
      margin: theme.spacing(6, 8),
      width: '800px',
      marginLeft: 'auto',
      marginRight: 'auto',
      [theme.breakpoints.down('sm')]: {
        width: '100%',
        padding: theme.spacing(0, 2),
      },
    },
    header: {
      marginTop: theme.spacing(8),
      display: 'flex',
      justifyContent: 'space-between',
    },
    position: {
      padding: theme.spacing(2),
      backgroundColor: `${theme.palette.background.paper}40`,
      marginTop: theme.spacing(2),
      borderRadius: theme.spacing(1),
      display: 'flex',
      justifyContent: 'space-between',
      [theme.breakpoints.down('sm')]: {
        display: 'block',
      },
    },
    positionData: {
      display: 'flex',
      justifyContent: 'space-between',
      width: '65%',
      [theme.breakpoints.down('sm')]: {
        marginTop: theme.spacing(1),
        width: '100%',
      },
    },
    shortPositionData: {
      width: '65%',
      [theme.breakpoints.down('sm')]: {
        marginTop: theme.spacing(1),
        width: '100%',
      },
    },
    innerPositionData: {
      display: 'flex',
      width: '100%',
    },
    positionTitle: {
      width: '30%',
      [theme.breakpoints.down('sm')]: {
        width: '100%',
      },
    },
    empty: {
      marginTop: theme.spacing(2),
    },
    green: {
      color: theme.palette.success.main,
    },
    red: {
      color: theme.palette.error.main,
    },
    history: {
      marginTop: theme.spacing(8),
    },
    link: {
      color: theme.palette.primary.main,
      textDecoration: 'underline',
      fontWeight: 600,
      fontSize: 14,
      marginTop: theme.spacing(1),
    },
    infoIcon: {
      fontSize: '10px',
      marginLeft: theme.spacing(0.5),
    },
    tooltipContainer: {
      marginLeft: '.5em',
    },
    dotIcon: {
      marginRight: '1em',
    },
  }),
)

export function Positions() {
  const [existingCollatPercent, setExistingCollatPercent] = useState(0)
  const [existingLiqPrice, setExistingLiqPrice] = useState(new BigNumber(0))
  const classes = useStyles()
  const {
    longGain,
    shortGain,
    buyQuote,
    sellQuote,
    // longUsdAmt,
    // shortUsdAmt,
    longRealizedPNL,
    shortRealizedPNL,
    loading: isPnLLoading,
  } = usePnL()
  const { activePositions, loading: isPositionFinishedCalc } = useLPPositions()
  const { pool } = useSqueethPool()

  const { wSqueeth } = useAddresses()
  const wSqueethBal = useTokenBalance(wSqueeth, 15, WSQUEETH_DECIMALS)
  const ethPrice = useETHPrice()

  const {
    positionType,
    squeethAmount,
    wethAmount,
    loading: isPositionLoading,
    shortVaults,
    firstValidVault,
    vaultId,
    existingCollat,
    lpedSqueeth,
  } = usePositions()

  const { index, getCollatRatioAndLiqPrice } = useController()
  const { transactions } = useTransactionHistory()

  const lastDeposit = useMemo(
    () => transactions.find((transaction) => transaction.transactionType === TransactionType.MINT_SHORT),
    [transactions?.length],
  )

  const vaultExists = useMemo(() => {
    return shortVaults.length && shortVaults[firstValidVault]?.collateralAmount?.isGreaterThan(0)
  }, [firstValidVault, shortVaults?.length])

  const { liquidations } = useVaultLiquidations(Number(vaultId))

  const fullyLiquidated = useMemo(() => {
    return shortVaults.length && shortVaults[firstValidVault]?.shortAmount?.isZero() && liquidations.length > 0
  }, [firstValidVault, shortVaults?.length, liquidations?.length])

  useEffect(() => {
    getCollatRatioAndLiqPrice(
      new BigNumber(fromTokenAmount(shortVaults[firstValidVault]?.collateralAmount, 18)),
      new BigNumber(fromTokenAmount(shortVaults[firstValidVault]?.shortAmount, WSQUEETH_DECIMALS)),
    ).then(({ collateralPercent, liquidationPrice }) => {
      setExistingCollatPercent(collateralPercent)
      setExistingLiqPrice(liquidationPrice)
    })
  }, [firstValidVault, shortVaults?.length])

  const mintedDebt = useMemo(() => {
    return wSqueethBal?.isGreaterThan(0) && positionType === PositionType.LONG
      ? wSqueethBal.minus(squeethAmount)
      : wSqueethBal
  }, [positionType, squeethAmount.toString(), wSqueethBal.toString()])

  const lpDebt = useMemo(() => {
    return lpedSqueeth.isGreaterThan(0) ? lpedSqueeth : new BigNumber(0)
  }, [squeethAmount.toString(), lpedSqueeth.toString()])

  const shortDebt = useMemo(() => {
    return positionType === PositionType.SHORT ? squeethAmount : new BigNumber(0)
  }, [squeethAmount.toString(), lpDebt.toString(), mintedDebt.toString()])

  return (
    <div>
      <Nav />
      <div className={classes.container}>
        <div className={classes.header}>
          <Typography color="primary" variant="h6">
            Your Positions
          </Typography>
          <div style={{ display: 'flex' }}>
            <Typography component="span" color="textSecondary">
              ETH Price:{' '}
            </Typography>

            <div className={classes.tooltipContainer}>
              <Typography component="span">$ {toTokenAmount(index, 18).sqrt().toFixed(2).toLocaleString()}</Typography>
              <Tooltip title={Tooltips.SpotPrice}>
                <FiberManualRecordIcon fontSize="small" className={clsx(classes.dotIcon, classes.infoIcon)} />
              </Tooltip>
            </div>
          </div>
        </div>
        {/* eslint-disable-next-line prettier/prettier */}
        {(wSqueethBal.isZero() && shortVaults.length && shortVaults[firstValidVault]?.collateralAmount.isZero()) ||
        (wSqueethBal.isZero() && shortVaults.length === 0 && squeethAmount.isEqualTo(0)) ||
        (positionType !== PositionType.LONG &&
          positionType !== PositionType.SHORT &&
          !wSqueethBal.isGreaterThan(0) &&
          shortVaults[firstValidVault]?.collateralAmount.isZero()) ? (
          <div className={classes.empty}>
            <Typography>No active positions</Typography>
          </div>
        ) : null}

        {!shortDebt.isGreaterThan(0) && positionType === PositionType.LONG ? (
          <div className={classes.position}>
            <div className={classes.positionTitle}>
              <Typography>Long Squeeth</Typography>
            </div>
            <div className={classes.shortPositionData}>
              <div className={classes.innerPositionData}>
                <div style={{ width: '50%' }}>
                  <Typography variant="caption" component="span" color="textSecondary">
                    Position
                  </Typography>
                  <Typography variant="body1">
                    {isPositionLoading && squeethAmount.isEqualTo(0) ? 'Loading' : squeethAmount.toFixed(8)}
                    &nbsp; oSQTH
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    $
                    {isPnLLoading && sellQuote.amountOut.times(toTokenAmount(index, 18).sqrt()).isEqualTo(0)
                      ? 'Loading'
                      : sellQuote.amountOut.times(toTokenAmount(index, 18).sqrt()).toFixed(2)}
                  </Typography>
                </div>
                <div style={{ width: '50%' }}>
                  <Typography variant="caption" color="textSecondary">
                    Unrealized P&L
                  </Typography>
                  <Tooltip title={Tooltips.UnrealizedPnL}>
                    <InfoIcon fontSize="small" className={classes.infoIcon} />
                  </Tooltip>
                  {isPnLLoading || longGain.isLessThanOrEqualTo(-100) || !longGain.isFinite() ? (
                    <Typography variant="body1">Loading</Typography>
                  ) : (
                    <>
                      <Typography variant="body1" className={longGain.isLessThan(0) ? classes.red : classes.green}>
                        ${sellQuote.amountOut.minus(wethAmount.abs()).times(toTokenAmount(index, 18).sqrt()).toFixed(2)}{' '}
                        ({sellQuote.amountOut.minus(wethAmount.abs()).toFixed(5)} ETH)
                      </Typography>
                      <Typography variant="caption" className={longGain.isLessThan(0) ? classes.red : classes.green}>
                        {(longGain || 0).toFixed(2)}%
                      </Typography>
                    </>
                  )}
                </div>
              </div>
              <div className={classes.innerPositionData} style={{ marginTop: '16px' }}>
                <div style={{ width: '50%' }}>
                  <Typography variant="caption" component="span" color="textSecondary">
                    Realized P&L
                  </Typography>
                  <Tooltip title={Tooltips.RealizedPnL}>
                    <InfoIcon fontSize="small" className={classes.infoIcon} />
                  </Tooltip>
                  <Typography variant="body1" className={longRealizedPNL.gte(0) ? classes.green : classes.red}>
                    $ {isPnLLoading && longRealizedPNL.isEqualTo(0) ? 'Loading' : longRealizedPNL.toFixed(2)}
                  </Typography>
                </div>
              </div>
            </div>
          </div>
        ) : null}
        {shortDebt.isGreaterThan(0) && vaultExists && !fullyLiquidated ? (
          <div className={classes.position}>
            <div className={classes.positionTitle}>
              <Typography>Short Squeeth</Typography>
              <Typography className={classes.link}>
                <Link href={`vault/${vaultId}`}>Manage</Link>
              </Typography>
            </div>
            <div className={classes.shortPositionData}>
              <div className={classes.innerPositionData}>
                <div style={{ width: '50%' }}>
                  <Typography variant="caption" component="span" color="textSecondary">
                    Position
                  </Typography>
                  {isPositionFinishedCalc ? (
                    <Typography variant="body1">Loading</Typography>
                  ) : (
                    <>
                      <Typography variant="body1">{squeethAmount.toFixed(8) + ' oSQTH'}</Typography>
                      <Typography variant="body2" color="textSecondary">
                        ${buyQuote.times(toTokenAmount(index, 18).sqrt()).toFixed(2)}
                      </Typography>
                    </>
                  )}
                </div>
                <div style={{ width: '50%' }}>
                  <Typography variant="caption" color="textSecondary">
                    Unrealized P&L
                  </Typography>
                  <Tooltip title={Tooltips.UnrealizedPnL}>
                    <InfoIcon fontSize="small" className={classes.infoIcon} />
                  </Tooltip>
                  {isPositionFinishedCalc || shortGain.isLessThanOrEqualTo(-100) || !shortGain.isFinite() ? (
                    <Typography variant="body1">Loading</Typography>
                  ) : (
                    <>
                      <Typography variant="body1" className={shortGain.isLessThan(0) ? classes.red : classes.green}>
                        $
                        {wethAmount
                          .minus(buyQuote)
                          .times(toTokenAmount(index, 18).sqrt())
                          .plus(lastDeposit?.ethAmount.times(lastDeposit?.ethPriceAtDeposit.minus(ethPrice)))
                          .toFixed(2)}{' '}
                        ({wethAmount.minus(buyQuote).toFixed(5)} ETH)
                      </Typography>
                      <Typography variant="caption" className={shortGain.isLessThan(0) ? classes.red : classes.green}>
                        {(shortGain || 0).toFixed(2)}%
                      </Typography>
                    </>
                  )}
                </div>
              </div>
              <div className={classes.innerPositionData} style={{ marginTop: '16px' }}>
                <div style={{ width: '50%' }}>
                  <Typography variant="caption" component="span" color="textSecondary">
                    Liquidation Price
                  </Typography>
                  <Tooltip title={Tooltips.LiquidationPrice}>
                    <InfoIcon fontSize="small" className={classes.infoIcon} />
                  </Tooltip>
                  <Typography variant="body1">
                    {isPositionFinishedCalc && existingLiqPrice.isEqualTo(0)
                      ? 'Loading'
                      : '$' + existingLiqPrice.toFixed(2)}
                  </Typography>
                </div>
                <div style={{ width: '50%' }}>
                  <Typography variant="caption" component="span" color="textSecondary">
                    Collateral (Amt / Ratio)
                  </Typography>
                  <Typography variant="body1">
                    {isPositionLoading && existingCollat.isEqualTo(0) ? 'Loading' : existingCollat.toFixed(4)} ETH (
                    {existingCollatPercent}%)
                  </Typography>
                </div>
              </div>
              <div className={classes.innerPositionData} style={{ marginTop: '16px' }}>
                <div style={{ width: '50%' }}>
                  <Typography variant="caption" component="span" color="textSecondary">
                    Realized P&L
                  </Typography>
                  <Tooltip title={Tooltips.RealizedPnL}>
                    <InfoIcon fontSize="small" className={classes.infoIcon} />
                  </Tooltip>
                  <Typography variant="body1" className={shortRealizedPNL.gte(0) ? classes.green : classes.red}>
                    $ {isPnLLoading && shortRealizedPNL.isEqualTo(0) ? 'Loading' : shortRealizedPNL.toFixed(2)}
                  </Typography>
                </div>
              </div>
            </div>
          </div>
        ) : null}
        {lpDebt.isGreaterThan(0) && vaultExists && !fullyLiquidated ? (
          <div className={classes.position}>
            <div className={classes.positionTitle}>
              <Typography>LPed Squeeth</Typography>
              <Typography className={classes.link}>
                {vaultExists ? <Link href={`vault/${vaultId}`}>Manage</Link> : null}
              </Typography>
            </div>
            <div className={classes.shortPositionData}>
              <div className={classes.innerPositionData}>
                <div style={{ width: '50%' }}>
                  <Typography variant="caption" component="span" color="textSecondary">
                    Amount
                  </Typography>
                  <Typography variant="body1">
                    {lpDebt.toFixed(8)}
                    &nbsp; oSQTH
                  </Typography>
                </div>
              </div>
              <div className={classes.innerPositionData} style={{ marginTop: '16px' }}>
                {new BigNumber(existingLiqPrice).isFinite() ? (
                  <div style={{ width: '50%' }}>
                    <Typography variant="caption" component="span" color="textSecondary">
                      Liquidation Price
                    </Typography>
                    <Tooltip title={Tooltips.LiquidationPrice}>
                      <InfoIcon fontSize="small" className={classes.infoIcon} />
                    </Tooltip>
                    <Typography variant="body1">
                      ${isPositionLoading && existingLiqPrice.isEqualTo(0) ? 'Loading' : existingLiqPrice.toFixed(2)}
                    </Typography>
                  </div>
                ) : null}
                <div style={{ width: '50%' }}>
                  <Typography variant="caption" component="span" color="textSecondary">
                    Collateral (Amt / Ratio)
                  </Typography>
                  <Typography variant="body1">
                    {isPositionLoading && existingCollat.isEqualTo(0) ? 'Loading' : existingCollat.toFixed(4)} ETH
                    {new BigNumber(existingCollatPercent).isFinite() ? ' (' + existingCollatPercent + ' %)' : null}
                  </Typography>
                </div>
              </div>
            </div>
          </div>
        ) : null}
        {mintedDebt.isGreaterThan(0) && !fullyLiquidated ? (
          <div className={classes.position}>
            <div className={classes.positionTitle}>
              <Typography>Minted Squeeth</Typography>
              <Typography className={classes.link}>
                {vaultExists ? <Link href={`vault/${vaultId}`}>Manage</Link> : null}
              </Typography>
            </div>
            <div className={classes.shortPositionData}>
              <div className={classes.innerPositionData}>
                <div style={{ width: '50%' }}>
                  <Typography variant="caption" component="span" color="textSecondary">
                    Amount
                  </Typography>
                  <Typography variant="body1">
                    {wSqueethBal?.isGreaterThan(0) &&
                    positionType === PositionType.LONG &&
                    wSqueethBal.minus(squeethAmount).isGreaterThan(0)
                      ? wSqueethBal.minus(squeethAmount).toFixed(8)
                      : wSqueethBal.toFixed(8)}
                    &nbsp; oSQTH
                  </Typography>
                </div>
              </div>
              <div className={classes.innerPositionData} style={{ marginTop: '16px' }}>
                {new BigNumber(existingLiqPrice).isFinite() ? (
                  <div style={{ width: '50%' }}>
                    <Typography variant="caption" component="span" color="textSecondary">
                      Liquidation Price
                    </Typography>
                    <Tooltip title={Tooltips.LiquidationPrice}>
                      <InfoIcon fontSize="small" className={classes.infoIcon} />
                    </Tooltip>
                    <Typography variant="body1">
                      $ {isPositionLoading && existingLiqPrice.isEqualTo(0) ? 'Loading' : existingLiqPrice.toFixed(2)}
                    </Typography>
                  </div>
                ) : null}
                <div style={{ width: '50%' }}>
                  <Typography variant="caption" component="span" color="textSecondary">
                    Collateral (Amt / Ratio)
                  </Typography>
                  <Typography variant="body1">
                    {isPositionLoading && existingCollat.isEqualTo(0) ? 'Loading' : existingCollat.toFixed(4)} ETH
                    {new BigNumber(existingCollatPercent).isFinite() ? ' (' + existingCollatPercent + ' %)' : null}
                  </Typography>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {liquidations.length > 0 ? (
          <div className={classes.position}>
            <div className={classes.positionTitle}>
              <Typography className={classes.red}>Short Squeeth - Liquidated</Typography>
              <Typography className={classes.link}>
                <Link href={`vault/${vaultId}`}>Manage</Link>
              </Typography>
            </div>
            <div className={classes.shortPositionData}>
              <div className={classes.innerPositionData}>
                <div style={{ width: '50%' }}>
                  <Typography variant="caption" component="span" color="textSecondary">
                    Redeemable Collateral
                  </Typography>
                  <Typography variant="body1">
                    {isPositionLoading && existingCollat.isEqualTo(0) ? 'Loading' : existingCollat.toFixed(4)} ETH
                    {new BigNumber(existingCollatPercent).isFinite() ? ' (' + existingCollatPercent + ' %)' : null}
                  </Typography>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {activePositions?.length > 0 ? (
          <>
            <div className={classes.header}>
              <Typography color="primary" variant="h6">
                Your LP Positions
              </Typography>
            </div>
            <LPTable isLPage={false} pool={pool} />
          </>
        ) : null}
        <div className={classes.history}>
          <Typography color="primary" variant="h6">
            Transaction History
          </Typography>
          <History />
        </div>
      </div>
    </div>
  )
}

export default Positions
