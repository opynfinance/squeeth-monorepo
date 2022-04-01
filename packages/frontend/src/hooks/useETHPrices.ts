import { useQuery } from '@apollo/client'
import { uniswapClient } from '@utils/apollo-client'
import { ETHPRICE_QUERY } from '../queries/uniswap/ethPriceQuery'
import { useEffect, useState } from 'react'
import { getEthPriceAtTransactionTime } from 'src/lib/pnl'
import { networkIdAtom } from 'src/state/wallet/atoms'
import { useAtomValue } from 'jotai'

export interface TxItem {
  timestamp: string
  blockNo: number
}

export const useETHPrices = (items: TxItem[] | undefined) => {
  const { networkId } = useAtomValue(networkIdAtom)
  const [itemIndex, setItemIndex] = useState(0)
  const [ethPrices, setETHPrices] = useState<number[]>([])
  const blockNo = items && items.length > 0 ? items[itemIndex].blockNo : 0
  const txTimestamp = items && items.length > 0 ? items[itemIndex].timestamp : ''
  const { data, loading } = useQuery(ETHPRICE_QUERY, {
    variables: {
      blockNo,
    },
    client: uniswapClient[networkId],
    fetchPolicy: 'cache-and-network',
  })

  useEffect(() => {
    if (!loading && items && items.length > 0) {
      if (data && data['bundles'].length > 0 && data['bundles'][0].ethPriceUSD > 0) {
        const ethPrice = data['bundles'][0].ethPriceUSD
        setETHPrices([...ethPrices, ethPrice])
        if (itemIndex < items.length - 1) {
          setItemIndex(itemIndex + 1)
        }
      } else {
        ;(async () => {
          const ethPrice = await getEthPriceAtTransactionTime(txTimestamp)
          setETHPrices([...ethPrices, ethPrice.toNumber()])
          if (itemIndex < items.length - 1) {
            setItemIndex(itemIndex + 1)
          }
        })()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

  return ethPrices.length === items?.length ? ethPrices : undefined
}
