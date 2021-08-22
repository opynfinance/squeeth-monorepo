import { InputAdornment, TextField, Tooltip } from '@material-ui/core'
import Button from '@material-ui/core/Button'
import Card from '@material-ui/core/Card'
import List from '@material-ui/core/List'
import ListItem from '@material-ui/core/ListItem'
import ListItemText from '@material-ui/core/ListItemText'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import Typography from '@material-ui/core/Typography'
import InfoOutlinedIcon from '@material-ui/icons/InfoOutlined'
import Image from 'next/image'
import { useMemo, useState } from 'react'
import { useEffect } from 'react'

import ccpayoff from '../public/images/ccpayoff.png'
import { LongChart } from '../src/components/Charts/LongChart'
import Nav from '../src/components/Nav'
import { useWorldContext } from '../src/context/world'
import useAsyncMemo from '../src/hooks/useAsyncMemo'
import { useETHPriceCharts } from '../src/hooks/useETHPriceCharts'
import { getCost, getFairSqueethAsk, getVolForTimestamp } from '../src/utils'

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
      textAlign: 'center',
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

export default function Home() {
  const classes = useStyles()
  const [amount, setAmount] = useState(1)
  const [isConfirmed, setIsConfirmed] = useState(false)

  const setModalStep = () => {
    if (isConfirmed) {
      setIsConfirmed(false)
    } else {
      setIsConfirmed(true)
    }
  }

  const [expanded, setExpanded] = useState(false)

  const handleExpandClick = () => {
    setExpanded(!expanded)
  }

  const { volMultiplier: globalVolMultiplier } = useWorldContext()
  // use hook because we only calculate accFunding based on 24 hour performance
  const { ethPrices, accFunding, startingETHPrice, setVolMultiplier, volMultiplier } = useETHPriceCharts(
    1,
    globalVolMultiplier,
  )

  useEffect(() => {
    setVolMultiplier(globalVolMultiplier)
  }, [globalVolMultiplier])

  const vol = useAsyncMemo(
    async () => {
      const ethPrice = ethPrices.length > 0 ? ethPrices[ethPrices.length - 1].value : 0
      const timestamp = ethPrices.length > 0 ? ethPrices[ethPrices.length - 1].time : Date.now() / 1000
      const _vol = await getVolForTimestamp(timestamp, ethPrice)
      return _vol * volMultiplier
    },
    0,
    [ethPrices, volMultiplier],
  )

  const price = useMemo(() => {
    const ethPrice = ethPrices.length > 0 ? ethPrices[ethPrices.length - 1].value : 0
    // return (getFairSqueethAsk(ethPrice, 1, vol) / startingETHPrice)
    return getFairSqueethAsk(ethPrice, 1, vol) * 0.000001
  }, [ethPrices, startingETHPrice, vol])

  const cost = useMemo(() => getCost(amount, price).toFixed(2), [amount, price])

  return (
    <div>
      <Nav />
      <div className={classes.body}>
        <div>
          <Typography variant="h5">Long Squeeth - ETH&sup2; Position</Typography>
          <Typography variant="body1">Perpetual leverage without liquidations</Typography>
          <Typography variant="body2" className={classes.cardDetail}>
            Long squeeth (ETH&sup2;) gives you a leveraged position with unlimited upside, protected downside, and no
            liquidations. Compared to a 2x leveraged position, you make more when ETH goes up and lose less when ETH
            goes down. Eg. If ETH goes up 5x, squeeth goes up 25x. You pay a daily funding rate for this position. Enter
            the position by purchasing an ERC20 token.
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
            Payoff
          </Typography>
          <div className={classes.thirdHeading}>
            <Image src={ccpayoff} alt="cc payoff" width={450} height={300} />
          </div>
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
            Daily funding is paid out of your squeeth position. You can think about this as selling a small amount of
            your squeeth each day to pay funding.
          </Typography>
          {/* <br />
          <Typography variant="body2" className={classes.cardSubTxt}>
            Funding is paid in-kind (using the squeeth token), so you cannot be liquidated. Note that the squeeth ERC20 amount will remain constant eg. if you bought 1 squeeth you will still have 1 squeeth after funding in kind. 
            What will change is how much value you can redeem for each squeeth. The amount of value you can redeem per squeeth depends on how much funding you have paid and the mark price of squeeth. [insert diagram of square with dotted lines, value being area of square]
          </Typography> */}
        </div>
        <div className={classes.buyCard}>
          <Card className={classes.innerCard}>
            <Typography className={classes.cardTitle} variant="h6">
              Buy
            </Typography>
            <div className={classes.amountInput}>
              <TextField
                size="small"
                value={amount}
                type="number"
                style={{ width: 300 }}
                onChange={(event) => setAmount(Number(event.target.value))}
                id="filled-basic"
                label="Long Size (Squeeth)"
                variant="outlined"
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <Tooltip title="The index price of the asset is ETH&sup2;. Each squeeth ERC20 token is 0.000001 of that index price.">
                        <InfoOutlinedIcon fontSize="small" />
                      </Tooltip>
                    </InputAdornment>
                  ),
                }}
              />
            </div>
            <div className={classes.amountInput}>
              <TextField
                size="small"
                value={cost}
                type="number"
                style={{ width: 300 }}
                disabled
                label="Cost (USDC)"
                variant="outlined"
              />
            </div>
            <Tooltip title="Daily funding is paid out of your position, no collateral required.">
              <div className={classes.amountInput}>
                Daily Funding to Pay: ${(amount * accFunding * 0.000001).toFixed(2)} (-
                {(((accFunding * 0.000001) / price) * 100).toFixed(2)} %)
              </div>
            </Tooltip>
            <span style={{ fontSize: 12 }}> 24h Vol: {(vol * 100).toFixed(2)} % </span>
            <Button
              style={{ width: 300 }}
              variant="contained"
              color="primary"
              onClick={setModalStep}
              className={classes.amountInput}
            >
              {'Buy'}
            </Button>
          </Card>
        </div>
      </div>
    </div>
  )
}
