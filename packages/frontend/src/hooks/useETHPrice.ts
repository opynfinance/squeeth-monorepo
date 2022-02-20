import BigNumber from 'bignumber.js'
import { useCallback, useEffect, useState } from 'react'
import { useAtom } from 'jotai'

import { indexAtom } from './contracts/useController'
import { toTokenAmount } from '@utils/calculations'
import { useIntervalAsync } from './useIntervalAsync'

/**
 * get token price by address.
 * @param token token address
 * @param refetchIntervalSec refetch interval in seconds
 * @returns {BigNumber} price denominated in USD
 */
export const useETHPrice = (refetchIntervalSec = 30): BigNumber => {
  const [price, setPrice] = useState(new BigNumber(0))
  const index = useAtom(indexAtom)[0]

  const updatePrice = useCallback(async () => {
    let newPrice: BigNumber

    try {
      newPrice = await getETHPriceCoingecko()
    } catch (error) {
      newPrice = toTokenAmount(index, 18).sqrt()
    }

    setPrice(newPrice)
  }, [index.toString()])

  useEffect(() => {
    updatePrice()
  }, [updatePrice])

  useIntervalAsync(updatePrice, refetchIntervalSec * 1000)

  return price
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

export const getHistoricEthPrice = async (dateString: string): Promise<BigNumber> => {
  const pair = 'ETH/USD'

  const response = await fetch(
    `https://api.twelvedata.com/time_series?start_date=${dateString}&end_date=${dateString}&symbol=${pair}&interval=1min&apikey=${process.env.NEXT_PUBLIC_TWELVEDATA_APIKEY}`,
  ).then((res) => res.json())

  if (response.status === 'error') return new BigNumber(0)

  return new BigNumber(Number(response.values[0].close))
}
