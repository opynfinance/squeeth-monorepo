import BigNumber from 'bignumber.js'
import { useEffect, useState } from 'react'
import { Contract } from 'web3-eth-contract'

import abi from '../../abis/controller.json'
import { Vaults, WSQUEETH_DECIMALS } from '../../constants'
import { useWallet } from '../../context/wallet'
import { Vault } from '../../types'
import { fromTokenAmount, toTokenAmount } from '../../utils/calculations'
import { useAddresses } from '../useAddress'
import { useOracle } from './useOracle'

const getMultiplier = (type: Vaults) => {
  if (type === Vaults.ETHBull) return 3
  if (type === Vaults.CrabVault) return 2

  return 1
}

export const useController = () => {
  const { web3, address, handleTransaction } = useWallet()
  const [contract, setContract] = useState<Contract>()
  const [normFactor, setNormFactor] = useState(new BigNumber(1))
  const [fundingPerDay, setFundingPerDay] = useState(0)
  const { controller, ethDaiPool, weth, dai } = useAddresses()
  const { getTwapSafe } = useOracle()

  useEffect(() => {
    if (!web3) return
    setContract(new web3.eth.Contract(abi as any, controller))
    const controllerContract = new web3.eth.Contract(abi as any, controller)
    controllerContract.methods
      .normalizationFactor()
      .call()
      .then((normFactor: any) => {
        setNormFactor(toTokenAmount(new BigNumber(normFactor.toString()), 18))
      })
      .catch(() => {
        console.log('normFactor error')
      })
  }, [controller, web3])

  useEffect(() => {
    if (!contract) return
    getFundingForDay().then(setFundingPerDay)
  }, [address, contract])

  /**
   *
   * @param vaultId - 0 to create new
   * @param amount - Amount of squeeth to mint
   * @param vaultType
   * @returns
   */
  const openDepositAndMint = (vaultId: number, amount: BigNumber, vaultType: Vaults) => {
    if (!contract || !address) return

    const _amount = fromTokenAmount(amount, 18)
    handleTransaction(
      contract.methods.mint(vaultId, _amount.toString(), 0).send({
        from: address,
        value: _amount.multipliedBy(getMultiplier(vaultType)).multipliedBy(10000),
      }),
    )
  }

  /**
   * Authorize an address to modify the vault
   * @param vaultId
   * @param operator
   */
  const updateOperator = async (vaultId: number, operator: string) => {
    if (!contract || !address) return

    await handleTransaction(
      contract.methods.updateOperator(vaultId, operator).send({
        from: address,
      }),
    )
  }

  const getVault = async (vaultId: number): Promise<Vault | null> => {
    if (!contract) return null

    const vault = await contract.methods.vaults(vaultId).call()
    const { NFTCollateralId, collateralAmount, shortAmount, operator } = vault

    return {
      id: vaultId,
      NFTCollateralId,
      collateralAmount: toTokenAmount(new BigNumber(collateralAmount), 18),
      shortAmount: toTokenAmount(new BigNumber(shortAmount), WSQUEETH_DECIMALS),
      operator,
    }
  }

  const getIndex = async (period: number) => {
    if (!contract) return new BigNumber(0)

    const indexPrice = await contract.methods.getIndex(period.toString()).call()
    return new BigNumber(indexPrice)
  }

  const getMark = async (period: number) => {
    if (!contract) return new BigNumber(0)

    const markPrice = await contract.methods.getDenormalizedMark(period.toString()).call()
    return new BigNumber(markPrice)
  }

  const getFundingForDay = async () => {
    let index
    let mark
    try {
      index = await getIndex(86400)
      mark = await getMark(86400)
    } catch (error) {
      index = await getIndex(1)
      mark = await getMark(1)
    }

    const nF = mark.dividedBy(mark.multipliedBy(2).minus(index))
    return 1 - nF.toNumber()
  }

  const getDebtAmount = async (shortAmount: BigNumber) => {
    if (!contract) return new BigNumber(0)

    const ethDaiPrice = await getTwapSafe(ethDaiPool, weth, dai, 3000)
    const _shortAmt = fromTokenAmount(shortAmount, WSQUEETH_DECIMALS)
    const ethDebt = new BigNumber(_shortAmt).multipliedBy(normFactor).multipliedBy(ethDaiPrice)
    return toTokenAmount(ethDebt, 18)
  }

  const getShortAmountFromDebt = async (debtAmount: BigNumber) => {
    if (!contract) return new BigNumber(0)

    const ethDaiPrice = await getTwapSafe(ethDaiPool, weth, dai, 3000)
    const shortAmount = fromTokenAmount(debtAmount, 18).div(normFactor).div(ethDaiPrice)
    return toTokenAmount(shortAmount.toFixed(0), WSQUEETH_DECIMALS)
  }

  return {
    openDepositAndMint,
    getVault,
    updateOperator,
    normFactor,
    fundingPerDay,
    getDebtAmount,
    getShortAmountFromDebt,
  }
}
