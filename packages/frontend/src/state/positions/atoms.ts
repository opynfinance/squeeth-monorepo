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
import { accounts_accounts } from '@queries/squeeth/__generated__/accounts'
import BigNumber from 'bignumber.js'

export const positionTypeAtom = atom(PositionType.NONE)
export const isLongAtom = atom((get) => {
  const positionType = get(positionTypeAtom)
  return positionType === PositionType.LONG
})
export const isShortAtom = atom((get) => {
  const positionType = get(positionTypeAtom)
  return positionType === PositionType.SHORT
})
export const firstValidVaultAtom = atom(0)
export const addressesAtom = atom((get) => {
  const networkId = get(networkIdAtom)
  return {
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
export const squeethLiquidityAtom = atom(BIG_ZERO)
export const wethLiquidityAtom = atom(BIG_ZERO)
export const depositedSqueethAtom = atom(BIG_ZERO)
export const depositedWethAtom = atom(BIG_ZERO)
export const withdrawnSqueethAtom = atom(BIG_ZERO)
export const withdrawnWethAtom = atom(BIG_ZERO)
export const isLPAtom = atom((get) => {
  const squeethLiquidity = get(squeethLiquidityAtom)
  const wethLiquidity = get(wethLiquidityAtom)
  return squeethLiquidity.gt(0) || wethLiquidity.gt(0)
})

export const vaultAtom = atom<Vault | null>(null)
export const existingCollatPercentAtom = atom(0)
export const existingCollatAtom = atom(BIG_ZERO)
export const existingLiqPriceAtom = atom(BIG_ZERO)
export const collatPercentAtom = atom(0)
export const isVaultLoadingAtom = atom(true)
export const vaultHistoryUpdatingAtom = atom(false)
export const isToHidePnLAtom = atom(false)
export const longPositionValueAtom = atom(BIG_ZERO)
export const shortPositionValueAtom = atom(BIG_ZERO)

export const initPosition = {
  currentOSQTHAmount: new BigNumber(0),
  currentETHAmount: new BigNumber(0),
  unrealizedOSQTHUnitCost: new BigNumber(0),
  unrealizedETHUnitCost: new BigNumber(0),
  realizedOSQTHUnitCost: new BigNumber(0),
  realizedETHUnitCost: new BigNumber(0),
  realizedOSQTHUnitGain: new BigNumber(0),
  realizedETHUnitGain: new BigNumber(0),
  realizedOSQTHAmount: new BigNumber(0),
  realizedETHAmount: new BigNumber(0),
}

export const accountAtom = atom<accounts_accounts[] | undefined>(undefined)

export const positionAtom = atom<any>(initPosition)
export const lpPositionAtom = atom<any>(initPosition)
export const accShortAmountAtom = atom(BIG_ZERO)
export const calculatedPositionAtom = atom({
  currentPositionValue: BIG_ZERO,
  currentETHAmount: BIG_ZERO,
  currentOSQTHAmount: BIG_ZERO,
  unrealizedPnL: BIG_ZERO,
  unrealizedPnLInPerct: BIG_ZERO,
  realizedPnL: BIG_ZERO,
  realizedPnLInPerct: BIG_ZERO,
})

export const calculatedLPPositionAtom = atom({
  lpedPositionValue: BIG_ZERO,
  lpedETHAmount: BIG_ZERO,
  lpedoSQTHAmount: BIG_ZERO,
  lpUnrealizedPnL: BIG_ZERO,
  lpUnrealizedPnLInPerct: BIG_ZERO,
  lpRealizedPnL: BIG_ZERO,
  lpRealizedPnLInPerct: BIG_ZERO,
})
