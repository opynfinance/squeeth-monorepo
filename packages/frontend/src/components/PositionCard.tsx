import { Tooltip, Typography } from '@material-ui/core'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import ArrowRightAltIcon from '@material-ui/icons/ArrowRightAlt'
import InfoIcon from '@material-ui/icons/InfoOutlined'
import BigNumber from 'bignumber.js'
import clsx from 'clsx'
import Link from 'next/link'
import React, { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { useAtom, useAtomValue } from 'jotai'

import { Tooltips } from '@constants/enums'
import { PositionType, TradeType } from '../types'
import { useVaultLiquidations } from '@hooks/contracts/useLiquidations'
import { usePrevious } from 'react-use'
import {
  useComputeSwaps,
  useFirstValidVault,
  useLongRealizedPnl,
  useLPPositionsQuery,
  useShortRealizedPnl,
  useSwaps,
} from 'src/state/positions/hooks'
import { useETHPrice } from '@hooks/useETHPrice'
import { existingCollatAtom, isLPAtom, positionTypeAtom } from 'src/state/positions/atoms'
import { useVaultManager } from '@hooks/contracts/useVaultManager'
import {
  actualTradeTypeAtom,
  isOpenPositionAtom,
  sqthTradeAmountAtom,
  tradeCompletedAtom,
  tradeSuccessAtom,
  tradeTypeAtom,
} from 'src/state/trade/atoms'
import {
  useBuyAndSellQuote,
  useLongGain,
  useLongUnrealizedPNL,
  useShortGain,
  useShortUnrealizedPNL,
} from 'src/state/pnl/hooks'
import { loadingAtom } from 'src/state/pnl/atoms'

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
      padding: theme.spacing(2),
      width: '420px',
      // background: theme.palette.background.lightStone,
      borderRadius: theme.spacing(1),
      display: 'flex',
      flexDirection: 'column',
      [theme.breakpoints.down('sm')]: {
        width: '100%',
      },
      fontWeight: 700,
    },
    header: {
      display: 'flex',
    },
    title: {
      padding: theme.spacing(0.4, 1),
      fontSize: '.7rem',
      borderRadius: theme.spacing(0.5),
      marginLeft: theme.spacing(2),
    },
    positionTitle: {
      color: (props: any): any =>
        props.positionType === PositionType.LONG
          ? theme.palette.success.main
          : props.positionType === PositionType.SHORT
          ? theme.palette.error.main
          : 'inherit',
      backgroundColor: (props: any): any =>
        props.positionType === PositionType.LONG
          ? `${theme.palette.success.main}20`
          : props.positionType === PositionType.SHORT
          ? `${theme.palette.error.main}20`
          : '#DCDAE920',
    },
    postpositionTitle: {
      color: (props: any): any =>
        props.postPosition === PositionType.LONG
          ? theme.palette.success.main
          : props.postPosition === PositionType.SHORT && theme.palette.error.main,
      backgroundColor: (props: any): any =>
        props.postPosition === PositionType.LONG
          ? `${theme.palette.success.main}20`
          : props.postPosition === PositionType.SHORT
          ? `${theme.palette.error.main}20`
          : '#DCDAE920',
    },
    posBg: {
      background: (props: any): any => {
        const positionColor =
          props.positionType === PositionType.LONG
            ? '#375F4290'
            : props.positionType === PositionType.SHORT
            ? '#68373D40'
            : 'rgba(255, 255, 255, 0.08)'
        const postColor =
          props.postPosition === PositionType.LONG
            ? '#375F42'
            : props.postPosition === PositionType.SHORT
            ? '#68373D90'
            : 'rgba(255, 255, 255, 0.08)'
        return `linear-gradient(to right, ${positionColor} 0%,${postColor} 75%)`
      },
    },
    assetDiv: {
      display: 'flex',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
    },
    unit: {
      marginLeft: theme.spacing(0.5),
    },
    red: {
      color: theme.palette.error.main,
    },
    green: {
      color: theme.palette.success.main,
    },
    grey: {
      color: theme.palette.text.secondary,
    },
    floatingContainer: {
      position: 'fixed',
      bottom: '30px',
      left: theme.spacing(4),
      background: theme.palette.background.lightStone,
      padding: theme.spacing(1, 2),
      width: '200px',
      borderRadius: theme.spacing(1),
      backdropFilter: 'blur(50px)',
      zIndex: 10,
    },
    pnl: {
      display: 'flex',
      alignItems: 'baseline',
    },
    postTrade: {
      display: 'flex',
      justifyContent: 'center',
    },
    arrow: {
      color: theme.palette.grey[600],
      marginLeft: theme.spacing(1),
    },
    postTradeAmt: {
      marginLeft: theme.spacing(1),
    },
    link: {
      color: theme.palette.primary.main,
      textDecoration: 'underline',
      fontWeight: 600,
      fontSize: 14,
    },
    infoIcon: {
      fontSize: '10px',
      marginLeft: theme.spacing(0.5),
    },
  }),
)

