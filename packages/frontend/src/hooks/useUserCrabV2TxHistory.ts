import { useQuery } from '@apollo/client'
import { userCrabV2Txes, userCrabV2TxesVariables } from '../queries/squeeth/__generated__/userCrabV2Txes'
import USER_CRAB_V2_TX_QUERY from '../queries/squeeth/userCrabV2TxQuery'
import { toTokenAmount } from '@utils/calculations'
import {
  WETH_DECIMALS,
  OSQUEETH_DECIMALS,
  V2_MIGRATION_ETH_AMOUNT,
  V2_MIGRATION_SUPPLY,
  V2_MIGRATION_OSQTH_AMOUNT,
  V2_MIGRATION_OSQTH_PRICE,
  V2_MIGRATION_ETH_PRICE,
  USDC_DECIMALS,
} from '../constants'
import { squeethClient } from '@utils/apollo-client'
import { CrabStrategyV2TxType } from '../types/index'
import { useUsdAmount } from './useUsdAmount'
import { networkIdAtom } from 'src/state/wallet/atoms'
import { useAtomValue } from 'jotai'
import useAppMemo from './useAppMemo'
import BigNumber from 'bignumber.js'
import { addressesAtom } from 'src/state/positions/atoms'

const getTxTitle = (type: string) => {
  if (type === CrabStrategyV2TxType.DEPOSIT) return 'Deposit'
  if (type === CrabStrategyV2TxType.WITHDRAW) return 'Withdraw'
  if (type === CrabStrategyV2TxType.FLASH_DEPOSIT) return 'Flash Deposit'
  if (type === CrabStrategyV2TxType.FLASH_WITHDRAW) return 'Flash Withdraw'
  if (type === CrabStrategyV2TxType.DEPOSIT_V1) return 'Deposit v1 shares'
}

export const useUserCrabV2TxHistory = (user: string, isDescending?: boolean) => {
  const networkId = useAtomValue(networkIdAtom)
  const { usdc } = useAtomValue(addressesAtom)
  const { getUsdAmt } = useUsdAmount()
  const { data, loading, startPolling, stopPolling } = useQuery<userCrabV2Txes, userCrabV2TxesVariables>(
    USER_CRAB_V2_TX_QUERY,
    {
      fetchPolicy: 'cache-and-network',
      client: squeethClient[networkId],
      variables: {
        ownerId: user ?? '',
        orderDirection: isDescending ? 'desc' : 'asc',
      },
    },
  )

  const uiData = useAppMemo(
    () =>
      data?.crabUserTxes.map((tx) => {
        let ethAmount = toTokenAmount(tx.ethAmount, WETH_DECIMALS)
        let ethUsdValue = getUsdAmt(ethAmount, tx.timestamp)

        if (tx.type === CrabStrategyV2TxType.DEPOSIT_V1) {
          const ethMigrated = new BigNumber(V2_MIGRATION_ETH_AMOUNT)
          const oSqthMigrated = new BigNumber(V2_MIGRATION_OSQTH_AMOUNT)

          ethAmount = ethMigrated
            .minus(oSqthMigrated.times(V2_MIGRATION_OSQTH_PRICE))
            .times(toTokenAmount(tx.lpAmount, WETH_DECIMALS))
            .div(V2_MIGRATION_SUPPLY)

          ethUsdValue = ethAmount.times(V2_MIGRATION_ETH_PRICE)
        }
        if (tx.type === CrabStrategyV2TxType.FLASH_WITHDRAW && usdc.toLowerCase() === tx.erc20Token?.toLowerCase()) {
          ethUsdValue = toTokenAmount(tx.erc20Amount, USDC_DECIMALS)
        } else if (
          tx.type === CrabStrategyV2TxType.FLASH_DEPOSIT &&
          usdc.toLowerCase() === tx.erc20Token?.toLowerCase()
        ) {
          ethUsdValue = toTokenAmount(tx.erc20Amount, USDC_DECIMALS).minus(
            getUsdAmt(toTokenAmount(tx.excessEth, 18), tx.timestamp),
          )
        }
        const lpAmount = toTokenAmount(tx.lpAmount, WETH_DECIMALS)
        const oSqueethAmount = toTokenAmount(tx.wSqueethAmount, OSQUEETH_DECIMALS)

        return {
          ...tx,
          ethAmount,
          lpAmount,
          oSqueethAmount,
          ethUsdValue,
          txTitle: getTxTitle(tx.type),
        }
      }),
    [data?.crabUserTxes, getUsdAmt, usdc],
  )

  return {
    loading,
    data: uiData,
    startPolling,
    stopPolling,
  }
}
