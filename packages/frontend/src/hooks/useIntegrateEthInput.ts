import BigNumber from 'bignumber.js'
import { useAtomValue } from 'jotai'
import { normFactorAtom } from 'src/state/controller/atoms'

import { useGetCollatRatioAndLiqPrice } from 'src/state/controller/hooks'
import { useGetSellQuote } from 'src/state/squeethPool/hooks'
import { useETHPrice } from './useETHPrice'
import useAppCallback from '@hooks/useAppCallback'

export const useIntergrateEthInput = () => {
  const normFactor = useAtomValue(normFactorAtom)
  const ethPrice = useETHPrice()
  const getCollatRatioAndLiqPrice = useGetCollatRatioAndLiqPrice()
  const getSellQuote = useGetSellQuote()

  const integrateETHInput = useAppCallback(
    async (ethDeposited: BigNumber, desiredCollatRatio: number, slippage: BigNumber) => {
      const emptyState = {
        squeethAmount: new BigNumber(0),
        ethBorrow: new BigNumber(0),
        liqPrice: new BigNumber(0),
        collatRatio: 0,
        quote: {
          amountOut: new BigNumber(0),
          minimumAmountOut: new BigNumber(0),
          priceImpact: '0',
        },
      }

      let start = 0
      let end = 3

      let prevState = { ...emptyState }

      if (ethDeposited.isZero() || desiredCollatRatio <= 1.5) return emptyState

      while (start <= end) {
        const middle = (start + end) / 2
        const estimatedOsqthPrice = new BigNumber(middle)
          .multipliedBy(normFactor)
          .times(ethPrice.div(new BigNumber(10000)))

        const oSQTH_mint_guess = ethDeposited.div(
          new BigNumber(desiredCollatRatio)
            .times(normFactor)
            .times(ethPrice.div(new BigNumber(10000)))
            .minus(estimatedOsqthPrice),
        )

        const quote = await getSellQuote(oSQTH_mint_guess, slippage)
        const ethBorrow = quote.minimumAmountOut
        const totalCollat = ethDeposited.plus(ethBorrow)
        const { collateralPercent: collatRatio, liquidationPrice: liqPrice } = await getCollatRatioAndLiqPrice(
          totalCollat,
          oSQTH_mint_guess,
        )

        prevState = { ethBorrow, collatRatio, squeethAmount: oSQTH_mint_guess, quote, liqPrice }

        if ((collatRatio / 100).toFixed(2) === desiredCollatRatio.toFixed(2)) {
          break
        }
        if (collatRatio / 100 < desiredCollatRatio) {
          end = middle
        } else {
          start = middle
        }
      }
      return prevState
    },
    [ethPrice, getCollatRatioAndLiqPrice, getSellQuote, normFactor],
  )

  return integrateETHInput
}
