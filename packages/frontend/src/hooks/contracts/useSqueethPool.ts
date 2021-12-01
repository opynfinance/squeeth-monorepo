import { CurrencyAmount, Percent, Token } from '@uniswap/sdk-core'
import { NonfungiblePositionManager, Pool, Position, Route, Tick, Trade } from '@uniswap/v3-sdk'
import BigNumber from 'bignumber.js'
import { ethers, providers } from 'ethers'
import { useEffect, useState } from 'react'
import { Contract } from 'web3-eth-contract'

import quoterABI from '../../abis/quoter.json'
import routerABI from '../../abis/swapRouter.json'
import uniABI from '../../abis/uniswapPool.json'
import erc20Abi from '../../abis/erc20.json'

import { INDEX_SCALE, UNI_POOL_FEES, WSQUEETH_DECIMALS } from '../../constants'
import { useWallet } from '../../context/wallet'
import { fromTokenAmount, parseSlippageInput, toTokenAmount } from '../../utils/calculations'
import { useAddresses } from '../useAddress'
import { Networks } from '../../types'
import useUniswapTicks from '../useUniswapTicks'
import { useETHPrice } from '../../hooks/useETHPrice'
import { useTrade } from '../../context/trade'
// import univ3prices from '@thanpolas/univ3prices'
const univ3prices = require('@thanpolas/univ3prices')

