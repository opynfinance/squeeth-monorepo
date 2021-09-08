import BigNumber from 'bignumber.js'
import { useCallback, useEffect, useState } from 'react'

import useInterval from './useInterval'

/**
 * get token price by address.
 * @param token token address
 * @param refetchIntervalSec refetch interval in seconds
 * @returns {BigNumber} price denominated in USD
 */
export const useETHPrice = (refetchIntervalSec = 20): BigNumber => {
  const [price, setPrice] = useState(new BigNumber(0))

  const updatePrice = useCallback(async () => {
    const price = await getETHPriceCoingecko()
    setPrice(price)
  }, [])

  useInterval(updatePrice, refetchIntervalSec * 1000)

  return price
}

export const getETHPriceCoingecko = async (): Promise<BigNumber> => {
  const coin = 'ethereum'
  // map rinkeby address to mainnet address
  // WETH

  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coin}&vs_currencies=usd`
  const res = await fetch(url)
  const priceStruct: { usd: number } = (await res.json())[coin.toLowerCase()]
  if (priceStruct === undefined) return new BigNumber(0)
  const price = priceStruct.usd
  return new BigNumber(price)
}
