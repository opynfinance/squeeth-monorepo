import { Backdrop, Button, CircularProgress, Fade, Modal } from '@material-ui/core'
import { createStyles, Divider, InputAdornment, makeStyles, TextField, Tooltip, Typography } from '@material-ui/core'
import InfoOutlinedIcon from '@material-ui/icons/InfoOutlined'
import BigNumber from 'bignumber.js'
import React, { useCallback, useEffect, useMemo, useState } from 'react'

import { Vaults } from '../../constants'
import { UNI_POOL_FEES } from '../../constants'
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

const Sell: React.FC<{ balance: number; open: boolean; newVersion: boolean }> = ({ balance, open, newVersion }) => {
  const [amount, setAmount] = useState(1)
  const [collateral, setCollateral] = useState(1)
  const [collatPercent, setCollatPercent] = useState(200)
  const [existingCollatPercent, setExistingCollatPercent] = useState(0)
  const [vaultId, setVaultId] = useState(0)
  const [isVaultApproved, setIsVaultApproved] = useState(true)
  const [quote, setQuote] = useState({
    amountOut: new BigNumber(0),
    minimumAmountOut: new BigNumber(0),
    priceImpact: '0',
  })
  const [buyQuote, setBuyQuote] = useState({
    amountIn: new BigNumber(0),
    maximumAmountIn: new BigNumber(0),
    priceImpact: '0',
  })
  const [shortLoading, setShortLoading] = useState(false)
  const [buyLoading, setBuyLoading] = useState(false)
  const [closeAmount, setCloseAmount] = useState(1)
  const [withdrawCollat, setWithdrawCollat] = useState(new BigNumber(0))
  const [modelOpen, setModelOpen] = useState(false)

  const classes = useStyles()
  const { openShort, closeShort } = useShortHelper()
  const { getSellQuote, ready, getBuyQuote, getWSqueethPositionValue } = useSqueethPool()
  const {
    updateOperator,
    normFactor: normalizationFactor,
    fundingPerDay,
    getShortAmountFromDebt,
    getDebtAmount,
  } = useController()
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
    if (!open && squeethAmount.lt(closeAmount)) {
      setCloseAmount(squeethAmount.toNumber())
    }
  }, [squeethAmount.toNumber(), open])

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
    if (!vaultId) {
      return
    }

    getDebtAmount(squeethAmount).then((debt) => {
      const _collat: BigNumber = shortVaults[0].collateralAmount
      if (debt && debt.isPositive()) {
        setExistingCollatPercent(Number(_collat.div(debt).times(100).toFixed(1)))
      }
    })
  }, [vaultId])

  useEffect(() => {
    if (!ready) return

    getBuyQuote(closeAmount).then(setBuyQuote)
  }, [closeAmount, ready])

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
      const restOfShort = new BigNumber(shortVaults[0].shortAmount).minus(closeAmount)
      getDebtAmount(new BigNumber(restOfShort)).then((debt) => {
        const neededCollat = debt.times(collatPercent / 100)
        setWithdrawCollat(_collat.minus(neededCollat))
      })
    }
  }, [closeAmount, collatPercent, shortVaults])

  const buyBackAndClose = useCallback(async () => {
    setBuyLoading(true)
    try {
      if (vaultId && !isVaultApproved) {
        await updateOperator(vaultId, shortHelper)
        setIsVaultApproved(true)
      } else {
        const _collat: BigNumber = shortVaults[0].collateralAmount
        const restOfShort = new BigNumber(shortVaults[0].shortAmount).minus(closeAmount)
        const _debt: BigNumber = await getDebtAmount(new BigNumber(restOfShort))
        const neededCollat = _debt.times(collatPercent / 100)
        await closeShort(vaultId, new BigNumber(closeAmount), _collat.minus(neededCollat))
      }
    } catch (e) {
      console.log(e)
    }
    setBuyLoading(false)
  }, [
    closeAmount,
    closeShort,
    collatPercent,
    getDebtAmount,
    isVaultApproved,
    shortHelper,
    shortVaults,
    updateOperator,
    vaultId,
  ])

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

  const ClosePosition = useMemo(() => {
    return (
      <div>
        <Typography variant="caption" className={classes.thirdHeading} component="div">
          Buy back and close position
        </Typography>
        <div className={classes.thirdHeading}>
          <PrimaryInput
            value={closeAmount}
            onChange={(v) => setCloseAmount(Number(v))}
            label="Amount"
            tooltip="Amount of wSQTH to buy"
            actionTxt="Max"
            onActionClicked={() => setCloseAmount(Number(squeethAmount))}
            unit="wSQTH"
            error={squeethAmount.lt(closeAmount)}
            convertedValue={getWSqueethPositionValue(closeAmount).toFixed(2).toLocaleString()}
            hint={
              squeethAmount.lt(closeAmount)
                ? 'Close amount exceeds position'
                : `Position ${squeethAmount.toFixed(6)} wSQTH`
            }
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
                  {/* <Tooltip title="If 200% you will get 1 wSqueeth for 2 ETH " style={{ marginLeft: '4px' }}>
                    <InfoOutlinedIcon fontSize="small" />
                  </Tooltip> */}
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
            <Typography className={classes.squeethExpTxt}>{buyQuote.amountIn.toFixed(6)}</Typography>
          </div>
          <div>
            <Typography variant="caption">
              ${Number(ethPrice.times(buyQuote.amountIn).toFixed(2)).toLocaleString()}
            </Typography>
            <Typography className={classes.squeethExpTxt}>ETH</Typography>
          </div>
        </div>
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
        <Divider className={classes.divider} />
        <TradeInfoItem label="Slippage Tolerance" value="0.5" unit="%" />
        <TradeInfoItem label="Price Impact" value={buyQuote.priceImpact} unit="%" />
        <TradeInfoItem label="Minimum to send" value={buyQuote.maximumAmountIn.toFixed(4)} unit="ETH" />
        <TradeInfoItem label="Liquidity Provider Fee" value={UNI_POOL_FEES / 1000000} unit="ETH" />

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
            disabled={shortLoading || collatPercent < 150}
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
          Trades on Uniswap 🦄
        </Typography>
      </div>
    )
  }, [
    buyBackAndClose,
    buyLoading,
    buyQuote.amountIn,
    buyQuote.maximumAmountIn,
    buyQuote.priceImpact,
    classes.amountInput,
    classes.caption,
    classes.divider,
    classes.squeethExp,
    classes.squeethExpTxt,
    classes.thirdHeading,
    closeAmount,
    collatPercent,
    connected,
    ethPrice,
    isVaultApproved,
    selectWallet,
    shortLoading,
    squeethAmount,
    withdrawCollat,
    getWSqueethPositionValue,
    existingCollatPercent,
  ])

  if (!open) {
    return ClosePosition
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
          label="Collateral"
          tooltip="Amount of ETH collateral"
          actionTxt="Max"
          onActionClicked={() => setCollateral(balance)}
          unit="ETH"
          convertedValue={(collateral * Number(ethPrice)).toFixed(2).toLocaleString()}
          hint={`Balance ${balance} ETH`}
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
                {/* <Tooltip title="If 200% you will get 1 wSqueeth for 2 ETH " style={{ marginLeft: '4px' }}>
                  <InfoOutlinedIcon fontSize="small" />
                </Tooltip> */}
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
          <Typography className={classes.squeethExpTxt}>wSQTH</Typography>
        </div>
      </div>
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
      <Divider className={classes.divider} />
      <TradeInfoItem label="Slippage tolerance" value="0.5" unit="%" />
      <TradeInfoItem label="Price Impact" value={quote.priceImpact} unit="%" />
      <TradeInfoItem label="Minimum received" value={quote.minimumAmountOut.toFixed(4)} unit="ETH" />
      <TradeInfoItem label="Liquidity Provider Fee" value={UNI_POOL_FEES / 1000000} unit="ETH" />

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
      {!newVersion ? (
        <>
          <div className={classes.closePosition}>
            <Typography className={classes.caption} color="primary">
              Current position: {squeethAmount.toFixed(6)}
            </Typography>
            <Button className={classes.closeBtn} onClick={() => setModelOpen(true)}>
              close
            </Button>
          </div>
          <Modal
            aria-labelledby="enable-notification"
            open={modelOpen}
            className={classes.modal}
            onClose={() => setModelOpen(false)}
            closeAfterTransition
            BackdropComponent={Backdrop}
            BackdropProps={{
              timeout: 500,
            }}
          >
            <Fade in={modelOpen}>
              <div className={classes.paper}>{ClosePosition}</div>
            </Fade>
          </Modal>
        </>
      ) : null}
    </div>
  )
}

export default Sell
