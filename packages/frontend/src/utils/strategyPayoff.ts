import { FUNDING_PERIOD } from '@constants/index'
import BigNumber from 'bignumber.js'
import { calculateIV } from './calculations'

const getGreeks = (ethPrice: number, nf: number, shortAmt: number, collat: number, oSqthPrice: number) => {
  const iv = calculateIV(oSqthPrice, nf, ethPrice)
  const oSqthPriceInUSD = oSqthPrice * ethPrice

  const deltaPerOsqth = 2 * oSqthPrice
  const gammaPerOsqth = (2 * oSqthPrice) / ethPrice
  const vegaPerOsqth = 2 * iv * FUNDING_PERIOD * oSqthPriceInUSD
  const thetaPerOsqth = Math.pow(iv, 2) * oSqthPriceInUSD

  const deltaPortfolio = collat - shortAmt * deltaPerOsqth
  const gammaPortfolio = -shortAmt * gammaPerOsqth
  const vegaPortfolio = -shortAmt * vegaPerOsqth
  const thetaPortfolio = shortAmt * thetaPerOsqth

  return { deltaPortfolio, gammaPortfolio, vegaPortfolio, thetaPortfolio }
}

/**
 * Solve using quadratic formula
 * @param a - 0.5 * gammaPortfolio
 * @param b - deltaPortfolio
 * @param c - (thetaPortfolio * time) / 365
 */
const getProfitThresholds = (a: number, b: number, c: number) => {
  const thresholdLower = (-b + Math.sqrt(Math.pow(b, 2) - 4 * a * c)) / (2 * a)
  const thresholdUpper = (-b - Math.sqrt(Math.pow(b, 2) - 4 * a * c)) / (2 * a)

  return { thresholdLower, thresholdUpper }
}

export const getCrabProfitDataPoints = (
  ethPriceAtHedge: number,
  nf: number,
  shortAmt: number,
  collat: number,
  oSqthPrice: number,
  percentRange: number,
  currentEthPrice: number,
  time: number,
) => {
  const dataPoints: any = []
  const { deltaPortfolio, gammaPortfolio, vegaPortfolio, thetaPortfolio } = getGreeks(
    ethPriceAtHedge,
    nf,
    shortAmt,
    collat,
    oSqthPrice,
  )
  const portfolioValueInETH = collat - shortAmt * oSqthPrice
  const portfolioValueInUSD = portfolioValueInETH * ethPriceAtHedge

  const starting = new BigNumber(-percentRange)
  const increment = new BigNumber(0.05)
  const ending = new BigNumber(percentRange)

  const { thresholdLower, thresholdUpper } = getProfitThresholds(
    0.5 * gammaPortfolio,
    deltaPortfolio,
    (thetaPortfolio * time) / 365,
  )

  let current = starting

  const getData = (ethPrice: number) => {
    const ethPriceChange = ethPrice - ethPriceAtHedge
    const bumpedPortfolio =
      deltaPortfolio * ethPriceChange +
      0.5 * gammaPortfolio * Math.pow(ethPriceChange, 2) +
      (thetaPortfolio * time) / 365

    const bumpedPortfolioPercent = bumpedPortfolio / portfolioValueInUSD

    const strategyReturn = bumpedPortfolioPercent
    const strategyReturnPositive = strategyReturn >= 0 ? strategyReturn : null
    const strategyReturnNegative = strategyReturn < 0 ? strategyReturn : null

    return {
      ethPrice: ethPrice,
      strategyReturn,
      strategyReturnPositive,
      strategyReturnNegative,
    }
  }

  while (current.lte(ending)) {
    const ethReturn = current.div(100).toNumber()
    const ethPrice = ethPriceAtHedge + ethReturn * ethPriceAtHedge
    dataPoints.push(getData(ethPrice))
    current = current.plus(increment)
  }

  return {
    dataPoints,
    lowerPriceBandForProfitability: getData(ethPriceAtHedge + thresholdLower),
    upperPriceBandForProfitability: getData(ethPriceAtHedge + thresholdUpper),
    currentProfit: getData(currentEthPrice),
  }
}

export const getBullProfitDataPoints = (
  ethPriceAtHedge: number,
  nf: number,
  shortAmt: number,
  collat: number,
  oSqthPrice: number,
  percentRange: number,
  currentEthPrice: number,
  time: number,
  eulerEth: number,
  ethSupplyApy: number,
  eulerUsdc: number,
  usdcBorrowApy: number,
) => {
  const dataPoints: any = []
  const { deltaPortfolio, gammaPortfolio, vegaPortfolio, thetaPortfolio } = getGreeks(
    ethPriceAtHedge,
    nf,
    shortAmt,
    collat,
    oSqthPrice,
  )
  const bullEthValue = eulerEth - eulerUsdc / ethPriceAtHedge + collat - shortAmt * oSqthPrice
  const bullExcessEth = eulerEth - bullEthValue
  collat = collat + bullExcessEth

  const portfolioValueInETH = collat - shortAmt * oSqthPrice
  const portfolioValueInUSD = portfolioValueInETH * ethPriceAtHedge

  const starting = new BigNumber(-percentRange)
  const increment = new BigNumber(0.05)
  const ending = new BigNumber(percentRange)

  const ethRate = Math.exp(ethSupplyApy / (365 / time))
  const usdRate = Math.exp(usdcBorrowApy / (365 / time))
  const ethReturns = eulerEth * ethRate - eulerEth
  const usdReturns = eulerUsdc * usdRate - eulerUsdc

  const { thresholdLower, thresholdUpper } = getProfitThresholds(
    0.5 * gammaPortfolio,
    deltaPortfolio + ethReturns,
    (thetaPortfolio * time) / 365 + ethReturns * ethPriceAtHedge - usdReturns,
  )

  let current = starting

  const getData = (ethPrice: number) => {
    const ethPriceChange = ethPrice - ethPriceAtHedge

    const eulerRateReturns = ethReturns * ethPrice - usdReturns

    const bumpedPortfolio =
      deltaPortfolio * ethPriceChange +
      0.5 * gammaPortfolio * Math.pow(ethPriceChange, 2) +
      (thetaPortfolio * time) / 365 +
      eulerRateReturns

    const bumpedPortfolioPercent = bumpedPortfolio / portfolioValueInUSD

    const strategyReturn = bumpedPortfolioPercent
    const strategyReturnPositive = strategyReturn >= 0 ? strategyReturn : null
    const strategyReturnNegative = strategyReturn < 0 ? strategyReturn : null

    return {
      ethPrice: ethPrice,
      strategyReturn,
      strategyReturnPositive,
      strategyReturnNegative,
    }
  }

  while (current.lte(ending)) {
    const ethReturn = current.div(100).toNumber()
    const ethPrice = ethPriceAtHedge + ethReturn * ethPriceAtHedge
    dataPoints.push(getData(ethPrice))
    current = current.plus(increment)
  }

  return {
    dataPoints,
    lowerPriceBandForProfitability: getData(ethPriceAtHedge + thresholdLower),
    upperPriceBandForProfitability: getData(ethPriceAtHedge + thresholdUpper),
    currentProfit: getData(currentEthPrice),
  }
}
