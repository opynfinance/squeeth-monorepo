import { Tooltip, Typography } from '@material-ui/core'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import ArrowRightAltIcon from '@material-ui/icons/ArrowRightAlt'
import InfoIcon from '@material-ui/icons/InfoOutlined'
import BigNumber from 'bignumber.js'
import clsx from 'clsx'
import Link from 'next/link'
import React, { useCallback, useEffect, useMemo, useState } from 'react'

import { Tooltips } from '../constants/enums'
import { useTrade } from '../context/trade'
import { useETHPrice } from '../hooks/useETHPrice'
import { useLongPositions, usePnL, useShortPositions } from '../hooks/usePositions'
import { PositionType, TradeType } from '../types'

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
      // marginTop: theme.spacing(1),
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

const PositionCard: React.FC<{ big?: boolean }> = ({ big }) => {
  const classes = useStyles()
  const {
    buyQuote,
    sellQuote,
    longGain,
    shortGain,
    wSqueethBal,
    positionType,
    longUsdAmt,
    shortUsdAmt,
    longRealizedPNL,
    shortRealizedPNL,
    loading,
    refetch,
  } = usePnL()
  const { tradeAmount, actualTradeType, isOpenPosition, quote, tradeSuccess, setTradeSuccess, tradeType } = useTrade()
  const ethPrice = useETHPrice()
  const { shortVaults, firstValidVault, vaultId } = useShortPositions()
  const { squeethAmount: lngAmt } = useLongPositions()
  const [fetchingNew, setFetchingNew] = useState(false)
  const [postTradeAmt, setPostTradeAmt] = useState(new BigNumber(0))
  const [postPosition, setPostPosition] = useState(PositionType.NONE)

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

  const titleClass = useMemo(() => {
    if (positionType === PositionType.LONG) return classes.longTitle
    if (positionType === PositionType.SHORT) return classes.shortTitle
    return classes.noneTitle
  }, [positionType])

  const pnlClass = useCallback(
    (long, short) => {
      if (positionType === PositionType.LONG) return long?.toFixed(2) > 0 ? classes.green : classes.red
      if (positionType === PositionType.SHORT) return short?.toFixed(2) > 0 ? classes.green : classes.red

      return classes.grey
    },
    [positionType, longGain, shortGain, longRealizedPNL, shortRealizedPNL],
  )

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
    [positionType, loading, longGain, shortGain],
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
    const hasShortPosition = shortVaults.length > 0 && shortVaults[firstValidVault].shortAmount.gt(0)
    if (actualTradeType === TradeType.LONG && !hasShortPosition) {
      if (isOpenPosition) {
        _postTradeAmt = wSqueethBal.plus(quote.amountOut)
      } else {
        _postTradeAmt = wSqueethBal.minus(tradeAmount)
      }
      if (_postTradeAmt.gt(0)) _postPosition = PositionType.LONG
    } else if (actualTradeType === TradeType.SHORT && !lngAmt.gt(0)) {
      if (isOpenPosition)
        _postTradeAmt = shortVaults.length ? shortVaults[firstValidVault].shortAmount.plus(tradeAmount) : tradeAmount
      else
        _postTradeAmt = shortVaults.length
          ? shortVaults[firstValidVault].shortAmount.minus(tradeAmount)
          : new BigNumber(0)
      if (_postTradeAmt.gt(0)) _postPosition = PositionType.SHORT
    }

    setPostTradeAmt(_postTradeAmt)
    setPostPosition(_postPosition)
  }, [wSqueethBal.toNumber(), shortVaults, tradeAmount, actualTradeType, quote.amountOut.toNumber()])

  const getPostPositionBasedValue = useCallback(
    (long: any, short: any, none: any, loadingMsg?: any) => {
      if (loadingMsg && loading) return loadingMsg
      if (postPosition === PositionType.LONG) return long
      if (postPosition === PositionType.SHORT) return short
      return none
    },
    [postPosition, loading],
  )

  const postTitleClass = useMemo(() => {
    if (postPosition === PositionType.LONG) return classes.longTitle
    if (postPosition === PositionType.SHORT) return classes.shortTitle
    return classes.noneTitle
  }, [postPosition])

  const cardBackground = useMemo(() => {
    const positionBackground = getPositionBasedValue('#375F4290', '#68373D40', 'rgba(255, 255, 255, 0.08)')
    const postPositionBackground = getPostPositionBasedValue('#375F42', '#68373D90', 'rgba(255, 255, 255, 0.08)')

    return `linear-gradient(to right, ${positionBackground} 0%, ${postPositionBackground} 75%)`
  }, [postPosition, positionType])

  return (
    <div className={classes.container} style={{ background: cardBackground }}>
      <div className={classes.header}>
        <Typography variant="caption" component="span" style={{ fontWeight: 500 }} color="textSecondary">
          MY POSITION
        </Typography>
        <span className={clsx(classes.title, titleClass)}>{positionType.toUpperCase()}</span>
        {postPosition === positionType ||
        (tradeType === TradeType.LONG && shortVaults.length && shortVaults[firstValidVault].shortAmount.gt(0)) ||
        (tradeType === TradeType.SHORT && lngAmt.gt(0)) ? null : (
          <>
            <ArrowRightAltIcon className={classes.arrow} />
            <span className={clsx(classes.title, postTitleClass)}>{postPosition.toUpperCase()}</span>
          </>
        )}
      </div>
      <div className={classes.assetDiv}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', marginTop: '.5em' }}>
            <Typography component="span" style={{ fontWeight: 600 }}>
              {getPositionBasedValue(
                wSqueethBal.toFixed(6),
                shortVaults.length && shortVaults[firstValidVault].shortAmount.toFixed(6),
                0,
              )}
            </Typography>
            {(tradeType === TradeType.SHORT && lngAmt.gt(0)) ||
            (tradeType === TradeType.LONG && shortVaults.length && shortVaults[firstValidVault].shortAmount.gt(0)) ||
            tradeAmount.isLessThanOrEqualTo(0) ||
            tradeAmount.isNaN() ? null : (
              <>
                <ArrowRightAltIcon className={classes.arrow} />
                <Typography
                  component="span"
                  style={{
                    fontWeight: 600,
                    color: postTradeAmt.gte(
                      getPositionBasedValue(
                        wSqueethBal.toFixed(6),
                        shortVaults.length && shortVaults[firstValidVault].shortAmount.toFixed(6),
                        0,
                      ),
                    )
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
                <Typography className={pnlClass(longGain, shortGain)} style={{ fontWeight: 600 }}>
                  {getPositionBasedValue(
                    `$${sellQuote.amountOut.times(ethPrice).minus(longUsdAmt.abs()).toFixed(2)}`,
                    `$${buyQuote.times(ethPrice).minus(shortUsdAmt.abs()).toFixed(2)}`,
                    '--',
                    'Loading',
                  )}
                </Typography>
                <Typography variant="caption" className={pnlClass(longGain, shortGain)} style={{ marginLeft: '4px' }}>
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
              <Typography className={pnlClass(longRealizedPNL, shortRealizedPNL)} style={{ fontWeight: 600 }}>
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
