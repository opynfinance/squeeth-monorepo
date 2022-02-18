import { useWallet } from '@context/wallet'
import { useAddresses } from '@hooks/useAddress'
import { useSqueethPool } from './useSqueethPool'
import { Position } from '@uniswap/v3-sdk'
import React, { useEffect, useState } from 'react'
import { Contract } from 'web3-eth-contract'
import positionManagerAbi from '../../abis/NFTpositionmanager.json'
import BigNumber from 'bignumber.js'
import { BIG_ZERO } from '../../constants'
import { fromTokenAmount, toTokenAmount } from '@utils/calculations'

export const useNFTManager = () => {
  const { nftManager } = useAddresses()
  const { address, web3 } = useWallet()
  const { pool, isWethToken0 } = useSqueethPool()

  const [contract, setContract] = useState<Contract>()

  useEffect(() => {
    if (!web3 || !nftManager) return
    setContract(new web3.eth.Contract(positionManagerAbi as any, nftManager))
  }, [web3])

  const getPosition = async (posId: number) => {
    console.log(contract, pool)
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

  const getETHandOSQTHAmount = async (posId: number) => {
    const result = await getPosition(posId)
    console.log(posId, result)
    if (!result) return { wethAmount: BIG_ZERO, oSqthAmount: BIG_ZERO }

    const { uniPosition, tokensOwed0, tokensOwed1 } = result
    const amt0 = new BigNumber(uniPosition.amount0.toSignificant(18))
    const amt1 = new BigNumber(uniPosition.amount1.toSignificant(18))

    const wethAmount = isWethToken0 ? amt0.plus(tokensOwed0) : amt1.plus(tokensOwed1)
    const oSqthAmount = !isWethToken0 ? amt0.plus(tokensOwed0) : amt1.plus(tokensOwed1)

    return { wethAmount, oSqthAmount, position: result.uniPosition }
  }

  return {
    getPosition,
    getETHandOSQTHAmount,
  }
}
