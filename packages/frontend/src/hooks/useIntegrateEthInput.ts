import BigNumber from 'bignumber.js'
import { useCallback } from 'react'

import { useGetCollatRatioAndLiqPrice, useNormFactor } from 'src/state/controller/hooks'
import { useGetSellQuote } from 'src/state/squeethPool/hooks'
import { useETHPrice } from './useETHPrice'

export const useIntergrateEthInput = () => {
  const normFactor = useNormFactor()
  const ethPrice = useETHPrice()
  const getCollatRatioAndLiqPrice = useGetCollatRatioAndLiqPrice()
  const getSellQuote = useGetSellQuote()

  const integrateETHInput = useCallback(
    async (ethDeposited: BigNumber, desiredCollatRatio: number, slippage: BigNumber) => {
      const emptyState = {
        squeethAmount: new BigNumber(0),
        ethBorrow: new BigNumber(0),
        collatRatio: 0,
        quote: {
          amountOut: new BigNumber(0),
          minimumAmountOut: new BigNumber(0),
          priceImpact: '0',
        },
      }

      let start = 0.8
      let end = 1.5

      let prevState = { ...emptyState }

      if (ethDeposited.isZero() || desiredCollatRatio < 1.5) return emptyState

      while (start <= end) {
        const middle = (start + end) / 2
        const extimatedOsqthPrice = new BigNumber(middle)
          .multipliedBy(normFactor)
          .times(ethPrice.div(new BigNumber(10000)))

        const oSQTH_mint_guess = ethDeposited.div(
          new BigNumber(desiredCollatRatio)
            .times(normFactor)
            .times(ethPrice.div(new BigNumber(10000)))
            .minus(extimatedOsqthPrice),
        )

        const quote = await getSellQuote(oSQTH_mint_guess, slippage)
        const ethBorrow = quote.minimumAmountOut
        const totalCollat = ethDeposited.plus(ethBorrow)
        const collatRatioAndLiqPrice = await getCollatRatioAndLiqPrice(totalCollat, oSQTH_mint_guess)
        const collatRatio = collatRatioAndLiqPrice.collateralPercent

        prevState = { ethBorrow, collatRatio, squeethAmount: oSQTH_mint_guess, quote }

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
    [ethPrice.toString(), getCollatRatioAndLiqPrice, getSellQuote, normFactor.toString()],
  )

  return integrateETHInput
}
