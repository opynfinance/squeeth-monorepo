import { tickToPrice } from '@uniswap/v3-sdk'

import { fromTokenAmount } from '@utils/calculations'
import { useAtomValue } from 'jotai'
import { addressesAtom, isWethToken0Atom } from '../positions/atoms'
import BigNumber from 'bignumber.js'
import { BIG_ZERO, OSQUEETH_DECIMALS } from '@constants/index'
import { controllerHelperHelperContractAtom } from '../contracts/atoms'
import useAppCallback from '@hooks/useAppCallback'
import { addressAtom } from '../wallet/atoms'
import { normFactorAtom } from '../controller/atoms'
import { Price, Token } from '@uniswap/sdk-core'
import JSBI from 'jsbi'
import { useHandleTransaction } from '../wallet/hooks'
const PRICE_FIXED_DIGITS = 8

// Opening a mint and LP position
export const useOpenPosition = () => {
  const { squeethPool } = useAtomValue(addressesAtom)
  const normalizationFactor = useAtomValue(normFactorAtom)
  const address = useAtomValue(addressAtom)
  const contract = useAtomValue(controllerHelperHelperContractAtom)
  const handleTransaction = useHandleTransaction()
  const openPosition = useAppCallback(
    async (
      ethAmount: BigNumber,
      squeethToMint: BigNumber,
      collateralAmount: BigNumber,
      vaultId: BigNumber,
      lowerTickInput: number,
      upperTickInput: number,
      onTxConfirmed?: () => void,
    ) => {
      const amount0Min = BIG_ZERO
      const amount1Min = BIG_ZERO
      const mintWSqueethAmount = fromTokenAmount(squeethToMint, OSQUEETH_DECIMALS).multipliedBy(normalizationFactor)

      // Closest 60 tick width above or below current tick (60 is minimum tick width for 30bps pool)

      // Closest valid lower tick
      const lowerTickBelow = lowerTickInput - (lowerTickInput % 60)
      const lowerTickAbove = lowerTickInput + (lowerTickInput % 60)
      const lowerTick =
        Math.abs(lowerTickAbove - lowerTickInput) < Math.abs(lowerTickBelow - lowerTickInput)
          ? lowerTickAbove
          : lowerTickBelow

      // Closest valid upper tick
      const upperTickBelow = upperTickInput - (upperTickInput % 60)
      const upperTickAbove = upperTickInput + (upperTickInput % 60)
      const upperTick =
        Math.abs(upperTickAbove - upperTickInput) < Math.abs(upperTickBelow - upperTickInput)
          ? upperTickAbove
          : upperTickBelow

      const params = {
        recipient: address,
        wPowerPerpPool: squeethPool,
        vaultId: vaultId,
        wPowerPerpAmount: mintWSqueethAmount,
        collateralToDeposit: collateralAmount,
        collateralToLp: BIG_ZERO,
        amount0Min: amount0Min,
        amount1Min: amount1Min,
        lowerTick: lowerTick,
        upperTick: upperTick,
      }

      return handleTransaction(
        contract!.methods.wMintLp(params, { value: collateralAmount }).send({
          from: address,
          value: fromTokenAmount(ethAmount, 18),
        }),
        onTxConfirmed,
      )
    },
    [],
  )
  return openPosition
}

export function getTickToPrice(baseToken?: Token, quoteToken?: Token, tick?: number): Price<Token, Token> | undefined {
  if (!baseToken || !quoteToken || typeof tick !== 'number') {
    return undefined
  }
  return tickToPrice(baseToken, quoteToken, tick)
}
