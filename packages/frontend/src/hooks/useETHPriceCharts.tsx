import { useCallback, useMemo, useState } from 'react'

import { getETHPNLCompounding, getSqueethChartWithFunding, getSqueethPNLCompounding } from '@utils/pricer'
import { useQuery } from 'react-query'

const emptyPriceList = [
  {
    time: new Date().setUTCMinutes(0, 0, 0),
    value: 0,
  },
]

const FIVE_MINUTES_IN_MILLISECONDS = 300_000
const ethPriceChartsQueryKeys = {
  ethPriceRange: (days: number) => ['ethPriceRange', { days }],
  allEthPricesRange: (days: number) => ['allEthPricesRange', { days }],
  allEth90daysPrices: () => ['allEth90daysPrices'],
  allEthWithinOneDayPrices: () => ['allEthWithinOneDayPrices'],
  cusdcPricesRange: (days: number) => ['cusdcPricesRange', { days }],
  squeethSeries: () => ['squeethSeries'],
  squeethPNLSeries: () => ['squeethPNLSeries'],
  ethPNLCompounding: () => ['ethPNLCompounding'],
}

export function useETHPriceCharts(initDays = 365, initVolMultiplier = 1.2, initCollatRatio = 1.5) {
  const [volMultiplier, setVolMultiplier] = useState(initVolMultiplier)
  const [days, setDays] = useState(initDays)
  const [collatRatio, setCollatRatio] = useState(initCollatRatio)

  const ethPrices = useQuery(ethPriceChartsQueryKeys.ethPriceRange(days), () => getETHPrices(days), {
    enabled: Boolean(days),
    staleTime: FIVE_MINUTES_IN_MILLISECONDS,
  })
  const allEthPrices = useQuery(ethPriceChartsQueryKeys.allEthPricesRange(initDays), () => getETHPrices(initDays), {
    enabled: Boolean(initDays),
    staleTime: FIVE_MINUTES_IN_MILLISECONDS,
  })
  const allEth90daysPrices = useQuery(ethPriceChartsQueryKeys.allEth90daysPrices(), () => getETH90DaysPrices(), {
    staleTime: FIVE_MINUTES_IN_MILLISECONDS,
  })
  const allEthWithinOneDayPrices = useQuery(
    ethPriceChartsQueryKeys.allEthWithinOneDayPrices(),
    () => getETHWithinOneDayPrices(),
    {
      staleTime: FIVE_MINUTES_IN_MILLISECONDS,
    },
  )
  const cusdcPrices = useQuery(ethPriceChartsQueryKeys.cusdcPricesRange(days), () => getCUSDCPrices(days), {
    staleTime: FIVE_MINUTES_IN_MILLISECONDS,
  })

  // const allVols = useAsyncMemo(async () => await getVolForTimestamp(1619942197, 400), [], [])

  const startingETHPrice = useMemo(() => {
    return ethPrices.data && ethPrices.data.length > 0 ? ethPrices.data[0].value : 1
  }, [ethPrices.data])

  const ethPriceMap = useMemo(
    () =>
      allEthPrices.data &&
      allEthPrices.data.reduce((acc, p) => {
        acc[p.time] = p.value
        return acc
      }, {} as Record<string, number>),
    [allEthPrices.data],
  )

  const eth90daysPriceMap = useMemo(
    () =>
      allEth90daysPrices.data &&
      allEth90daysPrices.data.reduce((acc, p) => {
        acc[p.time] = p.value
        return acc
      }, {} as Record<string, number>),
    [allEth90daysPrices.data],
  )

  const ethWithinOneDayPriceMap = useMemo(
    () =>
      allEthWithinOneDayPrices.data
        ? allEthWithinOneDayPrices.data.reduce((acc: any, p) => {
            acc[p.time] = p.value
            return acc
          }, {})
        : {},
    [allEthWithinOneDayPrices.data],
  )

  /**
   * cUSDC yield as PNL
   */
  const getStableYieldPNL = useCallback(
    (comparedLongAmount: number) => {
      if (!cusdcPrices.data || cusdcPrices.data.length === 0) return []

      // price of one unit of cUSDC
      const startCUSDCPrice = cusdcPrices.data[0].value
      const amountCUSDC = (startingETHPrice * comparedLongAmount) / startCUSDCPrice
      return cusdcPrices.data.map(({ time, value }) => {
        const pnlPerct =
          Math.round(
            ((amountCUSDC * value - startingETHPrice * comparedLongAmount) / (startingETHPrice * comparedLongAmount)) *
              10000,
          ) / 100
        return {
          time,
          value: pnlPerct,
        }
      })
    },
    [startingETHPrice, cusdcPrices.data],
  )

  // const ethLongPNLWithoutCompounding = useMemo(() => {
  //   return ethPrices.map(({ time, value }) => {
  //     return { time, value: value - startingETHPrice }
  //   })
  // }, [startingETHPrice, ethPrices])

  // prev way to calc short eth pnl w/o compounding
  // const ethShortPNLWithoutCompounding = useMemo(() => {
  //   return ethPrices.map(({ time, value }) => {
  //     return { time, value: startingETHPrice - value }
  //   })
  // }, [startingETHPrice, ethPrices])

  // get compounding eth pnl
  const ethPNLCompounding = useQuery(
    ethPriceChartsQueryKeys.ethPNLCompounding(),
    () => getETHPNLCompounding(ethPrices.data ?? []),
    {
      enabled: ethPrices.isSuccess,
    },
  )

  //new long eth pnl w compounding
  const longEthPNL = useMemo(() => {
    return (
      ethPNLCompounding.data &&
      ethPNLCompounding.data.map(({ time, longPNL }) => {
        return { time, value: longPNL }
      })
    )
  }, [ethPNLCompounding.data])

  //new short eth pnl w compounding
  const shortEthPNL = useMemo(() => {
    return (
      ethPNLCompounding.data &&
      ethPNLCompounding.data.map(({ time, shortPNL }) => {
        return { time, value: shortPNL }
      })
    )
  }, [ethPNLCompounding.data])

  const squeethPrices = useMemo(() => {
    return (
      ethPrices.data &&
      ethPrices.data.map(({ time, value }) => {
        return { time, value: value ** 2 / startingETHPrice }
      })
    )
  }, [ethPrices.data, startingETHPrice])

  const squeethSeries = useQuery(
    ethPriceChartsQueryKeys.squeethSeries(),
    () => getSqueethChartWithFunding(ethPrices.data ?? [], volMultiplier, collatRatio),
    { enabled: ethPrices.isSuccess },
  )

  const squeethPNLSeries = useQuery(
    ethPriceChartsQueryKeys.squeethPNLSeries(),
    () => getSqueethPNLCompounding(ethPrices.data ?? [], volMultiplier, collatRatio, days),
    { enabled: Boolean(ethPrices.isSuccess && days) },
  )

  const longSeries = useMemo(() => {
    return (
      squeethPNLSeries.data &&
      squeethPNLSeries.data.map(({ time, longPNL }) => {
        return { time, value: longPNL }
      })
    )
  }, [squeethPNLSeries.data])

  // new short series
  const shortSeries = useMemo(() => {
    return (
      squeethPNLSeries.data &&
      squeethPNLSeries.data.map(({ time, shortPNL }) => {
        return { time, value: shortPNL }
      })
    )
  }, [squeethPNLSeries.data])

  // prev short series
  const prevShortSeries = useMemo(() => {
    return (
      squeethSeries.data &&
      squeethSeries.data.series.map(({ time, shortPNL }) => {
        return { time, value: shortPNL }
      })
    )
  }, [squeethSeries.data])

  /**
   * position size over time, decreasing from 1
   */
  const positionSizePercentageSeries = useMemo(() => {
    return (
      squeethSeries.data &&
      squeethSeries.data.series.map(({ time, positionSize }) => {
        return { time, value: positionSize * 100 }
      })
    )
  }, [squeethSeries.data])

  const fundingPercentageSeries = useMemo(() => {
    return (
      squeethSeries.data &&
      squeethSeries.data.series.map(({ time, fundingPerSqueeth, mark, timeElapsed: timeElapsedInDay }) => {
        const fundingPercentageDay = fundingPerSqueeth / mark / timeElapsedInDay
        return { time, value: Number((fundingPercentageDay * 100).toFixed(4)) }
      })
    )
  }, [squeethSeries.data])

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
      if (!squeethSeries.data || squeethSeries.data.series.length === 0) return []
      if (!ethPrices.data || !prevShortSeries) return
      if (ethPrices.data && squeethSeries.data.series.length !== ethPrices.data.length) return []

      const delta = n - 2 // fix delta we want to hedge to. (n - 2)
      const normalizedFactor = startingETHPrice

      // how much eth holding throughout the time
      let longAmount = n
      const data: { time: number; value: number }[] = []
      let nextRebalanceTime = ethPrices.data[0].time + rebalanceInterval

      // set uniswap fee
      const UNISWAP_FEE = 0.003

      // accumulate total cost of buying (or selling) eth
      let totalLongCost = startingETHPrice * longAmount
      ethPrices.data.forEach(({ time, value: price }, i) => {
        if (time > nextRebalanceTime) {
          const m = squeethSeries.data.series[i].positionSize

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
        const realizedPNL = prevShortSeries[i].value + longValue

        // calculate how much eth to buy
        data.push({
          time: time,
          value: realizedPNL,
        })
      })

      return data
    },
    [ethPrices.data, prevShortSeries, squeethSeries.data, startingETHPrice],
  )

  return {
    getVaultPNLWithRebalance,
    setDays,
    setVolMultiplier,
    days,
    volMultiplier,
    startingETHPrice,
    ethPrices: ethPrices.data,
    getStableYieldPNL,
    longEthPNL,
    shortEthPNL,
    squeethPrices,
    longSeries,
    shortSeries,
    positionSizeSeries: positionSizePercentageSeries,
    fundingPercentageSeries,
    accFunding: squeethSeries.data?.accFunding,
    ethPriceMap,
    eth90daysPriceMap,
    ethWithinOneDayPriceMap,
    setCollatRatio,
    collatRatio,
  }
}

export async function getETHPrices(day = 1): Promise<{ time: number; value: number }[]> {
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
