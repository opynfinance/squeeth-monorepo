import { BIG_ZERO } from '../../constants'
import { useEffect, useState } from 'react'
import { CrabStrategyTxType, CrabStrategyV2TxType } from '../../types'
import { toTokenAmount } from '@utils/calculations'
import { useAtomValue, useSetAtom } from 'jotai'
import { indexAtom } from 'src/state/controller/atoms'
import useAppCallback from '../useAppCallback'
import useAppMemo from '../useAppMemo'
import BigNumber from 'bignumber.js'
import {
  bullCurrentETHPositionAtom,
  bullDepositedETHAtom,
  bullDepositedUSDCAtom,
  bullEthPnlAtom,
  bullEthPnlPerctAtom,
  bullPositionLoadedAtom,
  isBullPositionRefetchingAtom,
  isBullReadyAtom,
} from '@state/bull/atoms'
import { useUserBullTxHistory } from '@hooks/useUserBullTxHistory'
import { useTokenBalance } from '@hooks/contracts/useTokenBalance'
import { addressesAtom } from '@state/positions/atoms'

/*
  depositedEth = Sum of deposited ethAmount - Sum of withdrawn ethAmount
  depositedUsd = Sum of deposited ethUsed - Sum of withdrawn ethUsd
  minCurrentEth = currentEth 
  minCurrentUsd = currentEth * indexPrice
  minPnlUsd = minCurrentUsd - depositedUsd
  minPnL = minPnlUsd / depositedUsd * 100
*/
export const useBullPosition = (user: string) => {
  const { bullStrategy } = useAtomValue(addressesAtom)
  const { refetch } = useTokenBalance(bullStrategy)

  const [txToSearch, setTxToSearch] = useState<string | undefined>(undefined)

  const isBullReady = useAtomValue(isBullReadyAtom)
  const bullCurrentEthValue = useAtomValue(bullCurrentETHPositionAtom)

  const setEthPnl = useSetAtom(bullEthPnlAtom)
  const setEthPnlPerct = useSetAtom(bullEthPnlPerctAtom)
  const setDepositedEth = useSetAtom(bullDepositedETHAtom)
  const setDepositedUsdc = useSetAtom(bullDepositedUSDCAtom)
  const setPositionLoaded = useSetAtom(bullPositionLoadedAtom)
  const setIsPositionRefetching = useSetAtom(isBullPositionRefetchingAtom)

  const { loading: txHistoryLoading, data: txHistoryData, startPolling, stopPolling } = useUserBullTxHistory(user, true)

  const index = useAtomValue(indexAtom)

  const { remainingDepositEth: depositedEth, remainingDepositUsd: depositedUsd } = useAppMemo(() => {
    if (txHistoryLoading || !txHistoryData) return { remainingDepositUsd: BIG_ZERO, remainingDepositEth: BIG_ZERO }
    const { totalSharesDeposited, totalSharesWithdrawn, totalUSDDeposit, totalETHDeposit } = txHistoryData?.reduce(
      (acc, tx) => {
        if (tx.type === CrabStrategyV2TxType.FLASH_DEPOSIT) {
          acc.totalSharesDeposited = acc.totalSharesDeposited.plus(tx.bullAmount)
          acc.totalUSDDeposit = acc.totalUSDDeposit.plus(tx.ethUsdValue)
          acc.totalETHDeposit = acc.totalETHDeposit.plus(tx.ethAmount)
        } else if (tx.type === CrabStrategyV2TxType.FLASH_WITHDRAW) {
          acc.totalSharesWithdrawn = acc.totalSharesWithdrawn.plus(tx.bullAmount)
        }

        return acc
      },
      {
        totalSharesDeposited: BIG_ZERO,
        totalSharesWithdrawn: BIG_ZERO,
        totalUSDDeposit: BIG_ZERO,
        totalETHDeposit: BIG_ZERO,
      },
    )

    const remainingShares = new BigNumber(1).minus(totalSharesWithdrawn.div(totalSharesDeposited))
    const remainingDepositUsd = remainingShares.multipliedBy(totalUSDDeposit)
    const remainingDepositEth = remainingShares.multipliedBy(totalETHDeposit)

    return { remainingDepositUsd, remainingDepositEth }
  }, [txHistoryData, txHistoryLoading])

  const setPnL = useAppCallback(() => {
    const _ethPnl = bullCurrentEthValue.minus(depositedEth)
    const _ethPnlInPerct = bullCurrentEthValue.dividedBy(depositedEth).minus(1).times(100)
    setEthPnl(_ethPnl)
    setEthPnlPerct(_ethPnlInPerct)
    setDepositedEth(depositedEth)
    setDepositedUsdc(depositedUsd)
    setPositionLoaded(true)
  }, [bullCurrentEthValue, depositedEth, depositedUsd])

  useEffect(() => {
    if (!txToSearch) stopPolling()

    const match = txHistoryData?.find((tx) => tx.id.toLowerCase() === txToSearch)
    if (match) {
      refetch(() => {
        setIsPositionRefetching(false)
      })
      setTxToSearch(undefined)
    }
  }, [refetch, setIsPositionRefetching, stopPolling, txHistoryData, txToSearch])

  const pollForNewTx = useAppCallback(
    (tx: string) => {
      setIsPositionRefetching(true)
      setTxToSearch(tx)
      startPolling(500)
    },
    [setIsPositionRefetching, startPolling],
  )

  useEffect(() => {
    if (isBullReady && !txHistoryLoading) setPnL()
  }, [isBullReady, setPnL, txHistoryLoading])

  return {
    pollForNewTx,
  }
}

/*
AC:
loading
  should be true if either transaction history or crab is loading.
  should be false if both of them are loaded

depositedEth and depositedUsd
  should be zero if transaction history is loading.
  should be caculated as correct values if transaction history is loaded

minCurrentEth and minCurrentUsd
  should be zero if either transaction history or crab is loading.
  should be caculated as correct values if both of them are loaded

minPnL and minPnlUsd
  same as above


Dependencies:
  crabLoadingAtom
  currentEthValueAtom
  indexAtom
  useUserCrabTxHistory
*/
