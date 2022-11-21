import { nearestUsableTick, TickMath, encodeSqrtRatioX96, Position } from '@uniswap/v3-sdk'
import { useAtomValue } from 'jotai'
import BigNumber from 'bignumber.js'
import { useCallback } from 'react'
import { Contract } from 'web3-eth-contract'

import { INDEX_SCALE, OSQUEETH_DECIMALS, WETH_DECIMALS } from '@constants/index'
import { addressesAtom, isWethToken0Atom } from '@state/positions/atoms'
import { fromTokenAmount, toTokenAmount } from '@utils/calculations'
import {
  controllerHelperHelperContractAtom,
  nftManagerContractAtom,
  quoterContractAtom,
  squeethPoolContractAtom,
} from '@state/contracts/atoms'
import useAppCallback from '@hooks/useAppCallback'
import { useOSQTHPrice } from '@hooks/useOSQTHPrice'
import { addressAtom } from '@state/wallet/atoms'
import { useHandleTransaction } from '@state/wallet/hooks'
import { indexAtom, normFactorAtom, impliedVolAtom } from '@state/controller/atoms'
import { poolAtom } from '@state/squeethPool/atoms'
import { calculateLiquidationPriceForLP } from '@state/controller/utils'

/*** CONSTANTS ***/
const COLLAT_RATIO_FLASHLOAN = 2
const POOL_FEE = 3000
const x96 = new BigNumber(2).pow(96)
const FLASHLOAN_BUFFER = 0.02
export const MIN_COLLATERAL_RATIO = 150
export const DEFAULT_COLLATERAL_RATIO = 225

/*** ACTIONS ***/

// Opening a mint and LP position and depositing
export const useOpenPositionDeposit = () => {
  const { squeethPool } = useAtomValue(addressesAtom)
  const address = useAtomValue(addressAtom)
  const contract = useAtomValue(controllerHelperHelperContractAtom)
  const squeethPoolContract = useAtomValue(squeethPoolContractAtom)
  const isWethToken0 = useAtomValue(isWethToken0Atom)
  const normFactor = useAtomValue(normFactorAtom)
  const index = useAtomValue(indexAtom)

  const getNearestUsableTicks = useGetNearestUsableTicks()
  const handleTransaction = useHandleTransaction()

  const openPositionDeposit = useAppCallback(
    async (
      oSQTHToMint: BigNumber,
      ethInLP: BigNumber,
      ethInVault: BigNumber,
      lowerTickInput: number,
      upperTickInput: number,
      slippage: number,
      onTxRequested?: () => void,
      onTxConfirmed?: () => void,
    ) => {
      if (!squeethPoolContract || !contract || !address) return null

      const ticks = await getNearestUsableTicks(lowerTickInput, upperTickInput)
      if (!ticks) return null

      const { lowerTick, upperTick } = ticks
      const ethIndexPrice = toTokenAmount(index, 18).sqrt()

      const amount0New = isWethToken0 ? ethInLP : oSQTHToMint
      const amount1New = isWethToken0 ? oSQTHToMint : ethInLP
      const amount0Min = amount0New.times(new BigNumber(1).minus(slippage)).toFixed(0)
      const amount1Min = amount1New.times(new BigNumber(1).minus(slippage)).toFixed(0)

      const flashLoanAmount = new BigNumber(COLLAT_RATIO_FLASHLOAN + FLASHLOAN_BUFFER)
        .times(oSQTHToMint)
        .times(normFactor)
        .times(ethIndexPrice)
        .div(INDEX_SCALE)

      const flashloanWMintDepositNftParams = {
        wPowerPerpPool: squeethPool,
        vaultId: 0,
        wPowerPerpAmount: oSQTHToMint.toFixed(0),
        collateralToDeposit: ethInVault.plus(flashLoanAmount).toFixed(0),
        collateralToFlashloan: flashLoanAmount.toFixed(0),
        collateralToLp: ethInLP.toFixed(0),
        collateralToWithdraw: 0,
        amount0Min,
        amount1Min,
        lowerTick: lowerTick,
        upperTick: upperTick,
      }

      const txHash = handleTransaction(
        contract.methods.flashloanWMintLpDepositNft(flashloanWMintDepositNftParams).send({
          from: address,
          value: ethInLP.plus(ethInVault).toFixed(0),
        }),
        onTxConfirmed,
      )

      onTxRequested && onTxRequested()
      return txHash
    },
    [
      address,
      squeethPool,
      contract,
      squeethPoolContract,
      isWethToken0,
      index,
      normFactor,
      getNearestUsableTicks,
      handleTransaction,
    ],
  )

  return openPositionDeposit
}

