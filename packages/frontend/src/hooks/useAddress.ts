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
} from '../constants/address'
import { useWallet } from '@context/wallet'

const useAddresses = () => {
  const { networkId } = useWallet()

  const state = useMemo(
    () => ({
      zero: ZERO_ADDR,
      controller: CONTROLLER[networkId],
      vaultManager: VAULT_MANAGER[networkId],
      oSqueeth: OSQUEETH[networkId],
      weth: WETH[networkId],
      swapRouter: SWAP_ROUTER[networkId],
      squeethPool: SQUEETH_UNI_POOL[networkId],
      quoter: QUOTER[networkId],
      shortHelper: SHORT_HELPER[networkId],
      oracle: ORACLE[networkId],
      ethUsdcPool: ETH_USDC_POOL[networkId],
      usdc: USDC[networkId],
      nftManager: NFT_MANAGER[networkId],
    }),
    [networkId],
  )

  return state
}

export { useAddresses }
