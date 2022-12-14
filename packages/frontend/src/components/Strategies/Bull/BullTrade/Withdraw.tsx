import { PrimaryButtonNew } from '@components/Button'
import { InputToken } from '@components/InputNew'
import { LinkWrapper } from '@components/LinkWrapper'
import Metric from '@components/Metric'
import RestrictionInfo from '@components/RestrictionInfo'
import { TradeSettings } from '@components/TradeSettings'
import { BIG_ZERO, WETH_DECIMALS } from '@constants/index'
import { Box, Typography, Tooltip, CircularProgress } from '@material-ui/core'
import { useGetFlashWithdrawParams, useBullFlashWithdraw } from '@state/bull/hooks'
import { indexAtom } from '@state/controller/atoms'
import { useSelectWallet } from '@state/wallet/hooks'
import { toTokenAmount } from '@utils/calculations'
import { formatNumber } from '@utils/formatter'
import BigNumber from 'bignumber.js'
import { useAtom, useAtomValue } from 'jotai'
import { useCallback, useRef, useState } from 'react'
import { useZenBullStyles } from './styles'
import ethLogo from 'public/images/eth-logo.svg'
import InfoIcon from '@material-ui/icons/Info'
import debounce from 'lodash/debounce'
import { crabStrategySlippageAtomV2 } from '@state/crab/atoms'
import { useTokenBalance } from '@hooks/contracts/useTokenBalance'
import { addressesAtom } from '@state/positions/atoms'
import { useUserAllowance } from '@hooks/contracts/useAllowance'
import { useRestrictUser } from '@context/restrict-user'
import { connectedWalletAtom, supportedNetworkAtom } from '@state/wallet/atoms'
import { bullCurrentETHPositionAtom } from '@state/bull/atoms'
import { BullTradeType, BullTransactionConfirmation } from './index'

const BullWithdraw: React.FC<{ onTxnConfirm: (txn: BullTransactionConfirmation) => void }> = ({ onTxnConfirm }) => {
  const classes = useZenBullStyles()

  const withdrawAmountRef = useRef('0')
  const ongoingTransactionAmountRef = useRef(new BigNumber(0))
  const [withdrawAmount, setWithdrawAmount] = useState('0')
  const [txLoading, setTxLoading] = useState(false)

  const [slippage, setSlippage] = useAtom(crabStrategySlippageAtomV2)
  const [quoteLoading, setQuoteLoading] = useState(false)

  const negativeReturnsError = false
  const highDepositWarning = false
  const { isRestricted } = useRestrictUser()
  const connected = useAtomValue(connectedWalletAtom)
  const supportedNetwork = useAtomValue(supportedNetworkAtom)
  const bullPositionValueInEth = useAtomValue(bullCurrentETHPositionAtom)

  const selectWallet = useSelectWallet()

  const index = useAtomValue(indexAtom)
  const ethIndexPrice = toTokenAmount(index, 18).sqrt()

  const { bullStrategy, flashBull } = useAtomValue(addressesAtom)
  const { value: bullBalance } = useTokenBalance(bullStrategy, 15, WETH_DECIMALS)
  const { allowance: bullAllowance, approve: approveBull } = useUserAllowance(bullStrategy, flashBull)

  const [quote, setQuote] = useState({
    maxEthForWPowerPerp: BIG_ZERO,
    maxEthForUsdc: BIG_ZERO,
    wPowerPerpPoolFee: 0,
    usdcPoolFee: 0,
    priceImpact: 0,
  })

  const getFlashBullWithdrawParams = useGetFlashWithdrawParams()
  const bullFlashWithdraw = useBullFlashWithdraw()

  const debouncedDepositQuote = debounce(async (bullToWithdraw: string) => {
    setQuoteLoading(true)
    getFlashBullWithdrawParams(new BigNumber(bullToWithdraw))
      .then((_quote) => {
        if (bullToWithdraw === withdrawAmountRef.current) setQuote(_quote)
      })
      .finally(() => {
        if (bullToWithdraw === withdrawAmountRef.current) setQuoteLoading(false)
      })
  }, 500)

  const onInputChange = (ethToWithdraw: string) => {
    const _bullToWithdraw = new BigNumber(ethToWithdraw).div(bullPositionValueInEth).times(bullBalance)
    console.log('_bullToWithdraw', _bullToWithdraw.toString())
    setWithdrawAmount(ethToWithdraw)
    withdrawAmountRef.current = _bullToWithdraw.toString()
    debouncedDepositQuote(_bullToWithdraw.toString())
  }

  const onTxnConfirmed = useCallback(() => {
    withdrawAmountRef.current = '0'
    setWithdrawAmount('0')
    onTxnConfirm({
      status: true,
      amount: ongoingTransactionAmountRef.current,
      tradeType: BullTradeType.Withdraw,
    })
    ongoingTransactionAmountRef.current = new BigNumber(0)
  }, [onTxnConfirm])

  const onWithdrawClick = async () => {
    setTxLoading(true)
    try {
      ongoingTransactionAmountRef.current = new BigNumber(withdrawAmountRef.current)
      console.log('withdrawAmountRef.current', withdrawAmountRef.current)
      await bullFlashWithdraw(
        new BigNumber(withdrawAmountRef.current),
        quote.maxEthForWPowerPerp,
        quote.maxEthForUsdc,
        quote.wPowerPerpPoolFee,
        quote.usdcPoolFee,
        onTxnConfirmed,
      )
    } catch (e) {
      console.log(e)
    }
    setTxLoading(false)
  }

  const onApproveClick = async () => {
    setTxLoading(true)
    try {
      await approveBull(() => console.log('Approved'))
    } catch (e) {
      console.log(e)
    }
    setTxLoading(false)
  }

  return (
    <>
      <Box marginTop="32px" display="flex" justifyContent="space-between" alignItems="center" gridGap="12px">
        <Typography variant="h4" className={classes.subtitle}>
          Strategy withdraw
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
          error={false}
          helperText={``}
          balanceLabel="Balance"
          isLoading={quoteLoading}
          loadingMessage="Fetching best price"
          onBalanceClick={() => onInputChange(bullPositionValueInEth.toString())}
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
        {highDepositWarning ? (
          <div className={classes.notice}>
            <div className={classes.infoIcon}>
              <Tooltip title={'Too high deposit warning'}>
                <InfoIcon fontSize="medium" />
              </Tooltip>
            </div>
            <Typography variant="caption" className={classes.infoText}>
              Too high deposit warning
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
              label="Slippage"
              value={formatNumber(slippage) + '%'}
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
              disabled={quoteLoading || txLoading}
            >
              {!txLoading ? 'Withdraw' : <CircularProgress color="primary" size="2rem" />}
            </PrimaryButtonNew>
          )}
        </Box>
      </div>
    </>
  )
}

export default BullWithdraw
