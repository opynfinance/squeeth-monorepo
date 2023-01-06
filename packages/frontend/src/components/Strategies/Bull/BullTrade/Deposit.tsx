import { Box, Typography, Tooltip, CircularProgress } from '@material-ui/core'
import BigNumber from 'bignumber.js'
import { useAtom, useAtomValue } from 'jotai'
import { useMemo, useRef, useState, useCallback } from 'react'
import InfoIcon from '@material-ui/icons/Info'
import debounce from 'lodash/debounce'

import { PrimaryButtonNew } from '@components/Button'
import { InputToken } from '@components/InputNew'
import { LinkWrapper } from '@components/LinkWrapper'
import Metric from '@components/Metric'
import RestrictionInfo from '@components/RestrictionInfo'
import { TradeSettings } from '@components/TradeSettings'
import {
  BIG_ZERO,
  FUNDING_PERIOD,
  INDEX_SCALE,
  VOL_PERCENT_FIXED,
  VOL_PERCENT_SCALAR,
  YEAR,
  WETH_DECIMALS,
} from '@constants/index'
import { useGetFlashBulldepositParams, useBullFlashDeposit } from '@state/bull/hooks'
import { impliedVolAtom, indexAtom, normFactorAtom } from '@state/controller/atoms'
import { useSelectWallet, useWalletBalance } from '@state/wallet/hooks'
import { toTokenAmount } from '@utils/calculations'
import { formatNumber } from '@utils/formatter'
import ethLogo from 'public/images/eth-logo.svg'
import { connectedWalletAtom, supportedNetworkAtom } from '@state/wallet/atoms'
import { useRestrictUser } from '@context/restrict-user'
import { crabStrategySlippageAtomV2, crabStrategyVaultAtomV2, maxCapAtomV2 } from '@state/crab/atoms'
import useAppMemo from '@hooks/useAppMemo'
import { bullCapAtom, bullDepositedEthInEulerAtom } from '@state/bull/atoms'
import { BULL_EVENTS } from '@utils/amplitude'
import useExecuteOnce from '@hooks/useExecuteOnce'
import useAmplitude from '@hooks/useAmplitude'
import { useZenBullStyles } from './styles'
import { BullTradeType, BullTransactionConfirmation } from './index'
import useToggleCrispChat from '@hooks/useToggleCrispChat'

