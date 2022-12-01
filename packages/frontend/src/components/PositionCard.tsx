import { Typography, Box } from '@material-ui/core'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import ArrowRightAltIcon from '@material-ui/icons/ArrowRightAlt'
import BigNumber from 'bignumber.js'
import clsx from 'clsx'
import Link from 'next/link'
import React, { memo, useState } from 'react'
import { useAtom, useAtomValue } from 'jotai'

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
import { isLPAtom, positionTypeAtom, swapsAtom, isToHidePnLAtom } from 'src/state/positions/atoms'
import {
  actualTradeTypeAtom,
  isOpenPositionAtom,
  sqthTradeAmountAtom,
  tradeCompletedAtom,
  tradeSuccessAtom,
  tradeTypeAtom,
} from 'src/state/trade/atoms'
import {
  useLongGain,
  useShortGain,
  useCurrentLongPositionValue,
  useCurrentShortPositionValue,
  useLongUnrealizedPNL,
  useShortUnrealizedPNL,
} from 'src/state/pnl/hooks'
import { loadingAtom } from 'src/state/pnl/atoms'
import { useVaultData } from '@hooks/useVaultData'
import useAppEffect from '@hooks/useAppEffect'
import useAppCallback from '@hooks/useAppCallback'
import useAppMemo from '@hooks/useAppMemo'
import { HidePnLText } from './HidePnLText'
import Metric from '@components/Metric'

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
      padding: theme.spacing(2),
      marginTop: '16px',
      width: '420px',
      alignSelf: 'flex-start',
      background: theme.palette.background.stone,
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
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: '5px',
    },
    posTypeChange: {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
    },
    title: {
      padding: theme.spacing(0.8, 1.5),
      fontSize: '15px',
      fontWeight: 500,
      borderRadius: theme.spacing(1),
      // marginLeft: theme.spacing(2),
    },
    subtitle: {
      fontSize: '20px',
      fontWeight: 700,
      letterSpacing: '-0.01em',
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
    redPosition: {
      color: theme.palette.error.main,
      backgroundColor: `${theme.palette.error.main}20`,
    },
    posBg: {
      background: (props: any): any => {
        const positionColor =
          props.positionType === PositionType.LONG
            ? '#375F4290'
            : props.positionType === PositionType.SHORT
            ? '#68373D40'
            : theme.palette.background.stone
        const postColor =
          props.postPosition === PositionType.LONG
            ? '#375F42'
            : props.postPosition === PositionType.SHORT
            ? '#68373D90'
            : theme.palette.background.stone
        return `linear-gradient(to right, ${positionColor} 0%,${postColor} 75%)`
      },
    },
    assetDiv: {
      display: 'flex',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      marginTop: '16px',
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
    postAmount: {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
    },
    arrow: {
      color: theme.palette.grey[600],
    },
    link: {
      color: theme.palette.primary.main,
      fontWeight: 500,
      fontSize: 14,
    },
    pnlTitle: {
      display: 'flex',
      alignItems: 'center',
    },
    amountText: {
      fontFamily: 'DM Mono',
      fontSize: '22px',
      fontWeight: 500,
      lineHeight: '1em',
    },
    amountUnit: {
      fontSize: '20px',
    },
    positionUsdValue: {
      color: 'rgba(255, 255, 255, 0.6)',
      marginLeft: '12px',
    },
    labelContainer: {
      display: 'flex',
      justifyContent: 'space-between',
    },
    label: {
      color: 'rgba(255, 255, 255, 0.5)',
      fontSize: '15px',
      fontWeight: 500,
      width: 'max-content',
    },
  }),
)

const pnlClass = (positionType: string, long: number | BigNumber, short: number | BigNumber, classes: any) => {
  if (positionType === PositionType.LONG) return Number(long?.toFixed(2)) > 0 ? classes.green : classes.red
  if (positionType === PositionType.SHORT) return Number(short?.toFixed(2)) > 0 ? classes.green : classes.red

  return ''
}

