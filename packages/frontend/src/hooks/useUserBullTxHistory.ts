import { useQuery } from '@apollo/client'
import { userBullTxes, userBullTxesVariables } from '../queries/squeeth/__generated__/userBullTxes'
import USER_BULL_TX_QUERY from '../queries/squeeth/userBullQuery'
import { toTokenAmount } from '@utils/calculations'
import { WETH_DECIMALS } from '../constants'
import { squeethClient } from '@utils/apollo-client'
import { CrabStrategyV2TxType } from '../types/index'
import { networkIdAtom } from 'src/state/wallet/atoms'
import { useAtomValue } from 'jotai'
import useAppMemo from './useAppMemo'
import { getHistoricEthPrices } from './useETHPrice'
import { useCallback, useEffect, useState } from 'react'

const getTxTitle = (type: string) => {
  if (type === CrabStrategyV2TxType.FLASH_DEPOSIT) return 'Flash Deposit'
  if (type === CrabStrategyV2TxType.FLASH_WITHDRAW) return 'Flash Withdraw'
}

export const useUserBullTxHistory = (user: string, isDescending?: boolean) => {
  const networkId = useAtomValue(networkIdAtom)
  const [ethUsdPriceMap, setEthUsdPriceMap] = useState()
  const [ethUsdPriceMapLoading, setEthUsdPriceMapLoading] = useState(true)
  const { data, loading, startPolling, stopPolling } = useQuery<userBullTxes, userBullTxesVariables>(
    USER_BULL_TX_QUERY,
    {
      fetchPolicy: 'cache-and-network',
      client: squeethClient[networkId],
      variables: {
        ownerId: user ?? '',
        orderDirection: isDescending ? 'desc' : 'asc',
      },
    },
  )

  //get all timestamps found in the user's history once
  useEffect(() => {
    let timestampsArr: any[] = []
    timestampsArr = data?.bullUserTxes ? data?.bullUserTxes.map((tx) => tx.timestamp * 1000) : []
    if (timestampsArr.length > 0) {
      getHistoricEthPrices(timestampsArr).then((result) => {
        setEthUsdPriceMap(result ?? undefined)
        setEthUsdPriceMapLoading(false)
      })
    } else {
      setEthUsdPriceMapLoading(false)
    }
  }, [data?.bullUserTxes])

  const getEthPrice = useCallback(
    (timestamp) => {
      return ethUsdPriceMap ? ethUsdPriceMap![Number(timestamp) * 1000] : 0
    },
    [ethUsdPriceMap],
  )

  const uiData = useAppMemo(
    () =>
      data?.bullUserTxes.map((tx) => {
        const ethAmount = toTokenAmount(tx.ethAmount, WETH_DECIMALS)
        const ethUsdValue = ethAmount.multipliedBy(getEthPrice(tx.timestamp))

        const bullAmount = toTokenAmount(tx.bullAmount, WETH_DECIMALS)

        return {
          ...tx,
          ethAmount,
          bullAmount,
          ethUsdValue,
          txTitle: getTxTitle(tx.type),
        }
      }),
    [data?.bullUserTxes, getEthPrice],
  )

  return {
    loading: loading || ethUsdPriceMapLoading,
    data: uiData,
    startPolling,
    stopPolling,
  }
}
