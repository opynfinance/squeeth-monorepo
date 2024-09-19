import BigNumber from 'bignumber.js'
import { Contract } from 'web3-eth-contract'
import { Position } from '@uniswap/v3-sdk'
import fzero from 'fzero'

import { toTokenAmount } from '@utils/calculations'
import { Vault } from '../../types'
import { FUNDING_PERIOD, INDEX_SCALE, BIG_ONE, SHUTDOWN_DATE, BIG_ZERO, OSQUEETH_DECIMALS } from '../../constants'
import floatifyBigNums from '@utils/floatifyBigNums'

/**
 * Liquidation price is calculated using this document: https://docs.google.com/document/d/1MzuPADIZqLm3aQu-Ri2Iyk9ZUvDA1D6oOikKwwjSC2M/edit
 *
 * If you have any doubts please ask Joe Clark aka alpinechicken 🦔
 */
export const calculateLiquidationPriceForLP = (
  ethCollat: BigNumber,
  shortAmount: BigNumber,
  position: Position,
  isWethToken0: boolean,
  normFactor: BigNumber,
  impliedVol: number,
) => {
  const liquidity = toTokenAmount(position.liquidity.toString(), 18)

  const ETH_LOWER_BOUND = 500
  const ETH_UPPER_BOUND = 30000

  const pa = !isWethToken0
    ? new BigNumber(position?.token0PriceLower.toSignificant(18) || 0)
    : new BigNumber(1).div(position?.token0PriceUpper.toSignificant(18) || 0)
  const pb = !isWethToken0
    ? new BigNumber(position?.token0PriceUpper.toSignificant(18) || 0)
    : new BigNumber(1).div(position?.token0PriceLower.toSignificant(18) || 0)

  const maxEth = liquidity.times(pb.sqrt().minus(pa.sqrt()))
  const maxSqth = liquidity.times(new BigNumber(1).div(pa.sqrt()).minus(new BigNumber(1).div(pb.sqrt())))

  const divider = shortAmount.times(1.5).times(normFactor)

  const ethValueFunction = (ethPrice: string) => {
    const _ethPrice = new BigNumber(ethPrice)
    const p = _ethPrice
      .times(normFactor)
      .times(Math.exp(impliedVol * impliedVol * 0.04794520548))
      .div(INDEX_SCALE)

    if (p.lt(pa)) {
      return maxSqth.times(p)
    }
    if (p.gt(pb)) {
      return maxEth
    }

    return liquidity.times(p.sqrt().times(2).minus(pa.sqrt()).minus(p.div(pb.sqrt())))
  }

  const fzeroFunction = (ethPrice: string) => {
    const _result = new BigNumber(ethPrice)
      .minus(ethValueFunction(ethPrice).plus(ethCollat).times(INDEX_SCALE).div(divider))
      .toString()
    return _result
  }

  const result = fzero(fzeroFunction, [ETH_LOWER_BOUND, ETH_UPPER_BOUND], { maxiter: 50 })

  return new BigNumber(result.solution)
}

type UnivariateFunction = (x: number) => number
/**
 * We need to find a zero for implied volatilty function and fzero is unreliable
 * so using bisection algorithm https://en.wikipedia.org/wiki/Bisection_method
 * */
export const bisection = (fn: UnivariateFunction, a: number, b: number, tolerance: number, maxIterations: number) => {
  let i = 0

  while (i < maxIterations) {
    const c = (a + b) / 2
    const f_c = fn(c)

    if (f_c === 0 || b - a < tolerance) {
      return c
    }

    i++

    if (fn(a) * f_c > 0) {
      a = c
    } else {
      b = c
    }
  }

  return 0 // Did not converge within maxIterations
}

/**
 * Squeeth price in shutdown
 * See development here https://colab.research.google.com/drive/1gNpmXwmYPsWHwaI_pjuq3L5biq7NJVCx#scrollTo=qtjMrP_F_91z
 * */
export const getSqueethPriceShutdown = (
  ethPrice: BigNumber,
  normFactor: BigNumber,
  daysToShutdown: number,
  ethVol: number,
) => {
  const expiringQuadraticToday = ethPrice.times(Math.exp((ethVol * ethVol * daysToShutdown) / 365))
  const expiringQuadraticTomorrow = ethPrice.times(Math.exp((ethVol * ethVol * (daysToShutdown - 1)) / 365))
  // alpha is a value that makes the shutdown squeeth have the same return as expiring squeeth over one day.
  const alpha = expiringQuadraticToday
    .minus(expiringQuadraticTomorrow)
    .div(
      expiringQuadraticToday
        .minus(expiringQuadraticTomorrow)
        .plus(expiringQuadraticToday.minus(ethPrice).div(FUNDING_PERIOD)),
    )
  return normFactor.times(ethPrice.plus(alpha.times(expiringQuadraticToday.minus(ethPrice))).div(INDEX_SCALE))
}

