import { CircularProgress, createStyles, Divider, makeStyles, Typography } from '@material-ui/core'
import BigNumber from 'bignumber.js'
import React, { useCallback, useEffect, useMemo, useState } from 'react'

import { WSQUEETH_DECIMALS } from '../../constants'
import { UNI_POOL_FEES } from '../../constants'
import { useTrade } from '../../context/trade'
import { useWallet } from '../../context/wallet'
import { useUserAllowance } from '../../hooks/contracts/useAllowance'
import { useSqueethPool } from '../../hooks/contracts/useSqueethPool'
import { useTokenBalance } from '../../hooks/contracts/useTokenBalance'
import { useAddresses } from '../../hooks/useAddress'
import { useETHPrice } from '../../hooks/useETHPrice'
import { PrimaryButton } from '../Buttons'
import { PrimaryInput } from '../Inputs'
import TradeInfoItem from './TradeInfoItem'
import UniswapData from './UniswapData'

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
      paddingLeft: theme.spacing(1),
      paddingRight: theme.spacing(1),
    },
    caption: {
      marginTop: theme.spacing(1),
    },
    divider: {
      margin: theme.spacing(2, 3),
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
      marginTop: theme.spacing(1),
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
    closePosition: {
      display: 'flex',
      justifyContent: 'space-between',
      padding: theme.spacing(0, 1),
    },
    closeBtn: {
      color: theme.palette.error.main,
    },
    paper: {
      backgroundColor: theme.palette.background.paper,
      boxShadow: theme.shadows[5],
      borderRadius: theme.spacing(1),
      width: '350px',
      textAlign: 'center',
      paddingBottom: theme.spacing(2),
    },
    modal: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
  }),
)

type BuyProps = {
  balance: number
  open: boolean
  closeTitle: string
}

