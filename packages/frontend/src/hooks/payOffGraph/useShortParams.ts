import { useAtomValue } from 'jotai'
import { indexAtom, markAtom } from 'src/state/controller/atoms'

export default function useShortParams(ethPrice: number, collatRatio: number) {
  const squeethIndex = ethPrice ** 2
  const mark = useAtomValue(markAtom)
  const index = useAtomValue(indexAtom)
  const markRatio = Number(mark.div(index).toString())
  const squeethMark = squeethIndex * markRatio
  const dailyNormFactor = Math.exp((-1 * Math.log(markRatio)) / 17.5)
  const initialCollat = collatRatio * ethPrice
  const depositValue = initialCollat * ethPrice - squeethMark

  const cuNF0 = dailyNormFactor ** 0
  const cuNF1 = dailyNormFactor ** 1
  const cuNF14 = dailyNormFactor ** 14
  const cuNF28 = dailyNormFactor ** 28

  const getEthPrices = () => {
    let inc = Math.floor(ethPrice / 2)
    return Array(120)
      .fill(0)
      .map((_, i) => {
        if (i === 0) return inc
        inc += 30
        return inc
      })
  }
  const getCrabEthPrices = () => {
    let inc = Math.floor(ethPrice / 2)
    return Array(100)
      .fill(0)
      .map((_, i) => {
        if (i === 0) return inc
        inc += 30
        return inc
      })
  }

  return {
    squeethIndex,
    markRatio,
    squeethMark,
    initialCollat,
    depositValue,
    cuNF0,
    cuNF1,
    cuNF14,
    cuNF28,
    ethPrices: getEthPrices(),
    crabEthPrices: getCrabEthPrices(),
  }
}
