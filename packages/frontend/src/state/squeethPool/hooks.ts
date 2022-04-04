import { Contract } from 'web3-eth-contract'
import { Token, CurrencyAmount, Fraction, Percent } from '@uniswap/sdk-core'
import { nearestUsableTick, Pool, Route, TickMath, Trade } from '@uniswap/v3-sdk'
import { useUpdateAtom, useResetAtom } from 'jotai/utils'
import { useEffect, useCallback } from 'react'
import { useAtomValue } from 'jotai'
import BigNumber from 'bignumber.js'
import { ethers } from 'ethers'
import { AlphaRouter, ChainId, QUOTER_V2_ADDRESS, setGlobalLogger, SwapToRatioStatus, UniswapMulticallProvider, V3QuoteProvider } from '@uniswap/smart-order-router'

import routerABI from '../../abis/swapRouter.json'
import { addressesAtom, isWethToken0Atom } from '../positions/atoms'
import { addressAtom, networkIdAtom, web3Atom } from '../wallet/atoms'
import useUniswapTicks from '@hooks/useUniswapTicks'
import { DEFAULT_SLIPPAGE, OSQUEETH_DECIMALS, UNI_POOL_FEES, WETH_DECIMALS } from '@constants/index'
import { fromTokenAmount, parseSlippageInput } from '@utils/calculations'
import { useETHPrice } from '@hooks/useETHPrice'
import { useHandleTransaction } from '../wallet/hooks'
import {
  poolAtom,
  wethTokenAtom,
  squeethTokenAtom,
  squeethInitialPriceAtom,
  squeethPriceeAtom,
  readyAtom,
} from './atoms'
import { transactionHashAtom } from '../trade/atoms'
import { swapRouterContractAtom, squeethPoolContractAtom } from '../contracts/atoms'
import { Position } from '@uniswap/v3-sdk'
import { getPoolState } from './utils'
import { Networks } from '../../types'
import { V3PoolProvider } from '@utils/v3-ropsten-pool-provider'

const getImmutables = async (squeethContract: Contract) => {
  const [token0, token1, fee, tickSpacing, maxLiquidityPerTick] = await Promise.all([
    squeethContract?.methods.token0().call(),
    squeethContract?.methods.token1().call(),
    squeethContract?.methods.fee().call(),
    squeethContract?.methods.tickSpacing().call(),
    squeethContract?.methods.maxLiquidityPerTick().call(),
  ])

  return { token0, token1, fee, tickSpacing, maxLiquidityPerTick }
}



export const useUpdateSqueethPoolData = () => {
  const isWethToken0 = useAtomValue(isWethToken0Atom)
  const networkId = useAtomValue(networkIdAtom)
  const setPool = useUpdateAtom(poolAtom)
  const setWethToken = useUpdateAtom(wethTokenAtom)
  const setSqueethToken = useUpdateAtom(squeethTokenAtom)
  const contract = useAtomValue(squeethPoolContractAtom)
  const { ticks } = useUniswapTicks()
  useEffect(() => {
    ; (async () => {
      const { token0, token1, fee } = await getImmutables(contract!)

      const state = await getPoolState(contract!)
      const TokenA = new Token(
        networkId,
        token0,
        isWethToken0 ? 18 : OSQUEETH_DECIMALS,
        isWethToken0 ? 'WETH' : 'SQE',
        isWethToken0 ? 'Wrapped Ether' : 'oSqueeth',
      )
      const TokenB = new Token(
        networkId,
        token1,
        isWethToken0 ? OSQUEETH_DECIMALS : 18,
        isWethToken0 ? 'SQE' : 'WETH',
        isWethToken0 ? 'oSqueeth' : 'Wrapped Ether',
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

      setPool(pool)
      setWethToken(isWethToken0 ? TokenA : TokenB)
      setSqueethToken(isWethToken0 ? TokenB : TokenA)
    })()
  }, [isWethToken0, networkId, ticks?.length, contract])
}

export const useGetBuyQuoteForETH = () => {
  const pool = useAtomValue(poolAtom)
  const wethToken = useAtomValue(wethTokenAtom)
  const squeethToken = useAtomValue(squeethTokenAtom)
  //If I input an exact amount of ETH I want to spend, tells me how much Squeeth I'd purchase
  const getBuyQuoteForETH = useCallback(
    async (ETHAmount: BigNumber, slippageAmount = new BigNumber(DEFAULT_SLIPPAGE)) => {
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
        const rawAmount = CurrencyAmount.fromRawAmount(wethToken!, fromTokenAmount(ETHAmount, 18).toString())

        if (rawAmount.equalTo(0)) {
          return emptyState
        }

        const trade = await Trade.exactIn(route, rawAmount)

        //the amount of squeeth I'm getting out
        return {
          amountOut: new BigNumber(trade.outputAmount.toSignificant(OSQUEETH_DECIMALS)),
          minimumAmountOut: new BigNumber(
            trade.minimumAmountOut(parseSlippageInput(slippageAmount.toString())).toSignificant(OSQUEETH_DECIMALS),
          ),
          priceImpact: trade.priceImpact.toFixed(2),
        }
      } catch (e) {
        console.log(e)
      }

      return emptyState
    },
    [pool, wethToken?.address, squeethToken?.address],
  )

  return getBuyQuoteForETH
}

