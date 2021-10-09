import { Grid, InputAdornment, Tab, Tabs, TextField, Tooltip } from '@material-ui/core'
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
import { SqueethTab, SqueethTabs } from '../src/components/Tabs'
import Trade from '../src/components/Trade'
import { Vaults } from '../src/constants'
import { useWorldContext } from '../src/context/world'
import { useController } from '../src/hooks/contracts/useController'
import { useSqueethPool } from '../src/hooks/contracts/useSqueethPool'
import { useETHPrice } from '../src/hooks/useETHPrice'
import { useETHPriceCharts } from '../src/hooks/useETHPriceCharts'
import { useLongPositions, usePnL, useShortPositions } from '../src/hooks/usePositions'
import { toTokenAmount } from '../src/utils/calculations'

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
    cardDetail1: {
      color: theme.palette.text.secondary,
      lineHeight: '1.75rem',
      fontSize: '16px',
      marginTop: theme.spacing(4),
      fontFamily: 'Open Sans',
    },
    amountInput: {
      marginTop: theme.spacing(4),
    },
    innerCard: {
      textAlign: 'center',
      paddingBottom: theme.spacing(4),
      background: theme.palette.background.lightStone,
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
    position: {
      display: 'flex',
      marginTop: theme.spacing(1),
    },
    positionToken: {
      fontSize: '16px',
      fontWeight: 600,
      marginRight: theme.spacing(4),
    },
    positionUSD: {
      fontSize: '16px',
      marginRight: theme.spacing(4),
    },
    subNavTabs: {
      marginTop: theme.spacing(4),
    },
    green: {
      color: theme.palette.success.main,
      marginRight: theme.spacing(4),
      fontSize: '16px',
    },
    red: {
      color: theme.palette.error.main,
      marginRight: theme.spacing(4),
      fontSize: '16px',
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
  const { normFactor: normalizationFactor, fundingPerDay, mark, index } = useController()
  const { squeethAmount: lngAmt } = useLongPositions()
  const { squeethAmount: shrtAmt } = useShortPositions()
  const { getWSqueethPositionValue } = useSqueethPool()
  const { longGain, shortGain } = usePnL()

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
            <Tooltip
              title={'Estimated amount of funding paid in next 24 hours. Funding will happen out of your position.'}
            >
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
          {/* <Typography>${Number(ethPrice.multipliedBy(ethPrice).toFixed(2)).toLocaleString()}</Typography> */}
          <Typography>${Number(toTokenAmount(index, 18).toFixed(2)).toLocaleString()}</Typography>
        </div>
        <div className={classes.infoItem}>
          <div className={classes.infoLabel}>
            <Typography color="textSecondary" variant="body2">
              Mark Price
            </Typography>
          </div>
          <Typography>${Number(toTokenAmount(mark, 18).toFixed(2)).toLocaleString()}</Typography>
        </div>
      </div>
    )
  }

  return (
    <div>
      <Nav />
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <SqueethTabs
          value={tradeType}
          onChange={(evt, val) => setTradeType(val)}
          aria-label="Sub nav tabs"
          className={classes.subNavTabs}
        >
          <SqueethTab label="Long" />
          <SqueethTab label="Short" />
        </SqueethTabs>
      </div>

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
              My Position
            </Typography>
            <div className={classes.position}>
              <Typography className={classes.positionToken}>{lngAmt.toFixed(4)} wSQTH</Typography>
              <Typography className={classes.positionUSD}>${getWSqueethPositionValue(lngAmt).toFixed(2)}</Typography>
              <Typography variant="body1" className={longGain < 0 ? classes.red : classes.green}>
                {(longGain || 0).toFixed(2)}%
              </Typography>
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
            <Typography className={classes.cardTitle} variant="h6">
              Risks
            </Typography>
            <Typography variant="body2" className={classes.cardDetail1}>
              Funding is paid out of your position, meaning you sell a small amount of squeeth at funding, reducing your
              position size. Holding the position for a long period of time without upward movements in ETH can lose
              considerable funds to funding payments.
              <br /> <br />
              Squeeth smart contracts are currently unaudited. This is experimental technology and we encourage caution
              only risking funds you can afford to lose.
            </Typography>
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
                showLongTab={false}
              />
            </Card>
            <Typography className={classes.thirdHeading} variant="h6">
              Payoff
            </Typography>
            <LongSqueethPayoff ethPrice={ethPrice.toNumber()} />
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
              Historical Predicted Performance
            </Typography>
            <div className={classes.amountInput}>
              <VaultChart vault={Vaults.Short} longAmount={0} showPercentage={false} setCustomLong={setCustomLong} />
            </div>
            <Typography className={classes.cardTitle} variant="h6">
              My Position
            </Typography>
            <div className={classes.position}>
              <Typography className={classes.positionToken}>{shrtAmt.negated().toFixed(4)} wSQTH</Typography>
              <Typography className={classes.positionUSD}>${getWSqueethPositionValue(shrtAmt).toFixed(2)}</Typography>
              <Typography variant="body1" className={shortGain < 0 ? classes.red : classes.green}>
                {(shortGain || 0).toFixed(2)}%
              </Typography>
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
                showLongTab={false}
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
