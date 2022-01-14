import { useQuery } from '@apollo/client'
import BigNumber from 'bignumber.js'

import { crabStrategyTxes } from '../queries/squeeth/__generated__/crabStrategyTxes'
import CRAB_STRATEGY_TX_QUERY from '../queries/squeeth/crabStrategyTxQuery'
import { toTokenAmount } from '@utils/calculations'
import { WETH_DECIMALS, OSQUEETH_DECIMALS } from '../constants'
import { squeethClient } from '@utils/apollo-client'
import { useWallet } from '@context/wallet'
import { CrabStrategyTxType } from '../types/index'

const getTxTitle = (type: string) => {
  if (type === CrabStrategyTxType.DEPOSIT) return 'Deposit'
  if (type === CrabStrategyTxType.WITHDRAW) return 'Withdraw'
  if (type === CrabStrategyTxType.FLASH_DEPOSIT) return 'Flash Deposit'
  if (type === CrabStrategyTxType.FLASH_WITHDRAW) return 'Flash Withdraw'
  if (type === CrabStrategyTxType.HEDGE_ON_UNISWAP) return 'Hedge on Uniswap'
  if (type === CrabStrategyTxType.HEDGE) return 'Hedge'
}

export const useCrabStrategyTxHistory = () => {
  const { networkId } = useWallet()
  const { data, loading } = useQuery<crabStrategyTxes>(CRAB_STRATEGY_TX_QUERY, {
    fetchPolicy: 'cache-and-network',
    client: squeethClient[networkId],
  })

  const uiData = data?.crabStrategyTxes.map((tx) => {
    const ethAmount = toTokenAmount(tx.ethAmount, WETH_DECIMALS)
    const lpAmount = toTokenAmount(tx.lpAmount, WETH_DECIMALS)
    const oSqueethAmount = toTokenAmount(tx.wSqueethAmount, OSQUEETH_DECIMALS)

    return {
      ...tx,
      ethAmount,
      lpAmount,
      oSqueethAmount,
      txTitle: getTxTitle(tx.type),
    }
  })

  return {
    loading,
    data: uiData,
  }
}
