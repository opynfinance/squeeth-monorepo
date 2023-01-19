import { Box, Typography, Tooltip, CircularProgress } from '@material-ui/core'
import BigNumber from 'bignumber.js'
import { useAtom, useAtomValue } from 'jotai'
import { useCallback, useRef, useState, useMemo } from 'react'
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
  UNI_POOL_FEES,
  VOL_PERCENT_FIXED,
  VOL_PERCENT_SCALAR,
  WETH_DECIMALS,
  YEAR,
} from '@constants/index'
import { useGetFlashWithdrawParams, useBullFlashWithdraw } from '@state/bull/hooks'
import { impliedVolAtom, indexAtom, normFactorAtom, osqthRefVolAtom } from '@state/controller/atoms'
import { useSelectWallet } from '@state/wallet/hooks'
import { toTokenAmount } from '@utils/calculations'
import { formatNumber } from '@utils/formatter'
import ethLogo from 'public/images/eth-logo.svg'
import { crabStrategySlippageAtomV2 } from '@state/crab/atoms'
import { useTokenBalance } from '@hooks/contracts/useTokenBalance'
import { addressesAtom } from '@state/positions/atoms'
import { useUserAllowance } from '@hooks/contracts/useAllowance'
import { useRestrictUser } from '@context/restrict-user'
import { connectedWalletAtom, supportedNetworkAtom } from '@state/wallet/atoms'
import { bullCurrentETHPositionAtom } from '@state/bull/atoms'
import useAppMemo from '@hooks/useAppMemo'
import useAppCallback from '@hooks/useAppCallback'
import useAmplitude from '@hooks/useAmplitude'
import { BULL_EVENTS } from '@utils/amplitude'
import useExecuteOnce from '@hooks/useExecuteOnce'
import { useZenBullStyles } from './styles'
import { BullTradeType, BullTransactionConfirmation } from './index'
import useTrackTransactionFlow from '@hooks/useTrackTransactionFlow'

