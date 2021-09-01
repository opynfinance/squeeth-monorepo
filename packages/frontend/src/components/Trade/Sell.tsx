import { CircularProgress } from '@material-ui/core'
import { createStyles, InputAdornment, makeStyles, TextField, Tooltip, Typography } from '@material-ui/core'
import InfoOutlinedIcon from '@material-ui/icons/InfoOutlined'
import BigNumber from 'bignumber.js'
import React, { useEffect, useState } from 'react'

import { useWorldContext } from '../../context/world'
import { useController } from '../../hooks/contracts/useController'
import useShortHelper from '../../hooks/contracts/useShortHelper'
import { useSqueethPool } from '../../hooks/contracts/useSqueethPool'
import { useVaultManager } from '../../hooks/contracts/useVaultManager'
import { useAddresses } from '../../hooks/useAddress'
import { useETHPriceCharts } from '../../hooks/useETHPriceCharts'
import { ErrorButton, PrimaryButton } from '../Buttons'

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
    txItem: {
      display: 'flex',
      padding: theme.spacing(0, 1),
      marginTop: theme.spacing(1),
      justifyContent: 'space-between',
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
  }),
)

const Sell: React.FC = () => {
  const [amount, setAmount] = useState(0.00001)
  const [vaultId, setVaultId] = useState(0)
  const [isVaultApproved, setIsVaultApproved] = useState(true)
  const [premium, setPremium] = useState(new BigNumber(0))
  const [shortLoading, setShortLoading] = useState(false)
  const [buyLoading, setBuyLoading] = useState(false)

  const classes = useStyles()
  const { openShort, closeShort } = useShortHelper()
  const { getSellQuote, ready } = useSqueethPool()
  const { updateOperator } = useController()
  const { shortHelper } = useAddresses()
  const { vaults: shortVaults } = useVaultManager(5)

  // const squeethBal = useMemo(() => wSqueethBalO.multipliedBy(10000), [wSqueethBalO.toNumber()])

  useEffect(() => {
    if (!shortVaults.length) {
      setVaultId(0)
      return
    }

    setVaultId(shortVaults[0].id)
  }, [shortVaults.length])

  useEffect(() => {
    if (!ready) return
    getSellQuote(amount).then((val) => setPremium(val))
  }, [amount, ready])

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
        await openShort(vaultId, new BigNumber(amount))
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

  const { volMultiplier: globalVMultiplier } = useWorldContext()

  const { accFunding } = useETHPriceCharts(1, globalVMultiplier)

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

  const VaultValue: React.FC<{ value: string | number; label: string }> = ({ value, label }) => {
    return (
      <div>
        <Typography component="span" color="primary">
          {value}
        </Typography>
        <Typography component="span" variant="caption" className={classes.txUnit}>
          {label}
        </Typography>
      </div>
    )
  }

  return (
    <div>
      <Typography variant="caption" className={classes.thirdHeading} component="div">
        Sell Squeeth to receive premium
      </Typography>
      <div className={classes.thirdHeading}>
        <TextField
          size="small"
          value={amount}
          type="number"
          style={{ width: 300 }}
          onChange={(event) => setAmount(Number(event.target.value))}
          id="filled-basic"
          label="Squeeth Amount"
          variant="outlined"
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <Tooltip title="Amount of Squeeth you want to spend to get premium">
                  <InfoOutlinedIcon fontSize="small" />
                </Tooltip>
              </InputAdornment>
            ),
          }}
        />
      </div>
      <div className={classes.txItem}>
        <Typography className={classes.txLabel}>Premium you get</Typography>
        <TxValue value={premium.toFixed(4)} label="ETH" />
      </div>
      <div className={classes.txItem}>
        <Typography className={classes.txLabel}>Collateral Required</Typography>
        <TxValue value={(amount * 10000 * 1.5).toFixed(4)} label="ETH" />
      </div>
      <div className={classes.txItem}>
        <Typography className={classes.txLabel}>Daily Funding Received</Typography>
        <TxValue value={(accFunding * 0.000001).toFixed(2)} label="%" />
      </div>
      <PrimaryButton
        onClick={depositAndShort}
        className={classes.amountInput}
        disabled={shortLoading}
        variant="contained"
      >
        {shortLoading ? (
          <CircularProgress color="primary" size="1.5rem" />
        ) : (
          <>
            {isVaultApproved ? 'Deposit and sell (2/2)' : 'Add operator (1/2)'}
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
      <Typography variant="body1" color="primary" style={{ marginTop: '16px', marginBottom: '8px' }}>
        Your short Position: {shortVaults.length ? shortVaults[0].shortAmount.toFixed(8) : 0}
      </Typography>
      <ErrorButton
        disabled={!shortVaults.length || !isVaultApproved || buyLoading}
        style={{ width: 300 }}
        variant="contained"
        color="secondary"
        onClick={buyBackAndClose}
      >
        {buyLoading ? <CircularProgress color="primary" size="1.5rem" /> : 'Buy back and close'}
      </ErrorButton>{' '}
    </div>
  )
}

export default Sell
