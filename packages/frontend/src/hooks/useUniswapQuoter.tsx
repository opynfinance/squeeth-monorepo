import BigNumber from 'bignumber.js'
import { useAtomValue } from 'jotai'
import { quoterContractAtom } from 'src/state/contracts/atoms'

export const useUniswapQuoter = () => {
  const contract = useAtomValue(quoterContractAtom)

  const getExactIn = async (
    tokenIn: string,
    tokenOut: string,
    amountIn: BigNumber,
    poolFee: number,
    slippage: number,
  ) => {
    if (!contract) return null

    const quoteExactInputSingleParams = {
      tokenIn: tokenIn,
      tokenOut: tokenOut,
      amountIn: amountIn.toFixed(0),
      fee: poolFee,
      sqrtPriceLimitX96: 0,
    }

    const quote = await contract.methods.quoteExactInputSingle(quoteExactInputSingleParams).call()
    const minAmountOut = new BigNumber(quote.amountOut)
      .times(100 - slippage)
      .div(100)
      .toFixed(0)
    return { ...quote, minAmountOut }
  }

  const getExactOut = async (tokenIn: string, tokenOut: string, amountOut: BigNumber, poolFee: number) => {
    if (!contract) return null

    const quoteExactOutputSingleParams = {
      tokenIn: tokenIn,
      tokenOut: tokenOut,
      amount: amountOut.toFixed(0),
      fee: poolFee,
      sqrtPriceLimitX96: 0,
    }

    const quote = await contract.methods.quoteExactOutputSingle(quoteExactOutputSingleParams).call()
    return quote
  }

  return { getExactIn, getExactOut }
}
