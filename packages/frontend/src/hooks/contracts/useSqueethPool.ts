import { Token } from '@uniswap/sdk-core'
import { Pool } from '@uniswap/v3-sdk'
import BigNumber from 'bignumber.js'
import { ethers } from 'ethers'
import { useEffect, useState } from 'react'
import { Contract } from 'web3-eth-contract'

import quoterABI from '../../abis/quoter.json'
import routerABI from '../../abis/swapRouter.json'
import uniABI from '../../abis/uniswapPool.json'
import { UNI_POOL_FEES } from '../../constants'
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
  const [ready, setReady] = useState(false);

  const { address, web3, networkId, handleTransaction } = useWallet()
  const { squeethPool, swapRouter, quoter, weth, wSqueeth } = useAddresses()

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
    }).catch(console.log)
    setReady(true)
    setWethPrice(toTokenAmount(new BigNumber(pool?.token0Price.toSignificant(18) || 0), 18))
  }, [squeethToken?.address, pool?.token1Price.toFixed(18)])

  const updateData = async () => {
    const { token0, token1, fee } = await getImmutables()
    const isWethToken0 = parseInt(weth, 16) < parseInt(wSqueeth, 16)
    
    const state = await getPoolState()
    const TokenA = new Token(networkId, token0, 18, isWethToken0 ? 'WETH' : 'SQE', isWethToken0 ? 'Wrapped Ether' : 'wSqueeth')
    const TokenB = new Token(networkId, token1, 18, isWethToken0 ? 'SQE' : 'WETH', isWethToken0 ? 'wSqueeth' : 'Wrapped Ether')
    
    const pool = new Pool(
      TokenA,
      TokenB,
      Number(fee),
      state.sqrtPriceX96.toString(),
      state.liquidity.toString(),
      Number(state.tick),
    )
    setPool(pool)
    setWethToken(isWethToken0 ? TokenA : TokenB)
    setSqueethToken(isWethToken0 ? TokenB : TokenA)
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
    const exactOutputParam = await getBuyParam(new BigNumber(amount))

    await handleTransaction(swapRouterContract?.methods.exactOutputSingle(exactOutputParam).send({
      from: address,
    }))
  }

  const buyForWETH = async (amount: number) => {
    const exactInputParam = getBuyParamForETH(new BigNumber(amount))

    await handleTransaction(swapRouterContract?.methods.exactInputSingle(exactInputParam).send({
      from: address,
      value: ethers.utils.parseEther(amount.toString()),
    }))
  }

  const sell = async (amount: number) => {
    const exactInputParam = getSellParam(new BigNumber(amount))

    await handleTransaction(swapRouterContract?.methods.exactInputSingle(exactInputParam).send({
      from: address
    }))
  }

  const getSellParam = (amount: BigNumber) => {
    return {
      tokenIn: squeethToken?.address,
      tokenOut: wethToken?.address,
      fee: UNI_POOL_FEES,
      recipient: address,
      deadline: Math.floor(Date.now() / 1000 + 86400), // uint256
      amountIn: ethers.utils.parseEther(amount.toString()),
      amountOutMinimum: 0, // Should be updated
      sqrtPriceLimitX96: 0
    }
  }

  const getBuyParam = async (amount: BigNumber) => {
    const amountMax = fromTokenAmount((await getBuyQuote(amount.toNumber())).integerValue(BigNumber.ROUND_CEIL), 18)

    return {
      tokenIn: wethToken?.address, // address
      tokenOut: squeethToken?.address, // address
      fee: UNI_POOL_FEES, // uint24
      recipient: address, // address
      deadline: Math.floor(Date.now() / 1000 + 86400), // uint256
      amountOut: ethers.utils.parseEther(amount.toString()), // uint256
      amountInMaximum: amountMax.toString(),
      sqrtPriceLimitX96: 0, // uint160
    }
  }

  const getBuyParamForETH = (amount: BigNumber) => {
    return {
      tokenIn: wethToken?.address,
      tokenOut: squeethToken?.address,
      fee: UNI_POOL_FEES,
      recipient: address,
      deadline: Math.floor(Date.now() / 1000 + 86400), // uint256
      amountIn: ethers.utils.parseEther(amount.toString()),
      amountOutMinimum: 0, // Should be updated
      sqrtPriceLimitX96: 0
    }
  }

  const getBuyQuote = async (amount: number) => {
    if (!amount) return new BigNumber(0)

    const params = {
      tokenIn: wethToken?.address, // address
      tokenOut: squeethToken?.address, // address
      fee: UNI_POOL_FEES, // uint24
      amount: ethers.utils.parseEther(amount.toString()), // uint256
      sqrtPriceLimitX96: 0, // uint160
    }

    const input = await quoterContract?.methods.quoteExactOutputSingle(params).call({
      gas: 470000,
    })


    if (!input?.amountIn) return new BigNumber(0)
    console.log(toTokenAmount(new BigNumber(input.amountIn), 18).toNumber())
    return toTokenAmount(new BigNumber(input.amountIn), 18)
  }

  const getBuyQuoteForETH = async (amount: number) => {
    if (!amount) return new BigNumber(0)

    const params = {
      tokenIn: wethToken?.address, // address
      tokenOut: squeethToken?.address, // address
      fee: UNI_POOL_FEES, // uint24
      amountIn: ethers.utils.parseEther(amount.toString()), // uint256
      sqrtPriceLimitX96: 0, // uint160
    }

    const input = await quoterContract?.methods.quoteExactInputSingle(params).call({
      gas: 470000,
    })


    if (!input?.amountOut) return new BigNumber(0)
    console.log(toTokenAmount(new BigNumber(input.amountOut), 18).toNumber())
    return toTokenAmount(new BigNumber(input.amountOut), 18)
  }

  return {
    pool,
    squeethToken,
    wethToken,
    squeethPrice,
    wethPrice,
    ready,
    buy,
    sell,
    buyForWETH,
    getBuyQuote,
    getSellParam,
    getBuyParam,
    getBuyQuoteForETH
  }
}
