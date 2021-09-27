import { CircularProgress } from '@material-ui/core'
import { createStyles, InputAdornment, makeStyles, TextField, Tooltip, Typography } from '@material-ui/core'
import InfoOutlinedIcon from '@material-ui/icons/InfoOutlined'
import BigNumber from 'bignumber.js'
import React, { useEffect, useMemo, useState } from 'react'

import { Vaults } from '../../constants'
import { useWallet } from '../../context/wallet'
import { useWorldContext } from '../../context/world'
import { useController } from '../../hooks/contracts/useController'
import useShortHelper from '../../hooks/contracts/useShortHelper'
import { useSqueethPool } from '../../hooks/contracts/useSqueethPool'
import { useVaultManager } from '../../hooks/contracts/useVaultManager'
import { useAddresses } from '../../hooks/useAddress'
import { useETHPrice } from '../../hooks/useETHPrice'
import { useETHPriceCharts } from '../../hooks/useETHPriceCharts'
import { useShortPositions } from '../../hooks/usePositions'
import { toTokenAmount } from '../../utils/calculations'
import { ErrorButton, PrimaryButton } from '../Buttons'
import CollatRange from '../CollatRange'
import { PrimaryInput } from '../Inputs'
import TradeInfoItem from './TradeInfoItem'

const useStyles = makeStyles((theme) =>
  createStyles({
    cardTitle: {
      color: theme.palette.primary.main,
      marginTop: theme.spacing(4),
    },
    cardHeader: {
      color: theme.palette.primary.main,
      marginTop: theme.spacing(2),
    },
    cardSubTxt: {
      color: theme.palette.text.secondary,
      lineHeight: '1.75rem',
      fontSize: '16px',
    },
    innerCard: {
      paddingBottom: theme.spacing(8),
    },
    amountInput: {
      marginTop: theme.spacing(4),
    },
    thirdHeading: {
      marginTop: theme.spacing(2),
    },
    caption: {
      marginTop: theme.spacing(1),
    },
    txItem: {
      display: 'flex',
      padding: theme.spacing(0, 1),
      marginTop: theme.spacing(1),
      justifyContent: 'center',
      alignItems: 'center',
    },
    txLabel: {
      fontSize: '14px',
      color: theme.palette.text.secondary,
    },
    txUnit: {
      fontSize: '12px',
      color: theme.palette.text.secondary,
      marginLeft: theme.spacing(1),
    },
    infoIcon: {
      marginLeft: theme.spacing(0.5),
      color: theme.palette.text.secondary,
    },
  }),
)

