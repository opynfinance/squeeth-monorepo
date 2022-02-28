import { atom } from 'jotai'

import { PositionType, Vault } from '../../types'
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
import { networkIdAtom, web3Atom } from '../wallet/atoms'
import { BIG_ZERO } from '@constants/index'
import NFTpositionManagerABI from '../../abis/NFTpositionmanager.json'

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

export const managerAtom = atom((get) => {
  const { nftManager } = get(addressesAtom)
  const web3 = get(web3Atom)
  return new web3.eth.Contract(NFTpositionManagerABI as any, nftManager?.toLowerCase() || '')
})
export const activePositionsAtom = atom<any[]>([])
export const closedPositionsAtom = atom<any[]>([])
export const lpPositionsLoadingAtom = atom(false)
export const squeethLiquidityAtom = atom(BIG_ZERO)
export const wethLiquidityAtom = atom(BIG_ZERO)
export const depositedSqueethAtom = atom(BIG_ZERO)
export const depositedWethAtom = atom(BIG_ZERO)
export const withdrawnSqueethAtom = atom(BIG_ZERO)
export const withdrawnWethAtom = atom(BIG_ZERO)

export const vaultAtom = atom<Vault | null>(null)
export const existingCollatPercentAtom = atom(0)
export const existingCollatAtom = atom(BIG_ZERO)
export const existingLiqPriceAtom = atom(BIG_ZERO)
export const collatPercentAtom = atom(0)
export const isVaultLoadingAtom = atom(true)
