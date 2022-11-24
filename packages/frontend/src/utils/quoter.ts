import BigNumber from 'bignumber.js'
import { Contract } from 'web3-eth-contract'

export const getExactIn = async (
  contract: Contract,
  tokenIn: string,
  tokenOut: string,
  amountIn: BigNumber,
  poolFee: number,
  slippage: number,
) => {
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

export const getExactOut = async (
  contract: Contract,
  tokenIn: string,
  tokenOut: string,
  amountOut: BigNumber,
  poolFee: number,
  slippage: number,
) => {
  const quoteExactOutputSingleParams = {
    tokenIn: tokenIn,
    tokenOut: tokenOut,
    amount: amountOut.toFixed(0),
    fee: poolFee,
    sqrtPriceLimitX96: 0,
  }

  const quote = await contract.methods.quoteExactOutputSingle(quoteExactOutputSingleParams).call()
  const maxAmountIn = new BigNumber(quote.amountIn)
    .times(100 + slippage)
    .div(100)
    .toFixed(0)
  return { ...quote, maxAmountIn }
}
