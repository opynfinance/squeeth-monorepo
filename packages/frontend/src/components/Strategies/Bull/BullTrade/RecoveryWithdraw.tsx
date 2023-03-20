import React, { useCallback, useState } from 'react'
import { Box, Typography, Link, CircularProgress } from '@material-ui/core'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import { useAtom, useAtomValue } from 'jotai'
import BigNumber from 'bignumber.js'
import clsx from 'clsx'

import { InputToken } from '@components/InputNew'
import Metric from '@components/Metric'
import { TradeSettings } from '@components/TradeSettings'
import { PrimaryButtonNew } from '@components/Button'
import RestrictionInfo from '@components/RestrictionInfo'
import { crabStrategySlippageAtomV2 } from '@state/crab/atoms'
import { indexAtom } from '@state/controller/atoms'
import { useSelectWallet } from '@state/wallet/hooks'
import { connectedWalletAtom, supportedNetworkAtom } from '@state/wallet/atoms'
import { addressesAtom } from '@state/positions/atoms'
import { addressAtom } from '@state/wallet/atoms'
import useAppCallback from '@hooks/useAppCallback'
import { useUserAllowance } from '@hooks/contracts/useAllowance'
import useTrackTransactionFlow from '@hooks/useTrackTransactionFlow'
import { useBullPosition } from '@hooks/useBullPosition'
import { useRestrictUser } from '@context/restrict-user'
import { toTokenAmount } from '@utils/calculations'
import { formatNumber } from '@utils/formatter'
import { BULL_EVENTS } from '@utils/amplitude'
import ethLogo from 'public/images/eth-logo.svg'
import { useZenBullStyles } from './styles'

const useStyles = makeStyles((theme) =>
  createStyles({
    description: {
      marginTop: theme.spacing(1),
      marginBottom: theme.spacing(3),
    },
  }),
)

const RecoveryWithdraw: React.FC = () => {
  const zenBullClasses = useZenBullStyles()
  const classes = useStyles()

  const [withdrawEthAmount, setWithdrawEthAmount] = useState('0')
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [quote, setQuote] = useState({
    priceImpact: 0,
    poolFee: 0,
  })
  const [txLoading, setTxLoading] = useState(false)

  const [slippage, setSlippage] = useAtom(crabStrategySlippageAtomV2)
  const index = useAtomValue(indexAtom)
  const connected = useAtomValue(connectedWalletAtom)
  const supportedNetwork = useAtomValue(supportedNetworkAtom)
  const { bullStrategy, bullEmergencyWithdraw } = useAtomValue(addressesAtom)

  const bullPositionValueInEth = new BigNumber(100)
  const logAndRunTransaction = useTrackTransactionFlow()

  const onInputChange = useAppCallback((ethToWithdraw: string) => {
    setWithdrawEthAmount(ethToWithdraw)
  }, [])

  const setWithdrawMax = useAppCallback(() => {
    onInputChange(bullPositionValueInEth.toString())
  }, [bullPositionValueInEth, onInputChange])

  const onChangeSlippage = useCallback(
    (amount: BigNumber) => {
      setSlippage(amount.toNumber())
      onInputChange(withdrawEthAmount)
    },
    [setSlippage, onInputChange, withdrawEthAmount],
  )

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

  const onWithdrawClick = async () => {
    setTxLoading(true)
    try {
      console.log('withdrawing...')
    } catch (e) {
      console.log(e)
    }
    setTxLoading(false)
  }

  const withdrawError = null

  const { isRestricted } = useRestrictUser()
  const selectWallet = useSelectWallet()
  const { allowance: bullAllowance, approve: approveBull } = useUserAllowance(bullStrategy, bullEmergencyWithdraw)

  const ethIndexPrice = toTokenAmount(index, 18).sqrt()

  return (
    <>
      <Typography variant="h3" className={zenBullClasses.subtitle}>
        Recovery Withdrawal
      </Typography>

      <Typography variant="body2" className={classes.description}>
        Use recovery withdrawal to withdraw the Crab portion of a Zen Bull position.{' '}
        <Link href="https://opyn.gitbook.io/squeeth-faq/squeeth/beginner-squeeth-faq" target="_blank">
          Learn more.
        </Link>
      </Typography>

      <div className={zenBullClasses.tradeContainer}>
        <InputToken
          id="bull-withdraw-eth-input"
          value={withdrawEthAmount}
          onInputChange={onInputChange}
          balance={bullPositionValueInEth}
          logo={ethLogo}
          symbol={'ETH'}
          usdPrice={ethIndexPrice}
          error={!!withdrawError}
          helperText={withdrawError}
          onBalanceClick={setWithdrawMax}
        />

        <Box display="flex" flexDirection="column" gridGap="12px" marginTop="24px">
          <Box
            display="flex"
            alignItems="center"
            justifyContent="space-between"
            gridGap="12px"
            className={zenBullClasses.slippageContainer}
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
              <TradeSettings setSlippage={onChangeSlippage} slippage={new BigNumber(slippage)} />
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
          ) : bullAllowance.lt(withdrawEthAmount) ? (
            <PrimaryButtonNew
              fullWidth
              id="bull-deposit-btn"
              variant={'contained'}
              onClick={onApproveClick}
              disabled={quoteLoading || txLoading || !!withdrawError}
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

const Wrapper: React.FC = () => {
  const address = useAtomValue(addressAtom)
  useBullPosition(address ?? '')

  return <RecoveryWithdraw />
}

export default Wrapper
