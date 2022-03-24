import useShortParams from './useShortParams'

export default function useSqueethShortPayOffGraph(ethPrice: number, collatRatio: number) {
  const { markRatio, initialCollat, depositValue, cuNF0, cuNF1, cuNF14, cuNF28, ethPrices, crabEthPrices } =
    useShortParams(ethPrice, collatRatio)

  const payout0 = ethPrices.map((p) => {
    return (((-1 * cuNF0 * p ** 2 * markRatio + initialCollat * p) / depositValue - 1) * 100).toFixed(2)
  })

  const payout1 = crabEthPrices.map((p) => {
    return (((-1 * cuNF1 * p ** 2 * markRatio + initialCollat * p) / depositValue - 1) * 100).toFixed(2)
  })

  const payout14 = ethPrices.map((p) => {
    return (((-1 * cuNF14 * p ** 2 * markRatio + initialCollat * p) / depositValue - 1) * 100).toFixed(2)
  })

  const payout28 = ethPrices.map((p) => {
    return (((-1 * cuNF28 * p ** 2 * markRatio + initialCollat * p) / depositValue - 1) * 100).toFixed(2)
  })

  return {
    ethPrices,
    payout0,
    payout1,
    payout14,
    payout28,
  }
}
