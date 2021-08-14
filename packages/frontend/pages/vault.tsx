import Typography from '@material-ui/core/Typography'
import Box from '@material-ui/core/Box'
import { Button, createStyles, FormControlLabel, InputAdornment, makeStyles, Switch, Tab, Tabs, TextField } from '@material-ui/core'
import Image from 'next/image'
import Card from '@material-ui/core/Card'
import Nav from '../src/components/Nav'
import { Vaults } from '../src/constants'
import crabpayoff from '../public/images/crabpayoff.png';
import ethbullpayoff from '../public/images/ethbullpayoff.png';
import { useEffect, useMemo, useState } from 'react'
import { useWorldContext } from '../src/context/world'
import { VaultChart } from '../src/components/Charts/VaultChart'
import { useETHPriceCharts } from '../src/hooks/useETHPriceCharts'
import useAsyncMemo from '../src/hooks/useAsyncMemo'
import { calculateLiquidationPrice, getFairSqueethBid, getVolForTimestamp } from '../src/utils'

const useStyles = makeStyles(theme => (createStyles({
  header: {
    color: theme.palette.primary.main,
  },
  expand: {
    transform: 'rotate(270deg)',
    transition: theme.transitions.create('transform', {
      duration: theme.transitions.duration.shortest,
    }),
  },
  expandOpen: {
    transform: 'rotate(180deg)',
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
  innerCard: {
    paddingBottom: theme.spacing(8)
  },
  amountInput: {
    marginTop: theme.spacing(4),
  },
})))

const getVaultDetail = (vault: Vaults) => {
  if (vault === Vaults.CrabVault) return (
    <p> 
      This high yield position is similar to selling a strangle. You are profitable as long as ETH moves less than 6.8% in either direction <b>in a single day</b>. The strategy rebalances daily to be delta neutral by buying or selling ETH. <br/><br/>
    </p>
  )
  if (vault === Vaults.ETHBull) return (
    <p> This yielding position is profitable when ETH goes up any amount less than 100% <b>in a single day</b>. This strategy is not profitable when ETH goes down. <br/><br/>
    </p>
  )
  if (vault === Vaults.ETHBear) return (
    <p> This yielding position is profitable when ETH goes down any amount less than 100% <b>in a single day</b>.<br/><br/> </p>
  )
  else return (<p></p>)
}

const getAdvancedDetail = (vault: Vaults) => {
  if (vault === Vaults.CrabVault) return (
    <>
      <p>       
        This vault is short 1 continuous call, which is where you earn yield from. The vault is also long 2 ETH. This 2ETH - ETH&sup2; payoff gives you 0 delta exposure. 
        The vault is rebalancing daily to maintain this 0 delta exposure, meaning that you constantly have 0 ETH 
        exposure. You have a constant negative gamma exposure.

        <br /> 
        <br /> 
        You can deposit and withdraw from the vault at any time. You could potentially be liquidated if ETH hits the liquidation price. 
        This liquidation risk comes from the portion of the vault which is selling the continuous call (also where the yield comes from).

      </p>
      <Image src={crabpayoff} alt="crab payoff"/>
    </>
  )
  if (vault === Vaults.ETHBull) return (
    <>
      <p>       
      This vault is short 1 continuous call, which is where you earn yield from. The vault is also long 3 ETH. This 3ETH - ETH&sup2; payoff gives you 1 delta exposure.
      This vault is rebalancing daily to maintain this 1 delta exposure, meaning that you constantly have exposure to long 1 ETH. You have a constant negative gamma exposure.

      <br />
      <br />  
        You can deposit and withdraw from the vault at any time. You could potentially be liquidated if ETH hits the liquidation price. 
        This liquidation risk comes from the portion of the vault which is selling the continuous call (also where the yield comes from).
      </p>
      <Image src={ethbullpayoff} alt="eth bull payoff"/>
    </>
  )
  if (vault === Vaults.ETHBear) return (
    <p>       
    This vault is short 1 continuous call, which is where you earn yield from. The vault is also long 1 ETH. This ETH - ETH&sup2; payoff gives you -1 delta exposure. 
    The vault is rebalancing daily to maintain this -1 delta exposure, meaning that you constantly have exposure to short 1 ETH. You have a constant negative gamma exposure.

    <br /> 
    <br /> 
    You can deposit and withdraw from the vault at any time. You could potentially be liquidated if ETH hits the liquidation price. 
        This liquidation risk comes from the portion of the vault which is selling the continuous call (also where the yield comes from).
    </p>
  )
  else return (<p></p>)
}

const getVaultIntro = (vault: Vaults) => {
  if (vault === Vaults.CrabVault) return (
    <p> Earn high yield by selling volatility </p>
  )
  if (vault === Vaults.ETHBull) return (
    <p> Earn yield while being long ETH </p>
  )
  if (vault === Vaults.ETHBear) return (
    <p> Earn yield while being short ETH </p>
  )
}

export default function Vault() {
  const classes = useStyles();
  const [expanded, setExpanded] = useState(false);

  const handleExpandClick = () => {
    setExpanded(!expanded);
  };

  const [showPercentage, setShowPercentage] = useState(true)

  const [customLong, setCustomLong] = useState(1.5)

  const { researchMode } = useWorldContext()

  const [selectedIdx, setSelectedIdx] = useState(0)

  const vault = useMemo(() => {
    if (selectedIdx === 0) return Vaults.ETHBull
    if (selectedIdx === 1) return Vaults.CrabVault
    if (selectedIdx === 2) return Vaults.ETHBear
    else return Vaults.Custom
  }, [selectedIdx])

  // how many eth are we long while shorting squeeth
  const longAmount = useMemo(() => {
    if (vault === Vaults.ETHBear) return 1
    if (vault === Vaults.CrabVault) return 2
    if (vault === Vaults.ETHBull) return 3
    return customLong
  }, [customLong, vault])

  const [amount, setAmount] = useState(1)

  const [collateral, setCollateral] = useState(1)

  // use global vol set by global settings
  const { volMultiplier: globalVMultiplier, getVaultPNLWithRebalance, days: globalDays, startingETHPrice: globalStartingETHPrice } = useWorldContext()

  const { ethPrices, accFunding, startingETHPrice, volMultiplier: vMultiplier, setVolMultiplier } = useETHPriceCharts(1, globalVMultiplier)

  // set global vol into the useETHPriceCharts hook, so we get accurate data
  useEffect(() => {
    setVolMultiplier(globalVMultiplier)
  }, [globalVMultiplier, setVolMultiplier])


  const rebalancePNLSeries = getVaultPNLWithRebalance(longAmount)
  
  const backTestAPY = useMemo(() => {
    if (rebalancePNLSeries.length === 0 ) return 0
    const pnl = rebalancePNLSeries[rebalancePNLSeries.length - 1].value
    const multiplier = pnl > 0 ? 1 : -1
    const apy = Math.pow(1 + (pnl / globalStartingETHPrice), 365 / globalDays)
    return apy * multiplier * 100
  }, [rebalancePNLSeries, globalDays, globalStartingETHPrice])

  const currentEthPrice = useMemo(() => {
    return ethPrices.length > 0 ? ethPrices[ethPrices.length - 1].value : 0
  }, [ethPrices])

  const vol = useAsyncMemo(async() => {
    const ethPrice = ethPrices.length > 0 ? ethPrices[ethPrices.length - 1].value : 0
    const timestamp = ethPrices.length > 0 ? ethPrices[ethPrices.length - 1].time : Date.now() / 1000
    const vol = await getVolForTimestamp(timestamp, ethPrice) 
    return vol * vMultiplier
  }, 0, [ethPrices, vMultiplier])

  const price = useMemo(() => {
    return getFairSqueethBid(currentEthPrice, 1, vol) / startingETHPrice
  }, [currentEthPrice, startingETHPrice, vol])

  // scaled down by starting eth
  const dailyFundingPayment = useMemo(() => (accFunding / startingETHPrice ), [accFunding, startingETHPrice])

  const dailyInterestRate = useMemo(() => (dailyFundingPayment / price), [dailyFundingPayment, price])


  const liqPrice = useMemo(() => {
    const ethPrice = ethPrices.length > 0 ? ethPrices[ethPrices.length - 1].value : 0
    return calculateLiquidationPrice(amount, collateral, vol, ethPrice)
  }, [ethPrices, collateral, amount, vol])

  return (
    <div>
      <Nav />
      <div className={classes.body}>
        <Typography variant="h5">
          Yield Vaults
        </Typography>
        <Typography variant="body1" className={classes.subHeading}>
          Earn daily funding by depositing into a vault and short vol.
        </Typography>
        <div className={classes.cardContainer}>
          <Card className={classes.card}>
          <Tabs
              variant="fullWidth"
              value={selectedIdx}
              indicatorColor="primary"
              textColor="primary"
              onChange={(event, value) => {
                setSelectedIdx(value)
              }}
              aria-label="disabled tabs example"
            >
              <Tab style={{ textTransform: 'none' }} label={Vaults.ETHBull} icon={<div>🐂</div>} />
              <Tab style={{ textTransform: 'none' }} label={Vaults.CrabVault} icon={<div>🦀</div>} />
              <Tab style={{ textTransform: 'none' }} label={Vaults.ETHBear} icon={<div>🐻</div>} />

              {researchMode &&
                <Tab
                  style={{ textTransform: 'none' }}
                  label={Vaults.Custom}
                  icon={<div>🥙</div>}
                />
              }
            </Tabs>
            <Typography className={classes.cardTitle} variant="h6">
              {vault}
            </Typography>
            {getVaultIntro(vault)}
            <h3> Detail </h3>
            {getVaultDetail(vault)}
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
            <Typography className={classes.cardTitle} variant="h6">
              Historical PNL
            </Typography>
            <FormControlLabel
              control={<Switch
                checked={showPercentage}
                onChange={(event, checked) => setShowPercentage(checked)}
              />}
              label={<div style={{ fontSize: 12 }}> show percentage </div>}
            />
            </div>
            <VaultChart
              vault={vault} 
              longAmount={longAmount} 
              setCustomLong={setCustomLong} 
              showPercentage={showPercentage} 
            />
            <Typography className={classes.cardTitle} variant="h6">
              Advanced
            </Typography>
            <Typography variant="body2" className={classes.cardSubTxt}>
              {getAdvancedDetail(vault)}
            </Typography>
          </Card>
          <div className={classes.buyCard}>
            <Card className={classes.innerCard}>
              <Typography className={classes.cardTitle} variant="body1">
                Deposit in {vault}
              </Typography>
              <Typography data-tip="Funding Payment Annualized APY. This APY is calculated based on the minimal initial collateral (1 ETH)." style={{fontSize: 16}}>
                Estimated APY: {((1 + dailyInterestRate)^365)} %
              </Typography> 
              <Typography 
                data-tip="APY from backtest result. You can change the number in 'back test days' under the graph to run different stimulation. This APY is calculated based on the minimal initial collateral (1 ETH)" 
                style={{fontSize: 16}}> 
                  Realized APY: {backTestAPY.toFixed(0)} % 
              </Typography>
              <div className={classes.amountInput}>
                <TextField
                  size="small" 
                  value={amount} 
                  type="number" 
                  style={{ width: 300 }} 
                  onChange={(event) => setAmount(Number(event.target.value))} 
                  id="filled-basic" 
                  label="Amount" 
                  variant="outlined" />
              </div>
              <div className={classes.amountInput}>
                <TextField 
                  size="small" 
                  value={amount * longAmount}
                  // value={collateral} 
                  // onChange={(event) => setCollateral(Number(event.target.value))} 
                  type="number" 
                  style={{ width: 300 }} 
                  disabled id="filled-basic" 
                  label="Collateral"
                  // helperText={collateral < minCollateral ? `Min collateral is ${minCollateral}` : undefined} 
                  // error={collateral < minCollateral}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        ETH
                      </InputAdornment>
                    ),
                  }}
                  variant="outlined" />
              </div>
              <div className={classes.amountInput}>
                <TextField 
                  size="small" 
                  value={(dailyFundingPayment * amount).toFixed(4) } 
                  type="number" style={{ width: 300 }} 
                  disabled id="filled-basic" 
                  label="Daily Funding Received" 
                  variant="outlined"
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        USDC
                      </InputAdornment>
                    ),
                  }}
                />
              </div>
              <div className={classes.amountInput}>
              <TextField 
                size="small" 
                value={liqPrice.toFixed(0)} 
                onChange={(event) => setCollateral(Number(event.target.value))} 
                type="number" 
                style={{ width: 300 }} 
                id="filled-basic" 
                disabled
                label="24h Liquidation Price"
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      ETH
                    </InputAdornment>
                  ),
                }}
                variant="outlined" />
              </div>
              <Button className={classes.amountInput} style={{ width: 300 }} variant="contained" color="primary"> {'Deposit'} </Button>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
