import BigNumber from 'bignumber.js'
import { useEffect, useState } from 'react'
import { Contract } from 'web3-eth-contract'

import abi from '../../abis/controller.json'
import { Vaults } from '../../constants'
import { useWallet } from '../../context/wallet'
import { Vault } from '../../types'
import { fromTokenAmount, toTokenAmount } from '../../utils/calculations'
import { useAddresses } from '../useAddress'

const getMultiplier = (type: Vaults) => {
  if (type === Vaults.ETHBull) return 3
  if (type === Vaults.CrabVault) return 2

  return 1
}

export const useController = () => {
  const { web3, address } = useWallet()
  const [contract, setContract] = useState<Contract>()
  const { controller } = useAddresses()

  useEffect(() => {
    if (!web3) return
    setContract(new web3.eth.Contract(abi as any, controller))
  }, [web3])

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
    contract.methods
      .mint(vaultId, _amount.toString())
      .send({
        from: address,
        value: _amount.multipliedBy(getMultiplier(vaultType)),
      })
      .then(console.log)
  }

  const getVault = async (vaultId: number): Promise<Vault | null> => {
    if (!contract) return null

    const { NFTCollateralId, collateralAmount, shortAmount } = await contract.methods.vaults(vaultId).call()
    return {
      id: vaultId,
      NFTCollateralId,
      collateralAmount: toTokenAmount(new BigNumber(collateralAmount), 18),
      shortAmount: toTokenAmount(new BigNumber(shortAmount), 18),
    }
  }

  return {
    openDepositAndMint,
    getVault,
  }
}