/*** GETTERS ***/

export const useGetNearestUsableTicks = () => {
  const squeethPoolContract = useAtomValue(squeethPoolContractAtom)

  const getNearestUsableTicks = useAppCallback(
    async (lowerTickInput: number, upperTickInput: number) => {
      if (!squeethPoolContract) return null

      const { tick, tickSpacing } = await getPoolState(squeethPoolContract)
      const lowerTick = nearestUsableTick(lowerTickInput, Number(tickSpacing))
      const upperTick = nearestUsableTick(upperTickInput, Number(tickSpacing))
      return { lowerTick, upperTick, tick }
    },
    [squeethPoolContract],
  )

  return getNearestUsableTicks
}

// calculating ethInLP and ethInVault based on ethDeposit
export const useGetMintAndLPDeposits = () => {
  const getNearestUsableTicks = useGetNearestUsableTicks()
  const getOSQTHInLP = useGetOSQTHInLP()

  const index = useAtomValue(indexAtom)
  const normFactor = useAtomValue(normFactorAtom)

  const getMintAndLPDeposits = useAppCallback(
    async (
      ethDeposit: BigNumber,
      collatRatioPercent: BigNumber,
      usingUniswapLPNFTAsCollat,
      lowerTickInput: number,
      upperTickInput: number,
    ) => {
      const deposits = {
        ethInVault: new BigNumber(0),
        effectiveCollateralInVault: new BigNumber(0), // including the uniswap LP NFT value (if enabled)
        ethInLP: new BigNumber(0),
        oSQTHToMint: new BigNumber(0),
        minCollatRatioPercent: new BigNumber(MIN_COLLATERAL_RATIO),
      }

      const ticks = await getNearestUsableTicks(lowerTickInput, upperTickInput)
      if (!ticks) return null

      const { lowerTick, upperTick, tick } = ticks
      const collatRatio = collatRatioPercent.div(100)
      const ethIndexPrice = toTokenAmount(index, 18).sqrt()

      let start = new BigNumber(0)
      let end = new BigNumber(ethDeposit)
      const targetDeviation = new BigNumber(0.05)
      let pastDeviation = new BigNumber(Number.POSITIVE_INFINITY)

      while (start.lte(end)) {
        const ethInLP = start.plus(end).div(2)
        const oSQTHToMint = await getOSQTHInLP(ethInLP, lowerTick, upperTick, tick)
        if (!oSQTHToMint) return null

        const oSQTHInETH = oSQTHToMint.times(normFactor).times(ethIndexPrice).div(INDEX_SCALE)
        const effectiveCollateralInVault = collatRatio.times(
          oSQTHToMint.times(normFactor).times(ethIndexPrice).div(INDEX_SCALE),
        )

        const ethInVault = usingUniswapLPNFTAsCollat
          ? effectiveCollateralInVault.minus(ethInLP).minus(oSQTHInETH)
          : effectiveCollateralInVault
        const ethInVaultPos = BigNumber.max(ethInVault, 0) // ethInVault could be < 0

        const ethConsumed = ethInVaultPos.plus(ethInLP)
        const currentDeviation = ethDeposit.minus(ethConsumed)

        if (pastDeviation.eq(currentDeviation)) {
          break
        }
        pastDeviation = currentDeviation

        if (currentDeviation.gt(0) && currentDeviation.lte(targetDeviation)) {
          deposits.ethInVault = fromTokenAmount(ethInVaultPos, WETH_DECIMALS)
          deposits.effectiveCollateralInVault = fromTokenAmount(effectiveCollateralInVault, WETH_DECIMALS)
          deposits.ethInLP = fromTokenAmount(ethInLP, WETH_DECIMALS)
          deposits.oSQTHToMint = fromTokenAmount(oSQTHToMint, OSQUEETH_DECIMALS)

          /*
            When usingUniswapLPNFTAsCollat, there is a certain collatRatio after which ethInVault starts to go negative. 
            To prevent that case we set up a minCollatRatioPercent.
          */
          const minCollatRatioPercent = usingUniswapLPNFTAsCollat
            ? ethInLP.div(oSQTHInETH).plus(1).multipliedBy(100).integerValue(BigNumber.ROUND_CEIL)
            : new BigNumber(MIN_COLLATERAL_RATIO)

          deposits.minCollatRatioPercent = BigNumber.max(minCollatRatioPercent, MIN_COLLATERAL_RATIO) // make sure this doesn't go below MIN_COLLATERAL_RATIO

          break
        } else {
          if (currentDeviation.gt(0)) {
            start = ethInLP
          } else {
            end = ethInLP
          }
        }
      }

      return deposits
    },
    [index, normFactor, getNearestUsableTicks, getOSQTHInLP],
  )

  return getMintAndLPDeposits
}