/**
 * Squeeth implied volatility in shutdown using bisection to find the zero
 * */
export const getSqueethImpliedVolatilityShutdown = (
  ethPrice: BigNumber,
  normFactor: BigNumber,
  daysToShutdown: number,
  price: number,
) => {
  const fn = (vol: number) => {
    return Number(getSqueethPriceShutdown(ethPrice, normFactor, daysToShutdown, vol)) - price
  }
  // params to find implied vol between 1% and 200% within 100 iterations
  const volLower = 0.01
  const volUpper = 2
  const tolerance = 1e-6
  const maxIterations = 100
  // find implied volatility to match the price
  const root = bisection(fn, volLower, volUpper, tolerance, maxIterations)
  return root
}

/**
 * Days until shutdown
 * */
export const getDaysToShutdown = () => {
  const now = new Date()
  const shutdownDate = new Date(SHUTDOWN_DATE)
  const millisecondsPerDay = 1000 * 60 * 60 * 24
  return (shutdownDate.getTime() - now.getTime()) / millisecondsPerDay
}

export async function getVault(vaultId: number, contract: Contract | null): Promise<Vault | null> {
  if (!contract) return null
  const vault = await contract.methods.vaults(vaultId).call()
  const { NftCollateralId, collateralAmount, shortAmount, operator } = vault

  return {
    id: vaultId,
    NFTCollateralId: NftCollateralId,
    collateralAmount: toTokenAmount(new BigNumber(collateralAmount), 18),
    shortAmount: toTokenAmount(new BigNumber(shortAmount), OSQUEETH_DECIMALS),
    operator,
  }
}

export async function getIndex(period: number, contract: Contract | null) {
  if (!contract) return BIG_ZERO

  const indexPrice = await contract.methods.getIndex(period.toString()).call()
  return new BigNumber(indexPrice).times(INDEX_SCALE).times(INDEX_SCALE)
}

export async function getMark(period: number, contract: Contract | null) {
  if (!contract) return BIG_ZERO
  const markPrice = await contract.methods.getDenormalizedMark(period.toString()).call()
  return new BigNumber(markPrice).times(INDEX_SCALE).times(INDEX_SCALE)
}

export async function getNormFactor(contract: Contract | null) {
  if (!contract) return BIG_ZERO
  const normFactor = await contract.methods.normalizationFactor().call()
  return new BigNumber(normFactor).dividedBy(BIG_ONE)
}

// Tries to get funding for the longest period available based on Uniswap storage slots, optimistically 24hrs, worst case spot
// TODO: get 24hr historical funding from the subgraph to have a value that isn't dynamic based on storage slots
export async function getDailyHistoricalFunding(contract: Contract | null) {
  if (!contract) return { period: 0, funding: 0 }
  let index = BIG_ZERO
  let mark = BIG_ZERO
  let period = 24
  let isError = false
  //start by trying 24hr twap, if fails try dividing by 2 until 45min minimum, fall back to spot otherwise
  for (; period >= 0.75; period = period / 2) {
    try {
      //convert period from hours to seconds
      index = await getIndex(period * 3600, contract)
      mark = await getMark(period * 3600, contract)
      isError = false
    } catch (error) {
      isError = true
    }
    if (isError === false) {
      break
    }
  }
  if (index.isEqualTo(0) || mark.isEqualTo(0)) {
    index = await getIndex(1, contract)
    mark = await getMark(1, contract)
  }

  if (index.isEqualTo(0)) {
    return { period: 0, funding: 0 }
  }

  console.log('period ' + period, floatifyBigNums({ mark, index }))

  const funding = Math.log(mark.dividedBy(index).toNumber()) / FUNDING_PERIOD

  return { period: period, funding: funding }
}

export async function getCurrentImpliedFunding(contract: Contract | null) {
  if (!contract) return 0
  const currIndex = await getIndex(1, contract)
  const currMark = await getMark(1, contract)
  if (currIndex.isEqualTo(0)) {
    return 0
  }

  return Math.log(currMark.dividedBy(currIndex).toNumber()) / FUNDING_PERIOD
}

/**
 * Implied funding before shutdown is perp funding + expected Mark/Index decay
 * */
