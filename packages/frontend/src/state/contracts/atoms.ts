import { atom } from 'jotai'
import { Contract } from 'web3-eth-contract'

import { getContract } from '@utils/getContract'
import controllerAbi from '../../abis/controller.json'
import crabStrategyAbi from '../../abis/crabStrategy.json'
import positionManagerAbi from '../../abis/NFTpositionmanager.json'
import routerABI from '../../abis/swapRouter.json'
import uniABI from '../../abis/uniswapPool.json'
import shortAbi from '../../abis/shortHelper.json'
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

export const nftManagerContractAtom = atom<Contract | null>((get) => {
  const web3 = get(web3Atom)
  const { crabStrategy } = get(addressesAtom)
  if (!web3) return null
  return getContract(web3, crabStrategy, positionManagerAbi)
})

export const swapRouterContractAtom = atom<Contract | null>((get) => {
  const web3 = get(web3Atom)
  const { swapRouter } = get(addressesAtom)
  if (!web3) return null
  return getContract(web3, swapRouter, routerABI)
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
