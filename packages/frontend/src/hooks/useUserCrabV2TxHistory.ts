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
  BIG_ONE,
} from '../constants'
import { squeethClient } from '@utils/apollo-client'
import { CrabStrategyV2TxType } from '../types/index'
import { networkIdAtom } from 'src/state/wallet/atoms'
import { useAtomValue } from 'jotai'
import useAppMemo from './useAppMemo'
import BigNumber from 'bignumber.js'
import { addressesAtom } from 'src/state/positions/atoms'
import { getHistoricEthPrices } from './useETHPrice'
import { useEffect, useState } from 'react'

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
  const [ethUsdPriceMap, setEthUsdPriceMap] = useState()
  const [ethUsdPriceMapLoading, setEthUsdPriceMapLoading] = useState(true)
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

  //get all timestamps found in the user's history once
  useEffect(() => {
    let timestampsArr: any[] = []
    timestampsArr = data?.crabUserTxes ? data?.crabUserTxes.map((tx) => tx.timestamp * 1000) : []
    if (timestampsArr.length > 0) {
      getHistoricEthPrices(timestampsArr)
        .then((result) => {
          setEthUsdPriceMap(result ?? undefined)
        })
        .finally(() => {
          setEthUsdPriceMapLoading(false)
        })
    } else {
      setEthUsdPriceMapLoading(false)
    }
  }, [data?.crabUserTxes, usdc])

  const uiData = useAppMemo(
    () =>
      ethUsdPriceMap
        ? data?.crabUserTxes.map((tx) => {
            let ethAmount = toTokenAmount(tx.ethAmount, WETH_DECIMALS)
            let ethUsdValue = ethUsdPriceMap ? ethAmount.multipliedBy(ethUsdPriceMap![Number(tx.timestamp) * 1000]) : 0

            if (tx.type === CrabStrategyV2TxType.DEPOSIT_V1) {
              const ethMigrated = new BigNumber(V2_MIGRATION_ETH_AMOUNT)
              const oSqthMigrated = new BigNumber(V2_MIGRATION_OSQTH_AMOUNT)

              ethAmount = ethMigrated
                .minus(oSqthMigrated.times(V2_MIGRATION_OSQTH_PRICE))
                .times(toTokenAmount(tx.lpAmount, WETH_DECIMALS))
                .div(V2_MIGRATION_SUPPLY)

              ethUsdValue = ethAmount.times(V2_MIGRATION_ETH_PRICE)
            }
            if (
              tx.type === CrabStrategyV2TxType.FLASH_WITHDRAW &&
              usdc.toLowerCase() === tx.erc20Token?.toLowerCase()
            ) {
              ethUsdValue = toTokenAmount(tx.erc20Amount, USDC_DECIMALS)
            } else if (
              tx.type === CrabStrategyV2TxType.FLASH_DEPOSIT &&
              usdc.toLowerCase() === tx.erc20Token?.toLowerCase()
            ) {
              ethUsdValue = toTokenAmount(tx.erc20Amount, USDC_DECIMALS).minus(
                ethUsdPriceMap
                  ? toTokenAmount(tx.excessEth, 18).multipliedBy(ethUsdPriceMap![Number(tx.timestamp) * 1000])
                  : 0,
              )
            }
            if (tx.type === CrabStrategyV2TxType.OTC_DEPOSIT || tx.type === CrabStrategyV2TxType.OTC_WITHDRAW) {
              ethUsdValue = toTokenAmount(tx.erc20Amount, USDC_DECIMALS).minus(
                toTokenAmount(tx.ethAmount, 18).multipliedBy(
                  ethUsdPriceMap ? ethUsdPriceMap![Number(tx.timestamp) * 1000] : 0,
                ),
              )
              ethAmount = toTokenAmount(tx.erc20Amount, USDC_DECIMALS).div(
                toTokenAmount(BIG_ONE, 18).multipliedBy(
                  ethUsdPriceMap ? ethUsdPriceMap![Number(tx.timestamp) * 1000] : 0,
                ),
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
          })
        : [],
    [data?.crabUserTxes, usdc, ethUsdPriceMap],
  )

  return {
    loading: loading || ethUsdPriceMapLoading,
    data: uiData,
    startPolling,
    stopPolling,
  }
}