export const useUpdateSqueethPrices = () => {
  const setSqueethInitialPrice = useUpdateAtom(squeethInitialPriceAtom)
  const setSqueethPrice = useUpdateAtom(squeethPriceeAtom)
  const setReady = useUpdateAtom(readyAtom)

  const squeethToken = useAtomValue(squeethTokenAtom)
  const pool = useAtomValue(poolAtom)
  const isWethToken0 = useAtomValue(isWethToken0Atom)
  const getBuyQuoteForETH = useGetBuyQuoteForETH()
  useEffect(() => {
    if (!squeethToken?.address || !pool) return
    getBuyQuoteForETH(new BigNumber(1))
      .then((val) => {
        setSqueethPrice(val.amountOut)
        setSqueethInitialPrice(
          new BigNumber(
            !isWethToken0 ? pool?.token0Price.toSignificant(18) || 0 : pool?.token1Price.toSignificant(18) || 0,
          ),
        )
        setReady(true)
      })
      .catch(console.log)
  }, [squeethToken?.address, pool?.token1Price.toFixed(18), isWethToken0])
}

export const useGetWSqueethPositionValue = () => {
  const ethPrice = useETHPrice()
  const squeethInitialPrice = useAtomValue(squeethInitialPriceAtom)
  const getWSqueethPositionValue = useCallback(
    (amount: BigNumber | number) => {
      return new BigNumber(amount).times(squeethInitialPrice).times(ethPrice)
    },
    [ethPrice?.toString(), squeethInitialPrice?.toString()],
  )

  return getWSqueethPositionValue
}

export const useGetWSqueethPositionValueInETH = () => {
  const squeethInitialPrice = useAtomValue(squeethInitialPriceAtom)
  const getWSqueethPositionValueInETH = (amount: BigNumber | number) => {
    return new BigNumber(amount).times(squeethInitialPrice)
  }

  return getWSqueethPositionValueInETH
}

export const useGetBuyQuote = () => {
  const pool = useAtomValue(poolAtom)
  const wethToken = useAtomValue(wethTokenAtom)
  const squeethToken = useAtomValue(squeethTokenAtom)
  //If I input an exact amount of squeeth I want to buy, tells me how much ETH I need to pay to purchase that squeeth
  const getBuyQuote = useCallback(
    async (squeethAmount: BigNumber, slippageAmount = new BigNumber(DEFAULT_SLIPPAGE)) => {
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
        const rawAmount = CurrencyAmount.fromRawAmount(
          squeethToken!,
          fromTokenAmount(squeethAmount, OSQUEETH_DECIMALS).toFixed(0),
        )

        if (rawAmount.equalTo(0)) {
          return emptyState
        }

        const trade = await Trade.exactOut(route, rawAmount)

        //the amount of ETH I need to put in
        return {
          amountIn: new BigNumber(trade.inputAmount.toSignificant(18)),
          maximumAmountIn: new BigNumber(
            trade.maximumAmountIn(parseSlippageInput(slippageAmount.toString())).toSignificant(18),
          ),
          priceImpact: trade.priceImpact.toFixed(2),
        }
      } catch (e) {
        console.log(e)
      }

      return emptyState
    },
    [pool, wethToken?.address, squeethToken?.address],
  )

  return getBuyQuote
}

