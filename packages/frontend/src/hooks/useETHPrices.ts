import { useQuery } from '@apollo/client'
import { uniswapClient } from '@utils/apollo-client'
import { useWallet } from '@context/wallet'
import { ETHPRICE_QUERY } from '../queries/uniswap/ethPriceQuery'
import { useEffect, useState } from 'react'

export interface TxItem {
  timestamp: string
  blockNo: number
}

export const useETHPrices = (items: TxItem[] | undefined) => {
  const { networkId } = useWallet()
  const [skipCount, setSkipCount] = useState(0)
  const [ethPrices, setETHPrices] = useState<any[]>([])
  const blockNo = items && items.length > 0 ? items[0].blockNo : 0
  const { data, loading } = useQuery(ETHPRICE_QUERY, {
    variables: {
      blockNo,
    },
    client: uniswapClient[networkId],
    fetchPolicy: 'cache-and-network',
  })

  console.log('ccc', loading, data, ' ', blockNo)

  // useEffect(() => {
  //   if (!loading) {
  //     if (data && data['normalizationFactorUpdates'].length > 0) {
  //       const normHistoryItems = normHistory
  //       setNormHistory(
  //         normHistoryItems
  //           .concat(data['normalizationFactorUpdates'])
  //           .filter((val, ind, self) => ind === self.findIndex((item) => item.id === val.id)),
  //       )
  //       setSkipCount(skipCount + 1000)
  //     } else {
  //       setSkipCount(0)
  //     }
  //   }
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, [loading])

  return 0
}
