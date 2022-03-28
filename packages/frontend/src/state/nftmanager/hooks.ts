import { Position } from '@uniswap/v3-sdk'

import { toTokenAmount } from '@utils/calculations'
import { useAtomValue } from 'jotai'
import { isWethToken0Atom } from '../positions/atoms'
import BigNumber from 'bignumber.js'
import { BIG_ZERO } from '@constants/index'
import { poolAtom } from '../squeethPool/atoms'
import { nftManagerContractAtom } from '../contracts/atoms'
import { useCallback } from 'react'

export const useGetPosition = () => {
  const contract = useAtomValue(nftManagerContractAtom)
  const pool = useAtomValue(poolAtom)
  const getPosition = useCallback(
    async (posId: number) => {
      if (!contract || !pool) return

      const { tickLower, tickUpper, liquidity, tokensOwed1, tokensOwed0 } = await contract.methods
        .positions(posId)
        .call()
      const uniPosition = new Position({
        pool,
        tickLower: Number(tickLower),
        tickUpper: Number(tickUpper),
        liquidity: liquidity.toString(),
      })

      return { uniPosition, tokensOwed1: toTokenAmount(tokensOwed1, 18), tokensOwed0: toTokenAmount(tokensOwed0, 18) }
    },
    [contract, pool],
  )

  return getPosition
}

export const useGetETHandOSQTHAmount = () => {
  const isWethToken0 = useAtomValue(isWethToken0Atom)
  const getPosition = useGetPosition()
  const getETHandOSQTHAmount = useCallback(
    async (posId: number) => {
      const result = await getPosition(posId)
      if (!result) return { wethAmount: BIG_ZERO, oSqthAmount: BIG_ZERO }

      const { uniPosition, tokensOwed0, tokensOwed1 } = result
      const amt0 = new BigNumber(uniPosition.amount0.toSignificant(18))
      const amt1 = new BigNumber(uniPosition.amount1.toSignificant(18))

      const wethAmount = isWethToken0 ? amt0.plus(tokensOwed0) : amt1.plus(tokensOwed1)
      const oSqthAmount = !isWethToken0 ? amt0.plus(tokensOwed0) : amt1.plus(tokensOwed1)

      return { wethAmount, oSqthAmount, position: result.uniPosition }
    },
    [getPosition, isWethToken0],
  )

  return getETHandOSQTHAmount
}