export const useGetLiquidationPrice = () => {
  const impliedVol = useAtomValue(impliedVolAtom)
  const isWethToken0 = useAtomValue(isWethToken0Atom)
  const normFactor = useAtomValue(normFactorAtom)
  const pool = useAtomValue(poolAtom)

  const getLiquidity = useGetLiquidityFromOSQTHAmount()
  const getNearestUsableTicks = useGetNearestUsableTicks()
  const getTickPrices = useGetTickPrices()

  const getLiquidationPrice = useCallback(
    async (
      ethInVault: BigNumber,
      oSQTHToMint: BigNumber,
      usingUniswapLPNFTAsCollateral: boolean,
      lowerTickInput: number,
      upperTickInput: number,
    ) => {
      if (!pool) return null

      if (!usingUniswapLPNFTAsCollateral && oSQTHToMint.gt(0)) {
        const rSqueeth = oSQTHToMint.multipliedBy(normFactor).dividedBy(INDEX_SCALE)
        const liquidationPrice = ethInVault.div(rSqueeth.multipliedBy(1.5))
        return liquidationPrice
      }

      const ticks = await getNearestUsableTicks(lowerTickInput, upperTickInput)
      if (!ticks) return null

      const { lowerTick, upperTick, tick } = ticks

      const { sqrtLowerPrice, sqrtUpperPrice, sqrtCurrentPrice } = await getTickPrices(lowerTick, upperTick, tick)
      const liquidity = await getLiquidity(oSQTHToMint, sqrtLowerPrice, sqrtUpperPrice, sqrtCurrentPrice)

      const position = new Position({
        pool,
        tickLower: lowerTick,
        tickUpper: upperTick,
        liquidity: liquidity.integerValue().toNumber(),
      })

      const liquidationPrice = calculateLiquidationPriceForLP(
        toTokenAmount(ethInVault, 18),
        toTokenAmount(oSQTHToMint, 18),
        position!,
        isWethToken0,
        normFactor,
        impliedVol,
      )

      return liquidationPrice
    },
    [getLiquidity, impliedVol, isWethToken0, normFactor, pool, getNearestUsableTicks, getTickPrices],
  )

  return getLiquidationPrice
}

export const useGetPosition = () => {
  const contract = useAtomValue(nftManagerContractAtom)

  const getPosition = useCallback(
    async (uniTokenId: number) => {
      if (!contract) return null
      const position = await contract.methods.positions(uniTokenId).call()
      const {
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
        tokensOwed1,
      } = position
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
        tokensOwed1,
      }
    },
    [contract],
  )

  return getPosition
}

export const useGetLiquidityFromETHAmount = () => {
  const isWethToken0 = useAtomValue(isWethToken0Atom)

  const getLiquidity = useCallback(
    async (ethAmount: BigNumber, sqrtLowerPrice: BigNumber, sqrtUpperPrice: BigNumber, sqrtCurrentPrice: BigNumber) => {
      if (isWethToken0) {
        // Lx = x * (sqrtCurrentPrice * sqrtUpperPrice) / (sqrtUpperPrice - sqrtCurrentPrice)
        return ethAmount.times(sqrtCurrentPrice.times(sqrtUpperPrice)).div(sqrtUpperPrice.minus(sqrtCurrentPrice))
      } else {
        // Ly = y / (sqrtCurrentPrice - sqrtLowerPrice)
        return ethAmount.div(sqrtCurrentPrice.minus(sqrtLowerPrice))
      }
    },
    [isWethToken0],
  )

  return getLiquidity
}

