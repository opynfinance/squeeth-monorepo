import { useCallback, useMemo, useState } from 'react'

import { getETHPNLCompounding, getSqueethChartWithFunding, getSqueethPNLCompounding } from '@utils/pricer'
import { useAsyncMemo } from './useAsyncMemo'

const emptyPriceList = [
  {
    time: new Date().setUTCMinutes(0, 0, 0),
    value: 0,
  },
]

export function useETHPriceCharts(initDays = 365, initVolMultiplier = 1.2, initCollatRatio = 1.5) {
  const [volMultiplier, setVolMultiplier] = useState(initVolMultiplier)
  const [days, setDays] = useState(initDays)
  const [collatRatio, setCollatRatio] = useState(initCollatRatio)

  const ethPrices = useAsyncMemo(async () => await getETHPrices(days), [], [days])
  const allEthPrices = useAsyncMemo(async () => await getETHPrices(initDays), [], [initDays])
  const allEth90daysPrices = useAsyncMemo(async () => await getETH90DaysPrices(), [], [])
  const allEthWithinOneDayPrices = useAsyncMemo(async () => await getETHWithinOneDayPrices(), [], [])

  const cusdcPrices = useAsyncMemo(async () => await getCUSDCPrices(days), [], [days])

  // const allVols = useAsyncMemo(async () => await getVolForTimestamp(1619942197, 400), [], [])

  const startingETHPrice = useMemo(() => {
    return ethPrices.length === 0 ? 1 : ethPrices[0].value
  }, [ethPrices])

  const ethPriceMap = allEthPrices.reduce((acc: any, p) => {
    acc[p.time] = p.value
    return acc
  }, {})
  const eth90daysPriceMap = allEth90daysPrices.reduce((acc: any, p) => {
    acc[p.time] = p.value
    return acc
  }, {})

  const ethWithinOneDayPriceMap = allEthWithinOneDayPrices?.length
    ? allEthWithinOneDayPrices.reduce((acc: any, p) => {
        acc[p.time] = p.value
        return acc
      }, {})
    : {}

  /**
   * cUSDC yield as PNL
   */
  const getStableYieldPNL = useCallback(
    (comparedLongAmount: number) => {
      if (cusdcPrices.length === 0) return []
      // price of one unit of cUSDC
      const startCUSDCPrice = cusdcPrices[0].value
      const amountCUSDC = (startingETHPrice * comparedLongAmount) / startCUSDCPrice
      return cusdcPrices.map(({ time, value }) => {
        return {
          time,
          value: amountCUSDC * value - startingETHPrice * comparedLongAmount,
        }
      })
    },
    [startingETHPrice, cusdcPrices],
  )

  // const ethLongPNLWithoutCompounding = useMemo(() => {
  //   return ethPrices.map(({ time, value }) => {
  //     return { time, value: value - startingETHPrice }
  //   })
  // }, [startingETHPrice, ethPrices])

  // prev way to calc short eth pnl w/o compounding
  const ethShortPNLWithoutCompounding = useMemo(() => {
    return ethPrices.map(({ time, value }) => {
      return { time, value: startingETHPrice - value }
    })
  }, [startingETHPrice, ethPrices])

  // get compounding eth pnl
  const ethPNLCompounding = useAsyncMemo(
    () => {
      return getETHPNLCompounding(ethPrices)
    },
    [],
    [ethPrices],
  )

  //new long eth pnl w compounding
  const longEthPNL = useMemo(() => {
    return ethPNLCompounding.map(({ time, longPNL }) => {
      return { time, value: longPNL }
    })
  }, [ethPNLCompounding])

  //new short eth pnl w compounding
  const shortEthPNL = useMemo(() => {
    return ethPNLCompounding.map(({ time, shortPNL }) => {
      return { time, value: shortPNL }
    })
  }, [ethPNLCompounding])

  const squeethPrices = useMemo(() => {
    return ethPrices.map(({ time, value }) => {
      return { time, value: value ** 2 / startingETHPrice }
    })
  }, [ethPrices, startingETHPrice])

  const squeethSeries = useAsyncMemo(
    () => {
      return getSqueethChartWithFunding(ethPrices, volMultiplier, collatRatio)
    },
    { series: [], accFunding: 0 },
    [ethPrices, volMultiplier, collatRatio],
  )
  const squeethPNLSeries = useAsyncMemo(
    () => {
      return getSqueethPNLCompounding(ethPrices, volMultiplier, collatRatio, days)
    },
    [],
    [ethPrices, volMultiplier, collatRatio],
  )

  const longSeries = useMemo(() => {
    return squeethPNLSeries.map(({ time, longPNL }) => {
      return { time, value: longPNL }
    })
  }, [squeethPNLSeries])

  // new short series
  // const shortSeries = useMemo(() => {
  //   return squeethPNLSeries.map(({ time, shortPNL }) => {
  //     return { time, value: shortPNL }
  //   })
  // }, [squeethPNLSeries])

  // prev short series
  const shortSeries = useMemo(() => {
    return squeethSeries.series.map(({ time, shortPNL }) => {
      return { time, value: shortPNL }
    })
  }, [squeethSeries])

  /**
   * position size over time, decreasing from 1
   */
  const positionSizePercentageSeries = useMemo(() => {
    return squeethSeries.series.map(({ time, positionSize }) => {
      return { time, value: positionSize * 100 }
    })
  }, [squeethSeries])

  const fundingPercentageSeries = useMemo(() => {
    return squeethSeries.series.map(({ time, fundingPerSqueeth, mark, timeElapsed: timeElapsedInDay }) => {
      const fundingPercentageDay = fundingPerSqueeth / mark / timeElapsedInDay
      return { time, value: Number((fundingPercentageDay * 100).toFixed(4)) }
    })
  }, [squeethSeries])

  /**
   * used to generate vault pnl, considering
   * user's portfolio will be nx - m(x)^2
   * delta: n - 2mx
   *
   * m: short size
   * n: long size
   *
   */
  const getVaultPNLWithRebalance = useCallback(
    (n: number, rebalanceInterval = 86400) => {
      if (squeethSeries.series.length === 0) return []
      if (squeethSeries.series.length !== ethPrices.length) return []

      const delta = n - 2 // fix delta we want to hedge to. (n - 2)
      const normalizedFactor = startingETHPrice

      // how much eth holding throughout the time
      let longAmount = n
      const data: { time: number; value: number }[] = []
      let nextRebalanceTime = ethPrices[0].time + rebalanceInterval

      // set uniswap fee
      const UNISWAP_FEE = 0.003

      // accumulate total cost of buying (or selling) eth
      let totalLongCost = startingETHPrice * longAmount
      ethPrices.forEach(({ time, value: price }, i) => {
        if (time > nextRebalanceTime) {
          const m = squeethSeries.series[i].positionSize

          // rebalance
          const x = price / normalizedFactor

          // solve n for formula:
          // n - 2mx = m * delta
          const newN = m * delta + 2 * x * m
          const buyAmount = newN - longAmount
          const buyCost = buyAmount * price + Math.abs(buyAmount * price * UNISWAP_FEE)
          //console.log(`Date ${new Date(time * 1000).toDateString()}, price ${price.toFixed(3)} Rebalance: short squeeth ${m.toFixed(4)}, desired ETH long ${newN.toFixed(4)}, buy ${buyAmount.toFixed(4)} more eth`)

          totalLongCost += buyCost
          longAmount = newN

          //console.log('total long cost', totalLongCost, 'longAmount', longAmount)

          //normalizedFactor = price
          nextRebalanceTime = nextRebalanceTime + rebalanceInterval
        }

        const longValue = price * longAmount - totalLongCost // should probably be be named something like ethDeltaPnL
        const realizedPNL = shortSeries[i].value + longValue

        // calculate how much eth to buy
        data.push({
          time: time,
          value: realizedPNL,
        })
      })

      return data
    },
    [ethPrices, startingETHPrice, shortSeries, squeethSeries],
  )

  return {
    getVaultPNLWithRebalance,
    setDays,
    setVolMultiplier,
    days,
    volMultiplier,
    startingETHPrice,
    ethPrices,
    getStableYieldPNL,
    longEthPNL,
    shortEthPNL,
    squeethPrices,
    longSeries,
    shortSeries,
    positionSizeSeries: positionSizePercentageSeries,
    fundingPercentageSeries,
    accFunding: squeethSeries.accFunding,
    ethPriceMap,
    eth90daysPriceMap,
    ethWithinOneDayPriceMap,
    setCollatRatio,
    collatRatio,
  }
}

async function getETHPrices(day = 1): Promise<{ time: number; value: number }[]> {
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

async function getCUSDCPrices(day = 1): Promise<{ time: number; value: number }[]> {
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
