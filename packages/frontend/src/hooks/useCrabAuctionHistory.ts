import { useQuery } from '@apollo/client'
import BigNumber from 'bignumber.js'

import { crabAuctions } from '../queries/squeeth/__generated__/crabAuctions'
import CRAB_AUCTION_QUERY from '../queries/squeeth/crabAuctionQuery'
import { toTokenAmount } from '@utils/calculations'
import { WETH_DECIMALS, OSQUEETH_DECIMALS } from '../constants'
import { squeethClient } from '@utils/apollo-client'
import { useWallet } from '@context/wallet'
import { CrabStrategyTxType } from '../types/index'

export const useCrabStrategyTxHistory = () => {
  const { networkId } = useWallet()
  const { data, loading } = useQuery<crabAuctions>(CRAB_AUCTION_QUERY, {
    fetchPolicy: 'cache-and-network',
    client: squeethClient[networkId],
  })

  const uiData = data?.crabAuctions.map((tx) => {
    const ethAmount = toTokenAmount(tx.ethAmount, WETH_DECIMALS)
    const oSqueethAmount = toTokenAmount(tx.squeethAmount, OSQUEETH_DECIMALS)

    return {
      ...tx,
      ethAmount,
      oSqueethAmount,
    }
  })

  return {
    loading,
    data: uiData,
  }
}