export async function getCurrentImpliedFundingShutdown(contract: Contract | null) {
  if (!contract) return 0
  const currIndex = await getIndex(1, contract)
  const currMark = await getMark(1, contract)
  if (currIndex.isEqualTo(0)) {
    return 0
  }
  // First part of funding is normal funding calc
  const currentFunding = Math.log(currMark.dividedBy(currIndex).toNumber()) / FUNDING_PERIOD

  // // Second part of funding is Mark/Index decay
  const ethPrice = currIndex.dividedBy(BIG_ONE).sqrt()
  const normFactor = await getNormFactor(contract)
  const osqthPrice = Number(currMark.dividedBy(ethPrice).times(normFactor).dividedBy(BIG_ONE.times(INDEX_SCALE)))
  const ethVol = getSqueethImpliedVolatilityShutdown(ethPrice, normFactor, getDaysToShutdown(), osqthPrice)

  const markIndexDecay =
    1 -
    Number(getSqueethPriceShutdown(ethPrice, normFactor, getDaysToShutdown() - 1, ethVol)) /
      Number(getSqueethPriceShutdown(ethPrice, normFactor, getDaysToShutdown(), ethVol))

  return currentFunding + markIndexDecay
}

/**
 * Implied funding before shutdown is perp funding + expected Mark/Index decay
 * */
export async function getImpliedVolatilityShutdown(contract: Contract | null) {
  if (!contract) return 0
  const currIndex = await getIndex(1, contract)
  const currMark = await getMark(1, contract)
  if (currIndex.isEqualTo(0)) {
    return 0
  }
  // First part of funding is normal funding calc

  // // Second part of funding is Mark/Index decay
  const ethPrice = currIndex.dividedBy(BIG_ONE).sqrt()
  const normFactor = await getNormFactor(contract)
  const osqthPrice = Number(currMark.dividedBy(ethPrice).times(normFactor).dividedBy(BIG_ONE.times(INDEX_SCALE)))
  const ethVol = getSqueethImpliedVolatilityShutdown(ethPrice, normFactor, getDaysToShutdown(), osqthPrice)

  return ethVol
}

// Tries to get funding for the longest period available based on Uniswap storage slots, optimistically 24hrs, worst case spot
// TODO: get 24hr historical funding from the subgraph to have a value that isn't dynamic based on storage slots
export async function getDailyHistoricalFundingShutdown(contract: Contract | null) {
  if (!contract) return { period: 0, funding: 0 }
  let historicalIndex = BIG_ZERO
  let historicalMark = BIG_ZERO
  let period = 24
  let isError = false
  //start by trying 24hr twap, if fails try dividing by 2 until 45min minimum, fall back to spot otherwise
  for (; period >= 0.75; period = period / 2) {
    try {
      //convert period from hours to seconds
      historicalIndex = await getIndex(period * 3600, contract)
      historicalMark = await getMark(period * 3600, contract)
      isError = false
    } catch (error) {
      isError = true
    }
    if (isError === false) {
      break
    }
  }
  if (historicalIndex.isEqualTo(0) || historicalMark.isEqualTo(0)) {
    historicalIndex = await getIndex(1, contract)
    historicalMark = await getMark(1, contract)
  }

  if (historicalIndex.isEqualTo(0)) {
    return { period: 0, funding: 0 }
  }

  // First part of funding is normal funding calc
  const historicalFunding = Math.log(historicalMark.dividedBy(historicalIndex).toNumber()) / FUNDING_PERIOD

  // // Second part of funding is Mark/Index decay
  const ethPrice = historicalIndex.dividedBy(BIG_ONE).sqrt()

  const normFactor = await getNormFactor(contract)
  const osqthPrice = Number(historicalMark.dividedBy(ethPrice).times(normFactor).dividedBy(BIG_ONE.times(INDEX_SCALE)))

  const ethVol = getSqueethImpliedVolatilityShutdown(ethPrice, normFactor, getDaysToShutdown(), osqthPrice)

  const markIndexDecay =
    1 -
    Number(getSqueethPriceShutdown(ethPrice, normFactor, getDaysToShutdown() - 1, ethVol)) /
      Number(getSqueethPriceShutdown(ethPrice, normFactor, getDaysToShutdown(), ethVol))

  return { period: period, funding: historicalFunding + markIndexDecay }
}

export async function getOsqthRefVol() {
  const response = await fetch(`/api/currentsqueethvol`).then((res) => res.json())

  if (response.status === 'error') {
    console.log('Error fetching squeeth vol', response.status)
  }

  return response * 100
}