export const useGetLiquidityFromOSQTHAmount = () => {
  const isWethToken0 = useAtomValue(isWethToken0Atom)

  const getLiquidity = useCallback(
    async (
      squeethAmount: BigNumber,
      sqrtLowerPrice: BigNumber,
      sqrtUpperPrice: BigNumber,
      sqrtCurrentPrice: BigNumber,
    ) => {
      if (isWethToken0) {
        // Ly = y / (sqrtCurrentPrice - sqrtLowerPrice)
        return squeethAmount.div(sqrtCurrentPrice.minus(sqrtLowerPrice))
      } else {
        // Lx = x * (sqrtCurrentPrice * sqrtUpperPrice) / (sqrtUpperPrice - sqrtCurrentPrice)
        return squeethAmount.times(sqrtCurrentPrice.times(sqrtUpperPrice)).div(sqrtUpperPrice.minus(sqrtCurrentPrice))
      }
    },
    [isWethToken0],
  )

  return getLiquidity
}

export const useGetOSQTHInLP = () => {
  const isWethToken0 = useAtomValue(isWethToken0Atom)
  const getLiquidity = useGetLiquidityFromETHAmount()
  const getTickPrices = useGetTickPrices()

  const getOSQTHInLP = useCallback(
    async (ethInLP: BigNumber, lowerTick: Number, upperTick: Number, tick: number) => {
      const { sqrtLowerPrice, sqrtUpperPrice, sqrtCurrentPrice } = await getTickPrices(lowerTick, upperTick, tick)

      if (
        (sqrtUpperPrice.lt(sqrtCurrentPrice) && !isWethToken0) ||
        (sqrtLowerPrice.gt(sqrtCurrentPrice) && isWethToken0)
      ) {
        // All weth position
        console.log('LPing an all WETH position is not enabled, but you can rebalance to this position.')
        return
      } else if (
        (sqrtLowerPrice.gt(sqrtCurrentPrice) && !isWethToken0) ||
        (sqrtUpperPrice.lt(sqrtCurrentPrice) && isWethToken0)
      ) {
        // All squeeth position
        return new BigNumber(0)
      } else {
        // isWethToken0 -> y = Lx * (sqrtCurrentPrice - sqrtLowerPrice)
        // !isWethToken0  -> x = Ly * (sqrtUpperPrice - sqrtCurrentPrice)/(sqrtCurrentPrice * sqrtUpperPrice)

        const liquidity = await getLiquidity(ethInLP, sqrtLowerPrice, sqrtUpperPrice, sqrtCurrentPrice)
        return isWethToken0
          ? liquidity.times(sqrtCurrentPrice.minus(sqrtLowerPrice))
          : liquidity.times(sqrtUpperPrice.minus(sqrtCurrentPrice)).div(sqrtCurrentPrice.times(sqrtUpperPrice))
      }
    },
    [isWethToken0, getLiquidity, getTickPrices],
  )

  return getOSQTHInLP
}

