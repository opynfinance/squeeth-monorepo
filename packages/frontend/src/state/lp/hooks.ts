import { nearestUsableTick, TickMath } from '@uniswap/v3-sdk'
import { fromTokenAmount } from '@utils/calculations'
import { useAtomValue } from 'jotai'
import { addressesAtom, isWethToken0Atom } from '../positions/atoms'
import BigNumber from 'bignumber.js'
import { OSQUEETH_DECIMALS } from '@constants/index'
import { controllerContractAtom, controllerHelperHelperContractAtom, nftManagerContractAtom, quoterContractAtom, squeethPoolContractAtom } from '../contracts/atoms'
import useAppCallback from '@hooks/useAppCallback'
import { addressAtom } from '../wallet/atoms'
import { Contract } from 'web3-eth-contract'
import { useHandleTransaction } from '../wallet/hooks'
import { ethers } from 'ethers'
import { useCallback } from 'react'
import { useGetDebtAmount, useGetVault } from '../controller/hooks'

/*** CONSTANTS ***/
const COLLAT_RATIO_FLASHLOAN = 2
const POOL_FEE = 3000
const MAX_INT_128 = new BigNumber(2).pow(128).minus(1).toFixed(0)
const x96 = new BigNumber(2).pow(96)

/*** CONSTANTS ***/
const TICK_SPACE = 60

/*** GETTERS ***/

export const useGetPosition = () => {
  const contract = useAtomValue(nftManagerContractAtom)

  const getPosition = useCallback(
    async (uniTokenId: number) => {
      if (!contract) return null
      const position = await contract.methods.positions(uniTokenId).call()
      const { nonce, operator, token0, token1, fee, tickLower, tickUpper, liquidity, feeGrowthInside0LastX128, feeGrowthInside1LastX128, tokensOwed0, tokensOwed1 } = position
      return {
        nonce,
        operator,
        token0,
        token1,
        fee,
        tickLower,
        tickUpper,
        liquidity,
        feeGrowthInside0LastX128,
        feeGrowthInside1LastX128,
        tokensOwed0,
        tokensOwed1
      }
    },
    [contract],
  )

  return getPosition
}

export const useGetDecreaseLiquidity = () => {
  const contract = useAtomValue(nftManagerContractAtom)

  const getDecreaseLiquiduity = useCallback(
    async (tokenId: number, liquidity: number, amount0Min: number, amount1Min: number, deadline: number) => {
      if (!contract) return null
      const DecreaseLiquidityParams = {
        tokenId,
        liquidity,
        amount0Min,
        amount1Min,
        deadline,
      }

      const decreaseLiquidity = await contract.methods.decreaseLiquidity(DecreaseLiquidityParams).call()

      return decreaseLiquidity
    },
    [contract],
  )

  return getDecreaseLiquiduity
}

export const useGetExactIn = () => {
  const contract = useAtomValue(quoterContractAtom)
  const {weth, oSqueeth} = useAtomValue(addressesAtom)

  const getExactIn = useCallback(
    async (amount: BigNumber, squeethIn: boolean) => {
      if (!contract) return null

      const QuoteExactInputSingleParams = {
        tokenIn: squeethIn ? oSqueeth : weth,
        tokenOut: squeethIn ? weth : oSqueeth,
        amountIn: amount.toFixed(0),
        fee: POOL_FEE,
        sqrtPriceLimitX96: 0
      }

      const quote = await contract.methods.quoteExactInputSingle(QuoteExactInputSingleParams).call()
      return quote.amountOut
    },
    [contract, weth, oSqueeth],
  )

  return getExactIn
}

export const useGetExactOut = () => {
  const contract = useAtomValue(quoterContractAtom)
  const {weth, oSqueeth} = useAtomValue(addressesAtom)

  const getExactOut = useCallback(
    async (amount: BigNumber, squeethOut: boolean) => {
      if (!contract) return null

      const QuoteExactOutputSingleParams = {
        tokenIn: squeethOut ? weth : oSqueeth,
        tokenOut: squeethOut ? oSqueeth : weth,
        amount: amount.toFixed(0),
        fee: POOL_FEE,
        sqrtPriceLimitX96: 0
      }

      const quote = await contract.methods.quoteExactOutputSingle(QuoteExactOutputSingleParams).call()
      return quote.amountIn
    },
    [contract, weth, oSqueeth],
  )

  return getExactOut
}

async function getPoolState(poolContract: Contract) {
  const [slot, liquidity, tickSpacing] = await Promise.all([
    poolContract?.methods.slot0().call(),
    poolContract?.methods.liquidity().call(),
    poolContract.methods.tickSpacing().call()
  ])

  const PoolState = {
    liquidity,
    sqrtPriceX96: slot[0],
    tick: slot[1],
    observationIndex: slot[2],
    observationCardinality: slot[3],
    observationCardinalityNext: slot[4],
    feeProtocol: slot[5],
    unlocked: slot[6],
    tickSpacing
  }

  return PoolState
}