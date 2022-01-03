import { Tooltip, Typography } from '@material-ui/core'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import ArrowRightAltIcon from '@material-ui/icons/ArrowRightAlt'
import InfoIcon from '@material-ui/icons/InfoOutlined'
import BigNumber from 'bignumber.js'
import clsx from 'clsx'
import Link from 'next/link'
import React, { useCallback, useEffect, useMemo, useState } from 'react'

import { useLongPositions, usePnL, usePositions, useShortPositions } from '@hooks/usePositions'
import { Tooltips } from '@constants/enums'
import { useTrade } from '@context/trade'
import { useETHPrice } from '@hooks/useETHPrice'
import { PositionType, TradeType } from '../types'
import { useController } from '@hooks/contracts/useController'
import { toTokenAmount } from '@utils/calculations'

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

type PositionCardType = {
  tradeCompleted: boolean
}

const PositionCard: React.FC<PositionCardType> = ({ tradeCompleted }) => {
  const { buyQuote, sellQuote, longGain, shortGain, wSqueethBal, longRealizedPNL, shortRealizedPNL, loading, refetch } =
    usePnL()
  const { positionType, squeethAmount, wethAmount, shortVaults, firstValidVault, vaultId } = usePositions()
  const { tradeAmount, actualTradeType, isOpenPosition, quote, tradeSuccess, setTradeSuccess, tradeType } = useTrade()
  const ethPrice = useETHPrice()
  const { index } = useController()
  const [fetchingNew, setFetchingNew] = useState(false)
  const [postTradeAmt, setPostTradeAmt] = useState(new BigNumber(0))
  const [postPosition, setPostPosition] = useState(PositionType.NONE)
  const classes = useStyles({ positionType, postPosition })

  useEffect(() => {
    if (tradeSuccess) {
      setFetchingNew(true)
      setTradeSuccess(false)
      setTimeout(() => {
        setFetchingNew(false)
        refetch()
      }, 5000)
    }
  }, [tradeSuccess])

  const isDollarValueLoading = useMemo(() => {
    if (positionType === PositionType.LONG) {
      return loading || longGain <= -100 || !isFinite(Number(longGain))
    } else if (positionType === PositionType.SHORT) {
      return loading || shortGain <= -100 || !isFinite(Number(shortGain))
    } else {
      return null
    }
  }, [positionType, loading, longGain, shortGain])

  const getPositionBasedValue = useCallback(
    (long: any, short: any, none: any, loadingMsg?: any) => {
      if (loadingMsg && loading) return loadingMsg
      if (positionType === PositionType.LONG) {
        //if it's showing -100% it is still loading
        if (longGain <= -100 || !isFinite(Number(longGain))) {
          return loadingMsg
        }
        return long
      }
      if (positionType === PositionType.SHORT) {
        //if it's showing -100% it is still loading
        if (shortGain <= -100 || !isFinite(Number(shortGain))) {
          return loadingMsg
        }
        return short
      }
      return none
    },
    [shortVaults, squeethAmount, tradeType, positionType, loading, longGain, shortGain],
  )

  const getRealizedPNLBasedValue = useCallback(
    (long: any, short: any, none: any, loadingMsg?: any) => {
      if (loadingMsg && loading) return loadingMsg
      if (longRealizedPNL.isEqualTo(0) && shortRealizedPNL.isEqualTo(0)) return none
      if (positionType === PositionType.LONG) return long
      if (positionType === PositionType.SHORT) return short
      return none
    },
    [positionType, loading, longRealizedPNL, shortRealizedPNL],
  )

  useEffect(() => {
    let _postTradeAmt = new BigNumber(0)
    let _postPosition = PositionType.NONE
    if (actualTradeType === TradeType.LONG && positionType !== PositionType.SHORT) {
      if (isOpenPosition) {
        _postTradeAmt = squeethAmount.plus(quote.amountOut)
      } else {
        _postTradeAmt = squeethAmount.minus(tradeAmount)
      }
      if (_postTradeAmt.gt(0)) _postPosition = PositionType.LONG
    } else if (actualTradeType === TradeType.SHORT && positionType !== PositionType.LONG) {
      if (isOpenPosition) _postTradeAmt = squeethAmount.isGreaterThan(0) ? squeethAmount.plus(tradeAmount) : tradeAmount
      else _postTradeAmt = squeethAmount.isGreaterThan(0) ? squeethAmount.minus(tradeAmount) : new BigNumber(0)
      if (_postTradeAmt.gt(0)) _postPosition = PositionType.SHORT
    }

    setPostTradeAmt(_postTradeAmt)
    setPostPosition(_postPosition)
  }, [
    actualTradeType,
    firstValidVault,
    isOpenPosition,
    quote.amountOut.toNumber(),
    shortVaults?.length,
    tradeAmount.toNumber(),
    squeethAmount.toNumber(),
    positionType,
  ])

  return (
    <div className={clsx(classes.container, classes.posBg)}>
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
              {getPositionBasedValue(squeethAmount.toFixed(6), squeethAmount.toFixed(6), 0)}
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
                <Tooltip title={Tooltips.UnrealizedPnL}>
                  <InfoIcon fontSize="small" className={classes.infoIcon} />
                </Tooltip>
              </div>
              <div className={classes.pnl}>
                <Typography
                  className={pnlClass(positionType, longGain, shortGain, classes)}
                  style={{ fontWeight: 600 }}
                >
                  {getPositionBasedValue(
                    `$${sellQuote.amountOut.minus(wethAmount.abs()).times(toTokenAmount(index, 18).sqrt()).toFixed(2)}`,
                    `$${wethAmount.minus(buyQuote).times(toTokenAmount(index, 18).sqrt()).toFixed(2)}`,
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
              </div>
            </div>
            <div>
              <Typography variant="caption" color="textSecondary" style={{ fontWeight: 500 }}>
                Realized P&L
              </Typography>
              <Tooltip title={Tooltips.RealizedPnL}>
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
      <Typography variant="caption" color="textSecondary">
        {fetchingNew ? 'Fetching latest position' : ' '}
      </Typography>
      {positionType === PositionType.SHORT ? (
        <Typography className={classes.link}>
          <Link href={`vault/${vaultId}`}>Manage</Link>
        </Typography>
      ) : null}
    </div>
  )
}

export default PositionCard
function getPositionBasedValue(amountOut: BigNumber, buyQuote: BigNumber, arg2: BigNumber) {
  throw new Error('Function not implemented.')
}
