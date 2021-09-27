import { createStyles, makeStyles, Typography } from '@material-ui/core'
import BigNumber from 'bignumber.js'
import { useEffect, useState } from 'react'

import Nav from '../src/components/Nav'
import History from '../src/components/Trade/History'
import { WSQUEETH_DECIMALS } from '../src/constants'
import { useController } from '../src/hooks/contracts/useController'
import { useSqueethPool } from '../src/hooks/contracts/useSqueethPool'
import { useTokenBalance } from '../src/hooks/contracts/useTokenBalance'
import { useAddresses } from '../src/hooks/useAddress'
import { useETHPrice } from '../src/hooks/useETHPrice'
import { useLongPositions, useShortPositions } from '../src/hooks/usePositions'

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
      margin: theme.spacing(6, 8),
      width: '800px',
      marginLeft: 'auto',
      marginRight: 'auto',
    },
    position: {
      padding: theme.spacing(2),
      backgroundColor: `${theme.palette.background.paper}40`,
      marginTop: theme.spacing(2),
      borderRadius: theme.spacing(1),
      display: 'flex',
      justifyContent: 'space-between',
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
  }),
)

export default function Positions() {
  const classes = useStyles()
  const { wethAmount: longWethAmt, usdAmount: longUsdAmt, squeethAmount: wSqueethBal } = useLongPositions()
  const { wethAmount: shortWethAmt, usdAmount: shortUsdAmt, squeethAmount: shortSqueethAmt } = useShortPositions()
  const ethPrice = useETHPrice()
  const { normFactor: normalizationFactor } = useController()
  const { ready, getSellQuote, getBuyQuote } = useSqueethPool()

  const [sellQuote, setSellQuote] = useState({
    amountOut: new BigNumber(0),
    minimumAmountOut: new BigNumber(0),
    priceImpact: '0',
  })
  const [buyQuote, setBuyQuote] = useState(new BigNumber(0))
  const [longGain, setLongGain] = useState(0)
  const [shortGain, setShortGain] = useState(0)

  useEffect(() => {
    if (!ready) return

    getSellQuote(wSqueethBal.toNumber()).then(setSellQuote)
    getBuyQuote(shortSqueethAmt.negated().toNumber()).then(setBuyQuote)
  }, [wSqueethBal.toNumber(), ready])

  useEffect(() => {
    const _currentValue = sellQuote.amountOut
      .times(ethPrice || 0)
      .div(longUsdAmt.absoluteValue())
      .times(100)
    const _gain = _currentValue.minus(100)
    setLongGain(_gain.toNumber())
  }, [wSqueethBal.toNumber(), sellQuote.amountOut.toNumber(), ethPrice.toNumber(), longUsdAmt.toNumber()])

  useEffect(() => {
    const _currentValue = buyQuote
      .times(ethPrice || 0)
      .div(shortUsdAmt.absoluteValue())
      .times(100)
    const _gain = _currentValue.minus(100)
    setShortGain(_gain.toNumber())
  }, [shortSqueethAmt.toNumber(), buyQuote.toNumber(), ethPrice.toNumber(), shortUsdAmt.toNumber()])

  return (
    <div>
      <Nav />
      <div className={classes.container}>
        <Typography color="primary" variant="h6">
          Your positions
        </Typography>
        {wSqueethBal.isZero() && shortSqueethAmt.isZero() ? (
          <div className={classes.empty}>
            <Typography>No active positions</Typography>
          </div>
        ) : null}
        {wSqueethBal.isGreaterThan(0) ? (
          <div className={classes.position}>
            <Typography>Long Squeeth</Typography>
            <div>
              <Typography variant="body1">{wSqueethBal.toFixed(8)}&nbsp; WSQTH</Typography>
              <Typography variant="body2" color="textSecondary">
                {longWethAmt.toFixed(4)} &nbsp; WETH
              </Typography>
            </div>
            <div>
              <Typography variant="body1" className={longGain < 0 ? classes.red : classes.green}>
                {(longGain || 0).toFixed(2)}%
              </Typography>
              <Typography variant="body2" color="textSecondary">
                ${sellQuote.amountOut.times(ethPrice).toFixed(4)}
              </Typography>
            </div>
          </div>
        ) : null}
        {shortSqueethAmt.isNegative() ? (
          <div className={classes.position}>
            <Typography>Short Squeeth</Typography>
            <div>
              <Typography variant="body1">{shortSqueethAmt.toFixed(8)}&nbsp; WSQTH</Typography>
              <Typography variant="body2" color="textSecondary">
                {shortWethAmt.toFixed(4)} &nbsp; WETH
              </Typography>
            </div>
            <div>
              <Typography variant="body1" className={shortGain < 0 ? classes.red : classes.green}>
                {(shortGain || 0).toFixed(2)}%
              </Typography>
              <Typography variant="body2" color="textSecondary">
                ${buyQuote.times(ethPrice).toFixed(4)}
              </Typography>
            </div>
          </div>
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