const NETWORK_QUOTE_GAS_OVERRIDE: { [chainId: number]: number } = {
  [Networks.ARBITRUM_RINKEBY]: 6_000_000,
}
const DEFAULT_GAS_QUOTE = 2_000_000

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
  const [squeethInitialPrice, setSqueethInitialPrice] = useState<BigNumber>(new BigNumber(0))
  const [squeethPrice, setSqueethPrice] = useState<BigNumber>(new BigNumber(0))
  const [wethPrice, setWethPrice] = useState<BigNumber>(new BigNumber(0))
  const [ready, setReady] = useState(false)
  const [tvl, setTVL] = useState(0)
  const ethPrice = useETHPrice()

  const { address, web3, networkId, handleTransaction } = useWallet()
  const { squeethPool, swapRouter, quoter, weth, wSqueeth } = useAddresses()
  const { ticks } = useUniswapTicks()

  useEffect(() => {
    if (!web3 || !squeethPool || !swapRouter) return
    setSqueethContract(new web3.eth.Contract(uniABI as any, squeethPool))
    setSwapRouterContract(new web3.eth.Contract(routerABI as any, swapRouter))
    setQuoterContract(new web3.eth.Contract(quoterABI as any, quoter))
  }, [web3])

  useEffect(() => {
    if (!squeethContract || !ticks) return
    updateData()
    updatePoolTVL()
  }, [squeethContract, ticks?.length])

  useEffect(() => {
    if (!squeethToken?.address) return
    const isWethToken0 = parseInt(weth, 16) < parseInt(wSqueeth, 16)
    getBuyQuoteForETH(new BigNumber(1))
      .then((val) => {
        setSqueethPrice(val.amountOut)
        setSqueethInitialPrice(
          new BigNumber(
            !isWethToken0 ? pool?.token0Price.toSignificant(18) || 0 : pool?.token1Price.toSignificant(18) || 0,
          ),
        )
      })
      .catch(console.log)

    setReady(true)
    setWethPrice(
      toTokenAmount(
        new BigNumber(
          isWethToken0 ? pool?.token1Price.toSignificant(18) || 0 : pool?.token0Price.toSignificant(18) || 0,
        ),
        18,
      ),
    )
  }, [squeethToken?.address, pool?.token1Price.toFixed(18)])

  const updateData = async () => {
    const { token0, token1, fee } = await getImmutables()
    const isWethToken0 = parseInt(weth, 16) < parseInt(wSqueeth, 16)

    const state = await getPoolState()
    const TokenA = new Token(
      networkId,
      token0,
      isWethToken0 ? 18 : WSQUEETH_DECIMALS,
      isWethToken0 ? 'WETH' : 'SQE',
      isWethToken0 ? 'Wrapped Ether' : 'wSqueeth',
    )
    const TokenB = new Token(
      networkId,
      token1,
      isWethToken0 ? WSQUEETH_DECIMALS : 18,
      isWethToken0 ? 'SQE' : 'WETH',
      isWethToken0 ? 'wSqueeth' : 'Wrapped Ether',
    )

    const pool = new Pool(
      TokenA,
      TokenB,
      Number(fee),
      state.sqrtPriceX96.toString(),
      state.liquidity.toString(),
      Number(state.tick),
      ticks || [],
    )
    console.log(state.tick)

    //const setBeginningPrice =  pool.token0Price

    setPool(pool)
    setWethToken(isWethToken0 ? TokenA : TokenB)
    setSqueethToken(isWethToken0 ? TokenB : TokenA)
  }

  const updatePoolTVL = async () => {
    const isWethToken0 = parseInt(weth, 16) < parseInt(wSqueeth, 16)

    const state = await getPoolState()
    const ratio = univ3prices([18, 18], state.sqrtPriceX96).toAuto()
    const tokenPrice = isWethToken0 ? ratio * wethPrice.toNumber() : wethPrice.toNumber() / ratio
    // const wethContract = new ethers.Contract(weth, erc20Abi, new ethers.providers.Web3Provider(web3.currentProvider as any) || ethers.getDefaultProvider('ropsten'))

    // const wethBalance = ethers.utils.formatUnits(
    //   await (wethContract as any).balanceOf(pool),
    //   18
    // )

    // const tokenContract = new ethers.Contract(wSqueeth, erc20Abi, new ethers.providers.Web3Provider(web3.currentProvider as any)|| ethers.getDefaultProvider('ropsten'))

    // const tokenBalance = ethers.utils.formatUnits(
    //   await (tokenContract as any).balanceOf(pool),
    //   18
    // )
    // const tvl = tokenBalance * tokenPrice + wethPrice.toNumber() * wethBalance
    setTVL(tvl)
    console.log(tvl)
    return tvl
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

  function getWSqueethPositionValue(amount: BigNumber | number) {
    return new BigNumber(amount).times(squeethInitialPrice).times(ethPrice)
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

  const buy = async (amount: BigNumber) => {
    const exactOutputParam = await getBuyParam(amount)

    await handleTransaction(
      swapRouterContract?.methods.exactOutputSingle(exactOutputParam).send({
        from: address,
      }),
    )
  }

  const buyForWETH = async (amount: BigNumber) => {
    const exactInputParam = await getBuyParamForETH(new BigNumber(amount))

    const txHash = await handleTransaction(
      swapRouterContract?.methods.exactInputSingle(exactInputParam).send({
        from: address,
        value: ethers.utils.parseEther(amount.toString()),
      }),
    )

    return txHash
  }

  const sell = async (amount: BigNumber) => {
    const callData = await sellAndUnwrapData(amount)

    const txHash = await handleTransaction(
      swapRouterContract?.methods.multicall(callData).send({
        from: address,
      }),
    )

    return txHash
  }

  const sellAndUnwrapData = async (amount: BigNumber) => {
    if (!web3) return
    const exactInputParam = getSellParam(amount)
    exactInputParam.recipient = swapRouter
    const tupleInput = Object.values(exactInputParam).map((v) => v?.toString() || '')

    const { minimumAmountOut } = await getSellQuote(amount)
    const swapIface = new ethers.utils.Interface(routerABI)
    const encodedSwapCall = swapIface.encodeFunctionData('exactInputSingle', [tupleInput])
    const encodedUnwrapCall = swapIface.encodeFunctionData('unwrapWETH9', [
      fromTokenAmount(minimumAmountOut, 18).toString(),
      address,
    ])
    return [encodedSwapCall, encodedUnwrapCall]
  }

  const getSellParam = (amount: BigNumber) => {
    return {
      tokenIn: squeethToken?.address,
      tokenOut: wethToken?.address,
      fee: UNI_POOL_FEES,
      recipient: address,
      deadline: Math.floor(Date.now() / 1000 + 86400), // uint256
      amountIn: fromTokenAmount(amount, WSQUEETH_DECIMALS).toString(),
      amountOutMinimum: 0, // Should be updated
      sqrtPriceLimitX96: 0,
    }
  }

  const getBuyParam = async (amount: BigNumber) => {
    const amountMax = fromTokenAmount((await getBuyQuote(amount)).maximumAmountIn, 18)

    return {
      tokenIn: wethToken?.address, // address
      tokenOut: squeethToken?.address, // address
      fee: UNI_POOL_FEES, // uint24
      recipient: address, // address
      deadline: Math.floor(Date.now() / 1000 + 86400), // uint256
      amountOut: fromTokenAmount(amount, WSQUEETH_DECIMALS).toString(), // uint256
      amountInMaximum: amountMax.toString(),
      sqrtPriceLimitX96: 0, // uint160
    }
  }

  const getBuyParamForETH = async (amount: BigNumber) => {
    const quote = await getBuyQuoteForETH(amount)

    return {
      tokenIn: wethToken?.address,
      tokenOut: squeethToken?.address,
      fee: UNI_POOL_FEES,
      recipient: address,
      deadline: Math.floor(Date.now() / 1000 + 86400), // uint256
      amountIn: ethers.utils.parseEther(amount.toString()),
      amountOutMinimum: fromTokenAmount(quote.minimumAmountOut, WSQUEETH_DECIMALS).toString(),
      sqrtPriceLimitX96: 0,
    }
  }

  //If I input an exact amount of squeeth I want to buy, tells me how much ETH I need to pay to purchase that squeeth
  const getBuyQuote = async (squeethAmount: BigNumber, slippageAmount = new BigNumber(0.5)) => {
    const emptyState = {
      amountIn: new BigNumber(0),
      maximumAmountIn: new BigNumber(0),
      priceImpact: '0',
    }

    if (!squeethAmount || !pool) return emptyState

    try {
      //WETH is input token, squeeth is output token. I'm using WETH to buy Squeeth
      const route = new Route([pool], wethToken!, squeethToken!)
      //getting the amount of ETH I need to put in to get an exact amount of squeeth I inputted out
      const trade = await Trade.exactOut(
        route,
        CurrencyAmount.fromRawAmount(squeethToken!, fromTokenAmount(squeethAmount, WSQUEETH_DECIMALS).toNumber()),
      )

      console.log("get buy quote " + JSON.stringify(parseSlippageInput(slippageAmount.toString())))

      //the amount of ETH I need to put in
      return {
        amountIn: new BigNumber(trade.inputAmount.toSignificant(18)),
        maximumAmountIn: new BigNumber(trade.maximumAmountIn(parseSlippageInput(slippageAmount.toString())).toSignificant(18)),
        priceImpact: trade.priceImpact.toFixed(2),
      }
    } catch (e) {
      console.log(e)
    }

    return emptyState
  }

  //If I input an exact amount of ETH I want to spend, tells me how much Squeeth I'd purchase
  const getBuyQuoteForETH = async (ETHAmount: BigNumber, slippageAmount = new BigNumber(0.5)) => {
    const emptyState = {
      amountOut: new BigNumber(0),
      minimumAmountOut: new BigNumber(0),
      priceImpact: '0',
    }

    if (!ETHAmount || !pool) return emptyState

    try {
      //WETH is input token, squeeth is output token. I'm using WETH to buy Squeeth
      const route = new Route([pool], wethToken!, squeethToken!)
      //getting the amount of squeeth I'd get out for putting in an exact amount of ETH
      const trade = await Trade.exactIn(
        route,
        CurrencyAmount.fromRawAmount(wethToken!, fromTokenAmount(ETHAmount, 18).toNumber()),
      )

      console.log(slippageAmount.toString())

      console.log("get buy quote for eth " + JSON.stringify(parseSlippageInput(slippageAmount.toString())))

      //the amount of squeeth I'm getting out
      return {
        amountOut: new BigNumber(trade.outputAmount.toSignificant(WSQUEETH_DECIMALS)),
        minimumAmountOut: new BigNumber(trade.minimumAmountOut(parseSlippageInput(slippageAmount.toString())).toSignificant(WSQUEETH_DECIMALS)),
        priceImpact: trade.priceImpact.toFixed(2),
      }
    } catch (e) {
      console.log(e)
    }

    return emptyState
  }

  //I input an exact amount of squeeth I want to sell, tells me how much ETH I'd receive
  const getSellQuote = async (squeethAmount: BigNumber, slippageAmount = new BigNumber(0.5)) => {
    const emptyState = {
      amountOut: new BigNumber(0),
      minimumAmountOut: new BigNumber(0),
      priceImpact: '0',
    }
    if (!squeethAmount || !pool) return emptyState

    try {
      //squeeth is input token, WETH is output token. I'm selling squeeth for WETH
      const route = new Route([pool], squeethToken!, wethToken!)
      //getting the amount of ETH I'd receive for inputting the amount of squeeth I want to sell
      const trade = await Trade.exactIn(
        route,
        CurrencyAmount.fromRawAmount(squeethToken!, fromTokenAmount(squeethAmount, WSQUEETH_DECIMALS).toNumber()),
      )

      console.log("get sell quote " + JSON.stringify(parseSlippageInput(slippageAmount.toString())))


      //the amount of ETH I'm receiving
      return {
        amountOut: new BigNumber(trade.outputAmount.toSignificant(18)),
        minimumAmountOut: new BigNumber(trade.minimumAmountOut(parseSlippageInput(slippageAmount.toString())).toSignificant(18)),
        priceImpact: trade.priceImpact.toFixed(2),
      }
    } catch (e) {
      console.log(e)
    }

    return emptyState
  }

  //I input an exact amount of ETH I want to receive, tells me how much squeeth I'd need to sell
  const getSellQuoteForETH = async (ETHAmount: BigNumber, slippageAmount = new BigNumber(0.5)) => {
    const emptyState = {
      amountIn: new BigNumber(0),
      maximumAmountIn: new BigNumber(0),
      priceImpact: '0',
    }
    if (!ETHAmount || !pool) return emptyState

    try {
      //squeeth is input token, WETH is output token. I'm selling squeeth for WETH
      const route = new Route([pool], squeethToken!, wethToken!)
      //getting the amount of squeeth I'd need to sell to receive my desired amount of ETH
      const trade = await Trade.exactOut(
        route,
        CurrencyAmount.fromRawAmount(wethToken!, fromTokenAmount(ETHAmount, 18).toNumber()),
      )

      console.log("get sell quote for eth " + JSON.stringify(parseSlippageInput(slippageAmount.toString())))

      //the amount of squeeth I need to sell
      return {
        amountIn: new BigNumber(trade.inputAmount.toSignificant(18)),
        maximumAmountIn: new BigNumber(trade.maximumAmountIn(parseSlippageInput(slippageAmount.toString())).toSignificant(18)),
        priceImpact: trade.priceImpact.toFixed(2),
      }
    } catch (e) {
      console.log(e)
    }

    return emptyState
  }

  return {
    pool,
    squeethToken,
    wethToken,
    squeethInitialPrice,
    squeethPrice,
    wethPrice,
    ready,
    buy,
    sell,
    buyForWETH,
    tvl,
    getBuyQuote,
    getSellParam,
    getBuyParam,
    getBuyQuoteForETH,
    getSellQuote,
    getSellQuoteForETH,
    getWSqueethPositionValue,
  }
}
