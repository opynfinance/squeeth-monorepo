import { CircularProgress, createStyles, Divider, makeStyles, Typography } from '@material-ui/core'
import BigNumber from 'bignumber.js'
import React, { useEffect, useState } from 'react'

import { WSQUEETH_DECIMALS } from '../../constants'
import { useWallet } from '../../context/wallet'
import { useUserAllowance } from '../../hooks/contracts/useAllowance'
import { useController } from '../../hooks/contracts/useController'
import { useSqueethPool } from '../../hooks/contracts/useSqueethPool'
import { useTokenBalance } from '../../hooks/contracts/useTokenBalance'
import { useAddresses } from '../../hooks/useAddress'
import { useETHPrice } from '../../hooks/useETHPrice'
import { PrimaryButton } from '../Buttons'
import { PrimaryInput } from '../Inputs'
import History from './History'
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
    caption: {
      marginTop: theme.spacing(1),
    },
    divider: {
      marginTop: theme.spacing(2),
      marginButtom: theme.spacing(2),
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
    squeethExp: {
      display: 'flex',
      justifyContent: 'space-between',
      borderRadius: theme.spacing(1),
      padding: theme.spacing(1.5),
      width: '300px',
      marginLeft: 'auto',
      marginRight: 'auto',
      marginTop: theme.spacing(2),
      textAlign: 'left',
      backgroundColor: theme.palette.background.stone,
    },
    squeethExpTxt: {
      fontSize: '20px',
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
  balance: number
}

const Buy: React.FC<BuyProps> = ({
  setAmount,
  amount,
  setCost,
  cost,
  setSqueethExposure,
  squeethExposure,
  balance,
}) => {
  const [quote, setQuote] = useState({
    amountOut: new BigNumber(0),
    minimumAmountOut: new BigNumber(0),
    priceImpact: '0',
  })

  const [buyLoading, setBuyLoading] = useState(false)
  const [sellLoading, setSellLoading] = useState(false)

  const classes = useStyles()
  const { swapRouter, wSqueeth } = useAddresses()
  const wSqueethBal = useTokenBalance(wSqueeth, 5, WSQUEETH_DECIMALS)
  const { ready, sell, getBuyQuoteForETH, buyForWETH } = useSqueethPool()
  const { allowance: squeethAllowance, approve: squeethApprove } = useUserAllowance(wSqueeth, swapRouter)
  const { normFactor: normalizationFactor } = useController()
  const { selectWallet, connected } = useWallet()
  const ethPrice = useETHPrice()

  useEffect(() => {
    if (!ready) return
    getBuyQuoteForETH(amount).then((val) => {
      setQuote(val)
      setCost(val.amountOut.toNumber())
    })
  }, [amount, ready])

  useEffect(() => {
    setSqueethExposure((cost * Number(ethPrice) * Number(ethPrice) * Number(normalizationFactor)) / 10000)
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
      <div className={classes.thirdHeading} />
      <PrimaryInput
        value={amount.toString()}
        onChange={(v) => setAmount(Number(v))}
        label="Amount"
        tooltip="Amount of ETH you want to spend to get Squeeth exposure"
        actionTxt="Max"
        onActionClicked={() => setAmount(balance)}
        unit="ETH"
        convertedValue={(amount * Number(ethPrice)).toFixed(2).toLocaleString()}
      />
      {/* <TradeInfoItem label="Squeeth you get" value={cost.toFixed(8)} unit="WSQTH" /> */}
      <div className={classes.squeethExp}>
        <div>
          <Typography variant="caption">Buy</Typography>
          <Typography className={classes.squeethExpTxt}>{cost.toFixed(6)}</Typography>
        </div>
        <div>
          <Typography variant="caption">${Number(squeethExposure.toFixed(2)).toLocaleString()}</Typography>
          <Typography className={classes.squeethExpTxt}>wSQTH</Typography>
        </div>
      </div>

      <TradeInfoItem label="If ETH up 2x" value={Number((squeethExposure * 4).toFixed(2)).toLocaleString()} unit="$" />
      {/* if ETH down 50%, squeeth down 75%, so multiply amount by 0.25 to get what would remain  */}
      <TradeInfoItem
        label="If ETH down 50%"
        value={(amount * Number(ethPrice) * 0.25).toFixed(2).toLocaleString()}
        unit="$"
      />
      <Divider className={classes.divider} />
      <TradeInfoItem label="Slippage tolerance" value="0.5" unit="%" />
      <TradeInfoItem label="Price Impact" value={quote.priceImpact} unit="%" />
      <TradeInfoItem label="Minimum received" value={quote.minimumAmountOut.toFixed(6)} unit="wSQTH" />
      {!connected ? (
        <PrimaryButton
          variant="contained"
          onClick={selectWallet}
          className={classes.amountInput}
          disabled={!!buyLoading}
          style={{ width: '300px' }}
        >
          {'Connect Wallet'}
        </PrimaryButton>
      ) : (
        <PrimaryButton
          variant="contained"
          onClick={transact}
          className={classes.amountInput}
          disabled={!!buyLoading}
          style={{ width: '300px' }}
        >
          {buyLoading ? <CircularProgress color="primary" size="1.5rem" /> : 'Buy'}
        </PrimaryButton>
      )}
      <Typography variant="caption" className={classes.caption} component="div">
        Trades on Uniswap 🦄
      </Typography>
    </div>
  )
}

export default Buy
