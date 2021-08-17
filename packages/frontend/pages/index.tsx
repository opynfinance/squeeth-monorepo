import Typography from '@material-ui/core/Typography'
import Card from '@material-ui/core/Card'
import { TextField } from '@material-ui/core'
import Button from '@material-ui/core/Button'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import Nav from '../src/components/Nav'
import { LongChart } from '../src/components/Charts/LongChart'
import { useMemo, useState } from 'react'
import { useWorldContext } from '../src/context/world'
import { useETHPriceCharts } from '../src/hooks/useETHPriceCharts'
import { getCost, getFairSqueethAsk, getVolForTimestamp } from '../src/utils'
import useAsyncMemo from '../src/hooks/useAsyncMemo'
import Image from 'next/image'
import ccpayoff from '../public/images/ccpayoff.png';
import clsx from 'clsx';
import IconButton from '@material-ui/core/IconButton';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import Collapse from '@material-ui/core/Collapse';
import Grid from '@material-ui/core/Grid';
import { useEffect } from 'react'


const useStyles = makeStyles(theme => (createStyles({
  header: {
    color: theme.palette.primary.main,
  },
  body: {
    padding: theme.spacing(2, 8),
    margin: 'auto'
  },
  subHeading: {
    color: theme.palette.text.secondary,
  },
  cardContainer: {
    display: 'flex'
  },
  card: {
    marginTop: theme.spacing(2),
    padding: theme.spacing(2),
    width: '60%'
  },
  buyCard: {
    marginLeft: theme.spacing(2),
    padding: theme.spacing(2),
    width: '30%',
    textAlign: 'center'
  },
  cardTitle: {
    color: theme.palette.primary.main,
    marginTop: theme.spacing(2)
  },
  cardSubTxt: {
    color: theme.palette.text.secondary
  },
  amountInput: {
    marginTop: theme.spacing(4),
  },
  innerCard: {
    paddingBottom: theme.spacing(8)
  },
  expand: {
    transform: 'rotate(270deg)',
    color: theme.palette.primary.main,
    transition: theme.transitions.create('transform', {
      duration: theme.transitions.duration.shortest,
    }),
  },
  expandOpen: {
    transform: 'rotate(180deg)',
    color: theme.palette.primary.main,
  },
})))

export default function Home() {
  const classes = useStyles();
  const [amount, setAmount] = useState(1);
  const [isConfirmed, setIsConfirmed] = useState(false)

  const setModalStep = () => {
    if (isConfirmed) {
      setIsConfirmed(false);
    } else {
      setIsConfirmed(true);
    }
  }

  const [expanded, setExpanded] = useState(false);

  const handleExpandClick = () => {
    setExpanded(!expanded);
  };

  const { volMultiplier: globalVolMultiplier } = useWorldContext()
  // use hook because we only calculate accFunding based on 24 hour performance
  const { ethPrices, accFunding, startingETHPrice, setVolMultiplier, volMultiplier } = useETHPriceCharts(1, globalVolMultiplier)

  useEffect(() => {
    setVolMultiplier(globalVolMultiplier)
  }, [globalVolMultiplier])

  const vol = useAsyncMemo(async () => {
    const ethPrice = ethPrices.length > 0 ? ethPrices[ethPrices.length - 1].value : 0
    const timestamp = ethPrices.length > 0 ? ethPrices[ethPrices.length - 1].time : Date.now() / 1000
    const _vol = await getVolForTimestamp(timestamp, ethPrice)
    return _vol * volMultiplier
  }, 0, [ethPrices, volMultiplier])

  const price = useMemo(() => {
    const ethPrice = ethPrices.length > 0 ? ethPrices[ethPrices.length - 1].value : 0
    return (getFairSqueethAsk(ethPrice, 1, vol) / startingETHPrice)
  }, [ethPrices, startingETHPrice, vol])

  const cost = useMemo(() => getCost(amount, price).toFixed(2), [amount, price])

  return (
    <div>
      <Nav />
      <div className={classes.body}>
        <Typography variant="h5">
          Long Continuous Calls
        </Typography>
        <Typography variant="body1" className={classes.subHeading}>
          Perpetual leverage without liquidations
        </Typography>
        <div className={classes.cardContainer}>
          <Card className={classes.card}>
            <Typography className={classes.cardTitle} variant="h6">
              Historical PNL Backtest
            </Typography>
            <LongChart />
            <Typography className={classes.cardTitle} variant="h6">
              Strategy Details
            </Typography>
            <Typography variant="body2" className={classes.cardSubTxt}>
              Long continuous call gives you a leveraged position with unlimited upside, protected downside, and no liquidations. Compared to a 2x leveraged position, you make more when ETH goes up and lose less when ETH goes down. You pay a daily premium rate for this position. To enter the position you simply purchase an ERC20 token.
            </Typography>
            <Image src={ccpayoff} alt="cc payoff" width={450} height={300} />


            {/* <Typography className={classes.cardTitle} variant="h6">
              Advanced
            </Typography>
            <Typography variant="body2" className={classes.cardSubTxt}>
              Continuous call gives you an ETH&sup2; payoff. This means you have constant gamma exposure, so you always hold a position similar to an at the money call option. This functions similar to a perpetual swap, where you are targeting ETH&sup2; rather than ETH. 
            </Typography> */}
            
            <Grid container alignItems={'flex-start'} direction="row">
            <Typography className={classes.cardTitle} variant="h6">
              Advanced
            </Typography>  
              <IconButton
                className={clsx(classes.expand, {
                  [classes.expandOpen]: expanded,
                })}
                onClick={handleExpandClick}
                aria-expanded={expanded}
                aria-label="show more"
              >
              <ExpandMoreIcon fontSize="large" />
            </IconButton>
            <Collapse in={expanded} timeout="auto" unmountOnExit>
              <Typography variant="body2" className={classes.cardSubTxt}>
                Continuous call gives you an ETH&sup2; payoff. This means you have constant gamma exposure, so you always hold a position similar to an at the money call option. This functions similar to a perpetual swap, where you are targeting ETH&sup2; rather than ETH. 
              </Typography>
            </Collapse>  
            </Grid>


          </Card>
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
                  label="Long Size" 
                  variant="outlined"
                />
              </div>
              <div className={classes.amountInput}>
                <TextField
                  size="small" value={cost}
                  type="number"
                  style={{ width: 300 }}
                  disabled
                  label="Cost"
                  variant="outlined"
                  />
              </div>
                <Button
                  style={{ width: 300 }}
                  variant="contained" 
                  color="primary"
                  onClick={setModalStep}
                  className={classes.amountInput}
                >
                  {'Buy'}
                </Button>
                <div data-tip="Daily funding is paid out of your position, no collateral required." className={classes.amountInput}>
                  Daily Funding to Pay: ${(amount * accFunding / startingETHPrice).toFixed(2)} (-{(accFunding / startingETHPrice / price * 100).toFixed(2)} %)
                </div>
                <span style={{ fontSize: 12 }}> 24h Vol: {(vol * 100).toFixed(2)} % </span>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
