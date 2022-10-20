import { atom } from 'jotai'
import { Contract } from 'web3-eth-contract'

import { getContract } from '@utils/getContract'
import controllerAbi from '../../abis/controller.json'
import controllerHelperAbi from '../../abis/controllerHelper.json'
import crabStrategyAbi from '../../abis/crabStrategy.json'
import crabStrategyV2Abi from '../../abis/crabStrategyV2.json'
import positionManagerAbi from '../../abis/NFTpositionmanager.json'
import routerABI from '../../abis/swapRouter.json'
import uniABI from '../../abis/uniswapPool.json'
import shortAbi from '../../abis/shortHelper.json'
import crabMigrationAbi from '../../abis/crabMigration.json'
import quoterAbi from '../../abis/quoter.json'
import crabHelperAbi from '../../abis/crabHelper.json'
import { addressesAtom } from '../positions/atoms'
import { web3Atom } from '../wallet/atoms'

export const controllerContractAtom = atom<Contract | null>((get) => {
  const web3 = get(web3Atom)
  const { controller } = get(addressesAtom)
  if (!web3) return null
  return getContract(web3, controller, controllerAbi)
})

export const crabStrategyContractAtom = atom<Contract | null>((get) => {
  const web3 = get(web3Atom)
  const { crabStrategy } = get(addressesAtom)
  if (!web3) return null
  return getContract(web3, crabStrategy, crabStrategyAbi)
})

export const crabStrategyContractAtomV2 = atom<Contract | null>((get) => {
  const web3 = get(web3Atom)
  const { crabStrategy2 } = get(addressesAtom)
  if (!web3) return null
  return getContract(web3, crabStrategy2, crabStrategyV2Abi)
})

export const nftManagerContractAtom = atom<Contract | null>((get) => {
  const web3 = get(web3Atom)
  const { nftManager } = get(addressesAtom)
  if (!web3) return null
  return getContract(web3, nftManager, positionManagerAbi)
})

export const quoterContractAtom = atom<Contract | null>((get) => {
  const web3 = get(web3Atom)
  const { quoter } = get(addressesAtom)
  if (!web3) return null
  return getContract(web3, quoter, quoterAbi)
})

export const swapRouterContractAtom = atom<Contract | null>((get) => {
  const web3 = get(web3Atom)
  const { swapRouter } = get(addressesAtom)
  if (!web3) return null
  return getContract(web3, swapRouter, routerABI)
})

export const swapRouter2ContractAtom = atom<Contract | null>((get) => {
  const web3 = get(web3Atom)
  const { swapRouter2 } = get(addressesAtom)
  if (!web3) return null
  return getContract(web3, swapRouter2, routerABI)
})

export const squeethPoolContractAtom = atom<Contract | null>((get) => {
  const web3 = get(web3Atom)
  const { squeethPool } = get(addressesAtom)
  if (!web3) return null
  return getContract(web3, squeethPool, uniABI)
})

export const shortHelperContractAtom = atom<Contract | null>((get) => {
  const web3 = get(web3Atom)
  const { shortHelper } = get(addressesAtom)
  if (!web3) return null
  return getContract(web3, shortHelper, shortAbi)
})

export const crabMigrationContractAtom = atom<Contract | null>((get) => {
  const web3 = get(web3Atom)
  const { crabMigration } = get(addressesAtom)
  if (!web3) return null
  return getContract(web3, crabMigration, crabMigrationAbi)
})

export const controllerHelperHelperContractAtom = atom<Contract | null>((get) => {
  const web3 = get(web3Atom)
  const { controllerHelper } = get(addressesAtom)
  if (!web3) return null
  return getContract(web3, controllerHelper, controllerHelperAbi)
})

export const crabHelperContractAtom = atom<Contract | null>((get) => {
  const web3 = get(web3Atom)
  const { crabHelper } = get(addressesAtom)
  if (!web3) return null
  return getContract(web3, crabHelper, crabHelperAbi)
})