export const useGetBuyParam = () => {
  const address = useAtomValue(addressAtom)
  const squeethToken = useAtomValue(squeethTokenAtom)
  const wethToken = useAtomValue(wethTokenAtom)
  const getBuyQuote = useGetBuyQuote()
  const getBuyParam = async (amount: BigNumber) => {
    const amountMax = fromTokenAmount((await getBuyQuote(amount)).maximumAmountIn, 18)

    return {
      tokenIn: wethToken?.address, // address
      tokenOut: squeethToken?.address, // address
      fee: UNI_POOL_FEES, // uint24
      recipient: address, // address
      deadline: Math.floor(Date.now() / 1000 + 86400), // uint256
      amountOut: fromTokenAmount(amount, OSQUEETH_DECIMALS).toString(), // uint256
      amountInMaximum: amountMax.toString(),
      sqrtPriceLimitX96: 0, // uint160
    }
  }

  return getBuyParam
}

export const useBuy = () => {
  const address = useAtomValue(addressAtom)
  const swapRouterContract = useAtomValue(swapRouterContractAtom)
  const handleTransaction = useHandleTransaction()
  const getBuyParam = useGetBuyParam()
  const buy = async (amount: BigNumber) => {
    const exactOutputParam = await getBuyParam(amount)

    await handleTransaction(
      swapRouterContract?.methods.exactOutputSingle(exactOutputParam).send({
        from: address,
      }),
    )
  }
  return buy
}

export const useGetBuyParamForETH = () => {
  const address = useAtomValue(addressAtom)
  const squeethToken = useAtomValue(squeethTokenAtom)
  const wethToken = useAtomValue(wethTokenAtom)
  const getBuyQuoteForETH = useGetBuyQuoteForETH()
  const getBuyParamForETH = async (amount: BigNumber) => {
    const quote = await getBuyQuoteForETH(amount)

    return {
      tokenIn: wethToken?.address,
      tokenOut: squeethToken?.address,
      fee: UNI_POOL_FEES,
      recipient: address,
      deadline: Math.floor(Date.now() / 1000 + 86400), // uint256
      amountIn: fromTokenAmount(amount, 18),
      amountOutMinimum: fromTokenAmount(quote.minimumAmountOut, OSQUEETH_DECIMALS).toString(),
      sqrtPriceLimitX96: 0,
    }
  }

  return getBuyParamForETH
}

export const useBuyForWETH = () => {
  const address = useAtomValue(addressAtom)
  const handleTransaction = useHandleTransaction()
  const swapRouterContract = useAtomValue(swapRouterContractAtom)
  const getBuyParamForETH = useGetBuyParamForETH()
  const buyForWETH = async (amount: BigNumber) => {
    const exactInputParam = await getBuyParamForETH(new BigNumber(amount))

    const txHash = await handleTransaction(
      swapRouterContract?.methods.exactInputSingle(exactInputParam).send({
        from: address,
        value: fromTokenAmount(amount, 18),
      }),
    )

    return txHash
  }

  return buyForWETH
}

export const useBuyAndRefundData = () => {
  const address = useAtomValue(addressAtom)
  const web3 = useAtomValue(web3Atom)
  const getBuyParamForETH = useGetBuyParamForETH()
  const buyAndRefundData = async (amount: BigNumber) => {
    if (!web3) return
    const exactInputParam = await getBuyParamForETH(amount)
    exactInputParam.recipient = address
    const tupleInput = Object.values(exactInputParam).map((v) => v?.toString() || '')

    const swapIface = new ethers.utils.Interface(routerABI)
    const encodedSwapCall = swapIface.encodeFunctionData('exactInputSingle', [tupleInput])
    const encodedRefundCall = swapIface.encodeFunctionData('refundETH')

    return [encodedSwapCall, encodedRefundCall]
  }

  return buyAndRefundData
}

export const useBuyAndRefund = () => {
  const address = useAtomValue(addressAtom)
  const handleTransaction = useHandleTransaction()
  const swapRouterContract = useAtomValue(swapRouterContractAtom)
  const buyAndRefundData = useBuyAndRefundData()

  const buyAndRefund = useCallback(
    async (amount: BigNumber, onTxConfirmed?: () => void) => {
      const callData = await buyAndRefundData(amount)

      const result = await handleTransaction(
        swapRouterContract?.methods.multicall(callData).send({
          from: address,
          value: fromTokenAmount(amount, 18),
        }),
        onTxConfirmed,
      )

      return result
    },
    [address, swapRouterContract, buyAndRefundData],
  )

  return buyAndRefund
}

