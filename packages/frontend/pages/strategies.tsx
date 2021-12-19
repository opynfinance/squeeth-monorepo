import {
  Button,
  createStyles,
  FormControlLabel,
  IconButton,
  makeStyles,
  Switch,
  Tab,
  Tabs,
  TextField,
} from '@material-ui/core'
import Card from '@material-ui/core/Card'
import List from '@material-ui/core/List'
import ListItem from '@material-ui/core/ListItem'
import ListItemText from '@material-ui/core/ListItemText'
import Tooltip from '@material-ui/core/Tooltip'
import Typography from '@material-ui/core/Typography'
import WhatshotIcon from '@material-ui/icons/Whatshot'
import { validateAndParseAddress } from '@uniswap/sdk-core'
import BigNumber from 'bignumber.js'
import Image from 'next/image'
import { useEffect, useMemo, useState } from 'react'

import crabpayoff from '../public/images/crabpayoff.png'
import ethbullpayoff from '../public/images/ethbullpayoff.png'
import ShortSqueethPayoff from '@components/Charts/ShortSqueethPayoff'
import { VaultChart } from '@components/Charts/VaultChart'
import Nav from '@components/Nav'
import TradeInfoItem from '@components/Trade/TradeInfoItem'
import { Vaults } from '../src/constants'
import { useWallet } from '@context/wallet'
import { useWorldContext } from '@context/world'
import { useController } from '@hooks/contracts/useController'
import useShortHelper from '@hooks/contracts/useShortHelper'
import { useTokenBalance } from '@hooks/contracts/useTokenBalance'
import { useVaultManager } from '@hooks/contracts/useVaultManager'
import { useAddresses } from '@hooks/useAddress'
import useAsyncMemo from '@hooks/useAsyncMemo'
import { useETHPriceCharts } from '@hooks/useETHPriceCharts'
import { calculateLiquidationPrice, getCrabVaultPayoff, getFairSqueethBid, getVolForTimestamp } from '../src/utils'
import { withRequiredAddr } from '@utils/withRequiredAddr'