const BullWithdraw: React.FC<{ onTxnConfirm: (txn: BullTransactionConfirmation) => void }> = ({ onTxnConfirm }) => {
  const classes = useZenBullStyles()

  const withdrawAmountRef = useRef('0')
  const ongoingTransactionAmountRef = useRef(new BigNumber(0))
  const [withdrawAmount, setWithdrawAmount] = useState('0')
  const withdrawAmountBN = useMemo(() => new BigNumber(withdrawAmount), [withdrawAmount])
  const [txLoading, setTxLoading] = useState(false)

  const [slippage, setSlippage] = useAtom(crabStrategySlippageAtomV2)
  const [quoteLoading, setQuoteLoading] = useState(false)

  const negativeReturnsError = false
  const highDepositWarning = false
  const { isRestricted } = useRestrictUser()
  const connected = useAtomValue(connectedWalletAtom)
  const supportedNetwork = useAtomValue(supportedNetworkAtom)
  const bullPositionValueInEth = useAtomValue(bullCurrentETHPositionAtom)
  const osqthRefVol = useAtomValue(osqthRefVolAtom)

  const selectWallet = useSelectWallet()

  const index = useAtomValue(indexAtom)
  const ethIndexPrice = toTokenAmount(index, 18).sqrt()
  const impliedVol = useAtomValue(impliedVolAtom)
  const normFactor = useAtomValue(normFactorAtom)

  const { bullStrategy, flashBull } = useAtomValue(addressesAtom)
  const { value: bullBalance } = useTokenBalance(bullStrategy, 15, WETH_DECIMALS)
  const { allowance: bullAllowance, approve: approveBull } = useUserAllowance(bullStrategy, flashBull)

  const [quote, setQuote] = useState({
    maxEthForWPowerPerp: BIG_ZERO,
    maxEthForUsdc: BIG_ZERO,
    wPowerPerpPoolFee: 0,
    usdcPoolFee: 0,
    priceImpact: 0,
    ethInForSqth: BIG_ZERO,
    ethInForUsdc: BIG_ZERO,
    oSqthOut: BIG_ZERO,
    usdcOut: BIG_ZERO,
    poolFee: 0,
  })

  const getFlashBullWithdrawParams = useGetFlashWithdrawParams()
  const bullFlashWithdraw = useBullFlashWithdraw()
  const { track } = useAmplitude()
  const logAndRunTransaction = useTrackTransactionFlow()

  const trackUserEnteredWithdrawAmount = useCallback(
    (amount: BigNumber) => track(BULL_EVENTS.WITHDRAW_BULL_AMOUNT_ENTERED, { amount: amount.toNumber() }),
    [track],
  )
  const [trackWithdrawAmountEnteredOnce, resetTracking] = useExecuteOnce(trackUserEnteredWithdrawAmount)

  const showPriceImpactWarning = useAppMemo(() => {
    const squeethPrice = quote.ethInForSqth.div(quote.oSqthOut).times(1 - UNI_POOL_FEES / 1000_000)
    const scalingFactor = new BigNumber(INDEX_SCALE)
    const fundingPeriod = new BigNumber(FUNDING_PERIOD).div(YEAR)
    const executionVol = new BigNumber(
      Math.log(scalingFactor.times(squeethPrice).div(normFactor.times(ethIndexPrice)).toNumber()),
    )
      .div(fundingPeriod)
      .sqrt()
    const showPriceImpactWarning = executionVol
      .minus(impliedVol)
      .abs()
      .gt(BigNumber.max(new BigNumber(impliedVol).times(VOL_PERCENT_SCALAR), VOL_PERCENT_FIXED))

    return showPriceImpactWarning
  }, [quote.ethInForSqth, quote.oSqthOut, normFactor, ethIndexPrice, impliedVol])

  const withdrawFundingWarning = useAppMemo(() => {
    const impliedVolDiff = new BigNumber(VOL_PERCENT_SCALAR)
    const impliedVolDiffLowVol = new BigNumber(VOL_PERCENT_FIXED)

    const threshold = BigNumber.max(
      new BigNumber(osqthRefVol / 100).times(new BigNumber(1).plus(impliedVolDiff)),
      new BigNumber(osqthRefVol / 100).plus(impliedVolDiffLowVol),
    )

    const fundingWarning = new BigNumber(impliedVol).gt(threshold) ? true : false
    return fundingWarning
  }, [impliedVol, osqthRefVol])

  const debouncedWithdrawQuote = debounce(async (bullToWithdraw: string) => {
    setQuoteLoading(true)
    getFlashBullWithdrawParams(new BigNumber(bullToWithdraw))
      .then((_quote) => {
        if (bullToWithdraw === withdrawAmountRef.current) {
          let quotePriceImpact = _quote.priceImpact
          if (_quote.poolFee) quotePriceImpact = _quote.priceImpact - _quote.poolFee
          setQuote({ ..._quote, priceImpact: quotePriceImpact })
        }
      })
      .finally(() => {
        if (bullToWithdraw === withdrawAmountRef.current) setQuoteLoading(false)
      })
  }, 500)

  const onInputChange = useAppCallback(
    (ethToWithdraw: string) => {
      const withdrawEthBN = new BigNumber(ethToWithdraw)
      withdrawEthBN.isGreaterThan(0) ? trackWithdrawAmountEnteredOnce(withdrawEthBN) : null
      const _bullToWithdraw = new BigNumber(ethToWithdraw).div(bullPositionValueInEth).times(bullBalance)
      setWithdrawAmount(ethToWithdraw)
      withdrawAmountRef.current = _bullToWithdraw.toString()
      debouncedWithdrawQuote(_bullToWithdraw.toString())
    },
    [trackWithdrawAmountEnteredOnce, debouncedWithdrawQuote, bullBalance, bullPositionValueInEth],
  )

  const onTxnConfirmed = useCallback(
    (id?: string) => {
      onInputChange('0')
      onTxnConfirm({
        status: true,
        amount: ongoingTransactionAmountRef.current,
        tradeType: BullTradeType.Withdraw,
        txId: id,
      })
      resetTracking()
      ongoingTransactionAmountRef.current = new BigNumber(0)
    },
    [onTxnConfirm, resetTracking, onInputChange],
  )

  const onWithdrawClick = async () => {
    setTxLoading(true)
    try {
      ongoingTransactionAmountRef.current = new BigNumber(withdrawAmount)
      const dataToTrack = {
        amount: new BigNumber(withdrawAmountRef.current).toNumber(),
        isPriceImpactHigh: showPriceImpactWarning,
        priceImpact: quote.poolFee + quote.priceImpact,
      }
      await bullFlashWithdraw(
        new BigNumber(withdrawAmountRef.current),
        quote.maxEthForWPowerPerp,
        quote.maxEthForUsdc,
        quote.wPowerPerpPoolFee,
        quote.usdcPoolFee,
        dataToTrack,
        onTxnConfirmed,
      )
    } catch (e) {
      resetTracking()
      console.log(e)
    }
    setTxLoading(false)
  }

  const onApproveClick = async () => {
    setTxLoading(true)
    try {
      await logAndRunTransaction(async () => {
        await approveBull(() => console.log('Approved'))
      }, BULL_EVENTS.APPROVE_WITHDRAW_BULL)
    } catch (e) {
      console.log(e)
    }
    setTxLoading(false)
  }

  const withdrawError = useAppMemo(() => {
    if (withdrawAmountBN.gt(bullPositionValueInEth)) {
      return 'Withdraw amount greater than strategy balance'
    }
  }, [bullPositionValueInEth, withdrawAmountBN])

  const setWithdrawMax = () => {
    onInputChange(bullPositionValueInEth.toString())
  }

  return (
    <>
      <Box marginTop="32px" display="flex" justifyContent="space-between" alignItems="center" gridGap="12px">
        <Typography variant="h3" className={classes.subtitle}>
          Strategy Withdraw
        </Typography>
      </Box>

      <div className={classes.tradeContainer}>
        <InputToken
          id="bull-deposit-eth-input"
          value={withdrawAmount}
          onInputChange={onInputChange}
          balance={bullPositionValueInEth}
          logo={ethLogo}
          symbol={'ETH'}
          usdPrice={ethIndexPrice}
          error={!!withdrawError}
          helperText={withdrawError}
          onBalanceClick={setWithdrawMax}
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
        {withdrawFundingWarning ? (
          <div className={classes.notice}>
            <div className={classes.infoIcon}>
              <Tooltip
                title={
                  'Squeeth is currently more expensive than usual. The strategy buys back squeeth to withdraw. You can still withdraw, but you will pay more.'
                }
              >
                <InfoIcon fontSize="medium" />
              </Tooltip>
            </div>
            <Typography variant="caption" className={classes.infoText}>
              It is currently costly to withdraw. Consider withdrawing later.
            </Typography>
          </div>
        ) : null}

        {showPriceImpactWarning ? (
          <div className={classes.notice}>
            <div className={classes.infoIcon}>
              <Tooltip
                title={
                  'High price impact means that you are losing a significant amount of value due to the size of your trade. Withdrawing a smaller size can reduce your price impact.'
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
                value={formatNumber(quote.priceImpact) + '%'}
                isSmall
                flexDirection="row"
                justifyContent="space-between"
                gridGap="12px"
              />
              <TradeSettings
                setSlippage={(amt) => {
                  setSlippage(amt.toNumber())
                  onInputChange(withdrawAmount)
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
          ) : bullAllowance.lt(withdrawAmount) ? (
            <PrimaryButtonNew
              fullWidth
              id="bull-deposit-btn"
              variant={'contained'}
              onClick={onApproveClick}
              disabled={quoteLoading || txLoading}
            >
              {!txLoading ? 'Approve' : <CircularProgress color="primary" size="2rem" />}
            </PrimaryButtonNew>
          ) : (
            <PrimaryButtonNew
              fullWidth
              id="bull-deposit-btn"
              variant={'contained'}
              onClick={onWithdrawClick}
              disabled={quoteLoading || txLoading || !!withdrawError}
            >
              {!txLoading && !quoteLoading ? 'Withdraw' : <CircularProgress color="primary" size="2rem" />}
            </PrimaryButtonNew>
          )}
        </Box>
      </div>
    </>
  )
}

export default BullWithdraw