const Sell: React.FC<{ balance: number }> = ({ balance }) => {
  const [amount, setAmount] = useState(1)
  const [collateral, setCollateral] = useState(1)
  const [collatPercent, setCollatPercent] = useState(200)
  const [vaultId, setVaultId] = useState(0)
  const [isVaultApproved, setIsVaultApproved] = useState(true)
  const [quote, setQuote] = useState({
    amountOut: new BigNumber(0),
    minimumAmountOut: new BigNumber(0),
    priceImpact: '0',
  })
  const [buyQuote, setBuyQuote] = useState(new BigNumber(0))
  const [shortLoading, setShortLoading] = useState(false)
  const [buyLoading, setBuyLoading] = useState(false)

  const classes = useStyles()
  const { openShort, closeShort } = useShortHelper()
  const { getSellQuote, ready, getBuyQuote } = useSqueethPool()
  const { updateOperator, normFactor: normalizationFactor, fundingPerDay, getShortAmountFromDebt } = useController()
  const { shortHelper } = useAddresses()
  const { vaults: shortVaults } = useVaultManager(5)
  const { squeethAmount, wethAmount, usdAmount } = useShortPositions()
  const ethPrice = useETHPrice()
  const { selectWallet, connected } = useWallet()

  const liqPrice = useMemo(() => {
    const rSqueeth = normalizationFactor.multipliedBy(amount).dividedBy(10000)
    // console.log(amount, rSqueeth.toNumber(), normalizationFactor.toNumber())
    return collateral / rSqueeth.multipliedBy(1.5).toNumber()
  }, [amount, collatPercent, collateral, normalizationFactor.toNumber()])

  useEffect(() => {
    if (!shortVaults.length) {
      setVaultId(0)
      return
    }

    setVaultId(shortVaults[0].id)
  }, [shortVaults.length])

  useEffect(() => {
    const debt = new BigNumber((collateral * 100) / collatPercent)
    getShortAmountFromDebt(debt).then((s) => setAmount(s.toNumber()))
  }, [collatPercent, collateral, normalizationFactor.toNumber()])

  useEffect(() => {
    if (!ready) return
    getSellQuote(amount).then((val) => setQuote(val))
  }, [amount, ready])

  useEffect(() => {
    if (!ready) return

    getBuyQuote(squeethAmount.negated().toNumber()).then(setBuyQuote)
  }, [squeethAmount.toNumber(), ready])

  useEffect(() => {
    if (!vaultId) return

    setIsVaultApproved(shortVaults[0].operator.toLowerCase() === shortHelper.toLowerCase())
  }, [vaultId])

  const depositAndShort = async () => {
    setShortLoading(true)
    try {
      if (vaultId && !isVaultApproved) {
        await updateOperator(vaultId, shortHelper)
        setIsVaultApproved(true)
      } else {
        await openShort(vaultId, new BigNumber(amount), new BigNumber(collateral))
      }
    } catch (e) {
      console.log(e)
    }
    setShortLoading(false)
  }

  const buyBackAndClose = async () => {
    setBuyLoading(true)
    try {
      await closeShort(vaultId, shortVaults[0].shortAmount)
    } catch (e) {
      console.log(e)
    }
    setBuyLoading(false)
  }

  const { volMultiplier: globalVMultiplier, setCollatRatio } = useWorldContext()

  const { accFunding } = useETHPriceCharts(1, globalVMultiplier)

  useEffect(() => {
    setCollatRatio(collatPercent / 100)
  }, [collatPercent])

  const TxValue: React.FC<{ value: string | number; label: string }> = ({ value, label }) => {
    return (
      <div>
        <Typography component="span">{value}</Typography>
        <Typography component="span" variant="caption" className={classes.txUnit}>
          {label}
        </Typography>
      </div>
    )
  }

  return (
    <div>
      <Typography variant="caption" className={classes.thirdHeading} component="div">
        Mint and sell Squeeth to receive premium
      </Typography>
      <div className={classes.thirdHeading}>
        <PrimaryInput
          value={collateral.toString()}
          onChange={(v) => setCollateral(Number(v))}
          label="ETH Collateral"
          tooltip="Amount of ETH collateral"
          actionTxt="Max"
          onActionClicked={() => setCollateral(balance)}
        />
      </div>
      <div className={classes.thirdHeading}>
        <TextField
          size="small"
          value={collatPercent.toString()}
          type="number"
          style={{ width: 300 }}
          onChange={(event) => setCollatPercent(Number(event.target.value))}
          id="filled-basic"
          label="Collateral Ratio"
          variant="outlined"
          error={collatPercent < 150}
          helperText="Minimum is 150%"
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <Typography variant="caption">%</Typography>
                <Tooltip title="If 200% you will get 1 wSqueeth for 2 ETH " style={{ marginLeft: '4px' }}>
                  <InfoOutlinedIcon fontSize="small" />
                </Tooltip>
              </InputAdornment>
            ),
          }}
        />
      </div>
      <div className={classes.thirdHeading}></div>
      <CollatRange />
      <TradeInfoItem
        label="Squeeth exposure"
        value={ethPrice.times(ethPrice).times(amount).dividedBy(10000).times(normalizationFactor).toFixed(2)}
        unit="$$ of SQTH"
      />
      <TradeInfoItem
        label="Liquidation Price"
        value={liqPrice.toFixed(2)}
        unit="USDC"
        tooltip="Price of ETH when liquidation occurs"
      />
      <TradeInfoItem
        label="Initial Premium"
        value={quote.amountOut.toFixed(4)}
        unit="ETH"
        tooltip={'Initial payment you get for selling squeeth on Uniswap'}
      />
      <TradeInfoItem label="Slippage tolerance" value="0.5" unit="%" />
      <TradeInfoItem label="Price Impact" value={quote.priceImpact} unit="%" />
      <TradeInfoItem label="Minimum received" value={quote.minimumAmountOut.toFixed(4)} unit="ETH" />

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
          onClick={depositAndShort}
          className={classes.amountInput}
          disabled={shortLoading || collatPercent < 150}
          variant="contained"
          style={{ width: '300px' }}
        >
          {shortLoading ? (
            <CircularProgress color="primary" size="1.5rem" />
          ) : (
            <>
              {isVaultApproved ? 'Deposit and sell' : 'Add operator (1/2)'}
              {!isVaultApproved ? (
                <Tooltip
                  style={{ marginLeft: '2px' }}
                  title="Operator is a contract that mints squeeth, deposits collateral and sells squeeth in single TX. Similarly it also buys back + burns squeeth and withdraws collateral in single TX"
                >
                  <InfoOutlinedIcon fontSize="small" />
                </Tooltip>
              ) : null}
            </>
          )}
        </PrimaryButton>
      )}
      <Typography variant="caption" className={classes.caption} component="div">
        Trades on Uniswap 🦄
      </Typography>
      {/* <div style={{ marginTop: '20px', marginBottom: '4px' }}>
        <TradeInfoItem label="Short Position" value={squeethAmount.negated().toFixed(6)} unit="SQTH" color="primary" />
        <TradeInfoItem
          label="Total Premium Received"
          value={Number(usdAmount.toFixed(2)).toLocaleString()}
          unit="$$ of ETH"
          tooltip={`${wethAmount.absoluteValue().toFixed(4)} ETH`}
          color="green"
        />
        <TradeInfoItem
          label="Current Value"
          value={Number(buyQuote.times(ethPrice).toFixed(2)).toLocaleString()}
          unit="$$ of ETH"
          tooltip={`you have to spend ${buyQuote.toFixed(4)} ETH`}
          color="red"
        />
      </div>
      <ErrorButton
        disabled={!shortVaults.length || !isVaultApproved || buyLoading}
        style={{ width: '325px', marginTop: '4px' }}
        variant="contained"
        color="secondary"
        onClick={buyBackAndClose}
      >
        {buyLoading ? <CircularProgress color="primary" size="1.5rem" /> : 'Buy back and close'}
      </ErrorButton>{' '} */}
    </div>
  )
}

export default Sell