const pnlClass = (positionType: string, long: number | BigNumber, short: number | BigNumber, classes: any) => {
  if (positionType === PositionType.LONG) return Number(long?.toFixed(2)) > 0 ? classes.green : classes.red
  if (positionType === PositionType.SHORT) return Number(short?.toFixed(2)) > 0 ? classes.green : classes.red

  return classes.grey
}

const PositionCard: React.FC = () => {
  const shortGain = useShortGain()
  const longGain = useLongGain()
  const { buyQuote, sellQuote } = useBuyAndSellQuote()
  const longUnrealizedPNL = useLongUnrealizedPNL()
  const shortUnrealizedPNL = useShortUnrealizedPNL()
  const loading = useAtomValue(loadingAtom)

  const pType = useAtomValue(positionTypeAtom)
  const existingCollat = useAtomValue(existingCollatAtom)
  const { data, startPolling, stopPolling } = useSwaps()
  const swaps = data?.swaps
  const { squeethAmount } = useComputeSwaps()
  const { vaults: shortVaults } = useVaultManager()
  const { firstValidVault, vaultId } = useFirstValidVault()
  const { loading: isPositionLoading } = useLPPositionsQuery()
  const isLP = useAtomValue(isLPAtom)
  const isOpenPosition = useAtomValue(isOpenPositionAtom)
  const [tradeSuccess, setTradeSuccess] = useAtom(tradeSuccessAtom)
  const [tradeCompleted, setTradeCompleted] = useAtom(tradeCompletedAtom)

  const longRealizedPNL = useLongRealizedPnl()
  const shortRealizedPNL = useShortRealizedPnl()
  const { liquidations } = useVaultLiquidations(Number(vaultId))
  const actualTradeType = useAtomValue(actualTradeTypeAtom)
  const tradeAmountInput = useAtomValue(sqthTradeAmountAtom)
  const tradeType = useAtomValue(tradeTypeAtom)
  const ethPrice = useETHPrice()
  const prevSwapsData = usePrevious(swaps)
  const tradeAmount = new BigNumber(tradeAmountInput)
  const [fetchingNew, setFetchingNew] = useState(false)
  const [postTradeAmt, setPostTradeAmt] = useState(new BigNumber(0))
  const [postPosition, setPostPosition] = useState(PositionType.NONE)
  const positionType = useMemo(() => (isPositionLoading ? PositionType.NONE : pType), [pType, isPositionLoading])
  const classes = useStyles({ positionType, postPosition })

  useEffect(() => {
    if (tradeSuccess && prevSwapsData?.length === swaps?.length) {
      //if trade success and number of swaps is still the same, start swaps polling
      startPolling(500)
      setFetchingNew(true)
    } else {
      setTradeCompleted(false)
      setTradeSuccess(false)
      stopPolling()
      setFetchingNew(false)
    }
  }, [swaps?.length, prevSwapsData?.length, tradeSuccess])

  const fullyLiquidated = useMemo(() => {
    return shortVaults.length && shortVaults[firstValidVault]?.shortAmount?.isZero() && liquidations.length > 0
  }, [firstValidVault, shortVaults?.length, liquidations?.length])

  const isDollarValueLoading = useMemo(() => {
    if (positionType === PositionType.LONG) {
      return loading || longGain.isLessThanOrEqualTo(-100) || !longGain.isFinite()
    } else if (positionType === PositionType.SHORT) {
      return loading || shortGain.isLessThanOrEqualTo(-100) || !shortGain.isFinite()
    } else {
      return null
    }
  }, [positionType, loading, longGain.toString(), shortGain.toString()])

  const getPositionBasedValue = useCallback(
    (long: any, short: any, none: any, loadingMsg?: any) => {
      if (loadingMsg && (loading || isPositionLoading)) return loadingMsg
      if (positionType === PositionType.LONG) {
        //if it's showing -100% it is still loading
        if (longGain.isLessThanOrEqualTo(-100) || !longGain.isFinite()) {
          return loadingMsg
        }
        return long
      }
      if (positionType === PositionType.SHORT) {
        //if it's showing -100% it is still loading
        if (shortGain.isLessThanOrEqualTo(-100) || !shortGain.isFinite()) {
          return loadingMsg
        }
        return short
      }
      return none
    },
    [isPositionLoading, loading, positionType, longGain.toString(), shortGain.toString()],
  )

  const getRealizedPNLBasedValue = useCallback(
    (long: any, short: any, none: any, loadingMsg?: any) => {
      if (loadingMsg && loading) return loadingMsg
      if (longRealizedPNL.isEqualTo(0) && shortRealizedPNL.isEqualTo(0)) return none
      if (positionType === PositionType.LONG) return long
      if (positionType === PositionType.SHORT) return short
      return none
    },
    [tradeSuccess, positionType, loading, longRealizedPNL.toString(), shortRealizedPNL.toString()],
  )

  useEffect(() => {
    if (isPositionLoading) return

    let _postTradeAmt = new BigNumber(0)
    let _postPosition = PositionType.NONE
    if (actualTradeType === TradeType.LONG && positionType !== PositionType.SHORT) {
      if (isOpenPosition) {
        _postTradeAmt = squeethAmount.plus(tradeAmount)
      } else {
        _postTradeAmt = squeethAmount.minus(tradeAmount)
      }
      if (_postTradeAmt.gt(0)) _postPosition = PositionType.LONG
    } else if (actualTradeType === TradeType.SHORT && positionType !== PositionType.LONG) {
      if (isOpenPosition) {
        _postTradeAmt = squeethAmount.isGreaterThan(0) ? squeethAmount.plus(tradeAmount) : tradeAmount
      } else {
        _postTradeAmt = squeethAmount.isGreaterThan(0) ? squeethAmount.minus(tradeAmount) : new BigNumber(0)
      }
      if (_postTradeAmt.gt(0)) {
        _postPosition = PositionType.SHORT
      }
    }

    setPostTradeAmt(_postTradeAmt)
    setPostPosition(_postPosition)
  }, [
    actualTradeType,
    isOpenPosition,
    isPositionLoading,
    positionType,
    squeethAmount.toString(),
    tradeAmount.toString(),
  ])

  const pnlLoading = useMemo(() => {
    if (positionType === PositionType.LONG) {
      return longUnrealizedPNL.loading
    }
    if (positionType === PositionType.SHORT) {
      return shortUnrealizedPNL.loading
    }
  }, [longUnrealizedPNL.loading, positionType, shortUnrealizedPNL.loading])

  return (
    <div className={clsx(classes.container, classes.posBg)}>
      {!fullyLiquidated ? (
        <div>
          <div className={classes.header}>
            <Typography variant="caption" component="span" style={{ fontWeight: 500 }} color="textSecondary">
              MY POSITION
            </Typography>
            <span className={clsx(classes.title, classes.positionTitle)}>{positionType.toUpperCase()}</span>
            {postPosition === positionType ||
            (tradeType === TradeType.LONG && positionType === PositionType.SHORT) ||
            (tradeType === TradeType.SHORT && positionType === PositionType.LONG) ? null : (
              <>
                <ArrowRightAltIcon className={classes.arrow} />
                <span className={clsx(classes.title, classes.postpositionTitle)}>{postPosition.toUpperCase()}</span>
              </>
            )}
          </div>
          <div className={classes.assetDiv}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <Typography component="span" style={{ fontWeight: 600 }}>
                  {getPositionBasedValue(squeethAmount.toFixed(6), squeethAmount.toFixed(6), '0', '0')}
                </Typography>

                {(tradeType === TradeType.SHORT && positionType === PositionType.LONG) ||
                (tradeType === TradeType.LONG && positionType === PositionType.SHORT) ||
                tradeAmount.isLessThanOrEqualTo(0) ||
                tradeAmount.isNaN() ||
                tradeCompleted ? null : (
                  <>
                    <ArrowRightAltIcon className={classes.arrow} />
                    <Typography
                      component="span"
                      style={{
                        fontWeight: 600,
                        color: postTradeAmt.gte(getPositionBasedValue(squeethAmount, squeethAmount, 0))
                          ? '#49D273'
                          : '#f5475c',
                      }}
                      className={classes.postTradeAmt}
                    >
                      {postTradeAmt.lte(0) ? 0 : postTradeAmt.toFixed(6)}
                    </Typography>
                  </>
                )}
                <Typography color="textSecondary" component="span" variant="body2" className={classes.unit}>
                  oSQTH
                </Typography>
              </div>
              {isDollarValueLoading ? (
                <Typography variant="caption" color="textSecondary">
                  Loading
                </Typography>
              ) : (
                <Typography variant="caption" color="textSecondary" style={{ marginTop: '.5em' }}>
                  $ {getPositionBasedValue(sellQuote.amountOut, buyQuote, new BigNumber(0)).times(ethPrice).toFixed(2)}
                </Typography>
              )}
            </div>
            <div>
              <div>
                <div>
                  <div>
                    <Typography variant="caption" color="textSecondary" style={{ fontWeight: 500 }}>
                      Unrealized P&L
                    </Typography>
                    <Tooltip
                      title={Tooltips.UnrealizedPnL}
                      // title={isLong ? Tooltips.UnrealizedPnL : `${Tooltips.UnrealizedPnL}. ${Tooltips.ShortCollateral}`}
                    >
                      <InfoIcon fontSize="small" className={classes.infoIcon} />
                    </Tooltip>
                  </div>
                  <div className={classes.pnl}>
                    {!pnlLoading ? (
                      <>
                        <Typography
                          className={pnlClass(positionType, longGain, shortGain, classes)}
                          style={{ fontWeight: 600 }}
                        >
                          {getPositionBasedValue(
                            `$${longUnrealizedPNL.usd.toFixed(2)}`,
                            `$${shortUnrealizedPNL.usd.toFixed(2)}`,
                            '--',
                            'Loading',
                          )}
                        </Typography>
                        <Typography
                          variant="caption"
                          className={pnlClass(positionType, longGain, shortGain, classes)}
                          style={{ marginLeft: '4px' }}
                        >
                          {getPositionBasedValue(`(${longGain.toFixed(2)}%)`, `(${shortGain.toFixed(2)}%)`, null, ' ')}
                        </Typography>
                      </>
                    ) : (
                      'Loading'
                    )}
                  </div>
                </div>
                <div>
                  <Typography variant="caption" color="textSecondary" style={{ fontWeight: 500 }}>
                    Realized P&L
                  </Typography>
                  <Tooltip
                    title={Tooltips.RealizedPnL}
                    // title={isLong ? Tooltips.RealizedPnL : `${Tooltips.RealizedPnL}. ${Tooltips.ShortCollateral}`}
                  >
                    <InfoIcon fontSize="small" className={classes.infoIcon} />
                  </Tooltip>
                </div>
                <div className={classes.pnl}>
                  <Typography
                    className={pnlClass(positionType, longRealizedPNL, shortRealizedPNL, classes)}
                    style={{ fontWeight: 600 }}
                  >
                    {getRealizedPNLBasedValue(
                      `$${longRealizedPNL.toFixed(2)}`,
                      `$${shortRealizedPNL.toFixed(2)}`,
                      '--',
                      'Loading',
                    )}
                  </Typography>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div>
          <Typography style={{ fontWeight: 600 }}>FULLY LIQUIDATED</Typography>
          <Typography variant="caption" component="span" style={{ fontWeight: 500 }} color="textSecondary">
            REDEEMABLE COLLATERAL
          </Typography>
          <Typography variant="body1">
            {isPositionLoading && existingCollat.isEqualTo(0) ? 'Loading' : existingCollat.toFixed(4)} ETH
          </Typography>
        </div>
      )}
      <Typography variant="caption" color="textSecondary">
        {fetchingNew ? 'Fetching latest position' : ' '}
      </Typography>
      {positionType === PositionType.SHORT ? (
        <Typography className={classes.link}>
          <Link href={`vault/${vaultId}`}>Manage Vault</Link>
        </Typography>
      ) : null}
      {isLP ? (
        <Typography className={classes.link}>
          <Link href="lp">Manage LP</Link>
        </Typography>
      ) : null}
    </div>
  )
}

const MemoizedPositionCard = memo(PositionCard)

export default MemoizedPositionCard
// function getPositionBasedValue(amountOut: BigNumber, buyQuote: BigNumber, arg2: BigNumber) {
//   throw new Error('Function not implemented.')
// }
