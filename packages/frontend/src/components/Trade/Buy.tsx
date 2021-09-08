import {
  CircularProgress,
  createStyles,
  InputAdornment,
  makeStyles,
  TextField,
  Tooltip,
  Typography,
  withStyles,
} from '@material-ui/core'
import InfoOutlinedIcon from '@material-ui/icons/InfoOutlined'
import BigNumber from 'bignumber.js'
import React, { useEffect, useState } from 'react'

import { WSQUEETH_DECIMALS } from '../../constants'
import { useWorldContext } from '../../context/world'
import { useUserAllowance } from '../../hooks/contracts/useAllowance'
import { useController } from '../../hooks/contracts/useController'
import { useSqueethPool } from '../../hooks/contracts/useSqueethPool'
import { useTokenBalance } from '../../hooks/contracts/useTokenBalance'
import { useAddresses } from '../../hooks/useAddress'
import { useETHPrice } from '../../hooks/useETHPrice'
import { useETHPriceCharts } from '../../hooks/useETHPriceCharts'
import { ErrorButton, PrimaryButton } from '../Buttons'
import TradeInfoItem from './TradeInfoItem'

const useStyles = makeStyles((theme) =>
  createStyles({
    header: {
      color: theme.palette.primary.main,
    },
    body: {
      padding: theme.spacing(2, 12),
      margin: 'auto',
      display: 'flex',
      justifyContent: 'space-around',
    },
    subHeading: {
      color: theme.palette.text.secondary,
    },
    thirdHeading: {
      marginTop: theme.spacing(2),
    },
    details: {
      marginTop: theme.spacing(4),
      width: '65%',
    },
    buyCard: {
      marginTop: theme.spacing(4),
      marginLeft: theme.spacing(2),
    },
    cardTitle: {
      color: theme.palette.primary.main,
      marginTop: theme.spacing(4),
    },
    cardSubTxt: {
      color: theme.palette.text.secondary,
      lineHeight: '1.75rem',
      fontSize: '16px',
      width: '90%',
    },
    payoff: {
      color: theme.palette.text.secondary,
      lineHeight: '1.75rem',
      fontSize: '16px',
    },
    cardDetail: {
      color: theme.palette.text.secondary,
      lineHeight: '1.75rem',
      fontSize: '16px',
      marginTop: theme.spacing(4),
    },
    amountInput: {
      marginTop: theme.spacing(4),
    },
    innerCard: {
      textAlign: 'center',
      padding: theme.spacing(2),
      paddingBottom: theme.spacing(8),
      background: theme.palette.background.default,
      border: `1px solid ${theme.palette.background.stone}`,
    },
    expand: {
      transform: 'rotate(270deg)',
      color: theme.palette.primary.main,
      transition: theme.transitions.create('transform', {
        duration: theme.transitions.duration.shortest,
      }),
      marginTop: theme.spacing(6),
    },
    expandOpen: {
      transform: 'rotate(180deg)',
      color: theme.palette.primary.main,
    },
    dialog: {
      padding: theme.spacing(2),
    },
    dialogHeader: {
      display: 'flex',
      alignItems: 'center',
    },
    dialogIcon: {
      marginRight: theme.spacing(1),
      color: theme.palette.warning.main,
    },
    txItem: {
      marginTop: theme.spacing(1),
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    infoIcon: {
      marginLeft: theme.spacing(0.5),
      color: theme.palette.text.secondary,
    },
  }),
)

type BuyProps = {
  setAmount: (arg0: number) => void
  amount: number
  setCost: (arg0: number) => void
  cost: number
  setSqueethExposure: (arg0: number) => void
  squeethExposure: number
}

const Buy: React.FC<BuyProps> = ({ setAmount, amount, setCost, cost, setSqueethExposure, squeethExposure }) => {
  // const [amount, setAmount] = useState(1)
  const [quote, setQuote] = useState({
    amountOut: new BigNumber(0),
    minimumAmountOut: new BigNumber(0),
    priceImpact: '0',
  })
  // const [cost, setCost] = useState(new BigNumber(0))
  // const [squeethExposure, setSqueethExposure] = useState(new BigNumber(0))
  const [buyLoading, setBuyLoading] = useState(false)
  const [sellLoading, setSellLoading] = useState(false)

  const classes = useStyles()
  const { swapRouter, wSqueeth } = useAddresses()
  const wSqueethBal = useTokenBalance(wSqueeth, 5, WSQUEETH_DECIMALS)
  const { ready, sell, getBuyQuoteForETH, buyForWETH, squeethPrice } = useSqueethPool()
  const { allowance: squeethAllowance, approve: squeethApprove } = useUserAllowance(wSqueeth, swapRouter)
  const { volMultiplier: globalVolMultiplier } = useWorldContext()
  const { normFactor: normalizationFactor } = useController()

  const { accFunding } = useETHPriceCharts(1, globalVolMultiplier)

  const ethPrice = useETHPrice()

  useEffect(() => {
    if (!ready) return
    getBuyQuoteForETH(amount).then((val) => {
      setQuote(val)
      setCost(val.amountOut.toNumber())
    })
  }, [amount, ready])

  useEffect(() => {
    setSqueethExposure(cost * Number(ethPrice) * Number(ethPrice) * Number(normalizationFactor))
  }, [cost, ethPrice, normalizationFactor])

  const transact = async () => {
    setBuyLoading(true)
    try {
      await buyForWETH(amount)
    } catch (e) {
      console.log(e)
    }
    setBuyLoading(false)
  }

  const sellAndClose = () => {
    setSellLoading(true)
    try {
      if (squeethAllowance.lt(amount)) {
        squeethApprove()
      } else {
        sell(wSqueethBal)
      }
    } catch (e) {
      console.log(e)
    }
    setSellLoading(false)
  }

  return (
    <div>
      <Typography variant="caption" className={classes.thirdHeading} component="div">
        Pay ETH to buy squeeth exposure
      </Typography>
      <div className={classes.thirdHeading}>
        <TextField
          size="small"
          value={amount.toString()}
          type="number"
          style={{ width: 300 }}
          onChange={(event) => setAmount(Number(event.target.value))}
          id="filled-basic"
          label="ETH Amount"
          variant="outlined"
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <Tooltip title="Amount of ETH you want to spend to get Squeeth exposure">
                  <InfoOutlinedIcon fontSize="small" />
                </Tooltip>
              </InputAdornment>
            ),
          }}
        />
      </div>
      <TradeInfoItem
        label="Squeeth Exposure"
        value={Number(squeethExposure.toFixed(2)).toLocaleString()}
        unit="$$ of SQTH"
      />
      <TradeInfoItem
        label="Funding (paid continuously)"
        value={(accFunding * 0.000001).toFixed(2)}
        unit="%"
        tooltip="Funding is paid out of your position, no collateral required. Funding happens everytime the contract is touched."
      />
      <TradeInfoItem label="Slippage tolerance" value="0.5" unit="%" />
      <TradeInfoItem label="Price Impact" value={quote.priceImpact} unit="%" />
      <TradeInfoItem
        label="Minimum received"
        value={Number(
          quote.minimumAmountOut.times(ethPrice).times(ethPrice).times(normalizationFactor).toFixed(2),
        ).toLocaleString()}
        unit="$$ of SQTH"
      />
      <PrimaryButton variant="contained" onClick={transact} className={classes.amountInput} disabled={!!buyLoading}>
        {buyLoading ? <CircularProgress color="primary" size="1.5rem" /> : 'Buy'}
      </PrimaryButton>
      <Typography variant="body1" color="primary" style={{ marginTop: '16px', marginBottom: '8px' }}>
        Your long Position:{' '}
        {Number(wSqueethBal.times(ethPrice).times(ethPrice).times(normalizationFactor).toFixed(2)).toLocaleString()} $$
        of SQTH
      </Typography>
      <ErrorButton
        disabled={wSqueethBal.eq(0) || sellLoading}
        variant="contained"
        color="secondary"
        onClick={sellAndClose}
      >
        {sellLoading ? (
          <CircularProgress color="primary" size="1.5rem" />
        ) : squeethAllowance.lt(wSqueethBal) ? (
          'Approve to sell (1/2)'
        ) : (
          'Sell to close (2/2)'
        )}
      </ErrorButton>
    </div>
  )
}

export default Buy
