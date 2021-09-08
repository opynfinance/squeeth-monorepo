import { InputAdornment, TextField, Tooltip } from '@material-ui/core'
import Card from '@material-ui/core/Card'
import List from '@material-ui/core/List'
import ListItem from '@material-ui/core/ListItem'
import ListItemText from '@material-ui/core/ListItemText'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import Typography from '@material-ui/core/Typography'
import BigNumber from 'bignumber.js'
import Image from 'next/image'
import { useEffect, useState } from 'react'

import ccpayoff from '../public/images/ccpayoff.png'
import { LongChart } from '../src/components/Charts/LongChart'
import { VaultChart } from '../src/components/Charts/VaultChart'
import Nav from '../src/components/Nav'
import Trade from '../src/components/Trade'
import { Vaults } from '../src/constants'
import { useWorldContext } from '../src/context/world'
import { useETHPrice } from '../src/hooks/useETHPrice'
import { useETHPriceCharts } from '../src/hooks/useETHPriceCharts'

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

enum TradeType {
  BUY,
  SELL,
}

export default function Home() {
  const classes = useStyles()
  const [leverage, setLeverage] = useState(4)
  const [amount, setAmount] = useState(1)
  const [cost, setCost] = useState(0)
  const [squeethExposure, setSqueethExposure] = useState(0)
  const [tradeType, setTradeType] = useState(TradeType.BUY)
  const [customLong, setCustomLong] = useState(0)
  const ethPrice = useETHPrice()

  const { volMultiplier: globalVolMultiplier } = useWorldContext()
  // use hook because we only calculate accFunding based on 24 hour performance
  const { setVolMultiplier } = useETHPriceCharts(1, globalVolMultiplier)

  useEffect(() => {
    setVolMultiplier(globalVolMultiplier)
  }, [globalVolMultiplier])

  return (
    <div>
      <Nav />

      {tradeType === TradeType.BUY ? (
        //long side
        <div className={classes.body}>
          <div>
            <Typography variant="h5">Long Squeeth - ETH&sup2; Position</Typography>
            <Typography variant="body1">Perpetual leverage without liquidations</Typography>
            <Typography variant="body2" className={classes.cardDetail}>
              Long squeeth (ETH&sup2;) gives you a leveraged position with unlimited upside, protected downside, and no
              liquidations. Compared to a 2x leveraged position, you make more when ETH goes up and lose less when ETH
              goes down. Eg. If ETH goes up 5x, squeeth goes up 25x. You pay a daily funding rate for this position.
              Enter the position by purchasing an ERC20 token.
            </Typography>
            <Typography className={classes.cardTitle} variant="h6">
              Historical PNL Backtest
            </Typography>
            <div className={classes.amountInput}>
              <LongChart />
            </div>
            <Typography className={classes.cardTitle} variant="h6">
              Strategy Details
            </Typography>
            <Typography className={classes.thirdHeading} variant="h6">
              How it works
            </Typography>
            <List>
              <ListItem>
                <ListItemText primary="1. Buy Squeeth ERC20" secondary="via Uniswap" />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="2. Pay daily funding out of squeeth ERC20 position"
                  secondary="Can think about this like selling some of your squeeth ERC20 each day to pay funding"
                />
              </ListItem>
              <ListItem>
                <ListItemText primary="3. Exit position by selling squeeth ERC20" secondary="via Uniswap" />
              </ListItem>
            </List>

            <Typography className={classes.thirdHeading} variant="h6">
              Properties
            </Typography>
            <Typography variant="body2" className={classes.cardSubTxt}>
              Squeeth gives you an ETH&sup2; payoff. This means you have constant gamma exposure, so you always hold a
              position similar to an at the money call option. This functions similar to a perpetual swap, where you are
              targeting ETH&sup2; rather than ETH.
              <a className={classes.header} href="https://www.paradigm.xyz/2021/08/power-perpetuals/">
                {' '}
                Learn more.{' '}
              </a>
            </Typography>
            <br />
            <Typography variant="body2" className={classes.cardSubTxt}>
              Funding is calculated as your position size multiplied by the TWAP (time weighted average price) of Mark -
              Index, where Mark is the price squeeth is trading at and Index is ETH&sup2;. We use{' '}
              <a className={classes.header} href="https://uniswap.org/whitepaper-v3.pdf">
                {' '}
                Uniswap V3 GMA (geometric moving average) TWAP.{' '}
              </a>
              Funding happens everytime the contract is touched and is paid out of your squeeth position. You can think
              about this as selling a small amount of your squeeth each day to pay funding.
              <br />
              <br />
              Even though funding is paid out of your squeeth position, your squeeth balance is always constant. Your
              squeeth exposure changes through a normalization factor that takes into account the reduced exposure due
              to funding.
            </Typography>
            {/* <br />
          <Typography variant="body2" className={classes.cardSubTxt}>
            Funding is paid in-kind (using the squeeth token), so you cannot be liquidated. Note that the squeeth ERC20 amount will remain constant eg. if you bought 1 squeeth you will still have 1 squeeth after funding in kind. 
            What will change is how much value you can redeem for each squeeth. The amount of value you can redeem per squeeth depends on how much funding you have paid and the mark price of squeeth. [insert diagram of square with dotted lines, value being area of square]
          </Typography> */}
          </div>
          <div className={classes.buyCard}>
            <Card className={classes.innerCard}>
              <Trade
                setTradeType={setTradeType}
                tradeType={tradeType}
                amount={amount}
                setAmount={setAmount}
                cost={cost}
                setCost={setCost}
                squeethExposure={squeethExposure}
                setSqueethExposure={setSqueethExposure}
              />
            </Card>
            <Typography className={classes.thirdHeading} variant="h6">
              Payoff
            </Typography>
            <Typography variant="body2" className={classes.payoff}>
              You are putting down {amount} ETH to get ${squeethExposure.toFixed(2)} of squeeth exposure. If ETH goes up
              &nbsp;
              <TextField
                size="small"
                value={leverage.toString()}
                type="number"
                style={{ width: 75 }}
                onChange={(event) => setLeverage(Number(event.target.value))}
                // label="Leverage"
                variant="outlined"
                InputProps={{
                  endAdornment: <InputAdornment position="end">x</InputAdornment>,
                }}
              />
              &nbsp;, squeeth goes up {leverage * leverage}x, and your position is worth &nbsp; $
              {(cost * (leverage * Number(ethPrice)) ** 2).toFixed(2)}.
              <br /> <br />
              If ETH goes down 100% or more, your position is worth 0 ETH. With squeeth you can never lose more than you
              put in, giving you protected downside.
            </Typography>
            <div className={classes.thirdHeading}>
              <Image src={ccpayoff} alt="cc payoff" width={450} height={300} />
            </div>
          </div>
        </div>
      ) : (
        //short side
        <div className={classes.body}>
          <div>
            <Typography variant="h5">Short Squeeth - short ETH&sup2; Position</Typography>
            <Typography variant="body1">Earn funding for selling ETH&sup2;</Typography>
            <Typography variant="body2" className={classes.cardDetail}>
              Short squeeth (ETH&sup2;) is short an ETH&sup2; position. You earn a daily funding rate for taking on this
              position. You enter the position by putting down collateral, minting, and selling squeeth. If you become
              undercollateralized, you could be liquidated.
            </Typography>
            <Typography className={classes.cardTitle} variant="h6">
              Historical Backtests
            </Typography>
            <div className={classes.amountInput}>
              <VaultChart vault={Vaults.Short} longAmount={0} showPercentage={false} setCustomLong={setCustomLong} />
            </div>
            <Typography className={classes.cardTitle} variant="h6">
              Strategy Details
            </Typography>
            <Typography className={classes.thirdHeading} variant="h6">
              How it works
            </Typography>
            <List>
              <ListItem>
                <ListItemText primary="1. Put down ETH collateral" secondary="at least 1.5x collateralized" />
              </ListItem>
              <ListItem>
                <ListItemText primary="2. Mint Squeeth" secondary="Earn daily funding for being short squeeth" />
              </ListItem>
              <ListItem>
                <ListItemText primary="3. Sell Squeeth" secondary="via Uniswap" />
              </ListItem>
            </List>

            <Typography className={classes.thirdHeading} variant="h6">
              Properties
            </Typography>
            <Typography variant="body2" className={classes.cardSubTxt}>
              Short squeeth gives you a short ETH&sup2; payoff. This means you have constant negative gamma exposure, so
              you always hold a position similar to selling an at the money call option. This functions similar to a
              perpetual swap, where you are targeting ETH&sup2; rather than ETH.
              <a className={classes.header} href="https://www.paradigm.xyz/2021/08/power-perpetuals/">
                {' '}
                Learn more.{' '}
              </a>
            </Typography>
            <br />
            <Typography variant="body2" className={classes.cardSubTxt}>
              Funding is calculated as your position size multiplied by the TWAP (time weighted average price) of Mark -
              Index, where Mark is the price squeeth is trading at and Index is ETH&sup2;. We use{' '}
              <a className={classes.header} href="https://uniswap.org/whitepaper-v3.pdf">
                {' '}
                Uniswap V3 GMA (geometric moving average) TWAP.{' '}
              </a>
              Funding happens everytime the contract is touched and is paid out of your squeeth position. You can think
              about this as selling a small amount of your squeeth each day to pay funding.
            </Typography>
            {/* <br />
          <Typography variant="body2" className={classes.cardSubTxt}>
            Funding is paid in-kind (using the squeeth token), so you cannot be liquidated. Note that the squeeth ERC20 amount will remain constant eg. if you bought 1 squeeth you will still have 1 squeeth after funding in kind. 
            What will change is how much value you can redeem for each squeeth. The amount of value you can redeem per squeeth depends on how much funding you have paid and the mark price of squeeth. [insert diagram of square with dotted lines, value being area of square]
          </Typography> */}
          </div>
          <div className={classes.buyCard}>
            <Card className={classes.innerCard}>
              <Trade
                setTradeType={setTradeType}
                tradeType={tradeType}
                amount={amount}
                setAmount={setAmount}
                setCost={setCost}
                cost={cost}
                setSqueethExposure={setSqueethExposure}
                squeethExposure={squeethExposure}
              />
            </Card>
            {/* <Typography className={classes.thirdHeading} variant="h6">
              Payoff
            </Typography>
            <div className={classes.thirdHeading}>
              <Image src={ccpayoff} alt="cc payoff" width={450} height={300} />
            </div>
            <Typography variant="body2" className={classes.payoff}>
              If ETH goes up &nbsp;
              <TextField
                size="small"
                value={leverage.toString()}
                type="number"
                style={{ width: 75 }}
                onChange={(event) => setLeverage(Number(event.target.value))}
                // label="Leverage"
                variant="outlined"
                InputProps={{
                  endAdornment: <InputAdornment position="end">x</InputAdornment>,
                }}
              />
              &nbsp;, squeeth goes up {leverage * leverage}x, and your position is worth $
              {(leverage * leverage * Number(1)).toFixed(2)}
              <br /> <br />
              If ETH goes down 100% or more, your position is worth $0. With squeeth you can never lose more than you
              put in, giving you protected downside.
            </Typography> */}
          </div>
        </div>
      )}
    </div>
  )
}
