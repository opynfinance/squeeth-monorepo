import { Token } from '@uniswap/sdk-core'
import { Pool } from '@uniswap/v3-sdk'
import BigNumber from 'bignumber.js'
import { ethers } from 'ethers'
import { useEffect, useState } from 'react'
import { Contract } from 'web3-eth-contract'

import quoterABI from '../../abis/quoter.json'
import routerABI from '../../abis/swapRouter.json'
import uniABI from '../../abis/uniswapPool.json'
import { useWallet } from '../../context/wallet'
import { fromTokenAmount, toTokenAmount } from '../../utils/calculations'
import { useAddresses } from '../useAddress'

/**
 * Hook to interact with WETH contract
 */
export const useSqueethPool = () => {
  const [squeethContract, setSqueethContract] = useState<Contract>()
  const [swapRouterContract, setSwapRouterContract] = useState<Contract>()
  const [quoterContract, setQuoterContract] = useState<Contract>()
  const [pool, setPool] = useState<Pool>()
  const [wethToken, setWethToken] = useState<Token>()
  const [squeethToken, setSqueethToken] = useState<Token>()
  const [squeethPrice, setSqueethPrice] = useState<BigNumber>(new BigNumber(0))
  const [wethPrice, setWethPrice] = useState<BigNumber>(new BigNumber(0))

  const { address, web3, networkId } = useWallet()
  const { squeethPool, swapRouter, quoter } = useAddresses()

  useEffect(() => {
    if (!web3 || !squeethPool || !swapRouter) return
    setSqueethContract(new web3.eth.Contract(uniABI as any, squeethPool))
    setSwapRouterContract(new web3.eth.Contract(routerABI as any, swapRouter))
    setQuoterContract(new web3.eth.Contract(quoterABI as any, quoter))
  }, [web3])

  useEffect(() => {
    if (!squeethContract || !address) return

    updateData()
  }, [squeethContract, address])

  useEffect(() => {
    if (!squeethToken?.address) return
    getBuyQuote(1).then((val) => {
      setSqueethPrice(val)
    })
    setWethPrice(toTokenAmount(new BigNumber(pool?.token0Price.toSignificant(18) || 0), 18))
  }, [squeethToken?.address, pool?.token1Price.toFixed(18)])

  const updateData = async () => {
    const { token0, token1, fee } = await getImmutables()
    const state = await getPoolState()
    const TokenA = new Token(networkId, token0, 18, 'WETH', 'Wrapped Ether')
    const TokenB = new Token(networkId, token1, 18, 'SQE', 'wSqueeth')

    const pool = new Pool(
      TokenA,
      TokenB,
      Number(fee),
      state.sqrtPriceX96.toString(),
      state.liquidity.toString(),
      Number(state.tick),
    )
    setPool(pool)
    setWethToken(TokenA)
    setSqueethToken(TokenB)
  }

  const getImmutables = async () => {
    return {
      token0: await squeethContract?.methods.token0().call(),
      token1: await squeethContract?.methods.token1().call(),
      fee: await squeethContract?.methods.fee().call(),
      tickSpacing: await squeethContract?.methods.tickSpacing().call(),
      maxLiquidityPerTick: await squeethContract?.methods.maxLiquidityPerTick().call(),
    }
  }

  async function getPoolState() {
    const slot = await squeethContract?.methods.slot0().call()
    const PoolState = {
      liquidity: await squeethContract?.methods.liquidity().call(),
      sqrtPriceX96: slot[0],
      tick: slot[1],
      observationIndex: slot[2],
      observationCardinality: slot[3],
      observationCardinalityNext: slot[4],
      feeProtocol: slot[5],
      unlocked: slot[6],
    }
    return PoolState
  }

  const buy = async (amount: number) => {
    const amountMax = fromTokenAmount((await getBuyQuote(amount)).integerValue(BigNumber.ROUND_CEIL), 18)

    const exactOutputParam = {
      tokenIn: wethToken?.address, // address
      tokenOut: squeethToken?.address, // address
      fee: 3000, // uint24
      recipient: address, // address
      deadline: Math.floor(Date.now() / 1000 + 86400), // uint256
      amountOut: ethers.utils.parseEther(amount.toString()), // uint256
      amountInMaximum: amountMax.toString(),
      sqrtPriceLimitX96: 0, // uint160
    }

    await swapRouterContract?.methods.exactOutputSingle(exactOutputParam).send({
      from: address,
    })
  }

  const getBuyQuote = async (amount: number) => {
    if (!amount) return new BigNumber(0)

    const params = {
      tokenIn: wethToken?.address, // address
      tokenOut: squeethToken?.address, // address
      fee: 3000, // uint24
      amount: ethers.utils.parseEther(amount.toString()), // uint256
      sqrtPriceLimitX96: 0, // uint160
    }
    const input = await quoterContract?.methods.quoteExactOutputSingle(params).call({
      gas: 470000,
    })

    if (!input?.amountIn) return new BigNumber(0)
    return toTokenAmount(new BigNumber(input.amountIn), 18)
  }

  return {
    pool,
    squeethToken,
    wethToken,
    squeethPrice,
    wethPrice,
    buy,
    getBuyQuote,
  }
}
