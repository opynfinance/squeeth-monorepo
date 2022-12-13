import { PrimaryButtonNew } from '@components/Button'
import { InputToken } from '@components/InputNew'
import { LinkWrapper } from '@components/LinkWrapper'
import Metric from '@components/Metric'
import RestrictionInfo from '@components/RestrictionInfo'
import { TradeSettings } from '@components/TradeSettings'
import { BIG_ZERO } from '@constants/index'
import { Box, Typography, Tooltip, CircularProgress } from '@material-ui/core'
import { useGetFlashBulldepositParams, useBullFlashDeposit } from '@state/bull/hooks'
import { indexAtom } from '@state/controller/atoms'
import { useSelectWallet, useWalletBalance } from '@state/wallet/hooks'
import { toTokenAmount } from '@utils/calculations'
import { formatNumber } from '@utils/formatter'
import BigNumber from 'bignumber.js'
import { useAtom, useAtomValue } from 'jotai'
import { useRef, useState } from 'react'
import { useZenBullStyles } from './styles'
import ethLogo from 'public/images/eth-logo.svg'
import InfoIcon from '@material-ui/icons/Info'
import debounce from 'lodash/debounce'
import { connectedWalletAtom, supportedNetworkAtom } from '@state/wallet/atoms'
import { useRestrictUser } from '@context/restrict-user'
import { crabStrategySlippageAtomV2 } from '@state/crab/atoms'

const BullDepsoit: React.FC = () => {
  const classes = useZenBullStyles()

  const depositAmountRef = useRef('0')
  const [depositAmount, setDepositAmount] = useState('0')
  const [txLoading, setTxLoading] = useState(false)

  const [slippage, setSlippage] = useAtom(crabStrategySlippageAtomV2)
  const [quoteLoading, setQuoteLoading] = useState(false)

  const negativeReturnsError = false
  const highDepositWarning = false
  const { isRestricted } = useRestrictUser()
  const connected = useAtomValue(connectedWalletAtom)
  const supportedNetwork = useAtomValue(supportedNetworkAtom)

  const selectWallet = useSelectWallet()

  const index = useAtomValue(indexAtom)
  const ethIndexPrice = toTokenAmount(index, 18).sqrt()

  const [quote, setQuote] = useState({
    ethToCrab: BIG_ZERO,
    minEthFromSqth: BIG_ZERO,
    minEthFromUsdc: BIG_ZERO,
    wPowerPerpPoolFee: 0,
    usdcPoolFee: 0,
    priceImpact: 0,
  })

  const { data: balance } = useWalletBalance()

  const getFlashBullDepositParams = useGetFlashBulldepositParams()
  const bullFlashDeposit = useBullFlashDeposit()

  const debouncedDepositQuote = debounce(async (ethToDeposit: string) => {
    setQuoteLoading(true)
    getFlashBullDepositParams(new BigNumber(ethToDeposit))
      .then((_quote) => {
        console.log('', ethToDeposit.toString(), depositAmountRef.current)
        if (ethToDeposit === depositAmountRef.current) setQuote(_quote)
      })
      .finally(() => {
        if (ethToDeposit === depositAmountRef.current) setQuoteLoading(false)
      })
  }, 500)

  const onInputChange = (ethToDeposit: string) => {
    setDepositAmount(ethToDeposit)
    depositAmountRef.current = ethToDeposit
    debouncedDepositQuote(ethToDeposit)
  }

  const onDepositClick = async () => {
    setTxLoading(true)
    try {
      await bullFlashDeposit(
        quote.ethToCrab,
        quote.minEthFromSqth,
        quote.minEthFromUsdc,
        quote.wPowerPerpPoolFee,
        quote.usdcPoolFee,
        new BigNumber(depositAmountRef.current),
      )
    } catch (e) {
      console.log(e)
    }
    setTxLoading(false)
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
          error={false}
          helperText={``}
          balanceLabel="Balance"
          isLoading={quoteLoading}
          loadingMessage="Fetching best price"
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
              disabled={quoteLoading || txLoading || depositAmount === '0'}
            >
              {!txLoading ? 'Deposit' : <CircularProgress color="primary" size="1.5rem" />}
            </PrimaryButtonNew>
          )}
        </Box>
      </div>
    </>
  )
}

export default BullDepsoit
