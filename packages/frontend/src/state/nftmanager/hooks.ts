import { Position } from '@uniswap/v3-sdk'

import positionManagerAbi from '../../abis/NFTpositionmanager.json'
import { toTokenAmount } from '@utils/calculations'
import useContract from '@hooks/useContract'
import { useAtomValue } from 'jotai'
import { addressesAtom, isWethToken0Atom } from '../positions/atoms'
import BigNumber from 'bignumber.js'
import { BIG_ZERO } from '@constants/index'
import { poolAtom } from '../squeethPool/atoms'

export const useGetPosition = () => {
  const { nftManager } = useAtomValue(addressesAtom)
  const contract = useContract(nftManager, positionManagerAbi)
  const pool = useAtomValue(poolAtom)
  const getPosition = async (posId: number) => {
    if (!contract || !pool) return

    const { tickLower, tickUpper, liquidity, tokensOwed1, tokensOwed0 } = await contract.methods.positions(posId).call()
    const uniPosition = new Position({
      pool,
      tickLower: Number(tickLower),
      tickUpper: Number(tickUpper),
      liquidity: liquidity.toString(),
    })

    return { uniPosition, tokensOwed1: toTokenAmount(tokensOwed1, 18), tokensOwed0: toTokenAmount(tokensOwed0, 18) }
  }

  return getPosition
}

export const useGetETHandOSQTHAmount = () => {
  const isWethToken0 = useAtomValue(isWethToken0Atom)
  const getPosition = useGetPosition()
  const getETHandOSQTHAmount = async (posId: number) => {
    const result = await getPosition(posId)
    if (!result) return { wethAmount: BIG_ZERO, oSqthAmount: BIG_ZERO }

    const { uniPosition, tokensOwed0, tokensOwed1 } = result
    const amt0 = new BigNumber(uniPosition.amount0.toSignificant(18))
    const amt1 = new BigNumber(uniPosition.amount1.toSignificant(18))

    const wethAmount = isWethToken0 ? amt0.plus(tokensOwed0) : amt1.plus(tokensOwed1)
    const oSqthAmount = !isWethToken0 ? amt0.plus(tokensOwed0) : amt1.plus(tokensOwed1)

    return { wethAmount, oSqthAmount, position: result.uniPosition }
  }

  return getETHandOSQTHAmount
}
