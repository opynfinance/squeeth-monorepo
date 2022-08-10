import BigNumber from 'bignumber.js'
import { Contract } from 'web3-eth-contract'
import { Position } from '@uniswap/v3-sdk'
import fzero from 'fzero'

import { BIG_ZERO, OSQUEETH_DECIMALS } from '../../constants'
import { toTokenAmount } from '@utils/calculations'
import { Vault } from '../../types'
import { FUNDING_PERIOD, INDEX_SCALE } from '../../constants'
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
