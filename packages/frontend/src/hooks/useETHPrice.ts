import BigNumber from 'bignumber.js'
import { useQuery, useQueryClient } from 'react-query'

import { useController } from './contracts/useController'
import { toTokenAmount } from '@utils/calculations'

/**
 * get token price by address.
 * @param token token address
 * @param refetchIntervalSec refetch interval in seconds
 * @returns {BigNumber} price denominated in USD
 */
export const useETHPrice = (refetchIntervalSec = 30) => {
  const { index } = useController()
  const queryClient = useQueryClient()

  const ethPrice = useQuery('ethPrice', () => getETHPriceCoingecko(), {
    onError() {
      queryClient.setQueryData('ethPrice', toTokenAmount(index, 18).sqrt())
    },
    refetchInterval: refetchIntervalSec * 1000,
    refetchOnWindowFocus: true,
  })

  return ethPrice.data ?? new BigNumber(0)
}

export const getETHPriceCoingecko = async (): Promise<BigNumber> => {
  const coin = 'ethereum'

  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coin}&vs_currencies=usd`

  const res = await fetch(url)
  const priceStruct: { usd: number } = (await res.json())[coin.toLowerCase()]
  if (priceStruct === undefined) return new BigNumber(0)
  const price = priceStruct.usd
  return new BigNumber(price)
}