const Buy: React.FC<BuyProps> = ({ balance, open, closeTitle }) => {
  const [buyLoading, setBuyLoading] = useState(false)
  const [sellLoading, setSellLoading] = useState(false)

  const classes = useStyles()
  const { swapRouter, wSqueeth } = useAddresses()
  const wSqueethBal = useTokenBalance(wSqueeth, 5, WSQUEETH_DECIMALS)
  const { sell, buyForWETH, getWSqueethPositionValue } = useSqueethPool()
  const { tradeAmount: amount, setTradeAmount: setAmount, squeethExposure, quote } = useTrade()
  const { allowance: squeethAllowance, approve: squeethApprove } = useUserAllowance(wSqueeth, swapRouter)
  const { selectWallet, connected } = useWallet()
  const ethPrice = useETHPrice()

  useEffect(() => {
    if (!open && wSqueethBal.lt(amount)) {
      setAmount(wSqueethBal.toNumber())
    }
  }, [wSqueethBal.toNumber(), open])

  const { openError, closeError } = useMemo(() => {
    let openError = null
    let closeError = null

    if (connected && wSqueethBal.lt(amount)) {
      closeError = 'Insufficient oSQTH balance'
    }
    if (connected && amount > balance) {
      openError = 'Insufficient ETH balance'
    }

    return { openError, closeError }
  }, [amount, balance, wSqueethBal, connected])

  const transact = async () => {
    setBuyLoading(true)
    try {
      await buyForWETH(amount)
    } catch (e) {
      console.log(e)
    }
    setBuyLoading(false)
  }

  const sellAndClose = useCallback(async () => {
    setSellLoading(true)
    try {
      if (squeethAllowance.lt(amount)) {
        await squeethApprove()
      } else {
        await sell(new BigNumber(amount))
      }
    } catch (e) {
      console.log(e)
    }
    setSellLoading(false)
  }, [amount, sell, squeethAllowance, squeethApprove, wSqueethBal])

  const ClosePosition = useMemo(() => {
    return (
      <div>
        <Typography variant="caption" className={classes.thirdHeading} component="div">
          {closeTitle}
        </Typography>
        <div className={classes.thirdHeading} />
        <PrimaryInput
          value={amount.toString()}
          onChange={(v) => setAmount(Number(v))}
          label="Amount"
          tooltip="Amount of wSqueeth you want to close"
          actionTxt="Max"
          onActionClicked={() => setAmount(Number(wSqueethBal))}
          unit="oSQTH"
          convertedValue={getWSqueethPositionValue(amount).toFixed(2).toLocaleString()}
          error={!!closeError}
          hint={closeError ? closeError : `Balance ${wSqueethBal.toFixed(6)} oSQTH`}
        />
        <div className={classes.squeethExp}>
          <div>
            <Typography variant="caption">Get</Typography>
            <Typography className={classes.squeethExpTxt}>{quote.amountOut.toFixed(6)}</Typography>
          </div>
          <div>
            <Typography variant="caption">
              ${Number(quote.amountOut.times(ethPrice).toFixed(4)).toLocaleString()}
            </Typography>
            <Typography className={classes.squeethExpTxt}>ETH</Typography>
          </div>
        </div>
        <div className={classes.divider}>
          <UniswapData
            slippage="0.5"
            priceImpact={quote.priceImpact}
            minReceived={quote.minimumAmountOut.toFixed(4)}
            minReceivedUnit="ETH"
          />
        </div>
        {!connected ? (
          <PrimaryButton
            variant="contained"
            onClick={selectWallet}
            className={classes.amountInput}
            disabled={!!sellLoading}
            style={{ width: '300px' }}
          >
            {'Connect Wallet'}
          </PrimaryButton>
        ) : (
          <PrimaryButton
            variant="contained"
            onClick={sellAndClose}
            className={classes.amountInput}
            disabled={!!sellLoading || !!closeError}
            style={{ width: '300px' }}
          >
            {sellLoading ? (
              <CircularProgress color="primary" size="1.5rem" />
            ) : squeethAllowance.lt(amount) ? (
              'Approve oSQTH'
            ) : (
              'Sell to close'
            )}
          </PrimaryButton>
        )}
        <Typography variant="caption" className={classes.caption} component="div">
          Trades on Uniswap 🦄
        </Typography>
      </div>
    )
  }, [
    classes.thirdHeading,
    classes.squeethExp,
    classes.squeethExpTxt,
    classes.amountInput,
    classes.caption,
    closeTitle,
    amount,
    getWSqueethPositionValue,
    closeError,
    wSqueethBal,
    quote.amountOut,
    quote.priceImpact,
    quote.minimumAmountOut,
    ethPrice,
    connected,
    selectWallet,
    sellLoading,
    sellAndClose,
    squeethAllowance,
    setAmount,
  ])

  if (!open) {
    return ClosePosition
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
        error={!!openError}
        hint={openError ? openError : `Balance ${balance} ETH`}
      />
      {/* <TradeInfoItem label="Squeeth you get" value={cost.toFixed(8)} unit="WSQTH" /> */}
      <div className={classes.squeethExp}>
        <div>
          <Typography variant="caption">Buy</Typography>
          <Typography className={classes.squeethExpTxt}>{quote.amountOut.toFixed(6)}</Typography>
        </div>
        <div>
          <Typography variant="caption">${Number(squeethExposure.toFixed(2)).toLocaleString()}</Typography>
          <Typography className={classes.squeethExpTxt}>oSQTH</Typography>
        </div>
      </div>
      <div className={classes.divider}>
        <TradeInfoItem
          label="Value if ETH up 2x"
          value={Number((squeethExposure * 4).toFixed(2)).toLocaleString()}
          frontUnit="$"
        />
        {/* if ETH down 50%, squeeth down 75%, so multiply amount by 0.25 to get what would remain  */}
        <TradeInfoItem
          label="Value if ETH down 50%"
          value={Number((squeethExposure * 0.25).toFixed(2)).toLocaleString()}
          frontUnit="$"
        />
        <div style={{ marginTop: '10px' }}>
          <UniswapData
            slippage="0.5"
            priceImpact={quote.priceImpact}
            minReceived={quote.minimumAmountOut.toFixed(6)}
            minReceivedUnit="oSQTH"
          />
        </div>
      </div>
      {/* <Divider className={classes.divider} />
      <TradeInfoItem label="Slippage Tolerance" value="0.5" unit="%" />
      <TradeInfoItem label="Price Impact" value={quote.priceImpact} unit="%" />
      <TradeInfoItem label="Minimum received" value={quote.minimumAmountOut.toFixed(6)} unit="wSQTH" />
      <TradeInfoItem label="Liquidity Provider Fee" value={UNI_POOL_FEES / 1000000} unit="ETH" /> */}
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
          disabled={!!buyLoading || !!openError}
          style={{ width: '300px' }}
        >
          {buyLoading ? <CircularProgress color="primary" size="1.5rem" /> : 'Buy'}
        </PrimaryButton>
      )}
      <Typography variant="caption" className={classes.caption} component="div">
        Trades on Uniswap V3 🦄
      </Typography>
    </div>
  )
}

export default Buy
