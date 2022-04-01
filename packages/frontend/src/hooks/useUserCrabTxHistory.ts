import { useQuery } from '@apollo/client'
import { userCrabTxes, userCrabTxesVariables } from '../queries/squeeth/__generated__/userCrabTxes'
import USER_CRAB_TX_QUERY from '../queries/squeeth/userCrabTxQuery'
import { toTokenAmount } from '@utils/calculations'
import { WETH_DECIMALS, OSQUEETH_DECIMALS } from '../constants'
import { squeethClient } from '@utils/apollo-client'
import { CrabStrategyTxType } from '../types/index'
import { useUsdAmount } from './useUsdAmount'
import { networkIdAtom } from 'src/state/wallet/atoms'
import { useAtomValue } from 'jotai'

const getTxTitle = (type: string) => {
  if (type === CrabStrategyTxType.DEPOSIT) return 'Deposit'
  if (type === CrabStrategyTxType.WITHDRAW) return 'Withdraw'
  if (type === CrabStrategyTxType.FLASH_DEPOSIT) return 'Flash Deposit'
  if (type === CrabStrategyTxType.FLASH_WITHDRAW) return 'Flash Withdraw'
  if (type === CrabStrategyTxType.HEDGE_ON_UNISWAP) return 'Hedge on Uniswap'
  if (type === CrabStrategyTxType.HEDGE) return 'Hedge'
}

export const useUserCrabTxHistory = (user: string, isDescending?: boolean) => {
  const networkId = useAtomValue(networkIdAtom)
  const { getUsdAmt } = useUsdAmount()
  const { data, loading, startPolling, stopPolling } = useQuery<userCrabTxes, userCrabTxesVariables>(
    USER_CRAB_TX_QUERY,
    {
      fetchPolicy: 'cache-and-network',
      client: squeethClient[networkId],
      variables: {
        ownerId: user ?? '',
        orderDirection: isDescending ? 'desc' : 'asc',
      },
    },
  )

  const uiData = data?.crabStrategyTxes.map((tx) => {
    const ethAmount = toTokenAmount(tx.ethAmount, WETH_DECIMALS)
    const ethUsdValue = getUsdAmt(ethAmount, tx.timestamp)
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
  })

  return {
    loading,
    data: uiData,
    startPolling,
    stopPolling,
  }
}
