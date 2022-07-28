import { Contract } from 'web3-eth-contract'
import BigNumber from 'bignumber.js'
import { fromTokenAmount, toTokenAmount } from '@utils/calculations'
import { Vault } from '../../types'
import { YEAR } from '../../constants'

export const checkTimeHedge = async (contract: Contract | null) => {
  if (!contract) return null

  const result = await contract.methods.checkTimeHedge().call()
  return result
}

export const checkPriceHedge = async (auctionTriggerTime: number, contract: Contract | null) => {
  if (!contract) return null

  const result = await contract.methods.checkPriceHedge(auctionTriggerTime).call()
  return result
}

export const checkPriceHedgeV2 = async (contract: Contract | null) => {
  if (!contract) return null

  const result = await contract.methods.checkPriceHedge().call()
  return result
}

export const getCollateralFromCrabAmount = async (
  crabAmount: BigNumber,
  contract: Contract | null,
  vault: Vault | null,
) => {
  if (!contract || !vault) return null

  const totalSupply = toTokenAmount(await contract.methods.totalSupply().call(), 18)
  return vault.collateralAmount.times(crabAmount).div(totalSupply)
}

export const getCurrentProfitableMovePercentV2 = (currentImpliedVol: number) => {
  // Approximating a hedge every 2 days, take the vol divided by the sqrt of # of periods
  // In this case 365 / 2 = 182.5
  return currentImpliedVol / Math.sqrt(YEAR / 2)
}

export const getCurrentProfitableMovePercent = (currentImpliedFunding: number) => {
  return Math.sqrt(currentImpliedFunding)
}

export const getMaxCap = async (contract: Contract | null) => {
  if (!contract) return new BigNumber(0)

  const cap = await contract.methods.strategyCap().call()
  return toTokenAmount(cap, 18)
}

export const getStrategyVaultId = async (contract: Contract | null) => {
  if (!contract) return 0

  const _vaultId = await contract.methods.getStrategyVaultId().call()
  return Number(_vaultId.toString())
}

export const getTimeAtLastHedge = async (contract: Contract | null) => {
  if (!contract) return null

  const result = await contract.methods.timeAtLastHedge().call()
  return result
}

export const getWsqueethFromCrabAmount = async (crabAmount: BigNumber, contract: Contract | null) => {
  if (!contract) return null

  const result = await contract.methods.getWsqueethFromCrabAmount(fromTokenAmount(crabAmount, 18).toFixed(0)).call()
  return toTokenAmount(result.toString(), 18)
}

export const setStrategyCap = async (amount: BigNumber, contract: Contract | null, address: string | null) => {
  if (!contract) return

  const crabAmount = fromTokenAmount(amount, 18)
  return contract.methods.setStrategyCap(crabAmount.toFixed(0)).send({
    from: address,
  })
}
