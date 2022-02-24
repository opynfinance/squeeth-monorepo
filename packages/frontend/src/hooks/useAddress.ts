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
import { networkIdAtom, useWallet } from '@context/wallet'
import { atom } from 'jotai'

// @ts-ignore
export const oSqueethAtom = atom((get: any) => OSQUEETH[get(networkIdAtom)])
// @ts-ignore
export const wethAtom = atom((get: any) => WETH[get(networkIdAtom)])


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
      crabStrategy: CRAB_STRATEGY[networkId],
    }),
    [networkId],
  )

  return state
}

export { useAddresses }