const BullDeposit: React.FC<{ onTxnConfirm: (txn: BullTransactionConfirmation) => void }> = ({ onTxnConfirm }) => {
  const classes = useZenBullStyles()

  const depositAmountRef = useRef('0')
  const [depositAmount, setDepositAmount] = useState('0')
  const depositAmountBN = useMemo(() => new BigNumber(depositAmount), [depositAmount])

  const ongoingTransactionAmountRef = useRef(new BigNumber(0))
  const [txLoading, setTxLoading] = useState(false)

  const [slippage, setSlippage] = useAtom(crabStrategySlippageAtomV2)
  const [quoteLoading, setQuoteLoading] = useState(false)

  const negativeReturnsError = false
  const { isRestricted } = useRestrictUser()
  const connected = useAtomValue(connectedWalletAtom)
  const supportedNetwork = useAtomValue(supportedNetworkAtom)

  const selectWallet = useSelectWallet()

  const index = useAtomValue(indexAtom)
  const normFactor = useAtomValue(normFactorAtom)
  const impliedVol = useAtomValue(impliedVolAtom)
  const ethIndexPrice = toTokenAmount(index, 18).sqrt()
  const bullCap = useAtomValue(bullCapAtom)
  const bullDepositedEth = useAtomValue(bullDepositedEthInEulerAtom)
  const crabCap = useAtomValue(maxCapAtomV2)
  const crabDepositedEth = useAtomValue(crabStrategyVaultAtomV2)?.collateralAmount || BIG_ZERO

  const [quote, setQuote] = useState({
    ethToCrab: BIG_ZERO,
    minEthFromSqth: BIG_ZERO,
    minEthFromUsdc: BIG_ZERO,
    ethOutForSqth: BIG_ZERO,
    ethOutForUsdc: BIG_ZERO,
    oSqthIn: BIG_ZERO,
    usdcIn: BIG_ZERO,
    wPowerPerpPoolFee: 0,
    usdcPoolFee: 0,
    priceImpact: 0,
    wethToLend: BIG_ZERO,
    poolFee: 0,
  })

  const { data: balance } = useWalletBalance()

  const getFlashBullDepositParams = useGetFlashBulldepositParams()
  const bullFlashDeposit = useBullFlashDeposit()
  const { track } = useAmplitude()

  const trackUserEnteredDepositAmount = useCallback(
    (amount: BigNumber) => track(BULL_EVENTS.DEPOSIT_BULL_AMOUNT_ENTERED, { amount: amount.toNumber() }),
    [track],
  )

  const [trackDepositAmountEnteredOnce, resetTracking] = useExecuteOnce(trackUserEnteredDepositAmount)

  const debouncedDepositQuote = debounce(async (ethToDeposit: string) => {
    setQuoteLoading(true)
    getFlashBullDepositParams(new BigNumber(ethToDeposit))
      .then((_quote) => {
        console.log('', ethToDeposit.toString(), depositAmountRef.current)
        if (ethToDeposit === depositAmountRef.current) {
          let quotePriceImpact = _quote.priceImpact
          if (_quote.poolFee) quotePriceImpact = _quote.priceImpact - _quote.poolFee
          setQuote({ ..._quote, priceImpact: quotePriceImpact })
        }
      })
      .finally(() => {
        if (ethToDeposit === depositAmountRef.current) setQuoteLoading(false)
      })
  }, 500)

  const { show: showCrispChat } = useToggleCrispChat()

  const onInputChange = useCallback(
    (ethToDeposit: string) => {
      showCrispChat()
      const depositEthBN = new BigNumber(ethToDeposit)
      depositEthBN.isGreaterThan(0) ? trackDepositAmountEnteredOnce(depositEthBN) : null
      setDepositAmount(ethToDeposit)
      depositAmountRef.current = ethToDeposit
      debouncedDepositQuote(ethToDeposit)
    },
    [trackDepositAmountEnteredOnce, debouncedDepositQuote, showCrispChat],
  )

  const onTxnConfirmed = useCallback(
    (id?: string) => {
      onInputChange('0')
      onTxnConfirm({
        status: true,
        amount: ongoingTransactionAmountRef.current,
        tradeType: BullTradeType.Deposit,
        txId: id,
      })
      resetTracking()
      ongoingTransactionAmountRef.current = new BigNumber(0)
    },
    [onTxnConfirm, resetTracking, onInputChange],
  )

  const onDepositClick = useCallback(async () => {
    setTxLoading(true)
    try {
      ongoingTransactionAmountRef.current = new BigNumber(depositAmountRef.current)
      await bullFlashDeposit(
        quote.ethToCrab,
        quote.minEthFromSqth,
        quote.minEthFromUsdc,
        quote.wPowerPerpPoolFee,
        quote.usdcPoolFee,
        new BigNumber(depositAmountRef.current),
        onTxnConfirmed,
      )
    } catch (e) {
      resetTracking()
      console.log(e)
    }
    setTxLoading(false)
  }, [
    bullFlashDeposit,
    quote.ethToCrab,
    quote.minEthFromSqth,
    quote.minEthFromUsdc,
    quote.wPowerPerpPoolFee,
    quote.usdcPoolFee,
    onTxnConfirmed,
    resetTracking,
  ])

  const depositPriceImpactWarning = useAppMemo(() => {
    const squeethPrice = quote.ethOutForSqth.div(quote.oSqthIn)
    const scalingFactor = new BigNumber(INDEX_SCALE)
    const fundingPeriod = new BigNumber(FUNDING_PERIOD).div(YEAR)
    const log = Math.log(scalingFactor.times(squeethPrice).div(normFactor.times(ethIndexPrice)).toNumber())
    const executionVol = new BigNumber(log).div(fundingPeriod).sqrt()
    const showPriceImpactWarning =
      log < 0 ||
      executionVol
        .minus(impliedVol)
        .abs()
        .gt(BigNumber.max(new BigNumber(impliedVol).times(VOL_PERCENT_SCALAR), VOL_PERCENT_FIXED))
    return showPriceImpactWarning
  }, [quote.ethOutForSqth, quote.oSqthIn, normFactor, ethIndexPrice, impliedVol])

  const depositError = useAppMemo(() => {
    if (depositAmountBN.gt(toTokenAmount(balance ?? BIG_ZERO, 18))) {
      return 'Insufficient ETH balance'
    }
    if (quote.ethToCrab.plus(crabDepositedEth).gt(crabCap) || quote.wethToLend.plus(bullDepositedEth).gt(bullCap)) {
      return 'Deposit amount exceeds cap. Try a smaller amount.'
    }
  }, [
    balance,
    bullCap,
    bullDepositedEth,
    crabCap,
    crabDepositedEth,
    depositAmountBN,
    quote.ethToCrab,
    quote.wethToLend,
  ])

  const setDepositMax = () => {
    onInputChange(toTokenAmount(balance ?? BIG_ZERO, WETH_DECIMALS).toString())
  }

  return (
    <>
      <Box marginTop="32px" display="flex" justifyContent="space-between" alignItems="center" gridGap="12px">
        <Typography variant="h4" className={classes.subtitle}>
          Strategy deposit
        </Typography>
      </Box>

      <div className={classes.tradeContainer}>
        <InputToken
          id="bull-deposit-eth-input"
          value={depositAmount}
          onInputChange={onInputChange}
          balance={toTokenAmount(balance ?? BIG_ZERO, 18)}
          logo={ethLogo}
          symbol={'ETH'}
          usdPrice={ethIndexPrice}
          error={!!depositError}
          helperText={depositError}
          balanceLabel="Balance"
          onBalanceClick={setDepositMax}
        />

        {negativeReturnsError ? (
          <div className={classes.notice}>
            <div className={classes.infoIcon}>
              <Tooltip title={'Negative returns warning'}>
                <InfoIcon fontSize="medium" />
              </Tooltip>
            </div>
            <Typography variant="caption" className={classes.infoText}>
              Negative returns warning
            </Typography>
          </div>
        ) : null}

        {depositPriceImpactWarning ? (
          <div className={classes.notice}>
            <div className={classes.infoIcon}>
              <Tooltip
                title={
                  'High price impact means that you are losing a significant amount of value due to the size of your trade. Depositing a smaller size can reduce your price impact.'
                }
              >
                <InfoIcon fontSize="medium" />
              </Tooltip>
            </div>
            <Typography variant="caption" className={classes.infoText}>
              High price impact. Try multiple smaller transactions or contact us through{' '}
              <LinkWrapper href="https://tiny.cc/opyndiscord">discord</LinkWrapper> about OTC
            </Typography>
          </div>
        ) : null}

        <Box display="flex" flexDirection="column" gridGap="12px" marginTop="24px">
          <Box
            display="flex"
            alignItems="center"
            justifyContent="space-between"
            gridGap="12px"
            className={classes.slippageContainer}
          >
            <Metric
              label="Uniswap Fee"
              value={formatNumber(quote.poolFee) + '%'}
              isSmall
              flexDirection="row"
              justifyContent="space-between"
              gridGap="12px"
            />

            <Box display="flex" alignItems="center" gridGap="12px" flex="1">
              <Metric
                label="Price Impact"
                value={formatNumber(quote.priceImpact < 0 ? 0 : quote.priceImpact) + '%'}
                isSmall
                flexDirection="row"
                justifyContent="space-between"
                gridGap="12px"
              />
              <TradeSettings
                setSlippage={(amt) => {
                  setSlippage(amt.toNumber())
                  onInputChange(depositAmount)
                }}
                slippage={new BigNumber(slippage)}
              />
            </Box>
          </Box>
        </Box>

        {isRestricted && <RestrictionInfo marginTop="24px" />}

        <Box marginTop="24px">
          {isRestricted ? (
            <PrimaryButtonNew
              fullWidth
              variant="contained"
              onClick={selectWallet}
              disabled={true}
              id="bull-restricted-btn"
            >
              {'Unavailable'}
            </PrimaryButtonNew>
          ) : !connected ? (
            <PrimaryButtonNew
              fullWidth
              variant="contained"
              onClick={selectWallet}
              disabled={false}
              id="bull-select-wallet-btn"
            >
              {'Connect Wallet'}
            </PrimaryButtonNew>
          ) : !supportedNetwork ? (
            <PrimaryButtonNew fullWidth variant="contained" disabled={true} id="bull-unsupported-network-btn">
              {'Unsupported Network'}
            </PrimaryButtonNew>
          ) : (
            <PrimaryButtonNew
              fullWidth
              id="bull-deposit-btn"
              variant={'contained'}
              onClick={onDepositClick}
              disabled={quoteLoading || txLoading || depositAmount === '0' || !!depositError}
            >
              {!txLoading && !quoteLoading ? 'Deposit' : <CircularProgress color="primary" size="1.5rem" />}
            </PrimaryButtonNew>
          )}
        </Box>
      </div>
    </>
  )
}

export default BullDeposit
