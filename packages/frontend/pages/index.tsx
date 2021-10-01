import { Grid, InputAdornment, TextField, Tooltip } from '@material-ui/core'
import Card from '@material-ui/core/Card'
import List from '@material-ui/core/List'
import ListItem from '@material-ui/core/ListItem'
import ListItemText from '@material-ui/core/ListItemText'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import Typography from '@material-ui/core/Typography'
import InfoIcon from '@material-ui/icons/InfoOutlined'
import { useEffect, useState } from 'react'

import { LongChart } from '../src/components/Charts/LongChart'
import LongSqueethPayoff from '../src/components/Charts/LongSqueethPayoff'
import ShortSqueethPayoff from '../src/components/Charts/ShortSqueethPayoff'
import { VaultChart } from '../src/components/Charts/VaultChart'
import Nav from '../src/components/Nav'
import Trade from '../src/components/Trade'
import { Vaults } from '../src/constants'
import { useWorldContext } from '../src/context/world'
import { useController } from '../src/hooks/contracts/useController'
import { useETHPrice } from '../src/hooks/useETHPrice'
import { useETHPriceCharts } from '../src/hooks/useETHPriceCharts'
import { useLongPositions, useShortPositions } from '../src/hooks/usePositions'

const useStyles = makeStyles((theme) =>
  createStyles({
    header: {
      color: theme.palette.primary.main,
    },
    mainSection: {
      width: '50vw',
    },
    grid: {
      padding: theme.spacing(8, 0),
    },
    mainGrid: {
      maxWidth: '50%',
    },
    ticketGrid: {
      maxWidth: '350px',
    },
    subHeading: {
      color: theme.palette.text.secondary,
    },
    thirdHeading: {
      marginTop: theme.spacing(2),
    },
    buyCard: {
      marginLeft: theme.spacing(2),
      width: '400px',
    },
    cardTitle: {
      color: theme.palette.primary.main,
      marginTop: theme.spacing(4),
    },
    cardSubTxt: {
      color: theme.palette.text.secondary,
      lineHeight: '1.75rem',
      fontSize: '16px',
    },
    payoff: {
      color: theme.palette.text.secondary,
      lineHeight: '1.75rem',
      fontSize: '16px',
      marginTop: theme.spacing(2),
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
      background: theme.palette.background.stone,
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
    squeethInfo: {
      display: 'flex',
      marginTop: theme.spacing(4),
    },
    infoIcon: {
      fontSize: '14px',
      marginLeft: theme.spacing(0.5),
    },
    infoItem: {
      marginRight: theme.spacing(4),
    },
    infoLabel: {
      display: 'flex',
      alignItems: 'center',
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
  const { normFactor: normalizationFactor, fundingPerDay } = useController()
  const { squeethAmount: lngAmt } = useLongPositions()
  const { squeethAmount: shrtAmt } = useShortPositions()

  const { volMultiplier: globalVolMultiplier, collatRatio } = useWorldContext()
  // use hook because we only calculate accFunding based on 24 hour performance
  const { setVolMultiplier } = useETHPriceCharts(1, globalVolMultiplier)

  useEffect(() => {
    setVolMultiplier(globalVolMultiplier)
  }, [globalVolMultiplier])

  const SqueethInfo = () => {
    return (
      <div className={classes.squeethInfo}>
        <div className={classes.infoItem}>
          <Typography color="textSecondary" variant="body2">
            ETH Price
          </Typography>
          <Typography>${ethPrice.toNumber().toLocaleString()}</Typography>
        </div>
        <div className={classes.infoItem}>
          <div className={classes.infoLabel}>
            <Typography color="textSecondary" variant="body2">
              Implied 24h Funding
            </Typography>
            <Tooltip title={'Estimated amount of funding paid in next 24 hours. Funding will happen in kind.'}>
              <InfoIcon fontSize="small" className={classes.infoIcon} />
            </Tooltip>
          </div>
          <Typography>{(fundingPerDay * 100).toFixed(2)}%</Typography>
        </div>
        <div className={classes.infoItem}>
          <div className={classes.infoLabel}>
            <Typography color="textSecondary" variant="body2">
              ETH&sup2; Price
            </Typography>
          </div>
          <Typography>${Number(ethPrice.multipliedBy(ethPrice).toFixed(2)).toLocaleString()}</Typography>
        </div>
        <div className={classes.infoItem}>
          <Typography color="textSecondary" variant="body2">
            My Position
          </Typography>
          <Typography>
            {tradeType === TradeType.BUY ? lngAmt.toFixed(8) : shrtAmt.negated().toFixed(8)} WSQTH
          </Typography>
        </div>
      </div>
    )
  }

  return (
    <div>
      <Nav />

      {tradeType === TradeType.BUY ? (
        //long side
        <Grid container className={classes.grid}>
          <Grid item xs={1} />
          <Grid item xs={7} className={classes.mainGrid}>
            <Typography variant="h5">Long Squeeth - ETH&sup2; Position</Typography>
            <Typography variant="body1" color="textSecondary">
              Perpetual leverage without liquidations
            </Typography>
            <SqueethInfo />
            <Typography className={classes.cardTitle} variant="h6">
              Historical Predicted Performance
            </Typography>
            <div className={classes.amountInput}>
              <LongChart />
            </div>
            <Typography className={classes.cardTitle} variant="h6">
              What is squeeth?
            </Typography>
            <Typography variant="body2" className={classes.cardDetail}>
              Long squeeth (ETH&sup2;) gives you a leveraged position with unlimited upside, protected downside, and no
              liquidations. Compared to a 2x leveraged position, you make more when ETH goes up and lose less when ETH
              goes down. Eg. If ETH goes up 5x, squeeth goes up 25x. You pay a funding rate for this position. Enter the
              position by purchasing an ERC20 token.{' '}
              <a
                className={classes.header}
                href="https://opynopyn.notion.site/Squeeth-FAQ-4b6a054ab011454cbbd60cb3ee23a37c"
              >
                {' '}
                Learn more.{' '}
              </a>
            </Typography>
            {/* <Typography className={classes.cardTitle} variant="h6">
              Strategy Details
            </Typography>
            <Typography className={classes.thirdHeading} variant="h6">
              How it works
            </Typography>
            <List>
              <ListItem>
                <ListItemText primary="1. Buy Squeeth ERC20" secondary="Trades on Uniswap" />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="2. Pay continuous funding out of squeeth ERC20 position"
                  secondary="Sell some of your squeeth ERC20 to pay funding"
                />
              </ListItem>
              <ListItem>
                <ListItemText primary="3. Exit position by selling squeeth ERC20" secondary="Trades on Uniswap" />
              </ListItem>
            </List>

            <Typography className={classes.thirdHeading} variant="h6">
              Properties
            </Typography>
            <Typography variant="body2" className={classes.cardSubTxt}>
              Squeeth gives you an ETH&sup2; payoff. You always hold a position similar to an at the money call option -
              you have constant gamma exposure. This functions similar to a perpetual swap, where you are targeting
              ETH&sup2; rather than ETH.
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
              Funding happens everytime the contract is touched.
              <br />
              <br />
            </Typography> */}
            <Typography className={classes.cardTitle} variant="h6">
              Risks
            </Typography>
            <Typography variant="body2" className={classes.cardDetail}>
              Funding is paid in kind, meaning you sell a small amount of squeeth at funding, reducing your position
              size. Holding the position for a long period of time without upward movements in ETH can lose considerable
              funds to funding payments.
              <br /> <br />
              Squeeth smart contracts are currently unaudited. This is experimental technology and we encourage caution
              only risking funds you can afford to lose.
            </Typography>
            {/* <br />
          <Typography variant="body2" className={classes.cardSubTxt}>
            Funding is paid in-kind (using the squeeth token), so you cannot be liquidated. Note that the squeeth ERC20 amount will remain constant eg. if you bought 1 squeeth you will still have 1 squeeth after funding in kind. 
            What will change is how much value you can redeem for each squeeth. The amount of value you can redeem per squeeth depends on how much funding you have paid and the mark price of squeeth. [insert diagram of square with dotted lines, value being area of square]
          </Typography> */}
          </Grid>
          <Grid item xs={1} />
          <Grid item xs={4} className={classes.ticketGrid}>
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
            <LongSqueethPayoff ethPrice={ethPrice.toNumber()} />
            {/* <Typography variant="body2" className={classes.payoff}>
              You are getting ${squeethExposure.toFixed(2)} of squeeth exposure. If ETH goes up &nbsp;
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
              {((cost * Number(normalizationFactor) * (leverage * Number(ethPrice)) ** 2) / 10000).toFixed(2)}.
              <br /> <br />
              If ETH goes down, you lose less compared to 2x leverage.
            </Typography>
            <br /> */}
          </Grid>
        </Grid>
      ) : (
        //short side
        <Grid container className={classes.grid}>
          <Grid item xs={1} />
          <Grid item xs={7} className={classes.mainGrid}>
            <Typography variant="h5">Short Squeeth - short ETH&sup2; Position</Typography>
            <Typography variant="body1" color="textSecondary">
              Earn funding for selling ETH&sup2;
            </Typography>
            <SqueethInfo />
            <Typography className={classes.cardTitle} variant="h6">
              Historical Backtests
            </Typography>
            <div className={classes.amountInput}>
              <VaultChart vault={Vaults.Short} longAmount={0} showPercentage={false} setCustomLong={setCustomLong} />
            </div>
            <Typography className={classes.cardTitle} variant="h6">
              What is short squeeth?
            </Typography>
            <Typography variant="body2" className={classes.cardDetail}>
              Short squeeth (ETH&sup2;) is short an ETH&sup2; position. You earn a funding rate for taking on this
              position. You enter the position by putting down collateral, minting, and selling squeeth. If you become
              undercollateralized, you could be liquidated.{' '}
              <a
                className={classes.header}
                href="https://opynopyn.notion.site/Squeeth-FAQ-4b6a054ab011454cbbd60cb3ee23a37c"
              >
                {' '}
                Learn more.{' '}
              </a>
            </Typography>
            {/* <Typography className={classes.cardTitle} variant="h6">
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
                <ListItemText primary="2. Mint Squeeth" secondary="Earn continuous funding for being short squeeth" />
              </ListItem>
              <ListItem>
                <ListItemText primary="3. Sell Squeeth" secondary="Trades on Uniswap" />
              </ListItem>
            </List>
            <Typography className={classes.thirdHeading} variant="h6">
              Properties
            </Typography>
            <Typography variant="body2" className={classes.cardSubTxt}>
              Short squeeth gives you a short ETH&sup2; payoff. You always hold a position similar to selling an at the
              money{' '}
              <a className={classes.header} href="https://www.investopedia.com/terms/s/straddle.asp">
                {' '}
                straddle,{' '}
              </a>{' '}
              where you have constant negative gamma exposure. This functions similar to a perpetual swap, where you are
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
                Uniswap V3 GMA (geometric moving average) TWAP.
              </a>
              &nbsp; Funding happens everytime the contract is touched.{' '}
            </Typography>
            <br /> <br /> */}
            <Typography className={classes.cardTitle} variant="h6">
              Risks
            </Typography>
            <Typography variant="body2" className={classes.cardDetail}>
              If you fall below the minimum collateralization threshold (150%), you are at risk of liquidation. If ETH
              moves approximately 6% in either direction, you are unprofitable.
              <br /> <br />
              Squeeth smart contracts are currently unaudited. This is experimental technology and we encourage caution
              only risking funds you can afford to lose.
            </Typography>
          </Grid>
          <Grid item xs={1} />
          <Grid item xs={3} className={classes.ticketGrid}>
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
            <Typography className={classes.thirdHeading} variant="h6">
              Payoff
            </Typography>
            <ShortSqueethPayoff ethPrice={ethPrice.toNumber()} collatRatio={collatRatio} />
          </Grid>
        </Grid>
      )}
    </div>
  )
}
