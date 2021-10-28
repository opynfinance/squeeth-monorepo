import { Typography } from '@material-ui/core'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import ArrowRightAltIcon from '@material-ui/icons/ArrowRightAlt'
import BigNumber from 'bignumber.js'
import clsx from 'clsx'
import React, { useCallback, useMemo } from 'react'

import { useTrade } from '../context/trade'
import { useETHPrice } from '../hooks/useETHPrice'
import { usePnL } from '../hooks/usePositions'
import { PositionType, TradeType } from '../types'

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
      padding: theme.spacing(2),
      width: '420px',
      background: theme.palette.background.lightStone,
      borderRadius: theme.spacing(1),
      display: 'flex',
      flexDirection: 'column',
      [theme.breakpoints.down('sm')]: {
        width: '100%',
      },
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
    longTitle: {
      color: theme.palette.success.main,
      backgroundColor: `${theme.palette.success.main}20`,
    },
    shortTitle: {
      color: theme.palette.error.main,
      backgroundColor: `${theme.palette.error.main}20`,
    },
    noneTitle: {
      backgroundColor: '#DCDAE920',
    },
    assetDiv: {
      marginTop: theme.spacing(1),
      display: 'flex',
      justifyContent: 'space-between',
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
  }),
)

const PositionCard: React.FC<{ big?: boolean }> = ({ big }) => {
  const classes = useStyles()
  const {
    buyQuote,
    sellQuote,
    longGain,
    shortGain,
    shortSqueethAmt,
    wSqueethBal,
    positionType,
    longUsdAmt,
    shortUsdAmt,
    loading,
  } = usePnL()
  const { tradeAmount, actualTradeType, isOpenPosition, quote } = useTrade()
  const ethPrice = useETHPrice()

  const titleClass = useMemo(() => {
    if (positionType === PositionType.LONG) return classes.longTitle
    if (positionType === PositionType.SHORT) return classes.shortTitle
    return classes.noneTitle
  }, [positionType])

  const pnlClass = useMemo(() => {
    if (positionType === PositionType.LONG) return longGain > 0 ? classes.green : classes.red
    if (positionType === PositionType.SHORT) return shortGain > 0 ? classes.green : classes.red

    return classes.grey
  }, [positionType, longGain, shortGain])

  const getPositionBasedValue = useCallback(
    (long: any, short: any, none: any, loadingMsg?: any) => {
      if (loadingMsg && loading) return loadingMsg
      if (positionType === PositionType.LONG) return long
      if (positionType === PositionType.SHORT) return short
      return none
    },
    [positionType, loading],
  )

  const { postTradeAmt, postPosition } = useMemo(() => {
    let postTradeAmt = new BigNumber(0)
    let postPosition = PositionType.NONE
    if (actualTradeType === TradeType.LONG) {
      if (isOpenPosition) postTradeAmt = wSqueethBal.plus(quote.amountOut)
      else postTradeAmt = wSqueethBal.minus(tradeAmount)
      if (postTradeAmt.gt(0)) postPosition = PositionType.LONG
    } else {
      if (isOpenPosition) postTradeAmt = shortSqueethAmt.plus(tradeAmount)
      else postTradeAmt = shortSqueethAmt.minus(tradeAmount)
      if (postTradeAmt.gt(0)) postPosition = PositionType.SHORT
    }

    return { postTradeAmt, postPosition }
  }, [wSqueethBal.toNumber(), shortSqueethAmt.toNumber(), tradeAmount, actualTradeType, quote.amountOut.toNumber()])

  const postTitleClass = useMemo(() => {
    if (postPosition === PositionType.LONG) return classes.longTitle
    if (postPosition === PositionType.SHORT) return classes.shortTitle
    return classes.noneTitle
  }, [postPosition])

  return (
    <div className={classes.container}>
      <div className={classes.header}>
        <Typography variant="caption" component="span" color="textSecondary">
          POSITION
        </Typography>
        <span className={clsx(classes.title, titleClass)}>{positionType.toUpperCase()}</span>
        {postPosition !== positionType ? (
          <>
            <ArrowRightAltIcon className={classes.arrow} />
            <span className={clsx(classes.title, postTitleClass)}>{postPosition.toUpperCase()}</span>
          </>
        ) : null}
      </div>
      <div className={classes.assetDiv}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <Typography component="span">
              {getPositionBasedValue(wSqueethBal.toFixed(6), shortSqueethAmt.toFixed(6), 0)}
            </Typography>
            {tradeAmount > 0 ? (
              <>
                <ArrowRightAltIcon className={classes.arrow} />
                <Typography component="span" className={classes.postTradeAmt}>
                  {postTradeAmt.lte(0) ? 0 : postTradeAmt.toFixed(6)}
                </Typography>
              </>
            ) : null}
            <Typography color="textSecondary" component="span" variant="body2" className={classes.unit}>
              oSQTH
            </Typography>
          </div>
          {loading ? (
            <Typography variant="caption" color="textSecondary">
              Loading
            </Typography>
          ) : (
            <Typography variant="caption" color="textSecondary">
              $ {getPositionBasedValue(sellQuote.amountOut, buyQuote, new BigNumber(0)).times(ethPrice).toFixed(2)}
            </Typography>
          )}
        </div>
        <div style={{ marginLeft: '16px' }}>
          <Typography variant="caption" color="textSecondary">
            Unrealized P&L
          </Typography>
          <div className={classes.pnl}>
            <Typography className={pnlClass}>
              {getPositionBasedValue(
                `$${sellQuote.amountOut.times(ethPrice).minus(longUsdAmt.abs()).toFixed(2)}`,
                `$${buyQuote.times(ethPrice).minus(shortUsdAmt.abs()).toFixed(2)}`,
                '--',
                'Loading',
              )}
            </Typography>
            <Typography variant="caption" className={pnlClass} style={{ marginLeft: '4px' }}>
              {getPositionBasedValue(`(${longGain.toFixed(2)}%)`, `(${shortGain.toFixed(2)}%)`, null, ' ')}
            </Typography>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PositionCard
