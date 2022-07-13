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
import { useGetDebtAmount, useGetTwapSqueethPrice, useGetVault } from '../controller/hooks'

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
        console.log("DecreaseLiquidityParams", DecreaseLiquidityParams)
  
        const decreaseLiquidity = await contract.methods.decreaseLiquidity(DecreaseLiquidityParams).call()
  
        return decreaseLiquidity
      },
      [contract],
    )
  
    return getDecreaseLiquiduity
  }