const emptyPriceList = [
  {
    time: new Date().setUTCMinutes(0, 0, 0),
    value: 0,
  },
]

export async function getCoingeckoETHPrices(day = 1): Promise<{ time: number; value: number }[]> {
  try {
    const url = `https://api.coingecko.com/api/v3/coins/ethereum/market_chart?vs_currency=usd&days=${day}`
    const response = await fetch(url)
    const prices = (await response.json()).prices
    return prices.map(([timestamp, price]: number[]) => {
      return {
        time: timestamp / 1000,
        value: price,
      }
    })
  } catch (error) {
    return emptyPriceList
  }
}

export async function getCUSDCPrices(day = 1): Promise<{ time: number; value: number }[]> {
  try {
    const secondsInDay = 24 * 60 * 60
    const endTime = Math.round(Date.now() / 1000)
    const startTime = Math.round(endTime - day * secondsInDay)
    const url = `https://api.compound.finance/api/v2/market_history/graph?asset=0x39aa39c021dfbae8fac545936693ac917d5e7563&min_block_timestamp=${startTime}&max_block_timestamp=${endTime}&num_buckets=${day}`
    const response = await fetch(url)
    const prices = (await response.json()).exchange_rates

    const output: any = []
    for (const i in prices) output[i] = { time: prices[i].block_timestamp, value: prices[i].rate }
    return output
  } catch (error) {
    return emptyPriceList
  }
}

export async function getETH90DaysPrices(): Promise<{ time: number; value: number }[]> {
  try {
    const url = `https://api.coingecko.com/api/v3/coins/ethereum/market_chart?vs_currency=usd&days=90`
    const response = await fetch(url)
    const prices = (await response.json()).prices
    return prices.map(([timestamp, price]: number[]) => {
      return {
        time: new Date(timestamp).setUTCMinutes(0, 0, 0),
        value: price,
      }
    })
  } catch (error) {
    return emptyPriceList
  }
}

export async function getETHWithinOneDayPrices(): Promise<{ time: number; value: number }[]> {
  try {
    const url = `https://api.coingecko.com/api/v3/coins/ethereum/market_chart?vs_currency=usd&days=0.999`
    const response = await fetch(url)
    const prices = (await response.json()).prices
    return prices.map(([timestamp, price]: number[]) => {
      return {
        time: new Date(timestamp).setUTCSeconds(0, 0),
        value: price,
      }
    })
  } catch (error) {
    return emptyPriceList
  }
}
