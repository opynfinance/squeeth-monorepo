import { Button, createStyles, InputAdornment, makeStyles, TextField, Tooltip, Typography } from '@material-ui/core'
import InfoOutlinedIcon from '@material-ui/icons/InfoOutlined'
import BigNumber from 'bignumber.js'
import React, { useEffect, useMemo, useState } from 'react'

import { useWorldContext } from '../../context/world'
import { useUserAllowance } from '../../hooks/contracts/useAllowance'
import { useSqueethPool } from '../../hooks/contracts/useSqueethPool'
import { useTokenBalance } from '../../hooks/contracts/useTokenBalance'
import { useWeth } from '../../hooks/contracts/useWeth'
import { useAddresses } from '../../hooks/useAddress'
import useAsyncMemo from '../../hooks/useAsyncMemo'
import { useETHPriceCharts } from '../../hooks/useETHPriceCharts'
import { getFairSqueethAsk, getVolForTimestamp } from '../../utils'
import { ErrorButton, PrimaryButton } from '../Buttons'
import TradeInfoItem from './TradeInfoItem'

enum BuyStep {
  WRAP,
  APPROVE,
  BUY,
  Done,
}

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
  }),
)

const Buy: React.FC = () => {
  const [amount, setAmount] = useState(1)
  const [step, setStep] = useState(BuyStep.WRAP)
  const [cost, setCost] = useState(new BigNumber(0))

  const classes = useStyles()
  const { weth, swapRouter, wSqueeth } = useAddresses()
  const wethBal = useTokenBalance(weth, 5)
  const wSqueethBalO = useTokenBalance(wSqueeth, 5)
  const { squeethPrice, buy, getBuyQuote, sell } = useSqueethPool()
  const { wrap } = useWeth()
  const { allowance: wethAllowance, approve: wethApprove } = useUserAllowance(weth, swapRouter)
  const { allowance: squeethAllowance, approve: squeethApprove } = useUserAllowance(wSqueeth, swapRouter)
  const { volMultiplier: globalVolMultiplier } = useWorldContext()

  const { ethPrices, accFunding, startingETHPrice, volMultiplier } = useETHPriceCharts(1, globalVolMultiplier)

  useEffect(() => {
    getBuyQuote(amount).then((val) => setCost(val))
  }, [amount])

  const wSqueethBal = useMemo(() => wSqueethBalO.multipliedBy(10000), [wSqueethBalO.toNumber()])

  const transact = () => {
    if (step === BuyStep.WRAP) {
      wrap(new BigNumber(cost).minus(wethBal)).then(() => setStep(BuyStep.APPROVE))
    } else if (step === BuyStep.APPROVE) {
      wethApprove().then(() => setStep(BuyStep.BUY))
    } else {
      buy(amount).then(() => setStep(BuyStep.Done))
    }
  }

  const sellAndClose = () => {
    if (squeethAllowance.lt(amount)) {
      squeethApprove()
    } else {
      sell(wSqueethBal.toNumber())
    }
  }

  useEffect(() => {
    if (cost.gt(wethBal)) setStep(BuyStep.WRAP)
    else if (wethAllowance.lt(cost)) setStep(BuyStep.APPROVE)
    else setStep(BuyStep.BUY)
  }, [wethBal.toNumber(), cost.toNumber(), wethAllowance.toNumber()])

  const vol = useAsyncMemo(
    async () => {
      const ethPrice = ethPrices.length > 0 ? ethPrices[ethPrices.length - 1].value : 0
      const timestamp = ethPrices.length > 0 ? ethPrices[ethPrices.length - 1].time : Date.now() / 1000
      const _vol = await getVolForTimestamp(timestamp, ethPrice)
      return _vol * volMultiplier
    },
    0,
    [ethPrices, volMultiplier],
  )

  return (
    <div>
      <div className={classes.amountInput}>
        <TextField
          size="small"
          value={amount}
          type="number"
          style={{ width: 300 }}
          onChange={(event) => setAmount(Number(event.target.value))}
          id="filled-basic"
          label="Long Size (Squeeth)"
          variant="outlined"
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <Tooltip title="The index price of the asset is ETH&sup2;. Each squeeth ERC20 token is 0.000001 of that index price.">
                  <InfoOutlinedIcon fontSize="small" />
                </Tooltip>
              </InputAdornment>
            ),
          }}
        />
      </div>
      <TradeInfoItem label="Price" value={squeethPrice.toFixed(4)} unit="WETH" />
      <TradeInfoItem label="WETH Balance" value={wethBal.toFixed(4)} unit="WETH" />
      <TradeInfoItem label="Total cost" value={cost.toFixed(4)} unit="WETH" />
      <Tooltip title="Daily funding is paid out of your position, no collateral required.">
        <TradeInfoItem label="Daily Funding to Pay" value={(amount * accFunding * 0.000001).toFixed(2)} unit="USDC" />
      </Tooltip>
      {/* <span style={{ fontSize: 12 }}> 24h Vol: {(vol * 100).toFixed(2)} % </span> */}
      <PrimaryButton style={{ width: 300 }} variant="contained" onClick={transact} className={classes.amountInput}>
        {step === BuyStep.BUY ? 'Buy' : step === BuyStep.APPROVE ? 'Approve' : 'Wrap'}
      </PrimaryButton>
      <Typography variant="h6" color="primary" style={{ marginTop: '16px', marginBottom: '8px' }}>
        Your long Position: {wSqueethBal.toFixed(2)} SQE
      </Typography>
      <ErrorButton
        disabled={wSqueethBal.eq(0)}
        style={{ width: 300 }}
        variant="contained"
        color="secondary"
        onClick={sellAndClose}
      >
        {squeethAllowance.lt(wSqueethBal) ? 'Approve to sell' : 'Sell to close'}
      </ErrorButton>
    </div>
  )
}

export default Buy
