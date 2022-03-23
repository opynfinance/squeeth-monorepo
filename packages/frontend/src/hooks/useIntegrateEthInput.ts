import BigNumber from 'bignumber.js'
import { useGetCollatRatioAndLiqPrice, useGetDebtAmount, useNormFactor } from 'src/state/controller/hooks'
import { useGetSellQuote } from 'src/state/squeethPool/hooks'
import { useETHPrice } from './useETHPrice'

export const useIntergrateEthInput = () => {
  const normFactor = useNormFactor()
  const ethPrice = useETHPrice()
  const getDebtAmount = useGetDebtAmount()
  const getCollatRatioAndLiqPrice = useGetCollatRatioAndLiqPrice()
  const getSellQuote = useGetSellQuote()

  const integrateETHInput = async (ethDeposited: BigNumber, desiredCollatRatio: number, slippage: BigNumber) => {
    const emptyState = {
      totalCollat: new BigNumber(0),
      ethBorrow: new BigNumber(0),
      collatRatio: 0,
    }

    let start = new BigNumber(0.8)
    let end = new BigNumber(1.5)

    let prevState = { ...emptyState }

    while (start.lte(end)) {
      const middle = start.plus(end).div(2)
      const extimatedOsqthPrice = middle.multipliedBy(normFactor).times(ethPrice.div(new BigNumber(10000)))

      const oSQTH_mint_guess = ethDeposited.div(
        new BigNumber(desiredCollatRatio)
          .times(normFactor)
          .times(ethPrice.div(new BigNumber(10000)))
          .minus(extimatedOsqthPrice),
      )

      const ethDebt = await getDebtAmount(oSQTH_mint_guess)
      const quote = await getSellQuote(oSQTH_mint_guess, slippage)
      const ethBorrow = quote.amountOut
      const totalCollat = ethDeposited.plus(ethBorrow)
      const collatRatioAndLiqPrice = await getCollatRatioAndLiqPrice(totalCollat, oSQTH_mint_guess)
      const collatRatio = collatRatioAndLiqPrice.collateralPercent

      prevState = { ethBorrow, collatRatio, totalCollat }

      if (collatRatio === desiredCollatRatio) {
        break
      }
      if (collatRatio > desiredCollatRatio) {
        end = middle
      } else {
        start = middle
      }
    }
    return prevState
  }

  return integrateETHInput
}
