import { CircularProgress } from '@material-ui/core'
import { createStyles, Divider, InputAdornment, makeStyles, TextField, Tooltip, Typography } from '@material-ui/core'
import InfoOutlinedIcon from '@material-ui/icons/InfoOutlined'
import BigNumber from 'bignumber.js'
import React, { useCallback, useEffect, useMemo, useState } from 'react'

import { UNI_POOL_FEES } from '../../constants'
import { useTrade } from '../../context/trade'
import { useWallet } from '../../context/wallet'
import { useWorldContext } from '../../context/world'
import { useController } from '../../hooks/contracts/useController'
import useShortHelper from '../../hooks/contracts/useShortHelper'
import { useSqueethPool } from '../../hooks/contracts/useSqueethPool'
import { useVaultManager } from '../../hooks/contracts/useVaultManager'
import { useAddresses } from '../../hooks/useAddress'
import { useETHPrice } from '../../hooks/useETHPrice'
import { useLongPositions, useShortPositions } from '../../hooks/usePositions'
import { PrimaryButton } from '../Buttons'
import CollatRange from '../CollatRange'
import { PrimaryInput } from '../Inputs'
import TradeInfoItem from './TradeInfoItem'
import UniswapData from './UniswapData'

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
      marginTop: theme.spacing(1),
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
    divider: {
      margin: theme.spacing(2, 3),
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

type SellType = {
  balance: number
  open: boolean
  closeTitle: string
}

const Sell: React.FC<SellType> = ({ balance, open, closeTitle }) => {
  const [collateral, setCollateral] = useState(0)
  const [collatPercent, setCollatPercent] = useState(200)
  const [existingCollatPercent, setExistingCollatPercent] = useState(0)
  const [existingCollat, setExistingCollat] = useState(0)
  const [vaultId, setVaultId] = useState(0)
  const [isVaultApproved, setIsVaultApproved] = useState(true)
  const [shortLoading, setShortLoading] = useState(false)
  const [buyLoading, setBuyLoading] = useState(false)
  const [withdrawCollat, setWithdrawCollat] = useState(new BigNumber(0))

  const classes = useStyles()
  const { openShort, closeShort } = useShortHelper()
  const { getWSqueethPositionValue } = useSqueethPool()
  const { updateOperator, normFactor: normalizationFactor, getShortAmountFromDebt, getDebtAmount } = useController()
  const { shortHelper } = useAddresses()
  const { vaults: shortVaults } = useVaultManager(5)
  const ethPrice = useETHPrice()
  const { selectWallet, connected } = useWallet()
  const { tradeAmount: amount, setTradeAmount: setAmount, quote, sellCloseQuote } = useTrade()
  const { squeethAmount: lngAmt } = useLongPositions()
  const { squeethAmount: shrtAmt } = useShortPositions()

  const liqPrice = useMemo(() => {
    const rSqueeth = normalizationFactor.multipliedBy(amount).dividedBy(10000)

    return collateral / rSqueeth.multipliedBy(1.5).toNumber()
  }, [amount, collatPercent, collateral, normalizationFactor.toNumber()])

  useEffect(() => {
    if (!open && shrtAmt.lt(amount)) {
      setAmount(shrtAmt.toNumber())
    }
  }, [shrtAmt.toNumber(), open])

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
    if (!vaultId) {
      return
    }

    getDebtAmount(shrtAmt).then((debt) => {
      const _collat: BigNumber = shortVaults[0].collateralAmount
      if (debt && debt.isPositive()) {
        setExistingCollatPercent(Number(_collat.div(debt).times(100).toFixed(1)))
      }
    })
  }, [vaultId])

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

  useEffect(() => {
    if (shortVaults.length) {
      const _collat: BigNumber = shortVaults[0].collateralAmount
      setExistingCollat(_collat.toNumber())
      const restOfShort = new BigNumber(shortVaults[0].shortAmount).minus(amount)
      getDebtAmount(new BigNumber(restOfShort)).then((debt) => {
        const neededCollat = debt.times(collatPercent / 100)
        setWithdrawCollat(_collat.minus(neededCollat))
      })
    }
  }, [amount, collatPercent, shortVaults])

  const buyBackAndClose = useCallback(async () => {
    setBuyLoading(true)
    try {
      if (vaultId && !isVaultApproved) {
        await updateOperator(vaultId, shortHelper)
        setIsVaultApproved(true)
      } else {
        const _collat: BigNumber = shortVaults[0].collateralAmount
        const restOfShort = new BigNumber(shortVaults[0].shortAmount).minus(amount)
        const _debt: BigNumber = await getDebtAmount(new BigNumber(restOfShort))
        const neededCollat = _debt.times(collatPercent / 100)
        await closeShort(vaultId, new BigNumber(amount), _collat.minus(neededCollat))
      }
    } catch (e) {
      console.log(e)
    }
    setBuyLoading(false)
  }, [
    amount,
    closeShort,
    collatPercent,
    getDebtAmount,
    isVaultApproved,
    shortHelper,
    shortVaults,
    updateOperator,
    vaultId,
  ])

  const { setCollatRatio } = useWorldContext()

  const { openError, closeError } = useMemo(() => {
    let openError = null
    let closeError = null

    if (shrtAmt.lt(amount)) {
      closeError = 'Close amount exceeds position'
    }
    if (amount > balance) {
      openError = 'Insufficient ETH balance'
    } else if (amount > 0 && collateral + existingCollat < 0.5) {
      openError = 'Minimum collateral is 0.5 ETH'
    }

    return { openError, closeError }
  }, [amount, balance, shrtAmt.toNumber(), amount])

  useEffect(() => {
    setCollatRatio(collatPercent / 100)
  }, [collatPercent])

  const ClosePosition = useMemo(() => {
    return (
      <div>
        <Typography variant="caption" className={classes.thirdHeading} component="div">
          {closeTitle}
        </Typography>
        <div className={classes.thirdHeading}>
          <PrimaryInput
            value={amount}
            onChange={(v) => setAmount(Number(v))}
            label="Amount"
            tooltip="Amount of oSQTH to buy"
            actionTxt="Max"
            onActionClicked={() => setAmount(Number(shrtAmt))}
            unit="oSQTH"
            error={!!closeError}
            convertedValue={getWSqueethPositionValue(amount).toFixed(2).toLocaleString()}
            hint={shrtAmt.lt(amount) ? 'Close amount exceeds position' : `Position ${shrtAmt.toFixed(6)} oSQTH`}
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
                </InputAdornment>
              ),
            }}
          />
        </div>
        <div className={classes.thirdHeading}></div>
        <CollatRange />
        <div className={classes.squeethExp}>
          <div>
            <Typography variant="caption">Spend</Typography>
            <Typography className={classes.squeethExpTxt}>{sellCloseQuote.amountIn.toFixed(6)}</Typography>
          </div>
          <div>
            <Typography variant="caption">
              ${Number(ethPrice.times(sellCloseQuote.amountIn).toFixed(2)).toLocaleString()}
            </Typography>
            <Typography className={classes.squeethExpTxt}>ETH</Typography>
          </div>
        </div>
        <div className={classes.divider}>
          <TradeInfoItem
            label="Collateral you redeem"
            value={withdrawCollat.isPositive() ? withdrawCollat.toFixed(4) : 0}
            unit="ETH"
          />
          <TradeInfoItem
            label="Current Collateral ratio"
            value={existingCollatPercent}
            unit="%"
            tooltip={'Collateral ratio for current short position'}
          />
          <div style={{ marginTop: '10px' }}>
            <UniswapData
              slippage="0.5"
              priceImpact={sellCloseQuote.priceImpact}
              minReceived={sellCloseQuote.maximumAmountIn.toFixed(4)}
              minReceivedUnit="ETH"
            />
          </div>
        </div>

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
            onClick={buyBackAndClose}
            className={classes.amountInput}
            disabled={buyLoading || collatPercent < 150 || !!closeError || lngAmt.gt(0) || shrtAmt.isZero()}
            variant="contained"
            style={{ width: '300px' }}
          >
            {buyLoading ? (
              <CircularProgress color="primary" size="1.5rem" />
            ) : (
              <>
                {isVaultApproved ? 'Buy back and close' : 'Add operator (1/2)'}
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
          Trades on Uniswap V3 🦄
        </Typography>
      </div>
    )
  }, [
    classes.thirdHeading,
    classes.squeethExp,
    classes.squeethExpTxt,
    classes.divider,
    classes.amountInput,
    classes.caption,
    closeTitle,
    amount,
    closeError,
    getWSqueethPositionValue,
    shrtAmt,
    collatPercent,
    sellCloseQuote.amountIn,
    sellCloseQuote.priceImpact,
    sellCloseQuote.maximumAmountIn,
    ethPrice,
    withdrawCollat,
    existingCollatPercent,
    connected,
    selectWallet,
    buyLoading,
    buyBackAndClose,
    isVaultApproved,
    setAmount,
  ])

  if (!open) {
    return ClosePosition
  }

  return (
    <div>
      <Typography variant="caption" className={classes.thirdHeading} component="div">
        Mint and sell squeeth ERC20 to receive premium
      </Typography>
      <div className={classes.thirdHeading}>
        <PrimaryInput
          value={collateral.toString()}
          onChange={(v) => setCollateral(Number(v))}
          label="Collateral"
          tooltip="Amount of ETH collateral"
          actionTxt="Max"
          onActionClicked={() => setCollateral(balance)}
          unit="ETH"
          convertedValue={(collateral * Number(ethPrice)).toFixed(2).toLocaleString()}
          hint={!!openError ? openError : `Balance ${balance} ETH`}
          error={!!openError}
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
              </InputAdornment>
            ),
          }}
        />
      </div>
      <div className={classes.thirdHeading}></div>
      <CollatRange />
      <div className={classes.squeethExp}>
        <div>
          <Typography variant="caption">Sell</Typography>
          <Typography className={classes.squeethExpTxt}>{amount.toFixed(6)}</Typography>
        </div>
        <div>
          <Typography variant="caption">
            ${Number(getWSqueethPositionValue(amount).toFixed(2)).toLocaleString()}
          </Typography>
          <Typography className={classes.squeethExpTxt}>oSQTH</Typography>
        </div>
      </div>
      <div className={classes.divider}>
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
        <TradeInfoItem
          label="Current Collateral ratio"
          value={existingCollatPercent}
          unit="%"
          tooltip={'Collateral ratio for current short position'}
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
          disabled={shortLoading || collatPercent < 150 || !!openError || lngAmt.gt(0)}
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
    </div>
  )
}

export default Sell