export const useGetSellQuote = () => {
  const pool = useAtomValue(poolAtom)
  const squeethToken = useAtomValue(squeethTokenAtom)
  const wethToken = useAtomValue(wethTokenAtom)
  //I input an exact amount of squeeth I want to sell, tells me how much ETH I'd receive
  const getSellQuote = useCallback(
    async (squeethAmount: BigNumber, slippageAmount = new BigNumber(DEFAULT_SLIPPAGE)) => {
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
        const rawAmount = CurrencyAmount.fromRawAmount(
          squeethToken!,
          fromTokenAmount(squeethAmount, OSQUEETH_DECIMALS).toFixed(0),
        )

        if (rawAmount.equalTo(0)) {
          return emptyState
        }

        const trade = await Trade.exactIn(route, rawAmount)

        //the amount of ETH I'm receiving
        return {
          amountOut: new BigNumber(trade.outputAmount.toSignificant(18)),
          minimumAmountOut: new BigNumber(
            trade.minimumAmountOut(parseSlippageInput(slippageAmount.toString())).toSignificant(18),
          ),
          priceImpact: trade.priceImpact.toFixed(2),
        }
      } catch (e) {
        console.log(e)
      }

      return emptyState
    },
    [pool, wethToken?.address, squeethToken?.address],
  )
  return getSellQuote
}

export const useGetSellParam = () => {
  const address = useAtomValue(addressAtom)
  const squeethToken = useAtomValue(squeethTokenAtom)
  const wethToken = useAtomValue(wethTokenAtom)
  const getSellQuote = useGetSellQuote()
  const getSellParam = useCallback(
    async (amount: BigNumber) => {
      const amountMin = fromTokenAmount((await getSellQuote(amount)).minimumAmountOut, 18)

      return {
        tokenIn: squeethToken?.address,
        tokenOut: wethToken?.address,
        fee: UNI_POOL_FEES,
        recipient: address,
        deadline: Math.floor(Date.now() / 1000 + 86400), // uint256
        amountIn: fromTokenAmount(amount, OSQUEETH_DECIMALS).toString(),
        amountOutMinimum: amountMin.toString(),
        sqrtPriceLimitX96: 0,
      }
    },
    [getSellQuote, squeethToken?.address, wethToken?.address, address],
  )
  return getSellParam
}

const useSellAndUnwrapData = () => {
  const address = useAtomValue(addressAtom)
  const web3 = useAtomValue(web3Atom)
  const { swapRouter } = useAtomValue(addressesAtom)
  const getSellParam = useGetSellParam()
  const getSellQuote = useGetSellQuote()
  const sellAndUnwrapData = async (amount: BigNumber) => {
    if (!web3) return
    const exactInputParam = await getSellParam(amount)
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

  return sellAndUnwrapData
}

export const useSell = () => {
  const address = useAtomValue(addressAtom)
  const handleTransaction = useHandleTransaction()
  const swapRouterContract = useAtomValue(swapRouterContractAtom)
  const sellAndUnwrapData = useSellAndUnwrapData()

  const sell = async (amount: BigNumber, onTxConfirmed?: () => void) => {
    const callData = await sellAndUnwrapData(amount)

    const result = await handleTransaction(
      swapRouterContract?.methods.multicall(callData).send({
        from: address,
      }),
      onTxConfirmed,
    )

    return result
  }
  return sell
}

export const useGetSellQuoteForETH = () => {
  const pool = useAtomValue(poolAtom)
  const squeethToken = useAtomValue(squeethTokenAtom)
  const wethToken = useAtomValue(wethTokenAtom)
  //I input an exact amount of ETH I want to receive, tells me how much squeeth I'd need to sell
  const getSellQuoteForETH = useCallback(
    async (ETHAmount: BigNumber, slippageAmount = new BigNumber(DEFAULT_SLIPPAGE)) => {
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
        const rawAmount = CurrencyAmount.fromRawAmount(wethToken!, fromTokenAmount(ETHAmount, 18).toFixed(0))

        if (rawAmount.equalTo(0)) {
          return emptyState
        }

        const trade = await Trade.exactOut(route, rawAmount)

        //the amount of squeeth I need to sell
        return {
          amountIn: new BigNumber(trade.inputAmount.toSignificant(18)),
          maximumAmountIn: new BigNumber(
            trade.maximumAmountIn(parseSlippageInput(slippageAmount.toString())).toSignificant(18),
          ),
          priceImpact: trade.priceImpact.toFixed(2),
        }
      } catch (e) {
        console.log(e)
      }

      return emptyState
    },
    [pool, squeethToken, wethToken],
  )

  return getSellQuoteForETH
}

