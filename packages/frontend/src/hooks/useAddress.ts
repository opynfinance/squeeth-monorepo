import { useMemo } from 'react'

import {
  CONTROLLER,
  USDC,
  ETH_USDC_POOL,
  NFT_MANAGER,
  ORACLE,
  QUOTER,
  SHORT_HELPER,
  SQUEETH_UNI_POOL,
  SWAP_ROUTER,
  VAULT_MANAGER,
  WETH,
  OSQUEETH,
  ZERO_ADDR,
  CRAB_STRATEGY,
} from '../constants/address'
// import { useWallet } from '@context/wallet'
import { useAtomValue } from 'jotai'
import { networkIdAtom } from 'src/state/wallet/atoms'

const useAddresses = () => {
  // const { networkId } = useWallet()
  const networkId = useAtomValue(networkIdAtom)

  const state = useMemo(
    () => ({
      zero: ZERO_ADDR.toLowerCase(),
      controller: CONTROLLER[networkId].toLowerCase(),
      vaultManager: VAULT_MANAGER[networkId].toLowerCase(),
      oSqueeth: OSQUEETH[networkId].toLowerCase(),
      weth: WETH[networkId].toLowerCase(),
      swapRouter: SWAP_ROUTER[networkId].toLowerCase(),
      squeethPool: SQUEETH_UNI_POOL[networkId].toLowerCase(),
      quoter: QUOTER[networkId].toLowerCase(),
      shortHelper: SHORT_HELPER[networkId].toLowerCase(),
      oracle: ORACLE[networkId].toLowerCase(),
      ethUsdcPool: ETH_USDC_POOL[networkId].toLowerCase(),
      usdc: USDC[networkId].toLowerCase(),
      nftManager: NFT_MANAGER[networkId].toLowerCase(),
      crabStrategy: CRAB_STRATEGY[networkId].toLowerCase(),
    }),
    [networkId],
  )

  return state
}

export { useAddresses }
