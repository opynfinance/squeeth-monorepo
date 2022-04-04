import { ETH_USDC_POOL, SQUEETH_UNI_POOL, UNI_V3_FACTORY } from '@constants/address'
import { Contract } from 'web3-eth-contract'
import { Token } from '@uniswap/sdk-core'
import Web3 from 'web3'
import { IV3PoolProvider, V3PoolAccessor } from '@uniswap/smart-order-router'
import { ProviderConfig } from '@uniswap/smart-order-router/build/main/src/providers/provider'
import { computePoolAddress, FeeAmount, Pool } from '@uniswap/v3-sdk'
import BigNumber from 'bignumber.js'
import _ from 'lodash'
import { getPoolState } from 'src/state/squeethPool/utils'
import { getContract } from './getContract'
import uniABI from '../abis/uniswapPool.json'

type PoolsData = {
  sqrtPriceX96: BigNumber
  tick: number
  observationIndex: number
  observationCardinality: number
  observationCardinalityNext: number
  feeProtocol: number
  unlocked: boolean
  liquidity: BigNumber
}

const poolToString = (p: Pool): string => {
  return `${p.token0.symbol}/${p.token1.symbol}${p instanceof Pool ? `/${p.fee / 10000}%` : ``}`
}

export class V3PoolProvider implements IV3PoolProvider {
  // Computing pool addresses is slow as it requires hashing, encoding etc.
  // Addresses never change so can always be cached.
  private POOL_ADDRESS_CACHE: { [key: string]: string } = {}
  private web3: Web3

  constructor(web3: Web3) {
    this.web3 = web3
  }

  public async getPools(
    tokenPairs: [Token, Token, FeeAmount][],
    providerConfig?: ProviderConfig,
  ): Promise<V3PoolAccessor> {
    const poolAddressSet: Set<string> = new Set<string>()
    const sortedTokenPairs: Array<[Token, Token, FeeAmount]> = []
    const sortedPoolAddresses: string[] = []

    for (const tokenPair of tokenPairs) {
      const [tokenA, tokenB, feeAmount] = tokenPair

      console.log(tokenA?.symbol, tokenB?.symbol, feeAmount)
      const { poolAddress, token0, token1 } = this.getPoolAddress(tokenA, tokenB, feeAmount)

      if (poolAddressSet.has(poolAddress)) {
        continue
      }

      poolAddressSet.add(poolAddress)
      sortedTokenPairs.push([token0, token1, feeAmount])
      sortedPoolAddresses.push(poolAddress)
    }

    console.debug(`getPools called with ${tokenPairs.length} token pairs. Deduped down to ${poolAddressSet.size}`)

    const poolsData = await this.getPoolsData(sortedPoolAddresses)

    console.info(`Got liquidity and slot0s for ${poolAddressSet.size} pools `)

    const poolAddressToPool: { [poolAddress: string]: Pool } = {}

    const invalidPools: [Token, Token, FeeAmount][] = []

    for (let i = 0; i < sortedPoolAddresses.length; i++) {
      const poolData = poolsData[i]

      // These properties tell us if a pool is valid and initialized or not.
      if (!poolData || poolData.sqrtPriceX96.toString() === '0') {
        const [token0, token1, fee] = sortedTokenPairs[i]!
        invalidPools.push([token0, token1, fee])

        continue
      }

      const [token0, token1, fee] = sortedTokenPairs[i]!
      const { liquidity } = poolData

      const pool = new Pool(
        token0,
        token1,
        fee,
        poolData.sqrtPriceX96.toString(),
        liquidity.toString(),
        Number(poolData.tick),
      )

      const poolAddress = sortedPoolAddresses[i]!

      poolAddressToPool[poolAddress] = pool
    }

    if (invalidPools.length > 0) {
      console.info(
        {
          invalidPools: _.map(
            invalidPools,
            ([token0, token1, fee]) => `${token0.symbol}/${token1.symbol}/${fee / 10000}%`,
          ),
        },
        `${invalidPools.length} pools invalid after checking their slot0 and liquidity results. Dropping.`,
      )
    }

    const poolStrs = _.map(Object.values(poolAddressToPool), poolToString)

    console.debug({ poolStrs }, `Found ${poolStrs.length} valid pools`)

    return {
      getPool: (tokenA: Token, tokenB: Token, feeAmount: FeeAmount): Pool | undefined => {
        const { poolAddress } = this.getPoolAddress(tokenA, tokenB, feeAmount)
        return poolAddressToPool[poolAddress]
      },
      getPoolByAddress: (address: string): Pool | undefined => poolAddressToPool[address],
      getAllPools: (): Pool[] => Object.values(poolAddressToPool),
    }
  }

  public getPoolAddress(
    tokenA: Token,
    tokenB: Token,
    feeAmount: FeeAmount,
  ): { poolAddress: string; token0: Token; token1: Token } {
    const [token0, token1] = tokenA.sortsBefore(tokenB) ? [tokenA, tokenB] : [tokenB, tokenA]

    const cacheKey = `${token0.address}/${token1.address}/${feeAmount}`

    const cachedAddress = this.POOL_ADDRESS_CACHE[cacheKey]

    if (cachedAddress) {
      return { poolAddress: cachedAddress, token0, token1 }
    }

    const poolAddress = computePoolAddress({
      factoryAddress: UNI_V3_FACTORY[3],
      tokenA: token0,
      tokenB: token1,
      fee: feeAmount,
    })

    this.POOL_ADDRESS_CACHE[cacheKey] = poolAddress

    return { poolAddress, token0, token1 }
  }

  private async getPoolsData(poolAddresses: string[]): Promise<Array<PoolsData | null>> {
    const results = poolAddresses.map(async (addr) => {
      if (addr.toLowerCase() === SQUEETH_UNI_POOL[3].toLowerCase()) {
        const contract = getContract(this.web3, addr.toLowerCase(), uniABI)
        return getPoolState(contract)
      } else if (addr === '0x55A3196822567cF75bc6ACce12Cad03E66B40DCE') {
        const contract = getContract(this.web3, ETH_USDC_POOL[3], uniABI)
        return getPoolState(contract)
      }

      return null
    })
    const actualResults = await Promise.all(results)
    console.log(poolAddresses, actualResults)
    return actualResults
  }
}
