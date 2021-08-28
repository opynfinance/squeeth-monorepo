import { Button, createStyles, InputAdornment, makeStyles, TextField, Tooltip, Typography } from '@material-ui/core'
import InfoOutlinedIcon from '@material-ui/icons/InfoOutlined'
import BigNumber from 'bignumber.js'
import React, { useEffect, useMemo, useState } from 'react'

import { useWorldContext } from '../../context/world'
import { useController } from '../../hooks/contracts/useController'
import useShortHelper from '../../hooks/contracts/useShortHelper'
import { useTokenBalance } from '../../hooks/contracts/useTokenBalance'
import { useVaultManager } from '../../hooks/contracts/useVaultManager'
import { useAddresses } from '../../hooks/useAddress'
import { useETHPriceCharts } from '../../hooks/useETHPriceCharts'
import { ErrorButton } from '../Buttons'

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

  const classes = useStyles()
  const { openShort, closeShort } = useShortHelper()
  const { updateOperator } = useController()
  const { wSqueeth, weth, shortHelper } = useAddresses()
  const squeethBal = useTokenBalance(wSqueeth, 5)
  const wethBal = useTokenBalance(weth, 5)
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
    if (!vaultId) return

    setIsVaultApproved(shortVaults[0].operator.toLowerCase() === shortHelper.toLowerCase())
  }, [vaultId])

  const depositAndShort = () => {
    if (vaultId && !isVaultApproved) {
      updateOperator(vaultId, shortHelper).then(() => setIsVaultApproved(true))
    } else {
      openShort(vaultId, new BigNumber(amount))
    }
  }

  const { volMultiplier: globalVMultiplier } = useWorldContext()

  const { accFunding, startingETHPrice } = useETHPriceCharts(1, globalVMultiplier)

  const dailyFundingPayment = useMemo(() => accFunding / startingETHPrice, [accFunding, startingETHPrice])

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
        <Typography className={classes.txLabel}>Collateral Required</Typography>
        <TxValue value={(amount * 10000 * 1.5).toFixed(4)} label="ETH" />
      </div>
      <div className={classes.txItem}>
        <Typography className={classes.txLabel}>Daily Funding Received</Typography>
        <TxValue value={(dailyFundingPayment * amount).toFixed(2)} label="USDC" />
      </div>
      <div className={classes.txItem}>
        <Typography className={classes.txLabel}>WETH Balance</Typography>
        <TxValue value={wethBal.toFixed(2)} label="WETH" />
      </div>
      <Button
        onClick={depositAndShort}
        className={classes.amountInput}
        style={{ width: 300, color: '#000' }}
        variant="contained"
        color="primary"
      >
        {isVaultApproved ? 'Deposit and sell' : 'Add operator to deposit / Burn'}
      </Button>
      <Typography variant="body1" color="primary" style={{ marginTop: '16px', marginBottom: '8px' }}>
        Your short Position: {shortVaults.length ? shortVaults[0].shortAmount.toFixed(8) : 0}
      </Typography>
      <ErrorButton
        disabled={!shortVaults.length || !isVaultApproved}
        style={{ width: 300 }}
        variant="contained"
        color="secondary"
        onClick={() => closeShort(vaultId, shortVaults[0].shortAmount)}
      >
        Buy back and close
      </ErrorButton>{' '}
    </div>
  )
}

export default Sell
