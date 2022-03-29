import useShortParams from './useShortParams'

export default function useCrabVaultPayoff(ethPrice: number, collatRatio: number) {
  const { markRatio, initialCollat, depositValue, cuNF0, cuNF14, cuNF28, ethPrices } = useShortParams(
    ethPrice,
    collatRatio,
  )

  const payout0 = ethPrices.map((p) => {
    return (
      ((-(cuNF0 + (initialCollat - 2 * cuNF0 * ethPrice) / ethPrice) * p ** 2 * markRatio +
        (initialCollat + ((initialCollat - 2 * cuNF0 * ethPrice) / ethPrice) * markRatio * ethPrice) * p) /
        depositValue -
        1) *
      100
    ).toFixed(2)
  })

  const payout14 = ethPrices.map((p) => {
    return (
      ((-(cuNF14 + (initialCollat - 2 * cuNF14 * ethPrice) / ethPrice) * p ** 2 * markRatio +
        (initialCollat + ((initialCollat - 2 * cuNF14 * ethPrice) / ethPrice) * markRatio * ethPrice) * p) /
        depositValue -
        1) *
      100
    ).toFixed(2)
  })

  const payout28 = ethPrices.map((p) => {
    return (
      ((-(cuNF28 + (initialCollat - 2 * cuNF28 * ethPrice) / ethPrice) * p ** 2 * markRatio +
        (initialCollat + ((initialCollat - 2 * cuNF28 * ethPrice) / ethPrice) * markRatio * ethPrice) * p) /
        depositValue -
        1) *
      100
    ).toFixed(2)
  })

  return {
    ethPrices,
    payout0,
    payout14,
    payout28,
  }
}
