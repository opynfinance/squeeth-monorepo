import { PrimaryButton } from '@components/Button'
import { PrimaryInput } from '@components/Input/PrimaryInput'
import Nav from '@components/Nav'
import { useCrabStrategy } from '@hooks/contracts/useCrabStrategy'
import { Typography } from '@material-ui/core'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import BigNumber from 'bignumber.js'
import React, { useState } from 'react'

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
      padding: theme.spacing(4, 8),
    },
    header: {
      display: 'flex',
      alignItems: 'center',
    },
    tradeContainer: {
      width: '350px',
      background: theme.palette.background.stone,
      display: 'flex',
      flexDirection: 'column',
      margin: 'auto',
      padding: theme.spacing(2, 3),
    },
  }),
)

const Strategies: React.FC = () => {
  const classes = useStyles()
  const { maxCap, vault, deposit, collatRatio, liquidationPrice, isPriceHedge, isTimeHedge, priceHedgeOnUniswap } =
    useCrabStrategy()
  const [ethAmount, setEthAmount] = useState(new BigNumber(0))

  return (
    <div>
      <Nav />
      <div className={classes.container}>
        <div className={classes.header}>
          <Typography variant="h6">🦀</Typography>
          <Typography variant="h6" style={{ marginLeft: '8px' }}>
            Crab Strategy
          </Typography>
        </div>
      </div>
      <div className={classes.tradeContainer}>
        <p>Cap: {maxCap.toString()}</p>
        <p>Collateral: {vault?.collateralAmount.toNumber()}</p>
        <p>Collat Ratio: {collatRatio.toString()}</p>
        <p>Short Amount: {vault?.shortAmount.toNumber()}</p>
        <p>Is Price Hedge: {isPriceHedge.toString()}</p>
        <p>Is Time Hedge: {isTimeHedge.toString()}</p>
        <PrimaryInput
          value={ethAmount.toString()}
          onChange={(v) => setEthAmount(new BigNumber(v))}
          label="Amount"
          tooltip="ETH Amount willing to deposit"
          actionTxt="Max"
          unit="ETH"
          convertedValue={0.0}
        />
        <PrimaryButton>Deposit</PrimaryButton>
        <PrimaryButton onClick={priceHedgeOnUniswap}>Price Hedge</PrimaryButton>
      </div>
    </div>
  )
}

export default Strategies