export const useGetCollateralToLP = () => {
  const isWethToken0 = useAtomValue(isWethToken0Atom)
  const getLiquidity = useGetLiquidityFromOSQTHAmount()
  const getTickPrices = useGetTickPrices()

  const getCollateralToLP = useCallback(
    async (squeethAmount: BigNumber, lowerTick: Number, upperTick: Number, tick: number) => {
      const { sqrtLowerPrice, sqrtUpperPrice, sqrtCurrentPrice } = await getTickPrices(lowerTick, upperTick, tick)

      if (
        (sqrtUpperPrice.lt(sqrtCurrentPrice) && !isWethToken0) ||
        (sqrtLowerPrice.gt(sqrtCurrentPrice) && isWethToken0)
      ) {
        // All weth position
        console.log('LPing an all WETH position is not enabled, but you can rebalance to this position.')
        return
      } else if (
        (sqrtLowerPrice.gt(sqrtCurrentPrice) && !isWethToken0) ||
        (sqrtUpperPrice.lt(sqrtCurrentPrice) && isWethToken0)
      ) {
        // All squeeth position
        return new BigNumber(0)
      } else {
        // isWethToken0  -> x = Ly * (sqrtUpperPrice - sqrtCurrentPrice)/(sqrtCurrentPrice * sqrtUpperPrice)
        // !isWethToken0 -> y = Lx * (sqrtCurrentPrice - sqrtLowerPrice)

        const liquidity = await getLiquidity(squeethAmount, sqrtLowerPrice, sqrtUpperPrice, sqrtCurrentPrice)
        return isWethToken0
          ? liquidity.times(sqrtUpperPrice.minus(sqrtCurrentPrice)).div(sqrtCurrentPrice.times(sqrtUpperPrice))
          : liquidity.times(sqrtCurrentPrice.minus(sqrtLowerPrice))
      }
    },
    [isWethToken0, getLiquidity, getTickPrices],
  )

  return getCollateralToLP
}

export const useGetTickPrices = () => {
  const getTickPrices = useCallback((lowerTick: Number, upperTick: Number, currentTick: number) => {
    const sqrtLowerPrice = new BigNumber(TickMath.getSqrtRatioAtTick(Number(lowerTick)).toString()).div(x96)
    const sqrtUpperPrice = new BigNumber(TickMath.getSqrtRatioAtTick(Number(upperTick)).toString()).div(x96)
    const sqrtCurrentPrice = new BigNumber(TickMath.getSqrtRatioAtTick(Number(currentTick)).toString()).div(x96)
    return { sqrtLowerPrice, sqrtUpperPrice, sqrtCurrentPrice }
  }, [])

  return getTickPrices
}

export const useGetTicksFromETHPrice = () => {
  const isWethToken0 = useAtomValue(isWethToken0Atom)
  const oSQTHPrice = useOSQTHPrice()

  const getTicksFromETHPrice = useAppCallback(
    (minETHPrice: BigNumber, maxETHPrice: BigNumber) => {
      // encodeSqrtRatioX96 = √P * 2**96, where P = Price of token0 in terms of token1
      // if isWethToken0 then P = Price(WETH) / Price(oSQTH)
      const pa = isWethToken0 ? minETHPrice.div(oSQTHPrice).integerValue() : oSQTHPrice.div(maxETHPrice).integerValue()
      const pb = isWethToken0 ? maxETHPrice.div(oSQTHPrice).integerValue() : oSQTHPrice.div(minETHPrice).integerValue()

      const lowerTick =
        pa.isFinite() && !pa.isZero()
          ? TickMath.getTickAtSqrtRatio(encodeSqrtRatioX96(pa.toNumber(), 1))
          : TickMath.MIN_TICK

      const upperTick =
        pb.isFinite() && !pb.isZero()
          ? TickMath.getTickAtSqrtRatio(encodeSqrtRatioX96(pb.toNumber(), 1))
          : TickMath.MAX_TICK

      return { lowerTick, upperTick }
    },
    [isWethToken0, oSQTHPrice],
  )

  return getTicksFromETHPrice
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
  const { weth, oSqueeth } = useAtomValue(addressesAtom)

  const getExactIn = useCallback(
    async (amount: BigNumber, squeethIn: boolean) => {
      if (!contract) return null

      const QuoteExactInputSingleParams = {
        tokenIn: squeethIn ? oSqueeth : weth,
        tokenOut: squeethIn ? weth : oSqueeth,
        amountIn: amount.toFixed(0),
        fee: POOL_FEE,
        sqrtPriceLimitX96: 0,
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
  const { weth, oSqueeth } = useAtomValue(addressesAtom)

  const getExactOut = useCallback(
    async (amount: BigNumber, squeethOut: boolean) => {
      if (!contract) return null

      const QuoteExactOutputSingleParams = {
        tokenIn: squeethOut ? weth : oSqueeth,
        tokenOut: squeethOut ? oSqueeth : weth,
        amount: amount.toFixed(0),
        fee: POOL_FEE,
        sqrtPriceLimitX96: 0,
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
    poolContract.methods.tickSpacing().call(),
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
    tickSpacing,
  }

  return PoolState
}
