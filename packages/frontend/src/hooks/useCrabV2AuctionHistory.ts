import { useQuery } from '@apollo/client'
import { useAtomValue } from 'jotai'

import { crabV2Auctions } from '../queries/squeeth/__generated__/crabV2Auctions'
import CRAB_V2_AUCTION_QUERY from '../queries/squeeth/crabV2AuctionQuery'
import { toTokenAmount } from '@utils/calculations'
import { WETH_DECIMALS, OSQUEETH_DECIMALS } from '../constants'
import { squeethClient } from '@utils/apollo-client'
import { networkIdAtom } from 'src/state/wallet/atoms'

export const useCrabStrategyV2TxHistory = () => {
  const networkId = useAtomValue(networkIdAtom)
  const { data, loading } = useQuery<crabV2Auctions>(CRAB_V2_AUCTION_QUERY, {
    fetchPolicy: 'cache-and-network',
    client: squeethClient[networkId],
  })

  const uiData = data?.hedgeOTCs!.map((tx) => {
    const oSqueethAmount = toTokenAmount(tx.quantity, OSQUEETH_DECIMALS)
    const clearingPrice = toTokenAmount(tx.clearingPrice, WETH_DECIMALS)
    const ethAmount = oSqueethAmount.times(clearingPrice)

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