const PositionCard: React.FC = () => {
  const shortGain = useShortGain()
  const longGain = useLongGain()
  const longUnrealizedPNL = useLongUnrealizedPNL()
  const shortUnrealizedPNL = useShortUnrealizedPNL()
  const longPositionValue = useCurrentLongPositionValue()
  const shortPositionValue = useCurrentShortPositionValue()
  const loading = useAtomValue(loadingAtom)
  const isToHidePnL = useAtomValue(isToHidePnLAtom)

  const positionType = useAtomValue(positionTypeAtom)
  const { startPolling, stopPolling } = useSwaps()
  const swapsData = useAtomValue(swapsAtom)
  const swaps = swapsData.swaps
  const { squeethAmount } = useComputeSwaps()
  const { validVault: vault, vaultId } = useFirstValidVault()
  const { existingCollat } = useVaultData(vault)
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
  const prevSwapsData = usePrevious(swaps)
  const tradeAmount = useAppMemo(() => new BigNumber(tradeAmountInput), [tradeAmountInput])
  const [fetchingNew, setFetchingNew] = useState(false)
  const [postTradeAmt, setPostTradeAmt] = useState(new BigNumber(0))
  const [postPosition, setPostPosition] = useState(PositionType.NONE)
  const classes = useStyles({ positionType, postPosition })

  useAppEffect(() => {
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
  }, [swaps, prevSwapsData, tradeSuccess, setTradeCompleted, startPolling, stopPolling, setTradeSuccess])

  const fullyLiquidated = useAppMemo(() => {
    return Boolean(vault && vault.shortAmount.isZero() && liquidations.length > 0)
  }, [vault, liquidations])

  const isDollarValueLoading = useAppMemo(() => {
    if (positionType === PositionType.LONG || positionType === PositionType.SHORT) {
      return loading
    } else {
      return null
    }
  }, [positionType, loading])

  const getPositionBasedValue = useAppCallback(
    (long: any, short: any, none: any, loadingMsg?: any) => {
      if (loadingMsg && loading) return loadingMsg
      if (positionType === PositionType.LONG) {
        return long
      }
      if (positionType === PositionType.SHORT) {
        return short
      }
      return none
    },
    [loading, positionType],
  )

  const getRealizedPNLBasedValue = useAppCallback(
    (long: any, short: any, none: any, loadingMsg?: any) => {
      if (isToHidePnL) return none
      if (loadingMsg && loading) return loadingMsg
      if (longRealizedPNL.isEqualTo(0) && shortRealizedPNL.isEqualTo(0)) return none
      if (positionType === PositionType.LONG) return long
      if (positionType === PositionType.SHORT) return short
      return none
    },
    [isToHidePnL, positionType, loading, longRealizedPNL, shortRealizedPNL],
  )

  useAppEffect(() => {
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
  }, [actualTradeType, isOpenPosition, isPositionLoading, positionType, squeethAmount, tradeAmount])

  const pnlLoading = useAppMemo(() => {
    if (positionType === PositionType.LONG) {
      return longUnrealizedPNL.loading
    }
    if (positionType === PositionType.SHORT) {
      return shortUnrealizedPNL.loading
    }
  }, [longUnrealizedPNL.loading, positionType, shortUnrealizedPNL.loading])

  return (
    <div>
      <Box display="flex" alignItems="center" gridGap="24px">
        <Typography variant="h4" className={classes.subtitle}>
          My Position
        </Typography>

        {fullyLiquidated ? (
          <span className={clsx(classes.title, classes.redPosition)}>Fully Liquidated</span>
        ) : (
          <div className={classes.posTypeChange}>
            <span className={clsx(classes.title, classes.positionTitle)}>{positionType}</span>

            {postPosition === positionType ||
            (tradeType === TradeType.LONG && positionType === PositionType.SHORT) ||
            (tradeType === TradeType.SHORT && positionType === PositionType.LONG) ? null : (
              <>
                <ArrowRightAltIcon className={classes.arrow} />
                <span className={clsx(classes.title, classes.postpositionTitle)}>{postPosition}</span>
              </>
            )}
          </div>
        )}
      </Box>
      <div>
        {fullyLiquidated ? (
          <Box display="flex" alignItems="center" gridGap="12px" marginTop="16px" flexWrap="wrap">
            <Metric
              label="Position value"
              gridGap="4px"
              value={
                <div className={classes.postAmount}>
                  <Typography component="span" className={classes.amountText} id="position-card-positive-value">
                    0 oSQTH
                  </Typography>
                  <Typography component="span" className={clsx(classes.amountText, classes.positionUsdValue)}>
                    {Number(0).toFixed(2)}%
                  </Typography>
                </div>
              }
            />
            <Metric
              gridGap="4px"
              label="Redeemable collateral"
              value={
                <Typography variant="body1" className={classes.amountText}>
                  {isPositionLoading && existingCollat.isEqualTo(0) ? 'loading' : existingCollat.toFixed(4)} ETH
                </Typography>
              }
            />
          </Box>
        ) : (
          <Box display="flex" gridGap="12px" marginTop="16px" flexWrap="wrap">
            <Metric
              gridGap="6px"
              label={
                <div className={classes.labelContainer}>
                  <Typography className={classes.label}>Position value</Typography>
                  {positionType === PositionType.SHORT ? (
                    <Typography className={classes.link} id="pos-card-manage-vault-link">
                      <Link href={`vault/${vaultId}`}>Manage</Link>
                    </Typography>
                  ) : null}
                </div>
              }
              value={
                <div className={classes.postAmount}>
                  <Box display="flex" alignItems="center" gridGap="4px">
                    <Typography component="span" className={classes.amountText} id="position-card-before-trade-balance">
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
                          className={classes.amountText}
                          id="position-card-post-trade-balance"
                          style={{
                            color: postTradeAmt.gte(getPositionBasedValue(squeethAmount, squeethAmount, 0))
                              ? '#49D273'
                              : '#f5475c',
                          }}
                        >
                          {postTradeAmt.lte(0) ? 0 : postTradeAmt.toFixed(6)}
                        </Typography>
                      </>
                    )}
                  </Box>
                  <Typography component="span" className={clsx(classes.amountText, classes.amountUnit)} variant="body2">
                    oSQTH
                  </Typography>

                  {!isDollarValueLoading && (
                    <Typography component="span" className={clsx(classes.amountText, classes.positionUsdValue)}>
                      ${getPositionBasedValue(longPositionValue, shortPositionValue, new BigNumber(0)).toFixed(2)}
                    </Typography>
                  )}
                </div>
              }
            />

            {isToHidePnL || (tradeType === TradeType.SHORT && positionType != PositionType.LONG) ? (
              <Metric label="PnL" value={<HidePnLText />} gridGap="6px" />
            ) : (
              <>
                <Metric
                  gridGap="6px"
                  label="Unrealized PnL"
                  value={
                    <div className={classes.pnl} id="unrealized-pnl-value">
                      {!pnlLoading ? (
                        <Box display="flex" alignItems="center" gridGap="12px">
                          <Typography
                            className={clsx(pnlClass(positionType, longGain, shortGain, classes), classes.amountText)}
                            id="unrealized-pnl-usd-value"
                          >
                            {getPositionBasedValue(
                              `$${longUnrealizedPNL.usd.toFixed(2)}`,
                              `$${shortUnrealizedPNL.usd.toFixed(2)}`,
                              '$0',
                              'loading',
                            )}
                          </Typography>
                          <Typography
                            variant="caption"
                            className={clsx(
                              pnlClass(positionType, longGain, shortGain, classes),
                              classes.amountText,
                              classes.positionUsdValue,
                            )}
                            id="unrealized-pnl-perct-value"
                          >
                            {getPositionBasedValue(`(${longGain.toFixed(2)}%)`, `(${shortGain.toFixed(2)}%)`, '', ' ')}
                          </Typography>
                        </Box>
                      ) : (
                        'loading'
                      )}
                    </div>
                  }
                />
                <Metric
                  gridGap="6px"
                  label="Realized PnL"
                  value={
                    <div className={classes.pnl} id="realized-pnl-value">
                      <Typography
                        className={clsx(
                          classes.amountText,
                          pnlClass(positionType, longRealizedPNL, shortRealizedPNL, classes),
                        )}
                      >
                        {getRealizedPNLBasedValue(
                          `$${longRealizedPNL.toFixed(2)}`,
                          `$${shortRealizedPNL.toFixed(2)}`,
                          '$0',
                          'loading',
                        )}
                      </Typography>
                    </div>
                  }
                />
              </>
            )}
          </Box>
        )}
      </div>

      <Typography variant="caption" color="textSecondary">
        {fetchingNew ? 'Fetching latest position...' : ' '}
      </Typography>
    </div>
  )
}

const MemoizedPositionCard = memo(PositionCard)

export default MemoizedPositionCard
// function getPositionBasedValue(amountOut: BigNumber, buyQuote: BigNumber, arg2: BigNumber) {
//   throw new Error('Function not implemented.')
// }