export const useBuyAndLP = () => {
  const networkId = useAtomValue(networkIdAtom)
  const address = useAtomValue(addressAtom)
  const web3 = useAtomValue(web3Atom)
  const pool = useAtomValue(poolAtom)
  const isWethToken0 = useAtomValue(isWethToken0Atom)
  const contract = useAtomValue(squeethPoolContractAtom)

  // console.log(pool)
  const provider = new ethers.providers.Web3Provider(web3.currentProvider as any)
  let router: AlphaRouter
  const chainId = networkId as any as ChainId
  if (networkId === Networks.ROPSTEN) { // Use customised router for ropsten
    const multicall2Provider = new UniswapMulticallProvider(chainId, provider, 375_000);
    const v3QuoteProvider = new V3QuoteProvider(chainId,
      provider,
      multicall2Provider,
      {
        retries: 2,
        minTimeout: 100,
        maxTimeout: 1000,
      },
      {
        multicallChunk: 110,
        gasLimitPerCall: 1_200_000,
        quoteMinSuccessRate: 0.1,
      },
      {
        gasLimitOverride: 3_000_000,
        multicallChunk: 45,
      },
      {
        gasLimitOverride: 3_000_000,
        multicallChunk: 45,
      },
      {
        baseBlockOffset: -10,
        rollback: {
          enabled: true,
          attemptsBeforeRollback: 1,
          rollbackBlockOffset: -10,
        },
      },
      QUOTER_V2_ADDRESS[3]
    )
    router = new AlphaRouter({ chainId, provider, v3PoolProvider: new V3PoolProvider(web3!), v3QuoteProvider })
  } else {
    router = new AlphaRouter({ chainId, provider })
  }

  const getBuyAndLP = async () => {
    console.log(isWethToken0)
    const token0Balance = CurrencyAmount.fromRawAmount(pool?.token0!, fromTokenAmount(1, WETH_DECIMALS).toString())
    const token1Balance = CurrencyAmount.fromRawAmount(pool?.token1!, fromTokenAmount(0.4, WETH_DECIMALS).toString())
    const { tickSpacing } = await getImmutables(contract!)
    const state = await getPoolState(contract!)
    const tickSpacingInt = Number(tickSpacing)
    console.log(state.tick, tickSpacing)
    const position = new Position({
      pool: pool!,
      tickLower: nearestUsableTick(Number(state.tick), tickSpacingInt) - tickSpacingInt * 10,
      tickUpper: nearestUsableTick(Number(state.tick), tickSpacingInt) + tickSpacingInt * 10,
      liquidity: 1,
    })
    const routeToRatioResponse = await router.routeToRatio(
      token0Balance,
      token1Balance,
      position,
      {
        ratioErrorTolerance: new Fraction(1, 100),
        maxIterations: 6,
      },
      {
        swapOptions: {
          recipient: address!,
          slippageTolerance: parseSlippageInput(DEFAULT_SLIPPAGE.toString()),
          deadline: 100,
        },
        addLiquidityOptions: {
          tokenId: 10,
        },
      },
    )
    console.log(routeToRatioResponse.status)
    if (routeToRatioResponse.status === SwapToRatioStatus.SUCCESS) {
      console.log(
        routeToRatioResponse.status,
        routeToRatioResponse.result.trade.inputAmount.toSignificant(18),
        routeToRatioResponse.result.trade.outputAmount.toSignificant(18),
      )
    }
    if (routeToRatioResponse.status === SwapToRatioStatus.NO_ROUTE_FOUND) {
      console.log(routeToRatioResponse.error)
    }
  }

  return getBuyAndLP
}