const useStyles = makeStyles((theme) =>
  createStyles({
    header: {
      color: theme.palette.primary.main,
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
    body: {
      padding: theme.spacing(2, 8),
      margin: 'auto',
      display: 'flex',
      justifyContent: 'space-around',
    },
    subHeading: {
      color: theme.palette.text.secondary,
    },
    card: {
      marginTop: theme.spacing(2),
      padding: theme.spacing(2),
      width: '60%',
    },
    buyCard: {
      marginTop: theme.spacing(4),
      marginLeft: theme.spacing(2),
    },
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
      textAlign: 'center',
      padding: theme.spacing(2),
      paddingBottom: theme.spacing(8),
      background: theme.palette.background.default,
      border: `1px solid ${theme.palette.background.stone}`,
    },
    amountInput: {
      marginTop: theme.spacing(4),
    },
    thirdHeading: {
      marginTop: theme.spacing(2),
    },
    txItem: {
      display: 'flex',
      padding: theme.spacing(0, 4),
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

const getVaultDetail = (vault: Vaults) => {
  if (vault === Vaults.CrabVault)
    return (
      <p>
        This yielding position is similar to selling a strangle. You are profitable as long as ETH moves less than
        approximately 6% in either direction <b>in a single day</b>. The strategy rebalances daily to be delta neutral
        by buying or selling ETH.
        {/* <br /> <br /> Note that the 6% threshold is dynamic, changing each day based on the daily implied volatility and funding. */}
        <br />
        <br />
      </p>
    )
  if (vault === Vaults.ETHBull)
    return (
      <>
        {' '}
        This yielding position is profitable when ETH goes up any amount less than 100% <b>in a single day</b>. This
        strategy loses money when ETH goes down. <br />
        <br />
      </>
    )
  if (vault === Vaults.ETHBear)
    return (
      <>
        {' '}
        This yielding position is profitable when ETH goes down any amount <b>in a single day</b>. This strategy loses
        money when ETH goes up.
        <br />
        <br />{' '}
      </>
    )
  else return ''
}

const getAdvancedDetail = (vault: Vaults) => {
  if (vault === Vaults.CrabVault)
    return (
      <>
        {/* <Typography style={{ color: '#FFFFFF' }} variant="h6">
          Properties
        </Typography>
        <p>
          This strategy is short 1 squeeth, which is where you earn yield from. The strategy is also long 2 ETH. This
          2ETH - ETH&sup2; payoff gives you 0 ETH exposure.
          <a
            style={{ color: '#4DADF3' }}
            href="https://www.notion.so/opynopyn/Squeeth-FAQ-4b6a054ab011454cbbd60cb3ee23a37c"
          >
            {' '}
            Learn more.{' '}
          </a>
        </p> */}
        <Typography style={{ color: '#FFFFFF' }} variant="h6">
          Payoff
        </Typography>
        <p>
          This strategy is short 1 squeeth, which is where you earn yield from. The strategy is also long 2 ETH. This
          2ETH - ETH&sup2; payoff gives you 0 ETH exposure, while you earn funding yields.
          <a
            style={{ color: '#4DADF3' }}
            href="https://www.notion.so/opynopyn/Squeeth-FAQ-4b6a054ab011454cbbd60cb3ee23a37c"
            target="_blank"
            rel="noreferrer"
          >
            {' '}
            Learn more.{' '}
          </a>
        </p>
        {/* <Image src={crabpayoff} alt="crab payoff" width={450} height={300} /> */}
        <ShortSqueethPayoff ethPrice={3000} collatRatio={2} vaultType={Vaults.CrabVault} />
        <br /> <br />
        <br />
        <Typography style={{ color: '#FFFFFF' }} variant="h6">
          Risks
        </Typography>
        <p>
          If you fall below the safe collateralization threshold (150%), you are at risk of liquidation. If ETH moves
          more than approximately 6% in a given day, the strategy loses money.
          <br /> <br />
          Squeeth smart contracts are currently unaudited. This is experimental technology and we encourage caution only
          risking funds you can afford to lose.
        </p>
      </>
    )
  if (vault === Vaults.ETHBull)
    return (
      <>
        {/* <Typography style={{ color: '#FFFFFF' }} variant="h6">
          Properties
        </Typography>
        <p>
          This strategy is short 1 squeeth, which is where you earn yield from. The strategy is also long 3 ETH. This
          3ETH - ETH&sup2; payoff gives you exposure to long 1 ETH while you earn funding yields.
          <a
            style={{ color: '#4DADF3' }}
            href="https://www.notion.so/opynopyn/Squeeth-FAQ-4b6a054ab011454cbbd60cb3ee23a37c"
          >
            {' '}
            Learn more.{' '}
          </a>
        </p> */}
        <Typography style={{ color: '#FFFFFF' }} variant="h6">
          Payoff
        </Typography>
        <p>
          This strategy is short 1 squeeth, which is where you earn yield from. The strategy is also long 3 ETH. This
          3ETH - ETH&sup2; payoff gives you exposure to long 1 ETH while you earn funding yields.
          <a
            style={{ color: '#4DADF3' }}
            href="https://www.notion.so/opynopyn/Squeeth-FAQ-4b6a054ab011454cbbd60cb3ee23a37c"
            target="_blank"
            rel="noreferrer"
          >
            {' '}
            Learn more.{' '}
          </a>
        </p>
        <Image src={ethbullpayoff} alt="eth bull payoff" width={450} height={300} />
        <br />
        <br />
        <Typography style={{ color: '#FFFFFF' }} variant="h6">
          Risks
        </Typography>
        <p>
          If you fall below the safe collateralization threshold (150%), you are at risk of liquidation. If ETH goes up
          more than approximately 100% in a given day, or if ETH goes down the strategy loses money.
          <br /> <br />
          Squeeth smart contracts are currently unaudited. This is experimental technology and we encourage caution only
          risking funds you can afford to lose.
        </p>
      </>
    )
  if (vault === Vaults.ETHBear)
    return (
      <p>
        <Typography style={{ color: '#FFFFFF' }} variant="h6">
          Properties
        </Typography>
        This strategy is short 1 squeeth, which is where you earn yield from. The strategy is also long 1 ETH. This ETH
        - ETH&sup2; payoff gives you exposure to short 1 ETH, while you earn funding yields.
        <a
          style={{ color: '#4DADF3' }}
          href="https://www.notion.so/opynopyn/Squeeth-FAQ-4b6a054ab011454cbbd60cb3ee23a37c"
          target="_blank"
          rel="noreferrer"
        >
          {' '}
          Learn more.{' '}
        </a>
        <br />
        <br />
        <Typography style={{ color: '#FFFFFF' }} variant="h6">
          Risks
        </Typography>
        <p>
          If you fall below the safe collateralization threshold (150%), you are at risk of liquidation. If ETH goes up
          any amount, the strategy loses money.
          <br /> <br />
          Squeeth smart contracts are currently unaudited. This is experimental technology and we encourage caution only
          risking funds you can afford to lose.
        </p>
      </p>
    )
  else return ''
}

const getVaultIntro = (vault: Vaults) => {
  if (vault === Vaults.CrabVault) return <> Earn yield by selling volatility </>
  if (vault === Vaults.ETHBull) return <> Earn yield while being long ETH </>
  if (vault === Vaults.ETHBear) return <> Earn yield while being short ETH </>
}

const TxValue: React.FC<{ value: string | number; label: string }> = ({ value, label }) => {
  const classes = useStyles()

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
  const classes = useStyles()

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

export function Vault() {
  const classes = useStyles()
  const [showPercentage, setShowPercentage] = useState(true)
  const [customLong, setCustomLong] = useState(1.5)
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [amount, setAmount] = useState(1)
  const [collateral] = useState(1)
  const [vaultId, setVaultId] = useState(0)
  const [isVaultApproved, setIsVaultApproved] = useState(true)

  const { researchMode } = useWorldContext()
  const { openShort, closeShort } = useShortHelper()
  const { updateOperator, fundingPerDay } = useController()
  const { wSqueeth, weth, shortHelper } = useAddresses()
  const squeethBal = useTokenBalance(wSqueeth, 5)
  const wethBal = useTokenBalance(weth, 5)
  const { vaults: shortVaults } = useVaultManager(5)

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

  // use global vol set by global settings
  const {
    volMultiplier: globalVMultiplier,
    getVaultPNLWithRebalance,
    days: globalDays,
    startingETHPrice: globalStartingETHPrice,
  } = useWorldContext()

  const {
    ethPrices,
    accFunding,
    startingETHPrice,
    volMultiplier: vMultiplier,
    setVolMultiplier,
  } = useETHPriceCharts(1, globalVMultiplier)

  // set global vol into the useETHPriceCharts hook, so we get accurate data
  useEffect(() => {
    setVolMultiplier(globalVMultiplier)
  }, [globalVMultiplier, setVolMultiplier])

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

  const rebalancePNLSeries = getVaultPNLWithRebalance(longAmount)

  const backTestAPY = useMemo(() => {
    if (rebalancePNLSeries.length === 0) return 0
    const pnl = rebalancePNLSeries[rebalancePNLSeries.length - 1].value
    const multiplier = pnl > 0 ? 1 : -1
    const apy = Math.pow(1 + pnl / globalStartingETHPrice, 365 / globalDays)
    return apy * multiplier * 100
  }, [rebalancePNLSeries, globalDays, globalStartingETHPrice])

  const currentEthPrice = useMemo(() => {
    return ethPrices.length > 0 ? ethPrices[ethPrices.length - 1].value : 0
  }, [ethPrices])

  const vol = useAsyncMemo(
    async () => {
      const ethPrice = ethPrices.length > 0 ? ethPrices[ethPrices.length - 1].value : 0
      const timestamp = ethPrices.length > 0 ? ethPrices[ethPrices.length - 1].time : Date.now() / 1000
      const vol = await getVolForTimestamp(timestamp, ethPrice)
      return vol * vMultiplier
    },
    0,
    [ethPrices, vMultiplier],
  )

  const price = useMemo(() => {
    return getFairSqueethBid(currentEthPrice, 1, vol) / startingETHPrice
  }, [currentEthPrice, startingETHPrice, vol])

  // scaled down by starting eth
  // const dailyFundingPayment = useMemo(() => accFunding / startingETHPrice, [accFunding, startingETHPrice])

  const dailyInterestRate = useMemo(() => (fundingPerDay * 100) / price, [fundingPerDay, price])

  const { selectWallet, connected } = useWallet()

  const liqPrice = useMemo(() => {
    const ethPrice = ethPrices.length > 0 ? ethPrices[ethPrices.length - 1].value : 0
    return calculateLiquidationPrice(amount, collateral, vol, ethPrice)
  }, [ethPrices, collateral, amount, vol])

  const depositAndShort = () => {
    console.log('Deposit short')
  }

  return (
    <div>
      <Nav />
      <div className={classes.body}>
        <div className={classes.card}>
          <Typography variant="h5">Yield Strategies</Typography>

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

            {researchMode && <Tab style={{ textTransform: 'none' }} label={Vaults.Custom} icon={<div>🥙</div>} />}
          </Tabs>
          <Typography className={classes.cardHeader} variant="h6">
            {vault}
          </Typography>
          <Typography variant="body1">{getVaultIntro(vault)}</Typography>
          <Typography variant="body2" className={classes.cardSubTxt}>
            {getVaultDetail(vault)}
          </Typography>

          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
            <Typography className={classes.header} variant="h6">
              Historical Predicted Performance
            </Typography>
            <FormControlLabel
              control={<Switch checked={showPercentage} onChange={(event, checked) => setShowPercentage(checked)} />}
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
            Strategy Detail
          </Typography>
          <br />
          {/* <Typography className={classes.thirdHeading} variant="h6">
            How it works
          </Typography>
          <List>
            <ListItem>
              <ListItemText
                primary="1. Deposit ETH funds in the strategy"
                secondary="Behind the scenes the strategy is minting and selling squeeth, and holding long ETH"
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="2. Earn yield by being short squeeth and long ETH."
                secondary="Yield is paid out by reducing your squeeth debt"
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="3. Withdraw funds at anytime"
                secondary="Note there is liquidation risk from being short squeeth"
              />
            </ListItem>
          </List> */}

          <Typography variant="body2" className={classes.cardSubTxt}>
            {getAdvancedDetail(vault)}
          </Typography>
        </div>
        <div className={classes.buyCard}>
          <Card className={classes.innerCard}>
            <Typography className={classes.cardTitle} variant="h6">
              Deposit in {vault}
            </Typography>
            <br />
            <Tooltip title="Funding Payment Annualized APY. This APY is calculated based on the minimal initial collateral (1 ETH).">
              <Typography style={{ fontSize: 18 }}>Estimated APY: {(1 + dailyInterestRate) ^ 365}%</Typography>
            </Tooltip>
            <Tooltip title="APY from backtest result. You can change the number in 'back test days' under the graph to run different stimulation. This APY is calculated based on the minimal initial collateral (1 ETH)">
              <Typography style={{ fontSize: 18 }}>Realized APY: {backTestAPY.toFixed(0)}%</Typography>
            </Tooltip>
            <div className={classes.amountInput}>
              <TextField
                size="small"
                value={amount.toString()}
                type="number"
                style={{ width: 300 }}
                onChange={(event) => setAmount(Number(event.target.value))}
                id="filled-basic"
                label="ETH Amount"
                variant="outlined"
              />
            </div>
            {/* <div className={classes.txItem}>
              <Typography className={classes.txLabel}>Collateral Required</Typography>
              <TxValue value={amount * longAmount} label="ETH" />
            </div> */}
            <TradeInfoItem
              label="Funding (received continuously)"
              value={(fundingPerDay * 100).toFixed(2)}
              unit="%"
              tooltip="Funding is paid in kind, reducing your squeeth debt. Funding happens everytime the contract is touched."
            />
            <TradeInfoItem
              label="24h Liquidation Price"
              value={liqPrice.toFixed(0)}
              unit="USDC"
              tooltip="The liquidation price changes each day when the strategy adjusts to maintain its exposure"
            />

            {!connected ? (
              <Button
                onClick={selectWallet}
                className={classes.amountInput}
                style={{ width: 300, color: '#000' }}
                variant="contained"
                color="primary"
              >
                {'Connect Wallet'}
              </Button>
            ) : (
              <Button
                onClick={depositAndShort}
                className={classes.amountInput}
                style={{ width: 300, color: '#000' }}
                variant="contained"
                color="primary"
              >
                {isVaultApproved ? 'Deposit and sell' : 'Add operator to deposit / Burn'}
              </Button>
            )}
            <br />
            <div className={classes.txItem}>
              <Typography>Squeeth Balance</Typography>
              <TxValue value={squeethBal.toFixed(2)} label="SQE" />
            </div>
            <div className={classes.txItem}>
              <Typography>WETH Balance</Typography>
              <VaultValue value={wethBal.toFixed(2)} label="WETH" />
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default withRequiredAddr(Vault)
