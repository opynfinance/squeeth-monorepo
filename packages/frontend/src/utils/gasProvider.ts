import {
  ChainId,
  EIP1559GasPriceProvider,
  CachingGasStationProvider,
  OnChainGasPriceProvider,
  LegacyGasPriceProvider,
  GasPrice,
  NodeJSCache,
} from '@uniswap/smart-order-router'
import { JsonRpcProvider } from '@ethersproject/providers'
import NodeCache from 'node-cache'

const gasPriceProviderMap = new Map()

export const getGasPriceProvider = (chainId: ChainId) => {
  if (gasPriceProviderMap.has(chainId)) {
    return gasPriceProviderMap.get(chainId)
  }

  const gasPriceCache = new NodeJSCache<GasPrice>(new NodeCache({ stdTTL: 15, useClones: true }))
  const connectionUrl = `https://eth-mainnet.alchemyapi.io/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`
  const jsonRpcProvider = new JsonRpcProvider(connectionUrl, chainId)

  const gasPriceProvider = new CachingGasStationProvider(
    chainId,
    new OnChainGasPriceProvider(
      chainId,
      new EIP1559GasPriceProvider(jsonRpcProvider as any),
      new LegacyGasPriceProvider(jsonRpcProvider as any),
    ),
    gasPriceCache,
  )

  gasPriceProviderMap.set(chainId, gasPriceProvider)

  return gasPriceProvider
}
