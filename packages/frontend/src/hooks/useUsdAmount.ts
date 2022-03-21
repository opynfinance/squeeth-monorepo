import BigNumber from 'bignumber.js'

import { useCallback } from 'react'
import { useEth90daysPriceMap, useEthPriceMap, useEthWithinOneDayPriceMap } from 'src/state/ethPriceCharts/atoms'

const getClosestTime = (ethWithinOneDayPriceMap: { [key: number]: number }, timestamp: any): number => {
  if (!ethWithinOneDayPriceMap || !timestamp) return 0
  const closest = Object.keys(ethWithinOneDayPriceMap)?.length
    ? Object.keys(ethWithinOneDayPriceMap).reduce(function (previousValue: string, currentValue: string): any {
        const prev = Number(previousValue)
        const cur = Number(currentValue)
        const prevDiff = Math.abs(prev - timestamp)
        const curDiff = Math.abs(cur - timestamp)

        if (prevDiff == curDiff) {
          return previousValue > currentValue ? prev : cur
        } else {
          return curDiff < prevDiff ? cur : prev
        }
      })
    : '0'
  return Number(closest)
}

export const useUsdAmount = () => {
  const ethPriceMap = useEthPriceMap()
  const eth90daysPriceMap = useEth90daysPriceMap()
  const ethWithinOneDayPriceMap = useEthWithinOneDayPriceMap()

  const getUsdAmt = useCallback(
    (wethAmt: BigNumber, timestamp: any) => {
      if (!ethPriceMap || !eth90daysPriceMap) return new BigNumber(0)

      const currentTime = new Date(Date.now())
      const txTime = new Date(Number(timestamp) * 1000)
      let usdAmount
      let time
      const diffDays = (currentTime.getTime() - txTime.getTime()) / (1000 * 3600 * 24)

      if (diffDays > 90) {
        time = new Date(Number(timestamp) * 1000).setUTCHours(0, 0, 0) / 1000
        usdAmount = wethAmt.multipliedBy(ethPriceMap[time])
      } else if (diffDays <= 90 && diffDays >= 1) {
        time = new Date(Number(timestamp) * 1000).setUTCMinutes(0, 0, 0)
        usdAmount = wethAmt.multipliedBy(eth90daysPriceMap[time])
      } else {
        time = new Date(Number(timestamp) * 1000).setUTCSeconds(0, 0)
        const closestTime = getClosestTime(ethWithinOneDayPriceMap, time)
        usdAmount = wethAmt.multipliedBy(ethWithinOneDayPriceMap[closestTime])
      }
      return usdAmount
    },
    [eth90daysPriceMap, ethPriceMap, ethWithinOneDayPriceMap],
  )

  return { getUsdAmt }
}
