import { useQuery } from '@apollo/client'
import { userCrabV2Txes, userCrabV2TxesVariables } from '../queries/squeeth/__generated__/userCrabV2Txes'
import USER_CRAB_V2_TX_QUERY from '../queries/squeeth/userCrabV2TxQuery'
import { toTokenAmount } from '@utils/calculations'
import { WETH_DECIMALS, OSQUEETH_DECIMALS } from '../constants'
import { squeethClient } from '@utils/apollo-client'
import { CrabStrategyV2TxType } from '../types/index'
import { useUsdAmount } from './useUsdAmount'
import { networkIdAtom } from 'src/state/wallet/atoms'
import { useAtomValue } from 'jotai'

const getTxTitle = (type: string) => {
  if (type === CrabStrategyV2TxType.DEPOSIT) return 'Deposit'
  if (type === CrabStrategyV2TxType.WITHDRAW) return 'Withdraw'
  if (type === CrabStrategyV2TxType.FLASH_DEPOSIT) return 'Flash Deposit'
  if (type === CrabStrategyV2TxType.FLASH_WITHDRAW) return 'Flash Withdraw'
}

export const useUserCrabV2TxHistory = (user: string, isDescending?: boolean) => {
  const networkId = useAtomValue(networkIdAtom)
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

  const uiData = data?.crabUserTxes.map((tx) => {
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
