import { atom } from 'jotai'

import { PositionType } from '../../types'
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
} from '@constants/address'
import { networkIdAtom } from '../wallet/atoms'

export const positionTypeAtom = atom(PositionType.NONE)
export const firstValidVaultAtom = atom(0)
export const addressesAtom = atom((get) => {
  const networkId = get(networkIdAtom)
  return {
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
  }
})

export const isWethToken0Atom = atom((get) => {
  const addresses = get(addressesAtom)
  return parseInt(addresses.weth, 16) < parseInt(addresses.oSqueeth, 16)
})
