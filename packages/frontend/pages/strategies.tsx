import { PrimaryButton } from '@components/Button'
import { PrimaryInput } from '@components/Input/PrimaryInput'
import Nav from '@components/Nav'
import CapDetails from '@components/Strategies/CapDetails'
import StrategyInfoItem from '@components/Strategies/StrategyInfoItem'
import { SecondaryTab, SecondaryTabs } from '@components/Tabs'
import { useCrabStrategy } from '@hooks/contracts/useCrabStrategy'
import { useTokenBalance } from '@hooks/contracts/useTokenBalance'
import { useAddresses } from '@hooks/useAddress'
import { useETHPrice } from '@hooks/useETHPrice'
import { InputAdornment, TextField, Typography } from '@material-ui/core'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import BigNumber from 'bignumber.js'
import React, { useState } from 'react'

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
      padding: theme.spacing(4, 20),
      marginLeft: 'auto',
      marginRight: 'auto',
    },
    header: {
      display: 'flex',
      alignItems: 'center',
    },
    body: {
      display: 'flex',
      marginTop: theme.spacing(5),
    },
    tradeContainer: {
      display: 'flex',
      flexDirection: 'column',
      padding: theme.spacing(2, 3),
    },
    tradeForm: {
      background: theme.palette.background.stone,
      borderRadius: theme.spacing(2),
      margin: theme.spacing(0, 'auto'),
      width: '350px',
      position: 'sticky',
      height: '400px',
      top: '100px',
    },
    overview: {
      display: 'flex',
      columnGap: '20px',
      marginTop: theme.spacing(3),
    },
    details: {
      display: 'flex',
      flexDirection: 'column',
    },
    tabBackGround: {
      position: 'sticky',
      top: '0',
      zIndex: 20,
      // background: '#2A2D2E',
    },
  }),
)

const Strategies: React.FC = () => {
  const [ethAmount, setEthAmount] = useState(new BigNumber(0))
  const [depositOption, setDepositOption] = useState(0)
  const [slippage, setSlippage] = useState(0.5)

  const classes = useStyles()
  const { maxCap, vault, flashDeposit, collatRatio } = useCrabStrategy()
  const { crabToken } = useAddresses()
  const crabBalance = useTokenBalance(crabToken, 10, 18)
  const ethPrice = useETHPrice()

  return (
    <div>
      <Nav />
      <div className={classes.container}>
        <div className={classes.header}>
          <Typography variant="h6">🦀</Typography>
          <Typography variant="h6" style={{ marginLeft: '8px' }} color="primary">
            Crab Strategy
          </Typography>
        </div>
        <Typography variant="subtitle1" color="textSecondary" style={{ width: '60%', marginTop: '8px' }}>
          This yielding position is similar to selling a strangle. You are profitable as long as ETH moves less than
          approximately 6% in either direction in a single day. The strategy rebalances daily to be delta neutral by
          buying or selling ETH.
        </Typography>
        <div className={classes.body}>
          <div className={classes.details}>
            <CapDetails maxCap={maxCap} depositedAmount={vault?.collateralAmount || new BigNumber(0)} />
            <div className={classes.overview}>
              <StrategyInfoItem value={vault?.collateralAmount.toFixed(4)} label="Deposit (ETH)" />
              <StrategyInfoItem value={vault?.shortAmount.toFixed(4)} label="Short oSQTH" />
              <StrategyInfoItem value={collatRatio.toString()} label="Collat Ratio (%)" />
            </div>
          </div>
          <div className={classes.tradeForm}>
            <SecondaryTabs
              value={depositOption}
              onChange={(evt, val) => setDepositOption(val)}
              aria-label="simple tabs example"
              centered
              variant="fullWidth"
              className={classes.tabBackGround}
            >
              <SecondaryTab label="Deposit" />
              <SecondaryTab label="Withdraw" />
            </SecondaryTabs>
            <div className={classes.tradeContainer}>
              <PrimaryInput
                value={ethAmount.toString()}
                onChange={(v) => setEthAmount(new BigNumber(v))}
                label="Amount"
                tooltip="ETH Amount to deposit"
                actionTxt="Max"
                unit="ETH"
                convertedValue={ethPrice.times(ethAmount).toFixed(2)}
              />
              <TextField
                size="small"
                value={slippage}
                type="number"
                style={{ width: 300, marginTop: '8px' }}
                onChange={(event) => setSlippage(Number(event.target.value))}
                id="filled-basic"
                label="Slippage"
                variant="outlined"
                error={slippage <= 0}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <Typography variant="caption">%</Typography>
                    </InputAdornment>
                  ),
                }}
                inputProps={{
                  min: '0',
                }}
              />
              <PrimaryButton style={{ marginTop: '16px' }} onClick={() => flashDeposit(ethAmount, slippage)}>
                Deposit
              </PrimaryButton>
              <div style={{ marginTop: '16px' }}>Your Position: {crabBalance.toFixed(2)}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Strategies
